import { PageContainer } from "@/components/ui/page";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

// 回答一覧の読み込み中。戻りリンク＋見出し分の高さを先に確保する
export default function Loading() {
  return (
    <PageContainer>
      <div className="mb-6">
        <Skeleton className="mb-2 h-4 w-24" />
        <div className="flex h-7 items-center">
          <Skeleton className="h-5 w-56" />
        </div>
      </div>
      <TableSkeleton cols={4} />
    </PageContainer>
  );
}
