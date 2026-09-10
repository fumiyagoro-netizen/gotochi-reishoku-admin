import { PageContainer } from "@/components/ui/page";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

// 一覧クエリ待ちの間、見出し・チップ行・表の形の骨組みを出す
export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="mb-6 h-7 w-32" />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>
      <TableSkeleton rows={10} cols={4} />
    </PageContainer>
  );
}
