import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SITE_NAV, type SiteNavItem } from "@/lib/site-nav";

export const metadata = { title: "公開状況" };

// 公開状況（サイト管理のトップ）。年度の公開スイッチやトップページの構成一覧は、各画面ができてから
// ここに載せる（docs/site-migration/README.md §4）。今は切り替え前であることと、この区画の画面の一覧だけ。

function ItemRow({ item }: { item: SiteNavItem }) {
  const Icon = item.icon;
  const isHere = item.href === "/site";
  const body = (
    <>
      <Icon className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{item.label}</p>
        <p className="text-caption text-ink-subtle">{item.description}</p>
      </div>
      {isHere ? (
        <Badge tone="info">このページ</Badge>
      ) : item.ready ? (
        <Badge tone="success">利用できます</Badge>
      ) : (
        <Badge tone="outline">準備中</Badge>
      )}
    </>
  );
  const row = "flex items-center gap-3 px-5 py-3";
  if (item.ready && !isHere) {
    return (
      <Link
        href={item.href}
        className={`${row} transition-colors hover:bg-surface-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40`}
      >
        {body}
      </Link>
    );
  }
  return <div className={row}>{body}</div>;
}

export default function SiteHomePage() {
  return (
    <PageContainer width="detail">
      <PageHeader
        title="公開状況"
        description="公開サイト（gotouchireisyoku.com）に出す内容を管理する区画です。管理者だけが使えます。"
      />
      <div className="space-y-6">
        <Alert tone="info" title="公開サイトはまだ現行の WordPress で運用中です">
          <p>
            ここで入力した内容は、新しい公開サイトに切り替えた時点で表示されます。切り替えるまで、ここでの操作が現行サイトに反映されることはありません。
          </p>
        </Alert>

        <Card padding="none" as="section">
          <CardHeader title="この区画の画面" description="準備中の画面は、できたものから順に使えるようになります。" />
          {SITE_NAV.map((group) => (
            <div key={group.label} className="border-b border-line last:border-b-0">
              <p className="bg-surface-muted/60 px-5 py-1.5 text-caption font-medium text-ink-subtle">{group.label}</p>
              <ul className="divide-y divide-line">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <ItemRow item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      </div>
    </PageContainer>
  );
}
