"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/lib/role-context";

interface FooterSettings {
  senderName: string;
  orgName: string;
  postalAddress: string;
  contactEmail: string;
  contactTel: string;
}

export default function SettingsPage() {
  const { role } = useRole();
  const [settings, setSettings] = useState<FooterSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSettings(data.settings);
      });
  }, []);

  if (role !== "admin") {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">設定の閲覧・編集権限がありません</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setSaved(true);
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
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-8">設定</h2>

      {!settings ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : (
        <div className="max-w-xl">
          <h3 className="text-sm font-medium text-gray-700 mb-3">メール送信元情報</h3>
          <p className="text-xs text-gray-400 mb-4">
            見込み客へのメール配信時、本文末尾のフッターに使用されます。
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}
          {saved && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
              保存しました
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">差出人名</span>
                <input
                  type="text"
                  value={settings.senderName}
                  onChange={(e) => setSettings({ ...settings, senderName: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">団体名</span>
                <input
                  type="text"
                  value={settings.orgName}
                  onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  郵送先住所
                  {settings.postalAddress === "" && (
                    <span className="ml-2 text-xs text-amber-600 font-normal">未設定</span>
                  )}
                </span>
                <input
                  type="text"
                  value={settings.postalAddress}
                  onChange={(e) => setSettings({ ...settings, postalAddress: e.target.value })}
                  placeholder="例: 東京都〇〇区〇〇1-2-3"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">問い合わせ先メール</span>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">問い合わせ先電話番号</span>
                <input
                  type="text"
                  value={settings.contactTel}
                  onChange={(e) => setSettings({ ...settings, contactTel: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium
                hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "保存中..." : "保存する"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
