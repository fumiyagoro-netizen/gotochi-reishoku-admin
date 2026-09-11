"use client";

import { Badge } from "@/components/ui/badge";
import { Thumb } from "@/components/ui/table";
import { CollectionEditor, type Column, type FieldDef } from "./collection-editor";

export type JudgeItem = {
  id: number;
  name: string;
  title: string;
  role: string;
  photoUrl: string;
  isPublished: boolean;
};

const FIELDS: FieldDef[] = [
  { key: "name", label: "氏名", type: "text", required: true, maxLength: 100 },
  { key: "role", label: "役割", type: "text", maxLength: 100, placeholder: "例: 審査員代表・発起人", hint: "任意。氏名の上に小さく出ます" },
  { key: "title", label: "肩書き", type: "text", maxLength: 200, full: true, placeholder: "例: 冷凍食品専門家" },
  { key: "photoUrl", label: "写真", type: "image", uploadKind: "judge", full: true, hint: "正方形に近い写真がおすすめです（サイトでは円形に切り抜きます）。無ければ頭文字の丸で表示します" },
  { key: "isPublished", label: "サイトに表示する", type: "checkbox" },
];

export function JudgesEditor({ awardId, items }: { awardId: number; items: JudgeItem[] }) {
  const columns: Column<JudgeItem>[] = [
    { header: "写真", width: "w-16", render: (j) => <Thumb src={j.photoUrl || undefined} alt="" /> },
    {
      header: "氏名",
      render: (j) => (
        <div>
          <p className="font-medium text-ink">{j.name}</p>
          {j.role && <p className="text-caption text-ink-subtle">{j.role}</p>}
        </div>
      ),
    },
    { header: "肩書き", render: (j) => j.title || <span className="text-ink-faint">—</span> },
    {
      header: "状態",
      nowrap: true,
      render: (j) => (
        <span className="inline-flex gap-1">
          {j.isPublished ? <Badge tone="success" size="sm">表示</Badge> : <Badge tone="neutral" size="sm">非表示</Badge>}
          {!j.photoUrl && <Badge tone="warning" size="sm">写真なし</Badge>}
        </span>
      ),
    },
  ];

  return (
    <CollectionEditor
      kind="judges"
      itemLabel="審査員"
      items={items}
      columns={columns}
      fields={FIELDS}
      defaults={{ awardId, isPublished: true, name: "", title: "", role: "", photoUrl: "" }}
      sortable
      emptyTitle="この年度の審査員はまだ登録されていません"
      emptyDescription="「審査員を追加」から登録します。並び順どおりにサイトに出ます"
    />
  );
}
