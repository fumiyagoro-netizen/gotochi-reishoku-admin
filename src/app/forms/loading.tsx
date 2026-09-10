import { PageContainer } from "@/components/ui/page";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

// フォーム一覧の読み込み中。見出し分の高さを先に確保して、表示後に表が跳ねないようにする
export default function Loading() {
  return (
    <PageContainer>
      <div className="mb-6 flex h-7 items-center">
        <Skeleton className="h-5 w-32" />
      </div>
      <TableSkeleton cols={5} />
    </PageContainer>
  );
}
