import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ご当地冷凍食品大賞 エントリーフォーム",
  description: "日本全国！ご当地冷凍食品大賞 エントリー受付",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-lg">G</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              ご当地冷凍食品大賞
            </h1>
            <p className="text-xs text-gray-500">エントリーフォーム</p>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>&copy; 一般社団法人未来の食卓</p>
        </div>
      </footer>
    </>
  );
}
