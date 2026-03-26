"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DeleteEntryButton } from "./delete-entry-button";
import { PdfDownloadButton } from "./pdf-download-button";
import { PrizeSelector } from "./prize-selector";
import { useRole } from "@/lib/role-context";

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
  remarks: string;
  prizeLevel: string;
  images: EntryImage[];
}

function maskValue(value: string): string {
  if (!value) return "";
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return local.slice(0, 2) + "***@" + domain;
  }
  if (value.match(/^[\d-]+$/)) {
    return value.slice(0, 3) + "****" + value.slice(-2);
  }
  return "***";
}

export function EntryDetail({ entry: initialEntry }: { entry: EntryData }) {
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
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
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
    <div className="p-8 max-w-5xl" id="entry-detail">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/entries"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← エントリー一覧に戻る
        </Link>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700
                  disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1.5 border border-gray-300 text-sm text-gray-600 rounded-lg
                  hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
            </>
          ) : (
            <>
              {permissions.canEdit && (
                <button
                  onClick={startEdit}
                  className="px-3 py-1.5 border border-blue-300 text-blue-600 text-sm rounded-lg
                    hover:bg-blue-50 transition-colors"
                >
                  ✏️ 編集
                </button>
              )}
              {permissions.canDownload && (
                <PdfDownloadButton entryName={entry.productName} />
              )}
              {permissions.canDelete && (
                <DeleteEntryButton entryId={entry.id} />
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-start gap-6 mb-8">
        {mainImage && (
          <img
            src={mainImage.imageUrl}
            alt={entry.productName}
            className="w-32 h-32 object-cover rounded-xl border border-gray-200"
          />
        )}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {editing ? (
              <input
                value={draft.productName}
                onChange={(e) => updateField("productName", e.target.value)}
                className="w-full px-2 py-1 border border-blue-300 rounded-lg text-2xl font-bold"
              />
            ) : (
              entry.productName
            )}
          </h2>
          <p className="text-gray-600 mt-1">
            {editing ? (
              <input
                value={draft.companyName}
                onChange={(e) => updateField("companyName", e.target.value)}
                className="w-full px-2 py-1 border border-blue-300 rounded-lg text-base"
              />
            ) : (
              entry.companyName
            )}
          </p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
              {entry.productCategory || "未分類"}
            </span>
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
              回答番号: {entry.answerNo}
            </span>
          </div>
          <div className="mt-3">
            {permissions.canSetPrize ? (
              <PrizeSelector entryId={entry.id} currentPrize={entry.prizeLevel} />
            ) : entry.prizeLevel ? (
              <span className="inline-flex items-center px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 text-sm font-bold rounded-full">
                🏆 {entry.prizeLevel}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="企業・担当者情報">
          <EditableRow label="企業名" field="companyName" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="部署・役職" field="department" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="担当者（姓）" field="contactLastName" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="担当者（名）" field="contactFirstName" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          {permissions.canSeePrivateInfo ? (
            <>
              <EditableRow label="メール" field="email" editing={editing} draft={draft} entry={entry} onChange={updateField} isEmail={!editing} />
              <EditableRow label="電話番号" field="phone" editing={editing} draft={draft} entry={entry} onChange={updateField} />
            </>
          ) : (
            <>
              <MaskedRow label="メール" value={entry.email} />
              <MaskedRow label="電話番号" value={entry.phone} />
            </>
          )}
          <InfoRow label="回答日時" value={entry.answeredAt} />
        </Section>

        <Section title="商品情報">
          <EditableRow label="商品名" field="productName" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="カテゴリ" field="productCategory" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="販売価格" field="price" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="購入可能場所" field="purchaseLocation" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="参考URL" field="referenceUrl" editing={editing} draft={draft} entry={entry} onChange={updateField} isUrl={!editing} />
          <EditableRow label="トレードショー出展" field="tradeShowExhibition" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="小売業者販売希望" field="retailPartnership" editing={editing} draft={draft} entry={entry} onChange={updateField} />
        </Section>

        <Section title="こだわりポイント">
          <EditableTextBlock label="ご当地のこだわり" field="localAppeal" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableTextBlock label="おいしさのこだわり" field="tasteAppeal" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableTextBlock label="パッケージのこだわり" field="packageAppeal" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableTextBlock label="調理方法・おすすめの食べ方" field="cookingMethod" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableTextBlock label="その他アピール" field="otherAppeal" editing={editing} draft={draft} entry={entry} onChange={updateField} />
        </Section>

        <Section title="許認可・衛生情報">
          <EditableRow label="食品細菌検査" field="bacteriaInspection" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="賞味期限検査証" field="expirationInspection" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="営業許可証（製造販売）" field="manufacturingLicense" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="営業許可証（エントリー商品）" field="entryProductLicense" editing={editing} draft={draft} entry={entry} onChange={updateField} />
          <EditableRow label="食品衛生責任者" field="hygieneManager" editing={editing} draft={draft} entry={entry} onChange={updateField} />
        </Section>
      </div>

      {(mainImage || subImages.length > 0) && (
        <div className="mt-6">
          <Section title="商品写真">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {mainImage && (
                <div>
                  <img
                    src={mainImage.imageUrl}
                    alt="メインビジュアル"
                    className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                  />
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">メインビジュアル</p>
                    {permissions.canDownload && (
                      <a
                        href={mainImage.imageUrl}
                        download
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        DL
                      </a>
                    )}
                  </div>
                </div>
              )}
              {subImages.map((img, i) => (
                <div key={img.id}>
                  <img
                    src={img.imageUrl}
                    alt={`サブ画像 ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                  />
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">サブ画像 {i + 1}</p>
                    {permissions.canDownload && (
                      <a
                        href={img.imageUrl}
                        download
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        DL
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {(entry.remarks || editing) && (
        <div className="mt-6">
          <Section title="備考・メッセージ">
            {editing ? (
              <textarea
                value={draft.remarks}
                onChange={(e) => updateField("remarks", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm"
              />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {entry.remarks}
              </p>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="text-xs text-gray-500 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 whitespace-pre-wrap break-all">{value}</span>
    </div>
  );
}

function MaskedRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="text-xs text-gray-500 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-400 italic">{maskValue(value)}</span>
    </div>
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

  return (
    <div className="flex gap-3">
      <span className="text-xs text-gray-500 w-32 shrink-0 pt-0.5">{label}</span>
      {editing ? (
        <input
          value={draftValue}
          onChange={(e) => onChange(field, e.target.value)}
          className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm"
        />
      ) : isEmail ? (
        <a href={`mailto:${value}`} className="text-sm text-blue-600 hover:underline break-all">
          {value}
        </a>
      ) : isUrl && value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-700 whitespace-pre-wrap break-all">{value}</span>
      )}
    </div>
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
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {editing ? (
        <textarea
          value={draftValue}
          onChange={(e) => onChange(field, e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm"
        />
      ) : (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
      )}
    </div>
  );
}
