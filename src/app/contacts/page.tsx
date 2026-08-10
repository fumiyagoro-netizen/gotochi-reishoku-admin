"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRole } from "@/lib/role-context";

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

export default function ContactsPage() {
  const { permissions } = useRole();
  // 行選択（チェックボックス）は一斉送信・リスト一括追加のどちらかが使える人に表示
  const canSelect = permissions.canSendEmail || permissions.canEdit;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [listId, setListId] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showSend, setShowSend] = useState(false);
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
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
          見込み客・連絡先
          <span className="text-base font-normal text-gray-500 ml-3">
            {contacts.length}件
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href="/contacts/lists"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700
              hover:bg-gray-50 transition-colors"
          >
            リスト管理
          </Link>
          {permissions.canUpload && (
            <Link
              href="/contacts/import"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700
                hover:bg-gray-50 transition-colors"
            >
              CSVインポート
            </Link>
          )}
          {permissions.canSendEmail && (
            <button
              onClick={() => setShowBulkSend(true)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700
                hover:bg-gray-50 transition-colors"
            >
              ✉️ 一括配信
            </button>
          )}
          {permissions.canEdit && (
            <button
              onClick={() => { setEditingContact(null); setShowForm(true); }}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium
                hover:bg-blue-700 transition-colors"
            >
              + 連絡先追加
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg break-words">
          {errorMsg}
        </div>
      )}

      {feedbackMsg && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg break-words">
          {feedbackMsg}
        </div>
      )}

      {/* Search & Filter */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="メール・名前・企業名で検索..."
          className="flex-1 max-w-md px-4 py-2.5 border border-gray-300 rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={listId}
          onChange={(e) => setListId(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">すべてのリスト</option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium
            hover:bg-blue-700 transition-colors"
        >
          検索
        </button>
        {(q || listId) && (
          <button
            type="button"
            onClick={() => { setQ(""); setListId(""); }}
            className="px-4 py-2.5 text-gray-600 border border-gray-300 rounded-lg text-sm
              hover:bg-gray-50 transition-colors"
          >
            クリア
          </button>
        )}
      </form>

      {/* Bulk Action Bar */}
      {canSelect && selected.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
          <span className="text-sm font-medium text-blue-700">
            {selected.size}件選択中
          </span>
          {permissions.canSendEmail && (
            <button
              onClick={() => setShowSend(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg font-medium
                hover:bg-blue-700 transition-colors"
            >
              ✉️ 選択して送信
            </button>
          )}
          {permissions.canEdit && (
            <button
              onClick={() => setShowAddToList(true)}
              className="px-3 py-1.5 border border-blue-300 text-blue-700 bg-white text-sm rounded-lg
                font-medium hover:bg-blue-100 transition-colors"
            >
              リストに追加
            </button>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-sm text-gray-500 hover:text-gray-700"
          >
            選択解除
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {canSelect && (
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={contacts.length > 0 && selected.size === contacts.length}
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">メールアドレス</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">名前</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">企業名</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">リスト</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">購読状態</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">登録元</th>
                {permissions.canEdit && (
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    selected.has(contact.id) ? "bg-blue-50/50" : ""
                  }`}
                >
                  {canSelect && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(contact.id)}
                        onChange={() => toggle(contact.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-900">{contact.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{contact.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{contact.companyName}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.memberships.map((m) => (
                        <span
                          key={m.list.id}
                          className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          {m.list.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                        contact.subscribed
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {contact.subscribed ? "購読中" : "配信停止"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{contact.source || "-"}</td>
                  {permissions.canEdit && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setEditingContact(contact); setShowForm(true); }}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        編集
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td
                    colSpan={6 + (canSelect ? 1 : 0) + (permissions.canEdit ? 1 : 0)}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    連絡先データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showSend && (
        <SendModal
          contactIds={Array.from(selected)}
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
    </div>
  );
}

function SendModal({
  contactIds,
  lists,
  onClose,
  onSent,
}: {
  contactIds?: number[];
  lists: ContactList[];
  onClose: () => void;
  onSent: () => void;
}) {
  const hasSelection = !!contactIds && contactIds.length > 0;
  const [target, setTarget] = useState<"selection" | "list">(hasSelection ? "selection" : "list");
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [listSubscribedCount, setListSubscribedCount] = useState<number | null>(null);
  const [listTotalCount, setListTotalCount] = useState<number | null>(null);

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

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPostalAddress(data.settings.postalAddress || "");
      });
  }, []);

  useEffect(() => {
    if (target !== "list" || selectedListIds.length === 0) {
      setListSubscribedCount(null);
      setListTotalCount(null);
      return;
    }
    const params = new URLSearchParams();
    selectedListIds.forEach((id) => params.append("listId", id));
    // /api/contacts dedupes contacts belonging to multiple selected lists
    // at the database level, so this count matches the actual send count.
    fetch(`/api/contacts?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const contactsInLists: { subscribed: boolean }[] = data.contacts;
          setListTotalCount(contactsInLists.length);
          setListSubscribedCount(contactsInLists.filter((c) => c.subscribed).length);
        }
      });
  }, [target, selectedListIds]);

  const targetCount =
    target === "selection" ? (contactIds?.length ?? 0) : listSubscribedCount;

  const canSend =
    (target === "selection" && hasSelection) ||
    (target === "list" && selectedListIds.length > 0);

  const selectedListNames = lists
    .filter((list) => selectedListIds.includes(String(list.id)))
    .map((list) => list.name)
    .join("、");

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
    if (!window.confirm(`${countLabel}に送信します。よろしいですか？`)) return;

    setSending(true);
    setError("");
    setResult("");

    try {
      const body =
        target === "selection"
          ? { contactIds, subject, html, defaultName }
          : { listIds: selectedListIds, subject, html, defaultName };

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

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          メール配信
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {target === "selection"
            ? `選択した連絡先（${contactIds?.length ?? 0}件）に送信します`
            : selectedListIds.length > 0
              ? listSubscribedCount != null
                ? `配信対象: ${listSubscribedCount}件（購読中のみ、リスト全体${listTotalCount}件） / 対象リスト: ${selectedListNames}`
                : "配信対象を読み込み中..."
              : "配信先のリストを選択してください"}
        </p>

        {postalAddress === "" && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
            フッターの住所が未設定です。
            <Link href="/settings" className="underline ml-1">
              設定画面
            </Link>
            で入力してください。
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}
        {result && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
            {result}
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          {/* Target selector */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
            <span className="text-sm font-medium text-gray-700 block">配信先</span>
            <div className="flex flex-col gap-2">
              {hasSelection && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={target === "selection"}
                    onChange={() => setTarget("selection")}
                  />
                  選択した連絡先（{contactIds?.length}件）
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={target === "list"}
                  onChange={() => setTarget("list")}
                />
                リストから選択（複数選択可）
              </label>
              {target === "list" && (
                <div className="ml-6 max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white p-2 space-y-1">
                  {lists.length === 0 ? (
                    <p className="text-sm text-gray-400 px-1 py-0.5">リストがありません</p>
                  ) : (
                    lists.map((list) => (
                      <label
                        key={list.id}
                        className="flex items-center gap-2 text-sm text-gray-700 px-1 py-0.5 rounded
                          hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedListIds.includes(String(list.id))}
                          onChange={() => toggleListId(String(list.id))}
                          className="rounded border-gray-300"
                        />
                        {list.name}
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">件名</span>
            <div className="flex gap-1 mt-1 mb-1">
              <button
                type="button"
                onClick={() => insertTag("name")}
                className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              >
                [お名前]
              </button>
              <button
                type="button"
                onClick={() => insertTag("company")}
                className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              >
                [会社名]
              </button>
            </div>
            <input
              ref={subjectRef}
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => (lastFocusedRef.current = "subject")}
              required
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">本文（改行OK・HTML可）</span>
            <div className="flex gap-1 mt-1 mb-1">
              <button
                type="button"
                onClick={() => insertTag("name")}
                className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              >
                [お名前]
              </button>
              <button
                type="button"
                onClick={() => insertTag("company")}
                className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              >
                [会社名]
              </button>
            </div>
            <textarea
              ref={htmlRef}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              onFocus={() => (lastFocusedRef.current = "html")}
              required
              rows={10}
              placeholder="本文を入力してください。{{name}} / {{company}} / {{email}} で宛先ごとに差し込みできます。{{name|ご担当者様}} のようにフォールバック文字列も指定できます。"
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              改行はそのまま反映されます（Enterで段落を分けられます）。配信停止リンクと事務局情報は自動で本文末尾に付与されます。
            </p>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">名前が空のときの初期値</span>
            <input
              type="text"
              value={defaultName}
              onChange={(e) => setDefaultName(e.target.value)}
              className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              {"{{name}}"} に値がなく、フォールバック指定もない場合に使われます。
            </p>
          </label>

          {/* Preview */}
          <div className="p-3 border border-gray-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">プレビュー</span>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewLoading || !subject || !html}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700
                  hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {previewLoading ? "読み込み中..." : "プレビュー表示"}
              </button>
            </div>
            {previewError && (
              <p className="text-sm text-red-600">{previewError}</p>
            )}
            {previewData && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-700">
                  件名: {previewData.subject}
                </div>
                <iframe
                  srcDoc={previewData.html}
                  sandbox=""
                  className="w-full h-64 bg-white"
                  title="メールプレビュー"
                />
              </div>
            )}
          </div>

          {/* Test send */}
          <div className="p-3 border border-gray-200 rounded-lg space-y-2">
            <span className="text-sm font-medium text-gray-700 block">テスト送信</span>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleTestSend}
                disabled={testSending || !testEmail || !subject || !html}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700
                  hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {testSending ? "送信中..." : "テスト送信"}
              </button>
            </div>
            {testError && <p className="text-sm text-red-600">{testError}</p>}
            {testResult && <p className="text-sm text-green-600">{testResult}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg
                hover:bg-gray-50 transition-colors"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={sending || !canSend}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg font-medium
                hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {sending ? "送信中..." : "送信する"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {isEdit ? "連絡先編集" : "連絡先追加"}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">名前</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">企業名</span>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">電話番号</span>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div>
            <span className="text-sm font-medium text-gray-700 block mb-1">リスト</span>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white p-2 space-y-1">
              {lists.length === 0 ? (
                <p className="text-sm text-gray-400 px-1 py-0.5">リストがありません</p>
              ) : (
                lists.map((list) => (
                  <label
                    key={list.id}
                    className="flex items-center gap-2 text-sm text-gray-700 px-1 py-0.5 rounded
                      hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedListIds.includes(String(list.id))}
                      onChange={() => toggleListId(String(list.id))}
                      className="rounded border-gray-300"
                    />
                    {list.name}
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
        </form>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">リストに追加</h3>
        <p className="text-sm text-gray-500 mb-4">
          {contactIds.length}件の連絡先を追加します
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">追加先リスト</span>
            <select
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                リストを選択してください
              </option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
            {lists.length === 0 && (
              <p className="mt-1 text-sm text-gray-400">リストがありません</p>
            )}
          </label>

          <div className="flex justify-end gap-2 pt-2">
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
              disabled={saving || !listId}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg font-medium
                hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "追加中..." : "追加する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
