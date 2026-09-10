import { PageContainer } from "@/components/ui/page";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

// フォーム作成の読み込み中。基本情報カード＋項目カードの2枚の形にしておく
export default function Loading() {
  return (
    <PageContainer width="form">
      <div className="mb-6 flex h-7 items-center">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="space-y-6">
        <CardSkeleton lines={6} />
        <CardSkeleton lines={3} />
      </div>
    </PageContainer>
  );
}
