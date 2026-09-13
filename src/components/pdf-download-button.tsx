"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "@/components/ui/icons";

/**
 * 審査資料 PDF のダウンロード。
 *
 * 以前は html2canvas で詳細画面を撮影して jsPDF に貼っていたが、文字が画像に
 * なるため拡大・印刷でぼやけ、検索もできず、1枚の長い画像を機械的に切るので
 * 行や写真の途中でページが変わっていた。いまはサーバー側の
 * /api/entries/[id]/pdf が本物の文字で組み立てる（src/lib/entry-pdf.ts）。
 *
 * 素の <a download> ではなく fetch しているのは、生成に数秒かかるあいだ
 * 「PDF生成中...」を出すため。添付ダウンロードはページ遷移を伴わないので、
 * リンクのままだと押しても画面上は何も起きず、二重に押しやすい。
 * ファイル名はサーバーの Content-Disposition から取り、命名規則を1箇所に保つ。
 */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return null;
    }
  }
  const plain = header.match(/filename="([^"]+)"/i);
  return plain ? plain[1] : null;
}

export function PdfDownloadButton({ entryId }: { entryId: number }) {
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/entries/${entryId}/pdf?download=1`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "PDFの生成に失敗しました");
      }
      const name = filenameFromDisposition(res.headers.get("Content-Disposition"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name || `entry-${entryId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // 直後に revoke するとダウンロードが始まる前に無効になる環境があるため少し待つ
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "PDFの生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Button
      variant="secondary"
      icon={<Download />}
      onClick={handleDownload}
      disabled={generating}
      loading={generating}
    >
      {generating ? "PDF生成中..." : "PDF"}
    </Button>
  );
}
