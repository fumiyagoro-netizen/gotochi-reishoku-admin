import { PageContainer } from "@/components/ui/page";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

// 一覧の集計クエリ待ちの間、見出し・検索行・表の骨組みを先に出して高さの跳ねを防ぐ
export default function Loading() {
  return (
    <PageContainer>
      <div className="mb-6">
        <Skeleton className="h-7 w-48" />
        <div className="mt-5 flex items-center gap-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <TableSkeleton cols={7} thumb />
    </PageContainer>
  );
}
