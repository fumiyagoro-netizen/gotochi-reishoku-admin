"use client";

import { Badge } from "@/components/ui/badge";
import { CollectionEditor, type Column, type FieldDef } from "./collection-editor";

export type MediaItem = { id: number; name: string; outlet: string; youtubeId: string; isPublished: boolean };

const FIELDS: FieldDef[] = [
  { key: "name", label: "番組名", type: "text", required: true, maxLength: 200 },
  { key: "outlet", label: "媒体（局名など）", type: "text", maxLength: 100, placeholder: "例: テレビ朝日" },
  { key: "youtubeId", label: "YouTube の動画ID", type: "text", required: true, full: true, hint: "動画のURLを貼っても、IDだけ取り出して保存します" },
  { key: "isPublished", label: "サイトに表示する", type: "checkbox" },
];

export function MediaListEditor({ items }: { items: MediaItem[] }) {
  const columns: Column<MediaItem>[] = [
    {
      header: "サムネイル",
      width: "w-28",
      render: (m) => <img src={`https://i.ytimg.com/vi/${m.youtubeId}/default.jpg`} alt="" className="h-12 w-20 rounded-md border border-line object-cover" />,
    },
    {
      header: "番組",
      render: (m) => (
        <div>
          <p className="font-medium text-ink">{m.name}</p>
          <p className="text-caption text-ink-subtle">{m.outlet}</p>
        </div>
      ),
    },
    { header: "動画ID", nowrap: true, render: (m) => <code className="text-caption">{m.youtubeId}</code> },
    { header: "状態", nowrap: true, render: (m) => (m.isPublished ? <Badge tone="success" size="sm">表示</Badge> : <Badge tone="neutral" size="sm">非表示</Badge>) },
  ];

  return (
    <CollectionEditor
      kind="media"
      itemLabel="掲載メディア"
      items={items}
      columns={columns}
      fields={FIELDS}
      defaults={{ name: "", outlet: "", youtubeId: "", isPublished: true }}
      sortable
      emptyTitle="掲載メディアはまだ登録されていません"
      emptyDescription="「掲載メディアを追加」から登録します。並び順どおりに、トップの「主な掲載情報」に出ます"
    />
  );
}
