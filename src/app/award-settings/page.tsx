"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/lib/role-context";
import { utcToJstDateInputValue } from "@/lib/award-dates";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardHeader, CardFooter, NoPermission } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/field-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Settings2,
  PlayCircle,
  PauseCircle,
  Trash2,
  CalendarDays,
} from "@/components/ui/icons";

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
  const { role } = useRole();
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

  if (role !== "admin") {
    return (
      <PageContainer width="form">
        <NoPermission message="年度管理の閲覧・編集権限がありません" />
      </PageContainer>
    );
  }

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
    setEditStart(utcToJstDateInputValue(award.entryStartDate));
    setEditEnd(utcToJstDateInputValue(award.entryEndDate));
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
      <PageContainer width="form">
        <Skeleton className="mb-6 h-7 w-32" />
        <CardSkeleton lines={3} />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="form">
      <PageHeader
        title="年度管理"
        description="開催年度の追加・エントリー受付の開始/停止を管理します"
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setShowForm(true)}>
            新しい年度を追加
          </Button>
        }
      />

      {/* Create Form */}
      {showForm && (
        <div className="mb-6">
          <Card padding="none">
            <CardHeader title="新しい年度を追加" />
            <div className="p-5">
              {error && (
                <div className="mb-4">
                  <Alert tone="danger">{error}</Alert>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <Field label="年度">
                  <Input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(parseInt(e.target.value))}
                  />
                </Field>
                <Field label="名称">
                  <Input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </Field>
              </div>
            </div>
            <CardFooter>
              <Button variant="ghost" onClick={() => { setShowForm(false); setError(""); }}>
                キャンセル
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={saving || !newName}
                loading={saving}
              >
                {saving ? "作成中..." : "作成"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Awards List */}
      <div className="space-y-4">
        {awards.map((award) => (
          // 受付中の年度だけ枠を強調する（ボタン色ではなく面で「今の状態」を示す）
          <Card key={award.id} tone={award.isActive ? "active" : "default"}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="shrink-0 text-center">
                  <p className="text-2xl font-semibold tabular-nums tracking-tight text-ink">{award.year}</p>
                  <p className="text-caption text-ink-subtle">年度</p>
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-ink" title={award.name}>{award.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-ink-muted">
                      エントリー: <span className="font-semibold tabular-nums text-ink">{award._count.entries}</span>件
                    </span>
                    {award.isActive ? (
                      <Badge tone="success" dot="pulse">受付中</Badge>
                    ) : (
                      <Badge tone="outline">受付停止</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" size="sm" icon={<Settings2 />} onClick={() => startEdit(award)}>
                  設定
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={award.isActive ? <PauseCircle /> : <PlayCircle />}
                  onClick={() => toggleActive(award)}
                >
                  {award.isActive ? "受付停止" : "受付開始"}
                </Button>
                {award._count.entries === 0 && (
                  <Button variant="dangerGhost" size="sm" icon={<Trash2 />} onClick={() => handleDelete(award)}>
                    削除
                  </Button>
                )}
              </div>
            </div>

            {/* Period & notification info */}
            <div className="mt-3 flex flex-wrap gap-4 text-caption text-ink-subtle">
              {award.entryStartDate && (
                <span>受付開始: {new Date(award.entryStartDate).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
              )}
              {award.entryEndDate && (
                <span>受付締切: {new Date(award.entryEndDate).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
              )}
              {award.notifyEmails && (
                <span>通知先: {award.notifyEmails.split(",").length}件</span>
              )}
            </div>

            {/* Edit panel */}
            {editingId === award.id && (
              <div className="mt-4 space-y-5 border-t border-line pt-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                  <Field label="受付開始日">
                    <Input
                      type="date"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                    />
                  </Field>
                  <Field label="受付締切日">
                    <Input
                      type="date"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                    />
                  </Field>
                </div>
                <Field
                  label="エントリー通知先メールアドレス"
                  hint="カンマ区切りで複数設定可。エントリー時に通知が届きます。"
                >
                  <Input
                    type="text"
                    value={editNotify}
                    onChange={(e) => setEditNotify(e.target.value)}
                    placeholder="例: admin@example.com, staff@example.com"
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditingId(null)}>
                    キャンセル
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => saveEdit(award.id)}
                    disabled={saving}
                    loading={saving}
                  >
                    {saving ? "保存中..." : "保存"}
                  </Button>
                </div>
              </div>
            )}

            {award.isActive && editingId !== award.id && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm text-ink-muted">
                  エントリーフォーム: <code className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-caption text-ink">/entry</code> からこの年度にエントリーが受け付けられます
                </p>
              </div>
            )}
          </Card>
        ))}

        {awards.length === 0 && (
          <Card>
            <EmptyState
              icon={CalendarDays}
              title="年度が登録されていません"
              description="「新しい年度を追加」ボタンから作成してください"
            />
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
