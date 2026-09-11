"use client";

import { Badge } from "@/components/ui/badge";
import { ExternalLink, ImageOff } from "@/components/ui/icons";
import { CollectionEditor, type Column, type FieldDef } from "./collection-editor";
import { PARTNER_KINDS, siteAssetSrc } from "@/lib/site-collections-shared";

export type PartnerItem = {
  id: number;
  kind: string;
  name: string;
  url: string;
  logoUrl: string;
  isPublished: boolean;
};

const FIELDS: FieldDef[] = [
  { key: "kind", label: "種別", type: "select", required: true, options: PARTNER_KINDS.map((k) => ({ value: k, label: k })) },
  { key: "name", label: "名称", type: "text", required: true, maxLength: 200 },
  { key: "url", label: "リンク先", type: "url", full: true, placeholder: "https://", hint: "任意。ロゴを押したときに開くページ" },
  { key: "logoUrl", label: "ロゴ", type: "image", uploadKind: "partner", contain: true, full: true, hint: "背景が透明な PNG がおすすめです。無ければ名称を文字で表示します" },
  { key: "isPublished", label: "サイトに表示する", type: "checkbox" },
];

export function PartnersEditor({ items }: { items: PartnerItem[] }) {
  const columns: Column<PartnerItem>[] = [
    {
      header: "ロゴ",
      width: "w-28",
      render: (p) =>
        p.logoUrl ? (
          <img src={siteAssetSrc(p.logoUrl)} alt="" className="h-10 w-20 rounded-md border border-line bg-surface object-contain p-1" />
        ) : (
          <span className="grid h-10 w-20 place-items-center rounded-md bg-surface-muted text-ink-faint">
            <ImageOff className="size-4" aria-hidden="true" />
          </span>
        ),
    },
    { header: "種別", nowrap: true, render: (p) => <Badge tone={p.kind === "主催" ? "info" : "neutral"} size="sm">{p.kind}</Badge> },
    { header: "名称", render: (p) => <span className="font-medium text-ink">{p.name}</span> },
    {
      header: "リンク先",
      render: (p) =>
        p.url ? (
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
            開く
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    { header: "状態", nowrap: true, render: (p) => (p.isPublished ? <Badge tone="success" size="sm">表示</Badge> : <Badge tone="neutral" size="sm">非表示</Badge>) },
  ];

  return (
    <CollectionEditor
      kind="partners"
      itemLabel="パートナー"
      items={items}
      columns={columns}
      fields={FIELDS}
      defaults={{ kind: "協賛", name: "", url: "", logoUrl: "", isPublished: true }}
      sortable
      sameGroup={(a, b) => a.kind === b.kind}
      emptyTitle="パートナーはまだ登録されていません"
      emptyDescription="主催・後援はコンセプト欄のロゴカードに、全員がページ下のロゴの帯に出ます"
    />
  );
}
