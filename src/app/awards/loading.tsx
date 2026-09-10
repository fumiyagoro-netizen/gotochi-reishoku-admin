import { PageContainer } from "@/components/ui/page";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

// 受賞一覧: 見出し → 絞り込みタイル5枚 → 表 の形で骨組みを出す
export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="mb-6 h-7 w-40" />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <TableSkeleton cols={4} thumb />
    </PageContainer>
  );
}
