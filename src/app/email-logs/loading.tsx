import { PageContainer } from "@/components/ui/page";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

// 集計クエリ待ちの間、見出し・統計5枚・表の形の骨組みを出す（白紙のまま待たせない）
export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="mb-6 h-7 w-40" />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <TableSkeleton rows={8} cols={6} />
    </PageContainer>
  );
}
