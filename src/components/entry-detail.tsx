"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteEntryButton } from "./delete-entry-button";
import { PdfDownloadButton } from "./pdf-download-button";
import { PrizeSelector } from "./prize-selector";
import { ReviewStatusSelector, ReviewBadge } from "./review-status-selector";
import { ItemArrivalSelector, ItemArrivalBadge } from "./item-arrival-selector";
import { EntryComments, type EntryCommentData } from "./entry-comments";
import { useRole } from "@/lib/role-context";
import { isPrizeLevel } from "@/lib/prize-shared";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Badge, PrizeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field-controls";
import { KeyValue, KeyValueList } from "@/components/ui/key-value";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Download, Pencil, Trophy } from "@/components/ui/icons";

interface EntryImage {
  id: number;
  imageUrl: string;
  imageType: string;
}

interface EntryData {
  id: number;
  answerNo: string;
  answeredAt: string;
  companyName: string;
  department: string;
  contactLastName: string;
  contactFirstName: string;
  email: string;
  phone: string;
  prefecture: string;
  productName: string;
  productCategory: string;
  price: string;
  purchaseLocation: string;
  referenceUrl: string;
  tradeShowExhibition: string;
  retailPartnership: string;
  localAppeal: string;
  tasteAppeal: string;
  packageAppeal: string;
  cookingMethod: string;
  otherAppeal: string;
  bacteriaInspection: string;
  expirationInspection: string;
  manufacturingLicense: string;
  entryProductLicense: string;
  hygieneManager: string;
  referralSource: string;
  remarks: string;
  prizeLevel: string;
  reviewStatus: string;
  itemArrivalStatus: string;
  images: EntryImage[];
}

export function EntryDetail({
  entry: initialEntry,
  comments,
  currentUserId,
}: {
  entry: EntryData;
  comments: EntryCommentData[];
  currentUserId?: number;
}) {
  const [entry, setEntry] = useState(initialEntry);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialEntry);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { permissions } = useRole();

  const mainImage = entry.images.find((img) => img.imageType === "main");
  const subImages = entry.images.filter((img) => img.imageType === "sub");

  function startEdit() {
    setDraft({ ...entry });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      // The edit form never touches prizeLevel / reviewStatus /
      // itemArrivalStatus — each has its own selector — but draft is a copy of
      // the whole entry, so sending it wholesale included them anyway. The API
      // rejects a body containing reviewStatus or prizeLevel unless the caller
      // has canSetPrize, which editors do not, so saving any ordinary edit
      // failed for them with 「審査状況設定の権限がありません」. Send only what
      // the form can actually change.
      const { prizeLevel: _p, reviewStatus: _r, itemArrivalStatus: _a, images: _i, ...editable } = draft;
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editable),
      });
      const data = await res.json();
      if (data.success) {
        setEntry({ ...draft });
        setEditing(false);
        router.refresh();
      } else {
        alert(data.message || "保存に失敗しました");
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof EntryData, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <PageContainer width="detail">
      {/* 見出し行（戻る・編集・PDF・削除）は #entry-detail の外に置き、PDF の撮影範囲に入れない。
          編集中は保存・キャンセルを下の StickyActionBar に出すので actions は空にする */}
      <PageHeader
        title="エントリー詳細"
        backHref="/entries"
        backLabel="エントリー一覧に戻る"
        actions={
          editing ? undefined : (
            <>
              {permissions.canEdit && (
                <Button variant="secondary" icon={<Pencil />} onClick={startEdit}>
                  編集
                </Button>
              )}
              {permissions.canDownload && (
                <PdfDownloadButton entryName={entry.productName} />
              )}
              {permissions.canDelete && (
                <DeleteEntryButton entryId={entry.id} />
              )}
            </>
          )
        }
      />

      {/* html2canvas の撮影対象。旧ラッパー（p-8 max-w-5xl）と同じく PDF に 32px の余白を写すため
          p-8 を持たせ、PageContainer の px-8 と PageHeader の mb-6 は負マージンで打ち消して
          画面上の位置と横幅（1024px の箱）を今までどおりにする。白背景は canvas 色や影を写さないため */}
      <div id="entry-detail" className="-mx-8 -mt-6 bg-surface p-8">
        {/* PrizeSelector のポップオーバーがはみ出すので、このカードには clip を付けない */}
        <Card className="mb-6">
          <div className="flex items-start gap-4">
            {mainImage && (
              <img
                src={`/api/images/${mainImage.id}`}
                alt={entry.productName}
                className="size-16 shrink-0 rounded-md border border-line object-cover bg-surface-muted"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-ink">
                    {editing ? (
                      <Input
                        size="sm"
                        value={draft.productName}
                        onChange={(e) => updateField("productName", e.target.value)}
                        className="font-normal"
                      />
                    ) : (
                      entry.productName
                    )}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {editing ? (
                      <Input
                        size="sm"
                        value={draft.companyName}
                        onChange={(e) => updateField("companyName", e.target.value)}
                      />
                    ) : (
                      entry.companyName
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge tone="info">{entry.productCategory || "未分類"}</Badge>
                  <Badge tone="neutral">回答番号: {entry.answerNo}</Badge>
                </div>
              </div>
              {/* 受賞／審査／到着を横 1 行に。中身が null の枠は empty:hidden で gap に数えない */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="empty:hidden">
                  {permissions.canSetPrize ? (
                    <PrizeSelector entryId={entry.id} currentPrize={entry.prizeLevel} />
                  ) : entry.prizeLevel ? (
                    // 既知の賞は賞色バッジ。未知の値でも旧表示と同じく落とさず文字列で見せる
                    isPrizeLevel(entry.prizeLevel) ? (
                      <PrizeBadge prizeLevel={entry.prizeLevel} />
                    ) : (
                      <Badge tone="neutral" icon={<Trophy />}>
                        {entry.prizeLevel}
                      </Badge>
                    )
                  ) : null}
                </div>
                <div className="empty:hidden">
                  {permissions.canSetPrize ? (
                    <ReviewStatusSelector entryId={entry.id} currentStatus={entry.reviewStatus} />
                  ) : entry.reviewStatus ? (
                    <ReviewBadge status={entry.reviewStatus} />
                  ) : null}
                </div>
                <div className="empty:hidden">
                  {permissions.canSetItemArrival ? (
                    <ItemArrivalSelector entryId={entry.id} currentStatus={entry.itemArrivalStatus} />
                  ) : entry.itemArrivalStatus ? (
                    <ItemArrivalBadge status={entry.itemArrivalStatus} />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="mb-6">
          <EntryComments entryId={entry.id} comments={comments} currentUserId={currentUserId} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="企業・担当者情報">
            <KeyValueList>
              <EditableRow label="企業名" field="companyName" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableRow label="部署・役職" field="department" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              {permissions.canSeePrivateInfo ? (
                <>
                  <EditableRow label="担当者（姓）" field="contactLastName" editing={editing} draft={draft} entry={entry} onChange={updateField} />
                  <EditableRow label="担当者（名）" field="contactFirstName" editing={editing} draft={draft} entry={entry} onChange={updateField} />
                  <EditableRow label="メール" field="email" editing={editing} draft={draft} entry={entry} onChange={updateField} isEmail={!editing} />
                  <EditableRow label="電話番号" field="phone" editing={editing} draft={draft} entry={entry} onChange={updateField} />
                </>
              ) : (
                <>
                  <MaskedRow label="担当者（姓）" value={entry.contactLastName} />
                  <MaskedRow label="担当者（名）" value={entry.contactFirstName} />
                  <MaskedRow label="メール" value={entry.email} />
                  <MaskedRow label="電話番号" value={entry.phone} />
                </>
              )}
              <InfoRow label="回答日時" value={entry.answeredAt} />
            </KeyValueList>
          </Section>

          <Section title="商品情報">
            <KeyValueList>
              <EditableRow label="ご当地（都道府県）" field="prefecture" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableRow label="商品名" field="productName" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableRow label="カテゴリ" field="productCategory" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableRow label="販売価格" field="price" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableRow label="購入可能場所" field="purchaseLocation" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableRow label="参考URL" field="referenceUrl" editing={editing} draft={draft} entry={entry} onChange={updateField} isUrl={!editing} />
              <EditableRow label="トレードショー出展" field="tradeShowExhibition" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableRow label="小売業者販売希望" field="retailPartnership" editing={editing} draft={draft} entry={entry} onChange={updateField} />
            </KeyValueList>
          </Section>

          <Section title="こだわりポイント">
            <div className="space-y-4">
              <EditableTextBlock label="ご当地のこだわり" field="localAppeal" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableTextBlock label="おいしさのこだわり" field="tasteAppeal" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableTextBlock label="パッケージのこだわり" field="packageAppeal" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableTextBlock label="調理方法・おすすめの食べ方" field="cookingMethod" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableTextBlock label="その他アピール" field="otherAppeal" editing={editing} draft={draft} entry={entry} onChange={updateField} />
            </div>
          </Section>

          <Section title="許認可・衛生情報">
            <KeyValueList>
              <EditableRow label="食品細菌検査" field="bacteriaInspection" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableRow label="賞味期限検査証" field="expirationInspection" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableRow label="営業許可証（製造販売）" field="manufacturingLicense" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableRow label="営業許可証（エントリー商品）" field="entryProductLicense" editing={editing} draft={draft} entry={entry} onChange={updateField} />
              <EditableRow label="食品衛生責任者" field="hygieneManager" editing={editing} draft={draft} entry={entry} onChange={updateField} />
            </KeyValueList>
          </Section>
        </div>

        {(mainImage || subImages.length > 0) && (
          <div className="mt-6">
            <Section title="商品写真">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {mainImage && (
                  <div>
                    <img
                      src={`/api/images/${mainImage.id}`}
                      alt="メインビジュアル"
                      className="w-full aspect-square object-cover rounded-md border border-line bg-surface-muted"
                    />
                    <div className="flex items-center justify-center gap-3 mt-1.5">
                      <p className="text-caption text-ink-subtle">メインビジュアル</p>
                      {permissions.canDownload && (
                        <ImageDownloadLink href={`/api/images/${mainImage.id}?download=1`} />
                      )}
                    </div>
                  </div>
                )}
                {subImages.map((img, i) => (
                  <div key={img.id}>
                    <img
                      src={`/api/images/${img.id}`}
                      alt={`サブ画像 ${i + 1}`}
                      className="w-full aspect-square object-cover rounded-md border border-line bg-surface-muted"
                    />
                    <div className="flex items-center justify-center gap-3 mt-1.5">
                      <p className="text-caption text-ink-subtle">サブ画像 {i + 1}</p>
                      {permissions.canDownload && (
                        <ImageDownloadLink href={`/api/images/${img.id}?download=1`} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* 2026年8月に追加した設問。それ以前のエントリーは空なので、備考と同じく
            値があるときか編集中だけ出す。フォームでは選択式だが、保存時に
            「その他: 自由入力」へ畳んだ 1 本の文字列なので、ここは他の選択式項目
            （食品細菌検査など）と揃えて自由入力の EditableRow で直す。 */}
        {(entry.referralSource || editing) && (
          <div className="mt-6">
            <Section title="大賞を知ったきっかけ">
              <KeyValueList>
                <EditableRow label="どこで知ったか" field="referralSource"
                  editing={editing} draft={draft} entry={entry} onChange={updateField} />
              </KeyValueList>
            </Section>
          </div>
        )}

        {(entry.remarks || editing) && (
          <div className="mt-6">
            <Section title="備考・メッセージ">
              {editing ? (
                <Textarea
                  value={draft.remarks}
                  onChange={(e) => updateField("remarks", e.target.value)}
                  rows={3}
                />
              ) : (
                <p className="text-sm text-ink whitespace-pre-wrap">
                  {entry.remarks}
                </p>
              )}
            </Section>
          </div>
        )}
      </div>

      {/* 編集中の保存・キャンセル。#entry-detail の外に置いて PDF に写さない */}
      {editing && (
        <StickyActionBar>
          <Button variant="secondary" onClick={cancelEdit}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={saveEdit} disabled={saving} loading={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </StickyActionBar>
      )}
    </PageContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card padding="none" as="section">
      {/* CardHeader は h2 固定なので、商品名 h2 の下位になる h3 を同じ見た目で手で組む */}
      <div className="border-b border-line px-5 py-3.5">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

/** 商品写真の「ダウンロード」。<a download> のまま（要素種を変えない） */
function ImageDownloadLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1 rounded-sm text-caption text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <Download className="size-3.5" aria-hidden="true" />
      ダウンロード
    </a>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <KeyValue label={label}>
      <span className="whitespace-pre-wrap">{value}</span>
    </KeyValue>
  );
}

// `value` is expected to already be masked server-side (see
// src/lib/entry-privacy.ts maskEntryPrivateFields) for roles without
// canSeePrivateInfo — this component must never receive the plaintext
// applicant contact info, so it must not re-derive a mask from it either.
function MaskedRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <KeyValue label={label} masked>
      {value}
    </KeyValue>
  );
}

function EditableRow({
  label,
  field,
  editing,
  draft,
  entry,
  onChange,
  isEmail,
  isUrl,
}: {
  label: string;
  field: keyof EntryData;
  editing: boolean;
  draft: EntryData;
  entry: EntryData;
  onChange: (field: keyof EntryData, value: string) => void;
  isEmail?: boolean;
  isUrl?: boolean;
}) {
  const value = String(entry[field] || "");
  const draftValue = String(draft[field] || "");

  if (!editing && !value) return null;

  // 非編集時だけリンクにする（mailto は同タブ、URL は別タブ — KeyValue 側で使い分け）
  const link = editing
    ? undefined
    : isEmail
      ? `mailto:${value}`
      : isUrl && value
        ? value
        : undefined;

  return (
    <KeyValue label={label} editing={editing} link={link}>
      {editing ? (
        <Input
          size="sm"
          value={draftValue}
          onChange={(e) => onChange(field, e.target.value)}
        />
      ) : (
        <span className="whitespace-pre-wrap">{value}</span>
      )}
    </KeyValue>
  );
}

function EditableTextBlock({
  label,
  field,
  editing,
  draft,
  entry,
  onChange,
}: {
  label: string;
  field: keyof EntryData;
  editing: boolean;
  draft: EntryData;
  entry: EntryData;
  onChange: (field: keyof EntryData, value: string) => void;
}) {
  const value = String(entry[field] || "");
  const draftValue = String(draft[field] || "");

  if (!editing && !value) return null;

  return (
    <div>
      <p className="text-caption text-ink-subtle mb-1">{label}</p>
      {editing ? (
        <Textarea
          value={draftValue}
          onChange={(e) => onChange(field, e.target.value)}
          rows={4}
        />
      ) : (
        <p className="text-sm text-ink whitespace-pre-wrap">{value}</p>
      )}
    </div>
  );
}
