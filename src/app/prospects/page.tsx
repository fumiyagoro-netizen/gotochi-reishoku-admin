"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRole } from "@/lib/role-context";
import {
  PROSPECT_CONTACT_STATUSES,
  PROSPECT_STATUS_DROPPED,
} from "@/lib/prospect-shared";

interface Prospect {
  id: number;
  makerName: string;
  prefecture: string;
  productName: string;
  tempZone: string;
  supplement: string;
  url: string;
  contactStatus: string;
  assignee: string;
  email: string;
  phone: string;
  memo: string;
}

interface FilterOptions {
  prefectures: string[];
}

const CONTACT_STATUS_COLORS: Record<string, string> = {
  未着手: "bg-gray-100 text-gray-600",
  連絡済: "bg-blue-100 text-blue-700",
  資料送付済: "bg-amber-100 text-amber-700",
  エントリー意向: "bg-green-100 text-green-700",
  [PROSPECT_STATUS_DROPPED]: "bg-gray-200 text-gray-500",
};

// Reads ?year= from the URL — sidebar always appends it once at least one
// Award exists (src/components/sidebar.tsx hrefWithYear) — so this stays
// wrapped in Suspense per Next.js's useSearchParams requirement (see the
// default export below).
function ProspectsPageInner() {
  const { permissions } = useRole();
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    prefectures: [],
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [contactStatus, setContactStatus] = useState("");
  const [prefecture, setPrefecture] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams();
      if (year) params.set("year", year);
      if (q) params.set("q", q);
      if (contactStatus) params.set("contactStatus", contactStatus);
      if (prefecture) params.set("prefecture", prefecture);
      params.set("page", String(page));
      const res = await fetch(`/api/prospects?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProspects(data.prospects);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setFilterOptions(data.filterOptions);
      } else {
        setErrorMsg(data.message || "取得に失敗しました");
      }
    } catch (e) {
      setErrorMsg("通信エラー: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [year, q, contactStatus, prefecture, page]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  // 年度を切り替えたら1ページ目に戻す（他の絞り込み条件の変更時と同じ扱い）。
  // 切替前のページ番号のままだと、年度によっては件数が少なく空振りしうる。
  useEffect(() => {
    setPage(1);
  }, [year]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(qInput);
    setPage(1);
  }

  function handleClear() {
    setQInput("");
    setQ("");
    setContactStatus("");
    setPrefecture("");
    setPage(1);
  }

  const hasFilter = q || contactStatus || prefecture;

  // Mirrors the params fetchProspects sends to GET /api/prospects (minus
  // `page`, since the export always includes every matching row) so the
  // downloaded file reflects exactly what's filtered on screen.
  const exportParams = new URLSearchParams();
  if (year) exportParams.set("year", year);
  if (q) exportParams.set("q", q);
  if (contactStatus) exportParams.set("contactStatus", contactStatus);
  if (prefecture) exportParams.set("prefecture", prefecture);

  // 追客リスト is a standalone feature gated by canManageProspects alone
  // (admin/representative/editor). See the comment above PERMISSIONS in
  // src/lib/role-shared.ts.
  if (!permissions.canManageProspects) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">閲覧権限がありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          追客リスト
          {year && (
            <span className="text-base font-normal text-gray-500 ml-3">
              {year}年度
            </span>
          )}
          <span className="text-base font-normal text-gray-500 ml-3">
            {total}件
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {permissions.canDownload && (
            <a
              href={`/api/prospects/export?${exportParams.toString()}`}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700
                hover:bg-gray-50 transition-colors"
            >
              📥 Excelダウンロード
            </a>
          )}
          {permissions.canUpload && (
            <Link
              href="/prospects/import"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700
                hover:bg-gray-50 transition-colors"
            >
              Excelインポート
            </Link>
          )}
          <button
            onClick={() => { setEditingProspect(null); setShowForm(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium
              hover:bg-blue-700 transition-colors"
          >
            + 新規追加
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg break-words">
          {errorMsg}
        </div>
      )}

      {/* Search & Filter */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="メーカー名・商品名で検索..."
          className="flex-1 min-w-[220px] max-w-md px-4 py-2.5 border border-gray-300 rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={contactStatus}
          onChange={(e) => { setContactStatus(e.target.value); setPage(1); }}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">コンタクト状況（すべて）</option>
          {PROSPECT_CONTACT_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <select
          value={prefecture}
          onChange={(e) => { setPrefecture(e.target.value); setPage(1); }}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">県名（すべて）</option>
          {filterOptions.prefectures.map((pref) => (
            <option key={pref} value={pref}>{pref}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium
            hover:bg-blue-700 transition-colors"
        >
          検索
        </button>
        {hasFilter && (
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2.5 text-gray-600 border border-gray-300 rounded-lg text-sm
              hover:bg-gray-50 transition-colors"
          >
            クリア
          </button>
        )}
      </form>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              {/* The URL column only holds a fixed-width button now, so the
                  three text columns that were widest can give space back and
                  the whole table fits without scrolling on most screens.
                  Values that still overrun truncate with the full text on
                  hover, as before. */}
              <colgroup>
                <col className="w-[150px]" />
                <col className="w-[70px]" />
                <col className="w-[170px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[180px]" />
                <col className="w-[140px]" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">メーカー名</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">県名</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">商品名</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">コンタクト状況</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">担当者</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">連絡先</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prospects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => { setEditingProspect(p); setShowForm(true); }}
                    // Dropped prospects stay in the list but recede, so the rows
                    // still worth working stand out. Dimming the whole row (rather
                    // than restyling each cell) also fades the status badge and the
                    // URL link, and it lifts back to full opacity on hover so the
                    // row is still readable when you go to open it.
                    className={`transition-colors cursor-pointer ${
                      p.contactStatus === PROSPECT_STATUS_DROPPED
                        ? "bg-gray-50 opacity-50 hover:opacity-100 hover:bg-gray-100"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate" title={p.makerName}>
                      {p.makerName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 truncate" title={p.prefecture}>
                      {p.prefecture}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 truncate" title={p.productName}>
                      {p.productName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${
                          CONTACT_STATUS_COLORS[p.contactStatus] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.contactStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 truncate" title={p.assignee}>
                      {p.assignee || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 truncate" title={p.email}>
                      {p.email || "-"}
                    </td>
                    {/* No truncate here, unlike the text cells: it would clip
                        the button rather than shorten a long value. */}
                    <td className="px-4 py-3 text-sm">
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          // The row itself opens the edit modal, so the link
                          // has to stop the click from reaching it.
                          onClick={(e) => e.stopPropagation()}
                          title={p.url}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg
                            text-xs text-gray-700 whitespace-nowrap hover:bg-gray-50 transition-colors"
                        >
                          サイトを見る
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {prospects.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      追客先データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <button
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              前へ
            </button>
          )}
          <span className="px-3 py-2 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              次へ
            </button>
          )}
        </div>
      )}

      {showForm && (
        <ProspectFormModal
          prospect={editingProspect}
          // 新規追加時、今表示中の年度に紐付ける（src/app/api/prospects
          // POST が ?year= を見て awardId を解決する）。編集時は既存行の
          // awardId を変えないので使わない。
          year={year}
          // Anyone who can manage the list can remove a row from it — see the
          // matching gate in api/prospects/[id] DELETE. Not permissions.canDelete,
          // which representative and editor lack.
          canDelete={permissions.canManageProspects}
          onClose={() => { setShowForm(false); setEditingProspect(null); }}
          onSaved={fetchProspects}
        />
      )}
    </div>
  );
}

export default function ProspectsPage() {
  return (
    <Suspense>
      <ProspectsPageInner />
    </Suspense>
  );
}

function ProspectFormModal({
  prospect,
  year,
  canDelete,
  onClose,
  onSaved,
}: {
  prospect: Prospect | null;
  // 表示中の年度。新規追加(POST)の紐付け先としてのみ使う — 編集(PATCH)は
  // 対象行の awardId を変更しない。
  year: string | null;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!prospect;
  const [makerName, setMakerName] = useState(prospect?.makerName || "");
  const [prefecture, setPrefecture] = useState(prospect?.prefecture || "");
  const [productName, setProductName] = useState(prospect?.productName || "");
  const [tempZone, setTempZone] = useState(prospect?.tempZone || "");
  const [supplement, setSupplement] = useState(prospect?.supplement || "");
  const [url, setUrl] = useState(prospect?.url || "");
  const [contactStatus, setContactStatus] = useState(
    prospect?.contactStatus || PROSPECT_CONTACT_STATUSES[0]
  );
  const [assignee, setAssignee] = useState(prospect?.assignee || "");
  const [email, setEmail] = useState(prospect?.email || "");
  const [phone, setPhone] = useState(prospect?.phone || "");
  const [memo, setMemo] = useState(prospect?.memo || "");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(
        isEdit
          ? `/api/prospects/${prospect!.id}`
          : `/api/prospects${year ? `?year=${year}` : ""}`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            makerName,
            prefecture,
            productName,
            tempZone,
            supplement,
            url,
            contactStatus,
            assignee,
            email,
            phone,
            memo,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else {
        setError(data.message);
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!prospect) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/prospects/${prospect.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else {
        setError(data.message);
      }
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    // Clicking the backdrop closes the modal. The check is on the click's
    // target being the backdrop itself, so a click that starts inside the
    // panel — or lands on it — doesn't bubble up and close the form.
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {isEdit ? "追客先編集" : "追客先追加"}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">メーカー名</span>
              <input
                type="text"
                value={makerName}
                onChange={(e) => setMakerName(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">県名</span>
              <input
                type="text"
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">商品名</span>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">サイトで確認できる温度帯</span>
            <input
              type="text"
              value={tempZone}
              onChange={(e) => setTempZone(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">コンタクト状況</span>
            <select
              value={contactStatus}
              onChange={(e) => setContactStatus(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PROSPECT_CONTACT_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">補足</span>
            <input
              type="text"
              value={supplement}
              onChange={(e) => setSupplement(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">URL</span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">担当者</span>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">連絡先（メールアドレス）</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">連絡先（電話番号）</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">備考・メモ欄</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {isEdit && canDelete && (
                confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600">本当に削除しますか？</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg
                        hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? "削除中..." : "削除する"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="px-3 py-1.5 border border-gray-300 text-sm text-gray-600 rounded-lg
                        hover:bg-gray-50 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg
                      hover:bg-red-50 transition-colors"
                  >
                    削除
                  </button>
                )
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg
                  hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg font-medium
                  hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
