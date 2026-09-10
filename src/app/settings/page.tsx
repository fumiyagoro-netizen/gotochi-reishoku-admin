"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/lib/role-context";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardHeader, CardFooter, NoPermission } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/field-controls";
import { CardSkeleton } from "@/components/ui/skeleton";

interface FooterSettings {
  senderName: string;
  orgName: string;
  postalAddress: string;
  contactEmail: string;
  contactTel: string;
}

// 請求書PDFに印字する発行者情報。上の FooterSettings（メール配信フッター）
// とはキーも用途も別 — src/lib/settings.ts の getInvoiceIssuerSettings /
// invoice_* キー参照。この画面自体は canManageInvoices ではなく role==="admin"
// でガードしている — representative は canManageInvoices: true で請求書
// そのものは作成・編集できるが、ROLE_DESCRIPTIONS（src/lib/role-shared.ts）
// が明示的に「設定」を除外しているため、発行者情報の変更は管理者専用のまま
// にしている。
interface InvoiceIssuerSettings {
  issuerName: string;
  postalAddress: string;
  email: string;
  registrationNumber: string;
  bankInfo: string;
}

export default function SettingsPage() {
  const { role } = useRole();
  const [settings, setSettings] = useState<FooterSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceIssuerSettings | null>(null);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceSaved, setInvoiceSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSettings(data.settings);
      });
    fetch("/api/settings/invoice")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setInvoiceSettings(data.settings);
      });
  }, []);

  if (role !== "admin") {
    return (
      <PageContainer width="form">
        <NoPermission message="設定の閲覧・編集権限がありません" />
      </PageContainer>
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

  async function handleInvoiceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceSettings) return;
    setInvoiceSaving(true);
    setInvoiceError("");
    setInvoiceSaved(false);

    try {
      const res = await fetch("/api/settings/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceSettings),
      });
      const data = await res.json();
      if (data.success) {
        setInvoiceSettings(data.settings);
        setInvoiceSaved(true);
      } else {
        setInvoiceError(data.message);
      }
    } catch {
      setInvoiceError("保存に失敗しました");
    } finally {
      setInvoiceSaving(false);
    }
  }

  return (
    <PageContainer width="form">
      <PageHeader title="設定" />

      <div className="space-y-8">
        {!settings ? (
          <CardSkeleton lines={5} />
        ) : (
          <form onSubmit={handleSubmit}>
            <Card padding="none">
              <CardHeader
                title="メール送信元情報"
                description="見込み客へのメール配信時、本文末尾のフッターに使用されます。"
              />
              <div className="space-y-5 p-5">
                <Field label="差出人名">
                  <Input
                    type="text"
                    value={settings.senderName}
                    onChange={(e) => setSettings({ ...settings, senderName: e.target.value })}
                  />
                </Field>
                <Field label="団体名">
                  <Input
                    type="text"
                    value={settings.orgName}
                    onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
                  />
                </Field>
                <Field
                  label="郵送先住所"
                  labelAddon={
                    settings.postalAddress === "" && (
                      <Badge tone="warning" size="sm">未設定</Badge>
                    )
                  }
                >
                  <Input
                    type="text"
                    value={settings.postalAddress}
                    onChange={(e) => setSettings({ ...settings, postalAddress: e.target.value })}
                    placeholder="例: 東京都〇〇区〇〇1-2-3"
                  />
                </Field>
                <Field label="問い合わせ先メール">
                  <Input
                    type="email"
                    value={settings.contactEmail}
                    onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  />
                </Field>
                <Field label="問い合わせ先電話番号">
                  <Input
                    type="text"
                    value={settings.contactTel}
                    onChange={(e) => setSettings({ ...settings, contactTel: e.target.value })}
                  />
                </Field>
              </div>
              {/* 保存結果は保存ボタンの横に出す（バナーとボタンが離れないように） */}
              <CardFooter>
                <div className="mr-auto min-w-0">
                  {error && <Alert tone="danger" compact>{error}</Alert>}
                  {saved && <Alert tone="success" compact>保存しました</Alert>}
                </div>
                <Button variant="primary" type="submit" disabled={saving} loading={saving}>
                  {saving ? "保存中..." : "保存する"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}

        {!invoiceSettings ? (
          <CardSkeleton lines={5} />
        ) : (
          <form onSubmit={handleInvoiceSubmit}>
            <Card padding="none">
              <CardHeader
                title="請求書 発行者情報"
                description="請求書PDFに印字される発行者情報・振込先です。"
              />
              <div className="space-y-5 p-5">
                <Field label="発行者名（法人名）">
                  <Input
                    type="text"
                    value={invoiceSettings.issuerName}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, issuerName: e.target.value })}
                  />
                </Field>
                <Field label="住所">
                  <Input
                    type="text"
                    value={invoiceSettings.postalAddress}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, postalAddress: e.target.value })}
                    placeholder="例: 〒000-0000 東京都〇〇区〇〇1-2-3"
                  />
                </Field>
                <Field label="E-mail">
                  <Input
                    type="email"
                    value={invoiceSettings.email}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, email: e.target.value })}
                  />
                </Field>
                <Field label="登録番号（インボイス）">
                  <Input
                    type="text"
                    value={invoiceSettings.registrationNumber}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, registrationNumber: e.target.value })}
                    placeholder="T0000000000000"
                  />
                </Field>
                <Field label="振込先">
                  <Textarea
                    value={invoiceSettings.bankInfo}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankInfo: e.target.value })}
                    rows={2}
                    placeholder="例: ◯◯銀行 ◯◯支店 普通 0000000 ◯◯◯◯"
                  />
                </Field>
              </div>
              <CardFooter>
                <div className="mr-auto min-w-0">
                  {invoiceError && <Alert tone="danger" compact>{invoiceError}</Alert>}
                  {invoiceSaved && <Alert tone="success" compact>保存しました</Alert>}
                </div>
                <Button variant="primary" type="submit" disabled={invoiceSaving} loading={invoiceSaving}>
                  {invoiceSaving ? "保存中..." : "保存する"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}
      </div>
    </PageContainer>
  );
}
