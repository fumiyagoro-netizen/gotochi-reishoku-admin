import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

/**
 * Receives Resend's delivery-event webhooks (email.delivered / email.bounced
 * / email.complained) and attaches the result to the EmailLog row that
 * produced the message, matched by Resend's message id (EmailLog.messageId).
 *
 * Security: this route is listed in src/lib/public-paths.ts so middleware
 * lets it through without a session cookie (Resend has no session — it
 * calls this route directly), but it is NOT open to arbitrary callers.
 * Every request's Svix signature is verified against RESEND_WEBHOOK_SECRET
 * before anything in the payload is trusted or written to the database.
 * There is deliberately no hardcoded fallback secret (see the same
 * reasoning in src/lib/auth-core.ts's getJwtSecret()): a missing env var
 * must fail closed, not silently accept unverifiable events.
 *
 * Resend retries webhook delivery on any non-2xx response, so every branch
 * below that has successfully verified the signature returns 200 — even for
 * events we don't act on (e.g. a messageId with no matching row, or an
 * out-of-scope event type like email.opened) — to avoid triggering repeated
 * redelivery for something we're never going to handle differently.
 */

interface ResendBounceDetail {
  type?: string;
  subType?: string;
  message?: string;
}

interface ResendWebhookEvent {
  type?: string;
  data?: {
    email_id?: string;
    bounce?: ResendBounceDetail;
    [key: string]: unknown;
  };
}

// Renders Resend's bounce object (type / subType / message) into the single
// bounceReason string stored on EmailLog, e.g.
// "Permanent / Suppressed: The recipient's email address is on the
// suppression list...". Falls back gracefully if any part is missing.
function formatBounceReason(bounce: ResendBounceDetail | undefined): string {
  if (!bounce) return "";
  const classification = [bounce.type, bounce.subType].filter(Boolean).join(" / ");
  if (bounce.message) {
    return classification ? `${classification}: ${bounce.message}` : bounce.message;
  }
  return classification;
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RESEND_WEBHOOK_SECRET is not set — refusing to accept webhook events.");
    return NextResponse.json(
      { success: false, message: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Signature verification needs the exact bytes Resend signed. Reading
  // request.json() first (which internally consumes+reparses the body)
  // would make verification fail, so we read text first and JSON.parse only
  // after verify() succeeds.
  const rawBody = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { success: false, message: "Missing Svix signature headers" },
      { status: 400 }
    );
  }

  let event: ResendWebhookEvent;
  try {
    const webhook = new Webhook(secret);
    event = webhook.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookEvent;
  } catch (error) {
    console.error("Resend webhook signature verification failed:", error);
    return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 401 });
  }

  const messageId = event.data?.email_id;
  if (!messageId) {
    // No id to match against (shouldn't happen for the event types below,
    // but fail soft rather than error on an unexpected payload shape).
    return NextResponse.json({ success: true });
  }

  try {
    switch (event.type) {
      case "email.delivered":
        // updateMany (not update) so a messageId with no matching row —
        // e.g. an event for a send that predates this column, or one we
        // never logged — is a no-op instead of a thrown "record not found".
        await prisma.emailLog.updateMany({
          where: { messageId },
          data: { deliveredAt: new Date() },
        });
        break;

      case "email.bounced":
        await prisma.emailLog.updateMany({
          where: { messageId },
          data: {
            bouncedAt: new Date(),
            bounceReason: formatBounceReason(event.data?.bounce),
          },
        });
        break;

      case "email.complained":
        await prisma.emailLog.updateMany({
          where: { messageId },
          data: { complainedAt: new Date() },
        });
        break;

      // email.opened / email.clicked (open/click tracking) are explicitly
      // out of scope for this feature — accepted and ignored, not errored.
      // Any other event type (email.sent, email.delivery_delayed, etc.) is
      // likewise ignored rather than treated as an error.
      default:
        break;
    }
  } catch (error) {
    console.error("Resend webhook processing error:", error);
    // Still acknowledge with 200: the signature was valid, so this is our
    // own DB error, not a bad request — returning non-2xx here would just
    // make Resend retry the same event indefinitely.
  }

  return NextResponse.json({ success: true });
}
