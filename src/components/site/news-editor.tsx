"use client";

import { Badge } from "@/components/ui/badge";
import { CollectionEditor, type Column, type FieldDef } from "./collection-editor";
import { NEWS_CATEGORIES } from "@/lib/site-collections-shared";

export type NewsItem = {
  id: number;
  title: string;
  body: string;
  category: string;
  /** "YYYY-MM-DD"（JST）。未設定は "" */
  publishedAt: string;
  isPublished: boolean;
  isPinned: boolean;
};

const FIELDS: FieldDef[] = [
  { key: "title", label: "タイトル", type: "text", required: true, maxLength: 200, full: true },
  { key: "category", label: "カテゴリ", type: "select", required: true, options: NEWS_CATEGORIES.map((c) => ({ value: c, label: c })) },
  { key: "publishedAt", label: "公開日", type: "date", hint: "一覧に出る日付。新しい順に並びます" },
  { key: "body", label: "本文", type: "textarea", rows: 10, hint: "改行はそのまま表示します" },
  { key: "isPublished", label: "公開する", type: "checkbox", hint: "外すと下書き（サイトに出ません）" },
  { key: "isPinned", label: "ピン留め", type: "checkbox", hint: "トップのお知らせで先頭に固定します" },
];

export function NewsEditor({ items, topIds, today }: { items: NewsItem[]; topIds: number[]; today: string }) {
  const columns: Column<NewsItem>[] = [
    { header: "公開日", nowrap: true, render: (n) => n.publishedAt ? <span className="tabular-nums">{n.publishedAt.replaceAll("-", ".")}</span> : <span className="text-ink-faint">—</span> },
    { header: "カテゴリ", nowrap: true, render: (n) => <Badge tone={n.category === "結果発表" ? "warning" : n.category === "メディア" ? "info" : "neutral"} size="sm">{n.category}</Badge> },
    {
      header: "タイトル",
      render: (n) => (
        <div>
          <p className="font-medium text-ink">{n.title}</p>
          <p className="text-caption text-ink-subtle">
            {[n.isPinned && "ピン留め", topIds.includes(n.id) && "トップに表示中"].filter(Boolean).join("・")}
          </p>
        </div>
      ),
    },
    { header: "状態", nowrap: true, render: (n) => (n.isPublished ? <Badge tone="success" size="sm">公開</Badge> : <Badge tone="neutral" size="sm">下書き</Badge>) },
  ];

  return (
    <CollectionEditor
      kind="news"
      itemLabel="お知らせ"
      items={items}
      columns={columns}
      fields={FIELDS}
      defaults={{ category: "開催情報", publishedAt: today, isPublished: false, isPinned: false, body: "" }}
      emptyTitle="お知らせはまだありません"
      emptyDescription="「お知らせを追加」から作成します"
    />
  );
}
