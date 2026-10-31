import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ year?: string }>;
}

// 「商品×企画の表」は流通企画のトップ（参加状況）にまとめた。以前のURLを開いたときはトップへ送る
export default async function CampaignMatrixPage({ searchParams }: Props) {
  const { year } = await searchParams;
  redirect(year ? `/campaigns?year=${year}` : "/campaigns");
}
