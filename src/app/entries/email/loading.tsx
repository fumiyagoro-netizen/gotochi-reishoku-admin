import { PageContainer } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";

// 親 (entries) の loading.tsx は一覧の骨組みなので、フォーム画面はカードの骨組みで上書きする
export default function Loading() {
  return (
    <PageContainer width="form">
      <CardSkeleton lines={6} />
    </PageContainer>
  );
}
