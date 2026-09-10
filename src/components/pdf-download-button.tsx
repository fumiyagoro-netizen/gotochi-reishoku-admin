"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "@/components/ui/icons";

export function PdfDownloadButton({ entryName }: { entryName: string }) {
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    setGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      // 撮影範囲は #entry-detail だけ（見出し行の編集・PDF・削除ボタンと
      // 編集中の保存バーは entry-detail.tsx でこの外に置いてある）
      const content = document.getElementById("entry-detail");
      if (!content) return;

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        logging: false,
      } as Record<string, unknown>);

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF("p", "mm", "a4");

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,
        position,
        imgWidth,
        imgHeight
      );
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = -(imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          position,
          imgWidth,
          imgHeight
        );
        heightLeft -= pageHeight;
      }

      const safeName = entryName.replace(/[/\\?%*:|"<>]/g, "_");
      pdf.save(`${safeName}.pdf`);
    } catch {
      alert("PDF生成に失敗しました");
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
