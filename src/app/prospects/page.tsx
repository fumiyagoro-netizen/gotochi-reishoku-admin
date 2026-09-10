"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRole } from "@/lib/role-context";
import {
  PROSPECT_CONTACT_STATUSES,
  PROSPECT_STATUS_DROPPED,
} from "@/lib/prospect-shared";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { NoPermission } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/field-controls";
import {
  ChevronRight,
  Download,
  ExternalLink,
  Plus,
  Search,
  Target,
  Trash2,
  Upload,
  X,
} from "@/components/ui/icons";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { Modal } from "@/components/ui/modal";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { SearchInput, Toolbar } from "@/components/ui/toolbar";

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

// コンタクト状況 → Badge の完全クラス文字列（JIT のため結合しない）。
// 「追客しない」は outline（不在）で示すのでここには含めない。未知値は neutral。
const CONTACT_STATUS_BADGE_CLASS: Record<string, string> = {
  未着手: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
  連絡済: "bg-blue-50 text-blue-700 ring-blue-600/20",
  資料送付済: "bg-amber-50 text-amber-800 ring-amber-600/25",
  エントリー意向: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

function ContactStatusBadge({ status }: { status: string }) {
  if (status === PROSPECT_STATUS_DROPPED) return <Badge tone="outline">{status}</Badge>;
  const cls = CONTACT_STATUS_BADGE_CLASS[status];
  if (!cls) return <Badge tone="neutral">{status}</Badge>;
  return (
    <Badge tone="custom" className={cls}>
      {status}
    </Badge>
  );
}

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
      <PageContainer>
        <NoPermission message="閲覧権限がありません" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="追客リスト"
        meta={year && <Badge tone="neutral">{year}年度</Badge>}
        count={total}
        actions={
          <>
            {permissions.canDownload && (
              <ButtonLink
                variant="secondary"
                external
                href={`/api/prospects/export?${exportParams.toString()}`}
                icon={<Download />}
              >
                Excelダウンロード
              </ButtonLink>
            )}
            {permissions.canUpload && (
              <ButtonLink variant="secondary" href="/prospects/import" icon={<Upload />}>
                Excelインポート
              </ButtonLink>
            )}
            <Button
              variant="primary"
              icon={<Plus />}
              onClick={() => { setEditingProspect(null); setShowForm(true); }}
            >
              新規追加
            </Button>
          </>
        }
      />

      {errorMsg && (
        <div className="mb-4">
          <Alert tone="danger">{errorMsg}</Alert>
        </div>
      )}

      {/* Search & Filter（検索語は submit で反映、select は即時。既存の挙動差はそのまま） */}
      <Toolbar
        applied={Boolean(hasFilter)}
        clear={
          <Button variant="ghost" icon={<X />} onClick={handleClear}>
            クリア
          </Button>
        }
      >
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <SearchInput
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="メーカー名・商品名で検索..."
            active={Boolean(q)}
          />
          <div className="w-44">
            <Select
              value={contactStatus}
              onChange={(e) => { setContactStatus(e.target.value); setPage(1); }}
              data-active={contactStatus ? "true" : undefined}
            >
              <option value="">コンタクト状況（すべて）</option>
              {PROSPECT_CONTACT_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Select
              value={prefecture}
              onChange={(e) => { setPrefecture(e.target.value); setPage(1); }}
              data-active={prefecture ? "true" : undefined}
            >
              <option value="">県名（すべて）</option>
              {filterOptions.prefectures.map((pref) => (
                <option key={pref} value={pref}>{pref}</option>
              ))}
            </Select>
          </div>
          <Button variant="secondary" type="submit" icon={<Search />}>
            検索
          </Button>
        </form>
      </Toolbar>

      {loading ? (
        <TableSkeleton cols={7} />
      ) : (
        <Table fixed>
          {/* The URL column only holds a fixed-width button now, so the
              three text columns that were widest can give space back and
              the whole table fits without scrolling on most screens.
              Values that still overrun truncate with the full text on
              hover, as before. 県名は4文字（神奈川県）が切れない w-24。
              末尾の列は「行を押すと開く」ことを示す ChevronRight。 */}
          <colgroup>
            <col className="w-[150px]" />
            <col className="w-24" />
            <col className="w-[170px]" />
            <col className="w-[120px]" />
            <col className="w-[100px]" />
            <col className="w-[180px]" />
            <col className="w-[140px]" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr>
              <Th>メーカー名</Th>
              <Th>県名</Th>
              <Th>商品名</Th>
              <Th>コンタクト状況</Th>
              <Th>担当者</Th>
              <Th>連絡先</Th>
              <Th>URL</Th>
              <Th srLabel="開く" />
            </tr>
          </thead>
          <tbody>
            {prospects.map((p) => (
              <Tr
                key={p.id}
                onClick={() => { setEditingProspect(p); setShowForm(true); }}
                clickable
                // Dropped prospects stay in the list but recede, so the rows
                // still worth working stand out. 文字色を落とす方式なので
                // バッジは読めたまま（opacity で行ごと薄くしない）。
                muted={p.contactStatus === PROSPECT_STATUS_DROPPED}
              >
                <Td primary truncate={p.makerName}>
                  {p.makerName}
                </Td>
                <Td subtle truncate={p.prefecture}>
                  {p.prefecture}
                </Td>
                <Td truncate={p.productName}>
                  {p.productName}
                </Td>
                <Td>
                  <ContactStatusBadge status={p.contactStatus} />
                </Td>
                <Td truncate={p.assignee}>
                  {p.assignee || "-"}
                </Td>
                <Td truncate={p.email}>
                  {p.email || "-"}
                </Td>
                {/* No truncate here, unlike the text cells: it would clip
                    the button rather than shorten a long value. */}
                <Td>
                  {p.url ? (
                    <ButtonLink
                      variant="secondary"
                      size="sm"
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      // The row itself opens the edit modal, so the link
                      // has to stop the click from reaching it.
                      onClick={(e) => e.stopPropagation()}
                      title={p.url}
                      icon={<ExternalLink />}
                    >
                      サイトを見る
                    </ButtonLink>
                  ) : (
                    <span className="text-ink-subtle">-</span>
                  )}
                </Td>
                <Td>
                  <ChevronRight className="size-4 text-ink-faint" aria-hidden="true" />
                </Td>
              </Tr>
            ))}
            {prospects.length === 0 && (
              <EmptyState
                colSpan={8}
                icon={Target}
                title="追客先データがありません"
                description={
                  hasFilter
                    ? "検索条件に一致する追客先がありません。条件を変えるかクリアしてください"
                    : "「新規追加」から登録すると、ここに表示されます"
                }
              />
            )}
          </tbody>
        </Table>
      )}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

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
    </PageContainer>
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
    // Clicking the backdrop closes the modal（既存どおり。この画面だけ closeOnBackdrop）
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "追客先編集" : "追客先追加"}
      size="lg"
      closeOnBackdrop
      as="form"
      onSubmit={handleSubmit}
      footerStart={
        isEdit && canDelete && (
          confirmingDelete ? (
            <InlineConfirm
              message="本当に削除しますか？"
              confirmLabel={deleting ? "削除中..." : "削除する"}
              onConfirm={handleDelete}
              onCancel={() => setConfirmingDelete(false)}
              loading={deleting}
            />
          ) : (
            <Button
              variant="dangerGhost"
              icon={<Trash2 />}
              onClick={() => setConfirmingDelete(true)}
            >
              削除
            </Button>
          )
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="primary" type="submit" disabled={saving} loading={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Field label="メーカー名">
          <Input
            type="text"
            value={makerName}
            onChange={(e) => setMakerName(e.target.value)}
            required
          />
        </Field>
        <Field label="県名">
          <Input
            type="text"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
          />
        </Field>
      </div>

      <Field label="商品名">
        <Input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
      </Field>

      <Field label="サイトで確認できる温度帯">
        <Input
          type="text"
          value={tempZone}
          onChange={(e) => setTempZone(e.target.value)}
        />
      </Field>

      <Field label="コンタクト状況">
        <Select
          value={contactStatus}
          onChange={(e) => setContactStatus(e.target.value)}
        >
          {PROSPECT_CONTACT_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </Select>
      </Field>

      <Field label="補足">
        <Input
          type="text"
          value={supplement}
          onChange={(e) => setSupplement(e.target.value)}
        />
      </Field>

      <Field label="URL">
        <Input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Field label="担当者">
          <Input
            type="text"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          />
        </Field>
        <Field label="連絡先（メールアドレス）">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="連絡先（電話番号）">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
      </div>

      <Field label="備考・メモ欄">
        <Textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
        />
      </Field>
    </Modal>
  );
}
