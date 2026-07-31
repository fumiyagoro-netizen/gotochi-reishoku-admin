/** Core auth utilities - Edge-compatible (no jsonwebtoken) */
import type { Role } from "./role-shared";

/**
 * There is deliberately no fallback secret here. A hardcoded default would
 * sit in the repository in plaintext, so anyone who could read the source
 * could forge a session for any user if the env var ever went missing —
 * and it would fail silently, which is the worst version of that bug.
 *
 * Read lazily rather than at module load so that importing this module
 * (e.g. during `next build` page-data collection) never depends on the
 * environment. If the secret is absent, signing and verification throw:
 * verifyToken() turns that into "not authenticated" and login fails
 * outright, so a misconfigured deploy locks people out instead of
 * accepting forgeable tokens.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not set — refusing to sign or verify auth tokens.");
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export const COOKIE_NAME = "auth_token";
export const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface TokenPayload {
  userId: number;
  email: string;
  role: Role;
  exp: number;
}

/** Base64url encode */
function b64url(str: string): string {
  if (typeof btoa === "function") {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(str).toString("base64url");
}

/** Base64url decode */
function b64urlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob === "function") {
    return atob(padded);
  }
  return Buffer.from(padded, "base64").toString("utf-8");
}

/** Create HMAC signature using Web Crypto API (Edge-compatible) */
async function hmacSign(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getJwtSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return b64url(binary);
}

/** Verify HMAC signature */
async function hmacVerify(data: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(data);
  return expected === signature;
}

export async function createToken(payload: Omit<TokenPayload, "exp">): Promise<string> {
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TOKEN_MAX_AGE,
  };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(fullPayload));
  const signature = await hmacSign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const valid = await hmacVerify(`${header}.${body}`, signature);
    if (!valid) return null;

    const payload = JSON.parse(b64urlDecode(body)) as TokenPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
