"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [listId, setListId] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showSend, setShowSend] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (listId) params.set("listId", listId);
    const res = await fetch(`/api/contacts?${params.toString()}`);
    const data = await res.json();
    if (data.success) setContacts(data.contacts);
    setLoading(false);
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
          {permissions.canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium
                hover:bg-blue-700 transition-colors"
            >
              + 連絡先追加
            </button>
          )}
        </div>
      </div>

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
      {permissions.canEdit && selected.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
          <span className="text-sm font-medium text-blue-700">
            {selected.size}件選択中
          </span>
          <button
            onClick={() => setShowSend(true)}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg font-medium
              hover:bg-blue-700 transition-colors"
          >
            ✉️ 選択して送信
          </button>
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
                {permissions.canEdit && (
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
                  {permissions.canEdit && (
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
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
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
          onClose={() => setShowSend(false)}
          onSent={() => {
            setSelected(new Set());
            setShowSend(false);
          }}
        />
      )}

      {showForm && (
        <ContactFormModal
          onClose={() => setShowForm(false)}
          onSaved={fetchContacts}
        />
      )}
    </div>
  );
}

function SendModal({
  contactIds,
  onClose,
  onSent,
}: {
  contactIds: number[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [postalAddress, setPostalAddress] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPostalAddress(data.settings.postalAddress || "");
      });
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/contacts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, subject, html }),
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
          メール送信
        </h3>
        <p className="text-sm text-gray-500 mb-4">{contactIds.length}件に送信します</p>

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
          <label className="block">
            <span className="text-sm font-medium text-gray-700">件名</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">本文（HTML可）</span>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              required
              rows={10}
              placeholder="本文を入力してください。{{name}} / {{company}} で宛先ごとに差し込みできます。"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              配信停止リンクと事務局情報は自動で本文末尾に付与されます。
            </p>
          </label>

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
              disabled={sending}
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
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, companyName, phone }),
      });
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">連絡先追加</h3>

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
