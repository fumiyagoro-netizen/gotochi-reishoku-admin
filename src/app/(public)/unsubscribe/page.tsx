import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function unsubscribe(email: string) {
  await prisma.suppression.upsert({
    where: { email },
    update: {},
    create: { email, reason: "unsubscribe" },
  });

  await prisma.contact.updateMany({
    where: { email },
    data: { subscribed: false },
  });

  await writeAuditLog({
    action: "unsubscribe",
    target: "contact",
    detail: `配信停止: ${email}`,
  });
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email: rawEmail } = await searchParams;
  const email = (rawEmail || "").trim().toLowerCase();

  if (!email) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          配信停止
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          メールアドレスが指定されていません。メール内のリンクからアクセスしてください。
        </p>
      </div>
    );
  }

  await unsubscribe(email);

  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        配信停止が完了しました
      </h1>
      <p className="text-gray-600 mb-2 max-w-md mx-auto">
        <span className="font-mono text-gray-800">{email}</span> 宛のメール配信を停止しました。
      </p>
      <p className="text-gray-500 text-sm max-w-md mx-auto">
        今後、当団体からのメールマガジン等は届きません。<br />
        再度配信をご希望の場合は事務局までお問い合わせください。
      </p>
    </div>
  );
}
