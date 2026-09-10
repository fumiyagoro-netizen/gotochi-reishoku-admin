"use client";

import { useState, useEffect, useCallback, useRef, useId, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRole } from "@/lib/role-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle, NoPermission } from "@/components/ui/card";
import { CheckPill } from "@/components/ui/check-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { Checkbox, Input, Radio, Select, Textarea } from "@/components/ui/field-controls";
import { BookUser, ListPlus, Mail, Plus, Search, Send, Upload, X } from "@/components/ui/icons";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { Modal } from "@/components/ui/modal";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { SearchInput, Toolbar } from "@/components/ui/toolbar";

interface ContactList {
  id: number;
  name: string;
}

interface Contact {
  id: number;
  email: string;
  name: string;
  companyName: string;
  phone: string;
  subscribed: boolean;
  source: string;
  createdAt: string;
  memberships: { list: ContactList }[];
}

// Reads ?listId= from the URL so that opening a list from リスト管理
// (src/app/contacts/lists/page.tsx links to /contacts?listId=N) actually
// filters the table down to that list's members. useSearchParams requires a
// Suspense boundary in Next.js, hence the wrapper at the default export below
// — same shape as src/app/prospects/page.tsx.
function ContactsPageInner() {
  const { role, permissions } = useRole();
  const searchParams = useSearchParams();
  // 行選択（チェックボックス）は一斉送信・リスト一括追加のどちらかが使える人に表示
  const canSelect = permissions.canSendEmail || permissions.canEdit;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  // URL の ?listId= を初期値にする。以降は絞り込みセレクトの操作で state 側が
  // 正になる（リンクから来た直後だけ URL が効けばよく、セレクトを触るたびに
  // URL を書き換える必要はないため）。
  const [listId, setListId] = useState(searchParams.get("listId") ?? "");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showSend, setShowSend] = useState(false);
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  // 配信停止中の連絡先を購読中に戻すモーダル（管理者のみ）。既存の編集モーダル
  // とは別立てにしている — 通常編集とは違い理由入力・確認・監査ログが必須の
  // 別操作のため（src/app/api/contacts/[id]/resubscribe/route.ts 参照）。
  const [resubscribingContact, setResubscribingContact] = useState<Contact | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (listId) params.set("listId", listId);
      const res = await fetch(`/api/contacts?${params.toString()}`);
      const data = await res.json();
      if (data.success) setContacts(data.contacts);
      else setErrorMsg(data.message || "取得に失敗しました");
    } catch (e) {
      setErrorMsg("通信エラー: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [q, listId]);

  const fetchLists = useCallback(async () => {
    const res = await fetch("/api/contacts/lists");
    const data = await res.json();
    if (data.success) setLists(data.lists);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchContacts();
  }

  // Contacts (見込み客) is gated by canManageContacts, not canSeePrivateInfo:
  // editor keeps canSeePrivateInfo=true for entries but must not reach the
  // contacts feature at all. The API enforces this too; this only keeps the
  // page from rendering an empty shell.
  if (!permissions.canManageContacts) {
    return (
      <PageContainer>
        <NoPermission message="閲覧権限がありません" />
      </PageContainer>
    );
  }

  const isFiltered = Boolean(q || listId);
  const emptyColSpan = 6 + (canSelect ? 1 : 0) + (permissions.canEdit ? 1 : 0);

  return (
    <PageContainer>
      <PageHeader
        title="見込み客・連絡先"
        count={contacts.length}
        actions={
          <>
            <ButtonLink variant="ghost" href="/contacts/lists">
              リスト管理
            </ButtonLink>
            {permissions.canUpload && (
              <ButtonLink variant="secondary" href="/contacts/import" icon={<Upload />}>
                CSVインポート
              </ButtonLink>
            )}
            {permissions.canSendEmail && (
              <Button variant="secondary" icon={<Mail />} onClick={() => setShowBulkSend(true)}>
                一括配信
              </Button>
            )}
            {permissions.canEdit && (
              <Button
                variant="primary"
                icon={<Plus />}
                onClick={() => { setEditingContact(null); setShowForm(true); }}
              >
                連絡先追加
              </Button>
            )}
          </>
        }
      />

      {errorMsg && (
        <div className="mb-4">
          <Alert tone="danger">{errorMsg}</Alert>
        </div>
      )}

      {feedbackMsg && (
        <div className="mb-4">
          <Alert tone="success">{feedbackMsg}</Alert>
        </div>
      )}

      {/* Search & Filter（入力・選択ごとに即時再取得する仕組みは fetchContacts の依存配列のまま） */}
      <Toolbar
        applied={isFiltered}
        clear={
          <Button variant="ghost" icon={<X />} onClick={() => { setQ(""); setListId(""); }}>
            クリア
          </Button>
        }
      >
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <SearchInput
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="メール・名前・企業名で検索..."
            active={Boolean(q)}
          />
          <div className="w-44">
            <Select
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              data-active={listId ? "true" : undefined}
            >
              <option value="">すべてのリスト</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="secondary" type="submit" icon={<Search />}>
            検索
          </Button>
        </form>
      </Toolbar>

      {/* Bulk Action Bar */}
      {canSelect && selected.size > 0 && (
        <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
          {permissions.canSendEmail && (
            <Button variant="secondary" size="sm" icon={<Send />} onClick={() => setShowSend(true)}>
              選択して送信
            </Button>
          )}
          {permissions.canEdit && (
            <Button
              variant="secondary"
              size="sm"
              icon={<ListPlus />}
              onClick={() => setShowAddToList(true)}
            >
              リストに追加
            </Button>
          )}
        </BulkActionBar>
      )}

      {loading ? (
        <TableSkeleton cols={6} />
      ) : (
        <Table>
          <thead>
            <tr>
              {canSelect && (
                <Th width="w-10" srLabel="選択" compact>
                  <Checkbox
                    checked={contacts.length > 0 && selected.size === contacts.length}
                    onChange={toggleAll}
                    aria-label="このページの全件を選択"
                  />
                </Th>
              )}
              <Th>メールアドレス</Th>
              <Th>名前</Th>
              <Th>企業名</Th>
              <Th>リスト</Th>
              <Th>購読状態</Th>
              <Th>登録元</Th>
              {permissions.canEdit && <Th width="w-32">操作</Th>}
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <Tr key={contact.id} selected={selected.has(contact.id)}>
                {canSelect && (
                  <Td>
                    <Checkbox
                      checked={selected.has(contact.id)}
                      onChange={() => toggle(contact.id)}
                      aria-label={`${contact.email}を選択`}
                    />
                  </Td>
                )}
                <Td primary>{contact.email}</Td>
                <Td>{contact.name}</Td>
                <Td>{contact.companyName}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {contact.memberships.map((m) => (
                      <Badge key={m.list.id} tone="neutral" size="sm">
                        {m.list.name}
                      </Badge>
                    ))}
                  </div>
                </Td>
                <Td>
                  <Badge tone={contact.subscribed ? "success" : "outline"}>
                    {contact.subscribed ? "購読中" : "配信停止"}
                  </Badge>
                </Td>
                <Td subtle>{contact.source || "-"}</Td>
                {/* 「配信を再開」は幅を取るうえ、配信停止の行にしか出ない。
                    横に並べると列幅が行ごとに変わって表が揃わないので、
                    固定幅の列に縦積みし、各リンクは折り返さない。 */}
                {permissions.canEdit && (
                  <Td top>
                    <div className="flex flex-col items-start gap-1">
                      <Button
                        variant="link"
                        onClick={() => { setEditingContact(contact); setShowForm(true); }}
                      >
                        編集
                      </Button>
                      {/* 配信を再開できるのは管理者のみ（API側でも role === "admin"
                          で弾いている）。代表者・編集者には出さない。 */}
                      {role === "admin" && !contact.subscribed && (
                        <button
                          type="button"
                          onClick={() => setResubscribingContact(contact)}
                          className="rounded-sm text-sm text-success-ink whitespace-nowrap hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          配信を再開
                        </button>
                      )}
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
            {contacts.length === 0 && (
              <EmptyState
                colSpan={emptyColSpan}
                icon={BookUser}
                title="連絡先データがありません"
                description={
                  isFiltered
                    ? "検索条件に一致する連絡先がありません。条件を変えるかクリアしてください"
                    : permissions.canEdit
                      ? "「連絡先追加」から登録すると、ここに表示されます"
                      : undefined
                }
              />
            )}
          </tbody>
        </Table>
      )}

      {showSend && (
        <SendModal
          selectedContacts={contacts.filter((c) => selected.has(c.id))}
          lists={lists}
          onClose={() => setShowSend(false)}
          onSent={() => {
            setSelected(new Set());
            setShowSend(false);
          }}
        />
      )}

      {showBulkSend && (
        <SendModal
          lists={lists}
          onClose={() => setShowBulkSend(false)}
          onSent={() => setShowBulkSend(false)}
        />
      )}

      {showForm && (
        <ContactFormModal
          contact={editingContact}
          lists={lists}
          onClose={() => { setShowForm(false); setEditingContact(null); }}
          onSaved={fetchContacts}
        />
      )}

      {showAddToList && (
        <AddToListModal
          contactIds={Array.from(selected)}
          lists={lists}
          onClose={() => setShowAddToList(false)}
          onAdded={(message) => {
            setFeedbackMsg(message);
            setSelected(new Set());
            fetchContacts();
          }}
        />
      )}

      {resubscribingContact && (
        <ResubscribeModal
          contact={resubscribingContact}
          onClose={() => setResubscribingContact(null)}
          onDone={(message) => {
            setFeedbackMsg(message);
            setResubscribingContact(null);
            fetchContacts();
          }}
        />
      )}
    </PageContainer>
  );
}

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsPageInner />
    </Suspense>
  );
}

function SendModal({
  selectedContacts,
  lists,
  onClose,
  onSent,
}: {
  selectedContacts?: Contact[];
  lists: ContactList[];
  onClose: () => void;
  onSent: () => void;
}) {
  const hasSelection = !!selectedContacts && selectedContacts.length > 0;
  const [target, setTarget] = useState<"selection" | "list">(hasSelection ? "selection" : "list");
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [excludeListIds, setExcludeListIds] = useState<string[]>([]);
  // 件数表示は連絡先そのものを持っておいて数える。除外の判定式（除外リストの
  // どれかに所属しているか）をサーバ側の送信条件とそろえるためで、こうしておく
  // と「画面に出た件数」と「実際に送られる件数」がずれない。
  const [listContacts, setListContacts] = useState<Contact[] | null>(null);

  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [defaultName, setDefaultName] = useState("ご担当者様");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [postalAddress, setPostalAddress] = useState<string | null>(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; html: string } | null>(null);
  const [previewError, setPreviewError] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testError, setTestError] = useState("");

  const subjectRef = useRef<HTMLInputElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedRef = useRef<"subject" | "html">("html");

  // 差し込みタグのボタンを label の中に置かないため、ラベルと入力欄は id で結ぶ
  const subjectId = useId();
  const htmlId = useId();

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPostalAddress(data.settings.postalAddress || "");
      });
  }, []);

  useEffect(() => {
    if (target !== "list" || selectedListIds.length === 0) {
      setListContacts(null);
      return;
    }
    const params = new URLSearchParams();
    selectedListIds.forEach((id) => params.append("listId", id));
    // /api/contacts dedupes contacts belonging to multiple selected lists
    // at the database level, so this count matches the actual send count.
    fetch(`/api/contacts?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setListContacts(data.contacts as Contact[]);
      });
  }, [target, selectedListIds]);

  const contactIds = selectedContacts?.map((c) => c.id);

  // 除外の判定はサーバ側 (/api/contacts/send) の
  // NOT memberships.some(listId in excludeListIds) と同じ条件。所属情報は
  // API から返ってきたものをそのまま使うので、ここでの件数は実際の送信件数と一致する。
  const isExcluded = useCallback(
    (c: Contact) => c.memberships.some((m) => excludeListIds.includes(String(m.list.id))),
    [excludeListIds]
  );

  // リスト配信は購読中のみが対象（未購読はもともと送信時にスキップされる）。
  // 個別選択は選んだ件数がそのまま母数 — 購読状態の絞り込みは従来どおり送信時に行う。
  const pool: Contact[] | null =
    target === "selection"
      ? (selectedContacts ?? [])
      : listContacts
        ? listContacts.filter((c) => c.subscribed)
        : null;

  const excludedCount = pool ? pool.filter(isExcluded).length : null;
  const listTotalCount = listContacts?.length ?? null;
  const targetCount = pool ? pool.length - (excludedCount ?? 0) : null;

  const canSend =
    (target === "selection" && hasSelection) ||
    (target === "list" && selectedListIds.length > 0);

  const selectedListNames = lists
    .filter((list) => selectedListIds.includes(String(list.id)))
    .map((list) => list.name)
    .join("、");

  function toggleExcludeListId(id: string) {
    setExcludeListIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleListId(id: string) {
    setSelectedListIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function insertTag(tag: string) {
    const placeholder = `{{${tag}}}`;
    if (lastFocusedRef.current === "subject") {
      const el = subjectRef.current;
      const pos = el?.selectionStart ?? subject.length;
      const next = subject.slice(0, pos) + placeholder + subject.slice(pos);
      setSubject(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(pos + placeholder.length, pos + placeholder.length);
      });
    } else {
      const el = htmlRef.current;
      const pos = el?.selectionStart ?? html.length;
      const next = html.slice(0, pos) + placeholder + html.slice(pos);
      setHtml(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(pos + placeholder.length, pos + placeholder.length);
      });
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewData(null);
    try {
      const res = await fetch("/api/contacts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, html, defaultName, preview: true }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data.preview);
      } else {
        setPreviewError(data.message);
      }
    } catch {
      setPreviewError("プレビューの取得に失敗しました");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleTestSend() {
    setTestSending(true);
    setTestError("");
    setTestResult("");
    try {
      const res = await fetch("/api/contacts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, html, defaultName, testEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(data.message);
      } else {
        setTestError(data.message);
      }
    } catch {
      setTestError("テスト送信に失敗しました");
    } finally {
      setTestSending(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;

    const countLabel = targetCount != null ? `${targetCount}件` : "選択した宛先";
    const excludeLabel =
      excludedCount && excludedCount > 0 ? `（除外リストで${excludedCount}件を除いています）` : "";
    if (!window.confirm(`${countLabel}に送信します${excludeLabel}。よろしいですか？`)) return;

    setSending(true);
    setError("");
    setResult("");

    try {
      const body =
        target === "selection"
          ? { contactIds, subject, html, defaultName, excludeListIds }
          : { listIds: selectedListIds, subject, html, defaultName, excludeListIds };

      const res = await fetch("/api/contacts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.message);
        onSent();
      } else {
        setError(data.message);
      }
    } catch {
      setError("送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  const tagButtons = (
    <div className="mb-1.5 flex gap-1.5">
      <Button variant="secondary" size="sm" onClick={() => insertTag("name")}>
        [お名前]
      </Button>
      <Button variant="secondary" size="sm" onClick={() => insertTag("company")}>
        [会社名]
      </Button>
    </div>
  );

  return (
    // 入力途中の本文が消える事故を防ぐため、背景クリック・Esc では閉じない（既存どおり）
    <Modal
      open
      onClose={onClose}
      title="メール配信"
      description={
        target === "selection"
          ? `選択した連絡先（${contactIds?.length ?? 0}件）に送信します`
          : selectedListIds.length > 0
            ? targetCount != null
              ? `配信対象: ${targetCount}件（購読中のみ、リスト全体${listTotalCount}件） / 対象リスト: ${selectedListNames}`
              : "配信対象を読み込み中..."
            : "配信先のリストを選択してください"
      }
      size="lg"
      as="form"
      onSubmit={handleSend}
      footerStart={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
      footer={
        <Button
          variant="primary"
          type="submit"
          disabled={sending || !canSend}
          loading={sending}
          icon={<Send />}
        >
          {sending ? "送信中..." : "送信する"}
        </Button>
      }
    >
      {postalAddress === "" && (
        <Alert tone="warning">
          フッターの住所が未設定です。
          <Link href="/settings" className="ml-1 font-medium underline">
            設定画面
          </Link>
          で入力してください。
        </Alert>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      {result && <Alert tone="success">{result}</Alert>}

      {/* Target selector */}
      <Card padding="sm">
        <CardTitle>配信先</CardTitle>
        <div className="mt-3 flex flex-col gap-2">
          {hasSelection && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <Radio
                checked={target === "selection"}
                onChange={() => setTarget("selection")}
              />
              選択した連絡先（{contactIds?.length}件）
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-ink">
            <Radio
              checked={target === "list"}
              onChange={() => setTarget("list")}
            />
            リストから選択（複数選択可）
          </label>
          {target === "list" && (
            <div className="ml-6 max-h-40 overflow-y-auto rounded-md border border-line bg-surface p-2">
              {lists.length === 0 ? (
                <EmptyState size="sm" title="リストがありません" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {lists.map((list) => (
                    <CheckPill
                      key={list.id}
                      checked={selectedListIds.includes(String(list.id))}
                      onChange={() => toggleListId(String(list.id))}
                    >
                      {list.name}
                    </CheckPill>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 除外リスト。配信先が「リスト」でも「個別選択」でも同じように効く
          （サーバ側も宛先条件と AND で組む）ので、配信先ブロックの外に置く。 */}
      <Card padding="sm">
        <CardTitle>除外するリスト（任意）</CardTitle>
        <CardDescription>
          ここで選んだリストに入っている人には、今回の配信は届きません。
        </CardDescription>
        <div className="mt-3 space-y-2">
          {lists.length === 0 ? (
            <p className="text-sm text-ink-subtle">リストがありません</p>
          ) : (
            <div className="max-h-40 overflow-y-auto rounded-md border border-line bg-surface p-2">
              <div className="flex flex-wrap gap-2">
                {lists.map((list) => (
                  <CheckPill
                    key={list.id}
                    checked={excludeListIds.includes(String(list.id))}
                    onChange={() => toggleExcludeListId(String(list.id))}
                  >
                    {list.name}
                  </CheckPill>
                ))}
              </div>
            </div>
          )}
          {excludeListIds.length > 0 && (
            excludedCount != null ? (
              <p className="text-sm text-ink tabular-nums">
                除外 <span className="font-medium">{excludedCount}件</span> →{" "}
                実際に送るのは <span className="font-medium">{targetCount}件</span>
              </p>
            ) : (
              <p className="text-sm text-ink-subtle">件数を計算中...</p>
            )
          )}
          {excludeListIds.length > 0 && targetCount === 0 && (
            <Alert tone="danger" compact>
              除外した結果、送信対象が0件です。このままでは送信できません。
            </Alert>
          )}
        </div>
      </Card>

      <Field label="件名" htmlFor={subjectId}>
        {tagButtons}
        <Input
          id={subjectId}
          ref={subjectRef}
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onFocus={() => (lastFocusedRef.current = "subject")}
          required
        />
      </Field>

      <Field label="本文（改行OK・HTML可）" htmlFor={htmlId}>
        {tagButtons}
        <Textarea
          id={htmlId}
          ref={htmlRef}
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          onFocus={() => (lastFocusedRef.current = "html")}
          required
          rows={10}
          placeholder="本文を入力してください。{{name}} / {{company}} / {{email}} で宛先ごとに差し込みできます。{{name|ご担当者様}} のようにフォールバック文字列も指定できます。"
        />
        <div className="mt-2">
          <Alert tone="info">
            改行はそのまま反映されます（Enterで段落を分けられます）。配信停止リンクと事務局情報は自動で本文末尾に付与されます。
          </Alert>
        </div>
      </Field>

      <Field
        label="名前が空のときの初期値"
        hint={<>{"{{name}}"} に値がなく、フォールバック指定もない場合に使われます。</>}
      >
        <div className="max-w-xs">
          <Input
            type="text"
            value={defaultName}
            onChange={(e) => setDefaultName(e.target.value)}
          />
        </div>
      </Field>

      {/* Preview */}
      <Card padding="sm">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>プレビュー</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePreview}
            disabled={previewLoading || !subject || !html}
            loading={previewLoading}
          >
            {previewLoading ? "読み込み中..." : "プレビュー表示"}
          </Button>
        </div>
        {previewError && (
          <div className="mt-3">
            <Alert tone="danger">{previewError}</Alert>
          </div>
        )}
        {previewData && (
          <div className="mt-3 overflow-hidden rounded-md border border-line">
            <div className="border-b border-line bg-surface-muted/60 px-3 py-2 text-sm text-ink">
              件名: {previewData.subject}
            </div>
            <iframe
              srcDoc={previewData.html}
              sandbox=""
              className="h-64 w-full bg-surface"
              title="メールプレビュー"
            />
          </div>
        )}
      </Card>

      {/* Test send */}
      <Card padding="sm">
        <CardTitle>テスト送信</CardTitle>
        <div className="mt-3 flex gap-2">
          <div className="flex-1">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
            />
          </div>
          <Button
            variant="secondary"
            onClick={handleTestSend}
            disabled={testSending || !testEmail || !subject || !html}
            loading={testSending}
          >
            {testSending ? "送信中..." : "テスト送信"}
          </Button>
        </div>
        {testError && (
          <div className="mt-3">
            <Alert tone="danger">{testError}</Alert>
          </div>
        )}
        {testResult && (
          <div className="mt-3">
            <Alert tone="success">{testResult}</Alert>
          </div>
        )}
      </Card>
    </Modal>
  );
}

function ContactFormModal({
  contact,
  lists,
  onClose,
  onSaved,
}: {
  contact: Contact | null;
  lists: ContactList[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!contact;
  const [email, setEmail] = useState(contact?.email || "");
  const [name, setName] = useState(contact?.name || "");
  const [companyName, setCompanyName] = useState(contact?.companyName || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [selectedListIds, setSelectedListIds] = useState<string[]>(
    contact?.memberships.map((m) => String(m.list.id)) || []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleListId(id: string) {
    setSelectedListIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(
        isEdit ? `/api/contacts/${contact!.id}` : "/api/contacts",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            name,
            companyName,
            phone,
            listIds: selectedListIds.map((id) => Number(id)),
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

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "連絡先編集" : "連絡先追加"}
      size="md"
      as="form"
      onSubmit={handleSubmit}
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

      <Field label="メールアドレス">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>
      <Field label="名前">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="企業名">
        <Input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
      </Field>
      <Field label="電話番号">
        <Input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>

      {/* CheckPill は label 要素なので Field（label で包む）ではなく FieldLabel */}
      <div>
        <FieldLabel>リスト</FieldLabel>
        {lists.length === 0 ? (
          <p className="text-sm text-ink-subtle">リストがありません</p>
        ) : (
          <div className="max-h-40 overflow-y-auto rounded-md border border-line bg-surface p-2">
            <div className="flex flex-wrap gap-2">
              {lists.map((list) => (
                <CheckPill
                  key={list.id}
                  checked={selectedListIds.includes(String(list.id))}
                  onChange={() => toggleListId(String(list.id))}
                >
                  {list.name}
                </CheckPill>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AddToListModal({
  contactIds,
  lists,
  onClose,
  onAdded,
}: {
  contactIds: number[];
  lists: ContactList[];
  onClose: () => void;
  onAdded: (message: string) => void;
}) {
  const [listId, setListId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listId) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/contacts/add-to-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, listId: Number(listId) }),
      });
      const data = await res.json();
      if (data.success) {
        onAdded(data.message);
        onClose();
      } else {
        setError(data.message);
      }
    } catch {
      setError("追加に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="リストに追加"
      description={`${contactIds.length}件の連絡先を追加します`}
      size="sm"
      as="form"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={saving || !listId}
            loading={saving}
            icon={<ListPlus />}
          >
            {saving ? "追加中..." : "追加する"}
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}

      <Field label="追加先リスト" hint={lists.length === 0 ? "リストがありません" : undefined}>
        <Select
          value={listId}
          onChange={(e) => setListId(e.target.value)}
          required
        >
          <option value="" disabled>
            リストを選択してください
          </option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

// 配信停止中の連絡先を「購読中」に戻すモーダル。
//
// 特定電子メール法上、配信停止済みの相手には本人からの再開希望がない限り
// 再送してはいけない（事務局判断で勝手に戻さない）。理由の入力を必須にし、
// 実行前にもう一段確認を挟むことで、誰が・いつ・なぜ戻したかを後から
// 示せるようにしている（実際の記録は監査ログ側 — API 側の writeAuditLog）。
function ResubscribeModal({
  contact,
  onClose,
  onDone,
}: {
  contact: Contact;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = reason.trim().length > 0;

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/contacts/${contact.id}/resubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        onDone(`${contact.email} の配信を再開しました`);
      } else {
        setError(data.message || "配信再開に失敗しました");
        setConfirming(false);
      }
    } catch {
      setError("配信再開に失敗しました");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="配信を再開"
      description={`${contact.email} を「購読中」に戻します`}
      size="md"
      // 確認段階はフッタ左の InlineConfirm に置き換え、右のボタン列は出さない（既存の2段階を維持）
      footerStart={
        confirming ? (
          <InlineConfirm
            tone="warning"
            message={`${contact.email} 宛への配信を再開します。よろしいですか？`}
            confirmLabel="実行する"
            loadingLabel="実行中..."
            onConfirm={handleConfirm}
            onCancel={() => setConfirming(false)}
            loading={submitting}
          />
        ) : undefined
      }
      footer={
        confirming ? undefined : (
          <>
            <Button variant="secondary" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={() => setConfirming(true)}
              disabled={!canSubmit}
            >
              配信を再開
            </Button>
          </>
        )
      }
    >
      <Alert tone="info" compact>
        特定電子メール法上、配信停止済みの相手には本人からの再開希望がない限り再送できません。
        誰が・いつ・なぜ戻したかを後から示せるよう、理由の入力が必須です。
      </Alert>

      {error && <Alert tone="danger">{error}</Alert>}

      <Field label="再開理由">
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="例: 本人より再開希望のメールを受領 2026/8/25"
        />
      </Field>
    </Modal>
  );
}
