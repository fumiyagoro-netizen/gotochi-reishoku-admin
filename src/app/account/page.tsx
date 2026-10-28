"use client";

import { useCallback, useEffect, useState } from "react";
import { browserSupportsWebAuthn, startRegistration, WebAuthnError } from "@simplewebauthn/browser";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/field-controls";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { Skeleton } from "@/components/ui/skeleton";
import { Fingerprint, Plus } from "@/components/ui/icons";

interface Passkey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" });
}

/**
 * アカウント（全権限）。自分のパスキーの登録・削除と、自分のパスワードの変更。
 * ほかの人の分は扱わない（管理者がほかの人を直すのはユーザー管理画面）。
 */
export default function AccountPage() {
  return (
    <PageContainer width="form">
      <PageHeader title="アカウント" description="ログインの方法を設定します。" />
      <div className="space-y-6">
        <PasskeySection />
        <PasswordSection />
      </div>
    </PageContainer>
  );
}

function PasskeySection() {
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    const res = await fetch("/api/account/passkeys");
    const data = await res.json();
    if (data.success) setPasskeys(data.passkeys);
  }, []);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    fetchPasskeys();
  }, [fetchPasskeys]);

  async function handleRegister() {
    setMessage(null);
    setRegistering(true);
    try {
      const optionsRes = await fetch("/api/account/passkeys/options", { method: "POST" });
      const optionsData = await optionsRes.json();
      if (!optionsData.success) {
        setMessage({ tone: "danger", text: optionsData.message });
        return;
      }

      let attestation;
      try {
        attestation = await startRegistration({ optionsJSON: optionsData.options });
      } catch (error) {
        // 本人確認の画面を閉じた・時間切れ。ブラウザはどちらも同じエラーにするので区別しない
        if (error instanceof WebAuthnError && error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
          setMessage({ tone: "danger", text: "この端末のパスキーはすでに登録されています。" });
        } else {
          setMessage({ tone: "danger", text: "登録を中止しました。もう一度お試しください。" });
        }
        return;
      }

      const res = await fetch("/api/account/passkeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestation),
      });
      const data = await res.json();
      if (!data.success) {
        setMessage({ tone: "danger", text: data.message });
        return;
      }
      setMessage({ tone: "success", text: `パスキーを登録しました（${data.passkey.name}）。次回からログイン画面の「パスキーでログイン」で入れます。` });
      fetchPasskeys();
    } catch {
      setMessage({ tone: "danger", text: "パスキーを登録できませんでした" });
    } finally {
      setRegistering(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/account/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setConfirmingId(null);
        setMessage(null);
        fetchPasskeys();
      } else {
        setMessage({ tone: "danger", text: data.message });
      }
    } catch {
      setMessage({ tone: "danger", text: "削除できませんでした" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card as="section" padding="none">
      <CardHeader
        title="パスキー"
        description="指紋・顔認証・パソコンのPINでログインできます。端末ごとに1回登録してください。パスワードでのログインもこれまでどおり使えます。"
        actions={
          supported && (
            <Button variant="primary" icon={<Plus />} onClick={handleRegister} loading={registering} disabled={registering}>
              {registering ? "登録中..." : "パスキーを登録"}
            </Button>
          )
        }
      />
      <div className="space-y-3 px-5 py-4">
        {!supported && (
          <Alert tone="warning">このブラウザはパスキーに対応していません。Chrome・Safari・Edge の新しい版でお試しください。</Alert>
        )}
        {message && <Alert tone={message.tone}>{message.text}</Alert>}

        {passkeys === null ? (
          <Skeleton className="h-12 w-full" />
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-ink-subtle">まだ登録されていません。</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Fingerprint className="size-5 shrink-0 text-ink-subtle" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                  <p className="text-caption text-ink-subtle">
                    {formatDate(p.createdAt)}に登録
                    {p.lastUsedAt ? ` ・ 最後に使った日 ${formatDate(p.lastUsedAt)}` : " ・ まだ使っていません"}
                  </p>
                </div>
                {confirmingId === p.id ? (
                  <InlineConfirm
                    message="このパスキーを削除しますか？"
                    confirmLabel="削除する"
                    loadingLabel="削除中..."
                    loading={deleting}
                    onConfirm={() => handleDelete(p.id)}
                    onCancel={() => setConfirmingId(null)}
                    className="w-full"
                  />
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingId(p.id)}>
                    削除
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-caption text-ink-faint">
          端末をなくしたときは、ここで削除してください。端末の側に残ったパスキーは、削除後はログインに使えなくなります。
        </p>
      </div>
    </Card>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ tone: "danger", text: "新しいパスワードが確認用と一致しません" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!data.success) {
        setMessage({ tone: "danger", text: data.message });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ tone: "success", text: "パスワードを変更しました。次回のログインから新しいパスワードを使ってください。" });
    } catch {
      setMessage({ tone: "danger", text: "パスワードを変更できませんでした" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="section" padding="none">
      <form onSubmit={handleSubmit}>
        <CardHeader title="パスワードの変更" description="今のパスワードを確認してから変更します。" />
        <div className="space-y-4 px-5 py-4">
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
          <Field label="今のパスワード">
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          <Field label="新しいパスワード" hint="6文字以上">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </Field>
          <Field label="新しいパスワード（確認）">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <CardFooter>
          <Button variant="primary" type="submit" loading={saving} disabled={saving}>
            {saving ? "変更中..." : "パスワードを変更"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
