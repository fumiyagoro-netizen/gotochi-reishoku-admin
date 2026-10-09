"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, buttonClassName } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { CardSkeleton } from "@/components/ui/skeleton";

type BackupFile = { pathname: string; size: number; uploadedAt: string };

/** 最新のバックアップがこれより古ければ、自動バックアップが止まっている可能性を知らせる */
const STALE_HOURS = 36;
const SHOW = 10;

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function fmtSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * 設定画面の「バックアップ」。毎日の自動バックアップ（src/lib/backup.ts）の状況を見て、
 * 手動で取ったり、ファイルをダウンロードしたりする。管理者だけが開ける設定画面の中に置く。
 */
export function BackupCard() {
  const [files, setFiles] = useState<BackupFile[] | null>(null);
  const [retention, setRetention] = useState(30);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/backups");
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setFiles(data.files);
      setRetention(data.retentionDays);
      setLoadFailed(false);
    } catch {
      setError("バックアップの一覧を読めませんでした");
      setLoadFailed(true);
      setFiles([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runNow() {
    setRunning(true);
    setError("");
    setDone(false);
    try {
      const res = await fetch("/api/backups", { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setDone(true);
      await load();
    } catch {
      setError("バックアップに失敗しました。時間をおいてもう一度お試しください。");
    } finally {
      setRunning(false);
    }
  }

  if (!files) return <CardSkeleton lines={4} />;

  const latest = files[0];
  const ageHours = latest ? (Date.now() - new Date(latest.uploadedAt).getTime()) / 3_600_000 : Infinity;

  return (
    <Card padding="none">
      <CardHeader
        title="バックアップ"
        description={`毎日 午前3時ごろ（日本時間）に、エントリー・受賞・見込み客・フォームの回答などすべてのデータを自動で保存し、${retention}日分を残します。`}
        actions={
          <Button size="sm" onClick={runNow} disabled={running} loading={running}>
            {running ? "保存中..." : "今すぐバックアップ"}
          </Button>
        }
      />
      <div className="space-y-3 p-5">
        {error && <Alert tone="danger" compact>{error}</Alert>}
        {done && <Alert tone="success" compact>バックアップを保存しました</Alert>}
        {loadFailed ? null : !latest ? (
          <Alert tone="warning" compact>まだバックアップがありません。「今すぐバックアップ」で1回目を取れます。</Alert>
        ) : ageHours > STALE_HOURS ? (
          <Alert tone="warning" compact>
            最新のバックアップが {fmtTime(latest.uploadedAt)} です。自動バックアップが止まっている可能性があります。
          </Alert>
        ) : (
          <p className="text-sm text-ink">
            最新：{fmtTime(latest.uploadedAt)}（全{files.length}件を保管中）
          </p>
        )}
        {files.length > 0 && (
          <ul className="divide-y divide-line rounded-md border border-line">
            {files.slice(0, SHOW).map((f) => (
              <li key={f.pathname} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-ink">
                  {fmtTime(f.uploadedAt)}
                  <span className="ml-2 text-caption text-ink-subtle">
                    {f.pathname.endsWith("_manual.json.gz") ? "手動" : "自動"}・{fmtSize(f.size)}
                  </span>
                </span>
                <a
                  className={buttonClassName({ variant: "link", size: "sm" })}
                  href={`/api/backups/download?p=${encodeURIComponent(f.pathname)}`}
                >
                  ダウンロード
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="text-caption text-ink-subtle">
          ダウンロードしたファイルには応募者・見込み客の個人情報が含まれます。保管と受け渡しに注意してください。
          ダウンロードした記録は操作ログに残ります。
        </p>
      </div>
    </Card>
  );
}
