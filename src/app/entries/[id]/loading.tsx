import { PageContainer } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

// エントリー詳細の読み込み中。見出し行 → ヘッダカード → コメント → 4 セクションの
// 形を先に出して、表示後に高さが跳ねないようにする。
export default function Loading() {
  return (
    <PageContainer width="detail">
      <div aria-busy="true">
        {/* 本画面は見出しの下に #entry-detail の pt-8 が入るので、骨組みも同じ 32px を空ける */}
        <div className="mb-8">
          <Skeleton className="h-4 w-36" />
          <div className="mt-2 flex items-center justify-between gap-4">
            <Skeleton className="h-6 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        </div>
        <Card className="mb-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-16 shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3.5 w-1/3" />
              <div className="flex gap-3">
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
            </div>
          </div>
        </Card>
        <div className="mb-6">
          <CardSkeleton lines={2} />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      </div>
    </PageContainer>
  );
}
