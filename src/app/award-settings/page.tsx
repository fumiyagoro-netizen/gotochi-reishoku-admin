"use client";

import { useState, useEffect, useCallback } from "react";

interface Award {
  id: number;
  year: number;
  name: string;
  isActive: boolean;
  entryStartDate: string | null;
  entryEndDate: string | null;
  notifyEmails: string;
  createdAt: string;
  _count: { entries: number };
}

export default function AwardSettingsPage() {
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editNotify, setEditNotify] = useState("");

  const fetchAwards = useCallback(async () => {
    const res = await fetch("/api/awards");
    const data = await res.json();
    setAwards(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAwards();
  }, [fetchAwards]);

  useEffect(() => {
    if (showForm && newYear) {
      setNewName(`ご当地冷凍食品大賞 ${newYear}`);
    }
  }, [showForm, newYear]);

  async function handleCreate() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/awards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: newYear, name: newName, isActive: false }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message);
      setSaving(false);
      return;
    }
    setShowForm(false);
    setNewYear(new Date().getFullYear() + 1);
    setNewName("");
    setSaving(false);
    fetchAwards();
  }

  async function toggleActive(award: Award) {
    const newActive = !award.isActive;
    const msg = newActive
      ? `「${award.name}」のエントリー受付を開始しますか？\n（他の年度の受付は自動的に停止します）`
      : `「${award.name}」のエントリー受付を停止しますか？`;
    if (!confirm(msg)) return;

    await fetch(`/api/awards/${award.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: newActive }),
    });
    fetchAwards();
  }

  function startEdit(award: Award) {
    setEditingId(award.id);
    setEditStart(award.entryStartDate ? award.entryStartDate.slice(0, 10) : "");
    setEditEnd(award.entryEndDate ? award.entryEndDate.slice(0, 10) : "");
    setEditNotify(award.notifyEmails);
  }

  async function saveEdit(awardId: number) {
    setSaving(true);
    await fetch(`/api/awards/${awardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryStartDate: editStart || null,
        entryEndDate: editEnd || null,
        notifyEmails: editNotify,
      }),
    });
    setEditingId(null);
    setSaving(false);
    fetchAwards();
  }

  async function handleDelete(award: Award) {
    if (!confirm(`「${award.name}」を削除しますか？`)) return;
    const res = await fetch(`/api/awards/${award.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message);
      return;
    }
    fetchAwards();
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">年度管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            開催年度の追加・エントリー受付の開始/停止を管理します
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 新しい年度を追加
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">新しい年度を追加</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年度</label>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={saving || !newName}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "作成中..." : "作成"}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(""); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Awards List */}
      <div className="space-y-4">
        {awards.map((award) => (
          <div
            key={award.id}
            className={`bg-white rounded-xl border p-6 ${
              award.isActive ? "border-green-300 bg-green-50/30" : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{award.year}</p>
                  <p className="text-xs text-gray-500">年度</p>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{award.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-600">
                      エントリー: <span className="font-bold">{award._count.entries}</span>件
                    </span>
                    {award.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        受付中
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                        受付停止
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(award)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  設定
                </button>
                <button
                  onClick={() => toggleActive(award)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    award.isActive
                      ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {award.isActive ? "受付停止" : "受付開始"}
                </button>
                {award._count.entries === 0 && (
                  <button
                    onClick={() => handleDelete(award)}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>

            {/* Period & notification info */}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
              {award.entryStartDate && (
                <span>受付開始: {new Date(award.entryStartDate).toLocaleDateString("ja-JP")}</span>
              )}
              {award.entryEndDate && (
                <span>受付締切: {new Date(award.entryEndDate).toLocaleDateString("ja-JP")}</span>
              )}
              {award.notifyEmails && (
                <span>通知先: {award.notifyEmails.split(",").length}件</span>
              )}
            </div>

            {/* Edit panel */}
            {editingId === award.id && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">受付開始日</label>
                    <input
                      type="date"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">受付締切日</label>
                    <input
                      type="date"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    エントリー通知先メールアドレス
                  </label>
                  <input
                    type="text"
                    value={editNotify}
                    onChange={(e) => setEditNotify(e.target.value)}
                    placeholder="例: admin@example.com, staff@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">カンマ区切りで複数設定可。エントリー時に通知が届きます。</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => saveEdit(award.id)}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {award.isActive && editingId !== award.id && (
              <div className="mt-4 pt-4 border-t border-green-200">
                <p className="text-sm text-green-700">
                  エントリーフォーム: <code className="bg-green-100 px-2 py-0.5 rounded text-xs">/entry</code> からこの年度にエントリーが受け付けられます
                </p>
              </div>
            )}
          </div>
        ))}

        {awards.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">年度が登録されていません</p>
            <p className="text-sm">「新しい年度を追加」ボタンから作成してください</p>
          </div>
        )}
      </div>
    </div>
  );
}
