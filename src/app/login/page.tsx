"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/ui/brand";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/field-controls";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        window.location.href = "/";
        return;
      } else {
        setError(data.message);
      }
    } catch {
      setError("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  // API はどの欄の誤りか返さないので、エラー時は両方の欄を invalid にする
  const invalid = Boolean(error);

  return (
    <div className="admin-shell min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand size="lg" />
        </div>

        <Card padding="none" className="p-8">
          <form onSubmit={handleSubmit}>
            <h2 className="mb-5 text-sm font-medium text-ink-subtle">ログイン</h2>

            {error && (
              <div className="mb-4">
                <Alert tone="danger">{error}</Alert>
              </div>
            )}

            <div className="space-y-4">
              <Field label="メールアドレス">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="example@email.com"
                  invalid={invalid}
                />
              </Field>

              <Field label="パスワード">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="パスワードを入力"
                  invalid={invalid}
                />
              </Field>
            </div>

            <Button
              variant="primary"
              size="md"
              type="submit"
              className="mt-6 w-full"
              loading={loading}
              disabled={loading}
            >
              {loading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
