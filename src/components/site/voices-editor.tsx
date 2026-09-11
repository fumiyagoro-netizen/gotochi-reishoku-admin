"use client";

import { Badge } from "@/components/ui/badge";
import { Thumb } from "@/components/ui/table";
import { CollectionEditor, type Column, type FieldDef } from "./collection-editor";
import { MAX_VOICE_PHOTOS, siteAssetSrc } from "@/lib/site-collections-shared";

export type VoiceItem = {
  id: number;
  entryId: number;
  quote: string;
  photoUrls: string[];
  isPublished: boolean;
  /** 一覧表示用（例: 2026年度 最高金賞） */
  entryTag: string;
  productName: string;
  companyName: string;
};

export function VoicesEditor({ items, entryOptions }: { items: VoiceItem[]; entryOptions: { value: string; label: string }[] }) {
  const fields: FieldDef[] = [
    { key: "entryId", label: "受賞商品", type: "select", required: true, options: entryOptions, full: true, hint: "受賞の付いたエントリーから選びます。商品名・企業名・賞はエントリーのものを表示します" },
    { key: "quote", label: "コメント（全文）", type: "textarea", required: true, rows: 8, hint: "一覧では最初の4行ほどを表示し、クリックで全文が開きます" },
    { key: "photoUrls", label: "写真", type: "images", uploadKind: "voice", max: MAX_VOICE_PHOTOS, hint: `${MAX_VOICE_PHOTOS}枚まで。1枚目がカードの写真になります` },
    { key: "isPublished", label: "サイトに表示する", type: "checkbox" },
  ];

  const columns: Column<VoiceItem>[] = [
    { header: "写真", width: "w-16", render: (v) => <Thumb src={siteAssetSrc(v.photoUrls[0]) || undefined} alt="" /> },
    {
      header: "受賞商品",
      render: (v) => (
        <div>
          <p className="font-medium text-ink">{v.productName}</p>
          <p className="text-caption text-ink-subtle">
            {v.companyName}｜{v.entryTag}
          </p>
        </div>
      ),
    },
    { header: "コメント", render: (v) => <p className="line-clamp-2 max-w-md text-caption">{v.quote}</p> },
    {
      header: "状態",
      nowrap: true,
      render: (v) => (
        <span className="inline-flex gap-1">
          {v.isPublished ? <Badge tone="success" size="sm">表示</Badge> : <Badge tone="neutral" size="sm">非表示</Badge>}
          <Badge tone={v.photoUrls.length ? "neutral" : "warning"} size="sm">
            写真 {v.photoUrls.length}枚
          </Badge>
        </span>
      ),
    },
  ];

  return (
    <CollectionEditor
      kind="voices"
      itemLabel="受賞者の声"
      items={items}
      columns={columns}
      fields={fields}
      defaults={{ isPublished: false, quote: "", photoUrls: [], entryId: "" }}
      sortable
      emptyTitle="受賞者の声はまだありません"
      emptyDescription="「受賞者の声を追加」から、受賞商品に紐づけて登録します。並び順どおりにサイトに出ます"
    />
  );
}
