import { PageContainer, PageHeader } from "@/components/ui/page";
import { ImportWizard } from "@/components/site/import-wizard";

export const metadata = { title: "過去の受賞商品の取り込み" };

// 過去の受賞商品を Excel と写真から登録する（第1回 2024-2025 = 2025年度 の取り込み用に作ったもの）。
// 形式は src/lib/site-import.ts、登録は /api/site/import/*。
export default function SiteImportPage() {
  return (
    <PageContainer>
      <PageHeader
        title="過去の受賞商品の取り込み"
        description="過去の年度の受賞商品を、Excel と写真から登録します。取り込んだ商品はエントリー一覧と受賞商品の公開画面に並びます。"
      />
      <ImportWizard defaultYear={2025} />
    </PageContainer>
  );
}
