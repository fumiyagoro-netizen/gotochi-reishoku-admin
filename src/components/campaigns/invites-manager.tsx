"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_INVITE_BODY,
  DEFAULT_INVITE_SUBJECT,
  INVITE_TAG_LABELS,
  INVITE_TAGS,
  formatJstDateTime,
} from "@/lib/retail-shared";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Textarea } from "@/components/ui/field-controls";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { Copy, ExternalLink, Link2, Mail, RefreshCw, Search, Send, Users } from "@/components/ui/icons";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { Modal } from "@/components/ui/modal";
import { Table, Td, Th, Tr } from "@/components/ui/table";

export interface InviteRow {
  email: string;
  name: string;
  companies: string[];
  products: {
    id: number;
    productName: string;
    year: number;
    prizeLevel: string;
    contactOverridden: boolean;
    answererName: string;
    entryEmail: string;
    entryContactName: string;
  }[];
  pairCount: number;
  answeredCount: number;
  campaignNames: string[];
  hasUrl: boolean;
  lastSentAt: string | null;
  lastAnsweredAt: string | null;
  suppressed: boolean;
}

type FilterKey = "all" | "unanswered" | "unsent" | "suppressed";

const FILTERS: { key: FilterKey; label: string; test: (r: InviteRow) => boolean }[] = [
  { key: "all", label: "すべて", test: () => true },
  { key: "unanswered", label: "未回答の商品がある", test: (r) => r.answeredCount < r.pairCount },
  { key: "unsent", label: "案内をまだ送っていない", test: (r) => !r.lastSentAt },
  { key: "suppressed", label: "配信停止中", test: (r) => r.suppressed },
];

async function postInvites(payload: Record<string, unknown>) {
  const res = await fetch("/api/campaigns/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export function InvitesManager({
  rows,
  openCampaignNames,
  myEmail,
}: {
  rows: InviteRow[];
  openCampaignNames: string[];
  myEmail: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [urlFor, setUrlFor] = useState<InviteRow | null>(null);
  const [contactFor, setContactFor] = useState<{ row: InviteRow; product: InviteRow["products"][number] } | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const visible = useMemo(() => {
    const test = FILTERS.find((f) => f.key === filter)!.test;
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        test(r) &&
        (!needle ||
          r.email.includes(needle) ||
          r.name.toLowerCase().includes(needle) ||
          r.companies.some((c) => c.toLowerCase().includes(needle)) ||
          r.products.some((p) => p.productName.toLowerCase().includes(needle))),
    );
  }, [rows, filter, q]);

  if (openCampaignNames.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="募集中の企画がありません"
        description="企画一覧で企画の状態を「募集中」にすると、その対象商品の担当者がここに並びます"
      />
    );
  }

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.email));
  const selectedRows = rows.filter((r) => selected.has(r.email));

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  return (
    <div>
      <p className="mb-4 text-sm text-ink-muted">
        募集中の企画: <span className="font-medium text-ink">{openCampaignNames.join("、")}</span>
      </p>

      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-start gap-3">
        <FilterChipGroup>
          {FILTERS.map((f) => (
            <FilterChip key={f.key} active={filter === f.key} count={rows.filter(f.test).length} onClick={() => setFilter(f.key)}>
              {f.label}
            </FilterChip>
          ))}
        </FilterChipGroup>
        <div className="ml-auto w-72">
          <Input
            size="sm"
            leadingIcon={<Search aria-hidden="true" />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="企業名・担当者・商品名・アドレス"
            aria-label="担当者を検索"
          />
        </div>
      </div>

      {selected.size > 0 && (
        <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
          <Button size="sm" variant="primary" icon={<Mail />} onClick={() => setComposeOpen(true)}>
            案内メールを送る
          </Button>
        </BulkActionBar>
      )}

      <Table>
        <thead>
          <tr>
            <Th compact width="w-10" srLabel="選択">
              <Checkbox
                checked={allVisibleSelected}
                onChange={() =>
                  setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.email)))
                }
                aria-label="表示中をすべて選択"
              />
            </Th>
            <Th>担当者</Th>
            <Th>対象の商品</Th>
            <Th>回答</Th>
            <Th>案内メール</Th>
            <Th srLabel="申請ページ" />
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <Tr key={r.email} selected={selected.has(r.email)}>
              <Td top className="px-2">
                <Checkbox checked={selected.has(r.email)} onChange={() => toggle(r.email)} aria-label={`${r.email}を選択`} />
              </Td>
              <Td top>
                <p className="font-medium text-ink">{r.companies.join("、")}</p>
                <p className="text-ink">{r.name || "（宛名なし）"}</p>
                <p className="text-caption text-ink-subtle break-all">{r.email}</p>
              </Td>
              <Td top>
                <ul className="space-y-1">
                  {r.products.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-2">
                      <span className="text-ink">{p.productName}</span>
                      <span className="text-caption text-ink-subtle">
                        {p.year}年度 {p.prizeLevel}
                      </span>
                      {p.contactOverridden && <Badge tone="info" size="sm">案内先を変更済み</Badge>}
                      <Button variant="link" size="sm" onClick={() => setContactFor({ row: r, product: p })}>
                        案内先を変える
                      </Button>
                    </li>
                  ))}
                </ul>
              </Td>
              <Td top nowrap className="tabular-nums">
                {r.answeredCount === r.pairCount ? (
                  <Badge tone="success" size="sm">回答済み</Badge>
                ) : r.answeredCount === 0 ? (
                  <Badge tone="outline" size="sm">未回答</Badge>
                ) : (
                  <Badge tone="warning" size="sm">一部回答</Badge>
                )}
                <p className="mt-1 text-caption text-ink-subtle">
                  {r.answeredCount} / {r.pairCount}
                </p>
                {r.lastAnsweredAt && <p className="text-caption text-ink-subtle">{formatJstDateTime(r.lastAnsweredAt)}</p>}
              </Td>
              <Td top nowrap className="tabular-nums">
                {r.suppressed && (
                  <Badge tone="danger" size="sm" title="配信停止・不達のアドレスです。案内メールは送られません">
                    配信停止中
                  </Badge>
                )}
                {r.lastSentAt ? (
                  <p className="text-caption">{formatJstDateTime(r.lastSentAt)}</p>
                ) : (
                  !r.suppressed && <span className="text-caption text-ink-faint">未送信</span>
                )}
              </Td>
              <Td top>
                <Button size="sm" variant="secondary" icon={<Link2 />} onClick={() => setUrlFor(r)}>
                  URL
                </Button>
              </Td>
            </Tr>
          ))}
          {visible.length === 0 && (
            <EmptyState colSpan={6} icon={Users} title="該当する担当者はいません" description="絞り込みを「すべて」に戻すと全員を表示します" />
          )}
        </tbody>
      </Table>
      <p className="mt-3 text-caption text-ink-subtle">
        「回答」は、募集中の企画 × 商品の組み合わせのうち、回答が入っている数です。配信停止中のアドレスには案内メールが送られないので、URLをコピーして個別にお知らせください。
      </p>

      {urlFor && <UrlModal row={urlFor} onClose={() => setUrlFor(null)} />}
      {contactFor && (
        <ContactModal
          target={contactFor}
          onClose={() => setContactFor(null)}
          onSaved={(msg) => {
            setContactFor(null);
            setNotice(msg);
            router.refresh();
          }}
        />
      )}
      {composeOpen && (
        <ComposeModal
          recipients={selectedRows}
          myEmail={myEmail}
          onClose={() => setComposeOpen(false)}
          onSent={(msg) => {
            setComposeOpen(false);
            setSelected(new Set());
            setNotice(msg);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ 申請ページのURL */

function UrlModal({ row, onClose }: { row: InviteRow; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function load(action: "url" | "regenerate") {
    setError("");
    setCopied(false);
    const data = await postInvites({ action, email: row.email }).catch(() => null);
    if (!data?.success) setError(data?.message || "URLを取得できませんでした");
    else setUrl(data.url);
  }

  // 開いたときに一度だけ取る（無ければここで作られる）
  useEffect(() => {
    let cancelled = false;
    postInvites({ action: "url", email: row.email })
      .then((data) => {
        if (cancelled) return;
        if (!data?.success) setError(data?.message || "URLを取得できませんでした");
        else setUrl(data.url);
      })
      .catch(() => !cancelled && setError("URLを取得できませんでした"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [row.email]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("コピーできませんでした。URLを選択してコピーしてください");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdrop
      title="申請ページのURL"
      description={`${row.companies.join("、")} ${row.name}（${row.email}）専用のページです`}
      size="lg"
      footerStart={
        confirmRegen ? (
          <InlineConfirm
            tone="warning"
            message="今のURLは開けなくなります。作り直しますか？"
            confirmLabel="作り直す"
            loading={regenerating}
            onConfirm={async () => {
              setRegenerating(true);
              await load("regenerate");
              setRegenerating(false);
              setConfirmRegen(false);
            }}
            onCancel={() => setConfirmRegen(false)}
          />
        ) : (
          <Button variant="ghost" icon={<RefreshCw />} disabled={!url} onClick={() => setConfirmRegen(true)}>
            URLを作り直す
          </Button>
        )
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      {error && (
        <div className="mb-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <div className="flex gap-2">
        <Input readOnly value={loading ? "読み込み中..." : url} onFocus={(e) => e.target.select()} aria-label="申請ページのURL" />
        <Button variant="secondary" icon={<Copy />} disabled={!url} onClick={copy}>
          {copied ? "コピーしました" : "コピー"}
        </Button>
        {url && (
          <ButtonLink variant="secondary" external href={url} target="_blank" icon={<ExternalLink />}>
            開く
          </ButtonLink>
        )}
      </div>
      <p className="mt-3 text-caption text-ink-subtle">
        このURLを知っている人は、誰でもこの担当者の商品について回答できます。担当者以外に渡さないでください。漏れたときは「URLを作り直す」で古いURLを止められます。開いて送信すると、その内容が企業の回答として記録されます。
      </p>
    </Modal>
  );
}

/* ------------------------------------------------------------ 商品の案内先 */

function ContactModal({
  target,
  onClose,
  onSaved,
}: {
  target: { row: InviteRow; product: InviteRow["products"][number] };
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { product } = target;
  const [email, setEmail] = useState(product.contactOverridden ? target.row.email : "");
  const [name, setName] = useState(product.contactOverridden ? product.answererName : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(method: "PUT" | "DELETE") {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/contacts/${product.id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PUT" ? JSON.stringify({ email, name }) : undefined,
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "保存に失敗しました");
        return;
      }
      onSaved(
        method === "PUT"
          ? `「${product.productName}」の案内先を ${email} に変えました`
          : `「${product.productName}」の案内先をエントリー時の担当者に戻しました`,
      );
    } catch (e) {
      setError("通信エラー: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="案内先を変える"
      description={`${product.productName}（${product.year}年度 ${product.prizeLevel}）`}
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        submit("PUT");
      }}
      footerStart={
        product.contactOverridden && (
          <Button variant="ghost" disabled={saving} onClick={() => submit("DELETE")}>
            エントリー時の担当者に戻す
          </Button>
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            保存する
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          エントリー時の担当者: {product.entryContactName || "—"}（{product.entryEmail}）
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="新しい案内先のメールアドレス">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="宛名" labelHint="任意" hint="案内メールの「〇〇 様」に入ります">
          <Input maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 山田 花子" />
        </Field>
        <p className="text-caption text-ink-subtle">
          この商品は、以後このアドレスの担当者の申請ページに出ます（元の担当者のページからは消えます）。エントリーの担当者・メールアドレスは変わりません。
        </p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ 案内メール */

function ComposeModal({
  recipients,
  myEmail,
  onClose,
  onSent,
}: {
  recipients: InviteRow[];
  myEmail: string;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [subject, setSubject] = useState(DEFAULT_INVITE_SUBJECT);
  const [body, setBody] = useState(DEFAULT_INVITE_BODY);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [testEmail, setTestEmail] = useState(myEmail);
  const [busy, setBusy] = useState<"" | "preview" | "test" | "send">("");
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const sendable = recipients.filter((r) => !r.suppressed);
  const skipped = recipients.length - sendable.length;
  // 見本は送れる人の先頭（全員が配信停止なら先頭）
  const sample = sendable[0] ?? recipients[0];

  function insertTag(tag: string) {
    const el = bodyRef.current;
    const text = `{{${tag}}}`;
    if (!el) {
      setBody((b) => b + text);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + text + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  }

  async function run(action: "preview" | "test" | "send") {
    setBusy(action);
    setError("");
    setTestResult("");
    try {
      const data = await postInvites({
        action,
        subject,
        body,
        email: sample?.email,
        testEmail,
        emails: recipients.map((r) => r.email),
      });
      if (!data.success) {
        setError(data.message || "失敗しました");
        return;
      }
      if (action === "preview") setPreview(data.preview);
      if (action === "test") setTestResult(`${testEmail} にテスト送信しました`);
      if (action === "send") {
        onSent(
          `案内メールを ${data.sent}人に送りました` +
            (data.failed ? `（${data.failed}人は送信に失敗）` : "") +
            (data.skipped ? `。配信停止中の ${data.skipped}人には送っていません` : ""),
        );
      }
    } catch (e) {
      setError("通信エラー: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy("");
      setConfirmSend(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="案内メールを送る"
      description={`${recipients.length}人を選択中${skipped ? `（うち配信停止中の ${skipped}人には送りません）` : ""}`}
      size="xl"
      footerStart={
        <Button variant="secondary" onClick={onClose}>
          キャンセル
        </Button>
      }
      footer={
        confirmSend ? (
          <InlineConfirm
            tone="warning"
            message={`${sendable.length}人に送ります。送信は取り消せません`}
            confirmLabel="送信する"
            loadingLabel="送信中..."
            loading={busy === "send"}
            onConfirm={() => run("send")}
            onCancel={() => setConfirmSend(false)}
          />
        ) : (
          <Button variant="primary" icon={<Send />} disabled={sendable.length === 0 || !!busy} onClick={() => setConfirmSend(true)}>
            {sendable.length}人に送る
          </Button>
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="件名">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </Field>
          <Field label="本文" hint="文字で書きます（HTMLは使えません）。{{ }} の部分は担当者ごとに差し込まれます">
            <Textarea ref={bodyRef} rows={16} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {INVITE_TAGS.map((t) => (
              <Button key={t} size="sm" variant="secondary" onClick={() => insertTag(t)}>
                {INVITE_TAG_LABELS[t]}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" loading={busy === "preview"} disabled={!!busy || !sample} onClick={() => run("preview")}>
              プレビュー
            </Button>
            {sample && (
              <span className="text-caption text-ink-subtle">
                見本: {sample.companies[0]} {sample.name}
              </span>
            )}
          </div>
          {preview ? (
            <div className="rounded-lg border border-line">
              <p className="border-b border-line px-3 py-2 text-sm font-medium text-ink">{preview.subject}</p>
              <iframe title="メールのプレビュー" sandbox="" srcDoc={preview.html} className="h-96 w-full" />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-line-strong px-3 py-8 text-center text-caption text-ink-subtle">
              「プレビュー」で、見本の担当者に届く内容を確認できます
            </p>
          )}
          <Field label="テスト送信" hint="見本の担当者の内容（本物の申請ページのURL入り）を、このアドレスにだけ送ります">
            <div className="flex gap-2">
              <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
              <Button variant="secondary" loading={busy === "test"} disabled={!!busy || !testEmail || !sample} onClick={() => run("test")}>
                送る
              </Button>
            </div>
          </Field>
          {testResult && <Alert tone="success" compact>{testResult}</Alert>}
        </div>
      </div>
    </Modal>
  );
}
