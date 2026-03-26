"use client";

import { useState } from "react";

export function PdfDownloadButton({ entryName }: { entryName: string }) {
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    setGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

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
    <button
      onClick={handleDownload}
      disabled={generating}
      className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg
        hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      {generating ? "PDF生成中..." : "📄 PDF"}
    </button>
  );
}
