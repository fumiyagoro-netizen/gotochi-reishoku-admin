import Link from "next/link";

export default async function EntryCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string }>;
}) {
  const { no } = await searchParams;

  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        エントリーを受け付けました
      </h1>
      {no && (
        <p className="text-lg text-gray-700 mb-2">
          受付番号: <span className="font-mono font-bold text-blue-600">{no}</span>
        </p>
      )}
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        ご応募ありがとうございます。<br />
        エントリー内容について確認事項がある場合は、<br />
        ご登録いただいたメールアドレス宛にご連絡いたします。
      </p>
      <Link
        href="/entry"
        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        別の商品をエントリーする
      </Link>
    </div>
  );
}
