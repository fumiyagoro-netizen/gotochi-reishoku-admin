import { notFound } from "next/navigation";

// 公開サイトに無いURLは、公開サイトの見た目の「ページが見つかりません」を出す（src/app/web/not-found.tsx）
export default function MissingPage() {
  notFound();
}
