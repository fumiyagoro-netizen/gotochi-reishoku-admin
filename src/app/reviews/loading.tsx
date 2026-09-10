import { PageContainer } from "@/components/ui/page";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

// 審査状況: 見出し → 審査状況タイル3枚 → 到着タイル3枚 → 表 の形で骨組みを出す
export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="mb-6 h-7 w-40" />
      <div className="mb-6 space-y-4">
        <div>
          <Skeleton className="mb-1.5 h-4 w-16" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </div>
        <div>
          <Skeleton className="mb-1.5 h-4 w-40" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </div>
      </div>
      <TableSkeleton cols={6} thumb />
    </PageContainer>
  );
}
