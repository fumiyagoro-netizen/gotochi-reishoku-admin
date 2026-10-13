import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { getCurrentRole } from "@/lib/role";
import { cn } from "@/lib/cn";
import { ROLE_LABELS, type Role } from "@/lib/role-shared";
import { HELP_SHOTS, type HelpShotName } from "@/lib/help-shots";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Badge, ItemArrivalBadge, PrizeBadge, ReviewBadge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/ui/role-badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { AnnotatedShot, type AnnotatedItem } from "@/components/help/annotated-shot";
import {
  ArrowUpRight,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  Info,
  Mail,
  MessageSquare,
  Minus,
  PackageCheck,
  Receipt,
  Settings,
  Target,
  TriangleAlert,
  Trophy,
} from "@/components/ui/icons";

export const metadata = { title: "使い方" };

/**
 * 管理システムの使い方。全権限が開ける（middleware のログイン必須だけで、権限による制限はしない）。
 *
 * 見ている人の権限がサーバーで分かるので、冒頭に「あなたの主な業務」をその権限の分だけ出し、
 * 権限表ではその人の列に色を付け、使えない画面・ボタンの説明は薄くして「使えません」と添える。
 *
 * 権限ごとの可否は src/lib/role-shared.ts の PERMISSIONS と、画面ごとのハードコード
 * （設定・ユーザー管理などは admin 固定）を 2026年10月13日に全権限で実際に操作して確かめたもの。
 * 権限を変えたら、この画面の WHO / MATRIX / ROLE_TASKS も合わせて直すこと。
 */

const CONTACT = { name: "御船", email: "f.mifune@fta.or.jp" };

const A: Role = "admin";
const R: Role = "representative";
const E: Role = "editor";
const V: Role = "viewer";
const J: Role = "judge";
const ROLES: Role[] = [A, R, E, V, J];

type Who = "all" | Role[];

function can(who: Who, role: Role) {
  return who === "all" || who.includes(role);
}

function WhoBadges({ who }: { who: Who }) {
  if (who === "all") {
    return (
      <Badge tone="neutral" size="sm">
        全員
      </Badge>
    );
  }
  return (
    <>
      {who.map((r) => (
        <RoleBadge key={r} role={r} size="sm" />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// 画面写真の番号ごとの説明。順番は src/lib/help-shots.ts の注釈の並びと同じ
// ---------------------------------------------------------------------------

type Legend = { title: string; body: string; who: Who }[];

const LEGENDS: Record<HelpShotName, Legend> = {
  sidebar: [
    { title: "開催年度", body: "ほとんどの画面は、ここで選んだ年度のものだけを表示します。", who: "all" },
    { title: "日常業務", body: "全員が使う画面です。", who: "all" },
    { title: "配信・営業", body: "権限によって表示される項目が変わります。", who: [A, R, E] },
    { title: "管理", body: "システム全体の設定です。", who: [A] },
    { title: "自分の権限", body: "お名前の下に、ご自身の権限が出ます。", who: "all" },
  ],
  dashboard: [
    { title: "年度の数字", body: "総エントリー数・企業数・カテゴリ数・受賞数。受賞数を押すと受賞一覧へ移ります。", who: "all" },
    { title: "カテゴリ別", body: "カテゴリごとの応募件数です。下に都道府県ごとの件数も続きます。", who: "all" },
  ],
  entries: [
    { title: "検索", body: "企業名・商品名・ご担当者名で探せます。", who: "all" },
    { title: "カテゴリ", body: "お惣菜・米飯・麺・スイーツ・その他で絞り込みます。", who: "all" },
    { title: "応募者へメール配信", body: "宛先を絞って一斉にメールを送る画面へ進みます。", who: [A, R] },
    { title: "Excelダウンロード", body: "いま表示している一覧をExcelで保存します。", who: [A, R, E] },
    { title: "CSVアップロード", body: "エントリーをまとめて登録・更新します。", who: [A] },
    { title: "チェック欄", body: "チェックを入れると、商品到着や審査状況をまとめて設定できます。", who: [A, R, E] },
    { title: "商品名", body: "押すとエントリー詳細が開きます。", who: "all" },
  ],
  "entry-detail": [
    { title: "編集", body: "応募内容を書き換えます。", who: [A] },
    { title: "PDF", body: "審査資料をPDFで保存します。個人情報・審査状況・受賞は入りません。", who: [A, R, E] },
    { title: "削除", body: "エントリーを削除します。元に戻せません。", who: [A] },
    { title: "受賞", body: "受賞が決まっていれば賞が表示され、「変更」で付け替えます。未設定のときは「受賞を設定」と出ます。", who: [A] },
    { title: "審査状況", body: "選外・1次審査通過・2次審査通過。押すたびに付け外しできます。", who: [A] },
    { title: "商品到着", body: "審査用の商品が届いたら押します。もう一度押すと取り消せます。", who: [A, R, E] },
    { title: "審査コメント", body: "審査での気づきを書き込みます。詳細を開いた人は誰でも読めます。", who: [A, R, J] },
  ],
  reviews: [
    { title: "審査状況", body: "タイルを押すとその状態だけに絞り込みます。もう一度押すと解除されます。", who: "all" },
    { title: "商品到着", body: "「未到着」は、まだ届いていない商品の数です。", who: "all" },
  ],
  awards: [{ title: "賞で絞り込む", body: "すべて・最高金賞・金賞・銀賞・銅賞から選べます。", who: "all" }],
  email: [
    { title: "年度", body: "必ず1つ以上選びます。複数選べます。", who: [A, R] },
    { title: "審査状況", body: "選ぶと、ちょうどその状態の人だけに絞ります。何も選ばなければ全員です。", who: [A, R] },
    { title: "受賞枠", body: "選んだ賞の受賞者だけに絞ります。", who: [A, R] },
    { title: "対象人数", body: "条件に当てはまる人数がすぐに表示されます。", who: [A, R] },
    { title: "差し込み", body: "押すと、宛先ごとのお名前・会社名に置き換わる印が入ります。", who: [A, R] },
    { title: "プレビュー表示", body: "送る前の見た目を確認します。", who: [A, R] },
    { title: "テスト送信", body: "ご自身宛に1通だけ送って、実際のメールを確認します。", who: [A, R] },
  ],
  invoices: [
    { title: "年度ごとの売上", body: "カードを押すと、その年度の一覧に切り替わります。", who: [A, R] },
    { title: "請求項目マスタ", body: "品名と単価を登録しておく場所です。早期割引などの値引きも登録できます。", who: [A, R] },
    { title: "新規作成", body: "請求書を作ります。", who: [A, R] },
    { title: "送信状況", body: "送信済みかどうかと、送った日時です。", who: [A, R] },
  ],
  upload: [
    { title: "モードの切り替え", body: "新規登録と一括更新を切り替えます。", who: [A] },
    { title: "一括更新モードの表示", body: "この黄色い表示が出ていれば一括更新です。", who: [A] },
  ],
};

function legendItems(name: HelpShotName, role: Role): AnnotatedItem[] {
  return LEGENDS[name].map((l) => ({
    title: l.title,
    body: l.body,
    who: <WhoBadges who={l.who} />,
    unavailable: !can(l.who, role),
  }));
}

// ---------------------------------------------------------------------------
// 権限ごとの主な業務（事務局の整理: 2026年10月）
// ---------------------------------------------------------------------------

type Icon = ComponentType<{ className?: string }>;
type TaskKey = "entries" | "arrival" | "review" | "judging" | "comment" | "mail" | "prospects" | "invoices" | "settings";

const TASKS: Record<TaskKey, { title: string; body: string; href: string; howto?: string; icon: Icon; yearScoped: boolean }> = {
  entries: {
    title: "エントリーの確認",
    body: "新しい応募が届いていないか、内容に不備がないかを確認します。",
    href: "/entries",
    howto: "howto-new-entry",
    icon: ClipboardList,
    yearScoped: true,
  },
  arrival: {
    title: "商品の到着管理",
    body: "審査用の商品が届いたら、エントリー詳細で到着を記録します。",
    href: "/reviews",
    howto: "howto-arrival",
    icon: PackageCheck,
    yearScoped: true,
  },
  review: {
    title: "審査・受賞状況の確認",
    body: "何件が審査を通過し、商品がどこまで届いているかを審査状況で、受賞は受賞一覧で確認します。",
    href: "/reviews",
    icon: ClipboardCheck,
    yearScoped: true,
  },
  judging: {
    title: "審査結果と受賞の記録",
    body: "1次・2次審査の結果と、受賞をエントリー詳細で記録します。",
    href: "/entries",
    howto: "howto-review",
    icon: Trophy,
    yearScoped: true,
  },
  comment: {
    title: "審査コメント",
    body: "エントリー詳細を開き、審査での気づきを書き込みます。",
    href: "/entries",
    howto: "howto-comment",
    icon: MessageSquare,
    yearScoped: true,
  },
  mail: {
    title: "応募者へのメール",
    body: "審査状況や受賞枠で宛先を絞って、まとめて送ります。",
    href: "/entries/email",
    howto: "howto-mail",
    icon: Mail,
    yearScoped: false,
  },
  prospects: {
    title: "追客",
    body: "これから声をかけたいメーカーの連絡状況・担当者・メモを記録します。",
    href: "/prospects",
    howto: "howto-prospect",
    icon: Target,
    yearScoped: true,
  },
  invoices: {
    title: "請求",
    body: "エントリー費用などの請求書を作り、PDFで送ります。",
    href: "/invoices",
    howto: "howto-invoice",
    icon: Receipt,
    yearScoped: true,
  },
  settings: {
    title: "設定とユーザー管理",
    body: "年度の追加、アカウントの発行と権限の変更、メールの差出人情報などです。",
    href: "/users",
    icon: Settings,
    yearScoped: false,
  },
};

const ROLE_TASKS: Record<Role, { lead: string; tasks: TaskKey[] }> = {
  admin: {
    lead: "すべての業務を担当できます。エントリーの編集、受賞の決定、CSVの取り込み、システムの設定は管理者だけの操作です。",
    tasks: ["entries", "arrival", "judging", "mail", "prospects", "invoices", "settings"],
  },
  representative: {
    lead: "エントリーと審査・受賞状況の確認、追客、請求が中心です。応募者へのメールやフォームも使えます。エントリーの内容の書き換えと受賞の設定はできません。",
    tasks: ["entries", "review", "prospects", "invoices"],
  },
  editor: {
    lead: "審査用の商品が届いたことの記録と、追客が中心です。",
    tasks: ["arrival", "prospects"],
  },
  judge: {
    lead: "エントリーと審査状況の確認、審査コメントの記入が中心です。ご担当者名やメールアドレスなどの個人情報は表示されません。",
    tasks: ["entries", "review", "comment"],
  },
  viewer: {
    lead: "エントリー・審査状況・受賞を見ることができます。ご担当者名やメールアドレスなどの個人情報は表示されません。",
    tasks: ["entries", "review"],
  },
};

// ---------------------------------------------------------------------------
// できること・できないこと
// ---------------------------------------------------------------------------

const MATRIX: [string, Who][] = [
  ["エントリーを見る", "all"],
  ["エントリーの内容を編集する", [A]],
  ["受賞・審査状況を設定する", [A]],
  ["CSVを取り込む", [A]],
  ["エントリーを削除する", [A]],
  ["商品が届いたことを記録する", [A, R, E]],
  ["審査コメントを書く", [A, R, J]],
  ["応募者へ一斉メールを送る", [A, R]],
  ["フォーム・メール配信リストを使う", [A, R]],
  ["請求書を作る・送る", [A, R]],
  ["追客リストを使う", [A, R, E]],
  ["Excel・PDFをダウンロードする", [A, R, E]],
  ["応募企業の個人情報を見る", [A, R, E]],
  ["設定・ユーザー管理・操作ログ", [A]],
];

const ROLE_SUMMARY: Record<Role, string> = {
  admin: "すべての操作ができます。",
  representative: "メール配信・フォーム・請求書・追客リストを担当します。エントリーの中身は書き換えられません。",
  editor: "追客リストの管理と、審査用の商品が届いたことの記録を担当します。",
  viewer: "見るだけです。応募企業の個人情報は表示されません。",
  judge: "見ることと、審査コメントを書くことができます。個人情報は表示されません。",
};

// ---------------------------------------------------------------------------

const SECTIONS = [
  ["menu", "画面の見かた"],
  ["roles", "権限のちがい"],
  ["flow", "審査の流れ"],
  ["screens", "画面の案内"],
  ["howto", "よくある作業"],
  ["care", "気をつけること"],
  ["trouble", "困ったとき"],
] as const;

function Section({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-6 border-t border-line pt-8">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      {lead && <p className="mt-1 max-w-prose text-sm text-ink-muted">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ScreenBlock({
  title,
  who,
  role,
  description,
  children,
}: {
  title: string;
  who: Who;
  role: Role;
  description: string;
  children: ReactNode;
}) {
  const ok = can(who, role);
  return (
    <div className="mb-12 last:mb-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <WhoBadges who={who} />
      </div>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">{description}</p>
      {!ok && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2.5 py-1 text-caption font-medium text-warning-ink">
          <Info className="size-3.5" aria-hidden="true" />
          あなたの権限では、この画面は開けません
        </p>
      )}
      <div className={ok ? "mt-4" : "mt-4 opacity-60"}>{children}</div>
    </div>
  );
}

function Recipe({
  id,
  title,
  who,
  role,
  steps,
  tip,
}: {
  id: string;
  title: string;
  who: Who;
  role: Role;
  steps: ReactNode[];
  tip?: ReactNode;
}) {
  const ok = can(who, role);
  return (
    <Card as="section" padding="md" className={ok ? "scroll-mt-6" : "scroll-mt-6 opacity-50"}>
      <div id={id} className="scroll-mt-6">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <WhoBadges who={who} />
        </div>
      </div>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink marker:font-semibold marker:text-accent">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {tip && <p className="mt-3 border-t border-dashed border-line pt-3 text-caption text-ink-muted">{tip}</p>}
    </Card>
  );
}

/** 手順の中で「4章の画面の◯番」を指す印 */
function Ref({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center rounded-sm bg-orange-50 px-1.5 text-caption font-semibold text-orange-700">
      {children}
    </span>
  );
}

type Props = { searchParams: Promise<{ year?: string }> };

export default async function HelpPage({ searchParams }: Props) {
  const role = await getCurrentRole();
  const { year } = await searchParams;
  // サイドバーと同じく、年度で絞る画面へのリンクには表示中の年度を引き継ぐ
  const withYear = (href: string, scoped: boolean) => (scoped && year ? `${href}?year=${encodeURIComponent(year)}` : href);
  const mine = ROLE_TASKS[role];

  return (
    <PageContainer width="detail">
      <PageHeader
        title="使い方"
        description={`この管理システムでできることと、日々の作業の手順です。わからないことは${CONTACT.name}（${CONTACT.email}）までお問い合わせください。`}
      />

      {/* あなたの主な業務 */}
      <Card padding="md">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink">あなたの主な業務</h2>
          <RoleBadge role={role} />
        </div>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">{mine.lead}</p>
        {/* 枚数で段組みを変え、最後の1枚だけが次の段に取り残されないようにする（7枚は 4+3、4枚は 4 か 2+2） */}
        <div
          className={cn(
            "mt-5 grid gap-3",
            mine.tasks.length === 2 && "sm:grid-cols-2",
            mine.tasks.length === 3 && "sm:grid-cols-3",
            mine.tasks.length >= 4 && "sm:grid-cols-2 lg:grid-cols-4",
          )}
        >
          {mine.tasks.map((key) => {
            const t = TASKS[key];
            const Icon = t.icon;
            return (
              <div key={key} className="flex min-w-0 flex-col rounded-lg border border-line bg-surface-muted/40 p-4">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
                </div>
                <p className="mt-2 flex-1 text-caption text-ink-muted">{t.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <ButtonLink href={withYear(t.href, t.yearScoped)} variant="secondary" size="sm" iconRight={<ArrowUpRight />}>
                    画面を開く
                  </ButtonLink>
                  {t.howto && (
                    <ButtonLink href={`#${t.howto}`} variant="link" size="sm">
                      手順を見る
                    </ButtonLink>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* もくじ */}
      <nav aria-label="この画面のもくじ" className="mt-6 flex flex-wrap gap-x-1 gap-y-1">
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-md px-2.5 py-1 text-caption font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {label}
          </a>
        ))}
      </nav>

      <Section
        id="menu"
        title="画面の見かた"
        lead="左のメニューでいちばん大事なのは開催年度です。探しているエントリーや受賞が見当たらないときは、まず年度が合っているかを確かめてください。"
      >
        <AnnotatedShot
          shot={HELP_SHOTS.sidebar}
          alt="左のメニュー"
          items={legendItems("sidebar", role)}
          note="メールアドレスは見本です。"
          layout="side"
        />
      </Section>

      <Section id="roles" title="権限のちがい" lead={<>権限は5種類です。表示されるメニューもボタンも権限ごとに変わります。<strong className="font-semibold text-ink">メニューが少なくても不具合ではありません。</strong></>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <div
              key={r}
              className={
                r === role
                  ? "rounded-lg border border-accent bg-accent-soft/50 p-4 ring-1 ring-accent"
                  : "rounded-lg border border-line bg-surface p-4"
              }
            >
              <div className="flex items-center gap-2">
                <RoleBadge role={r} />
                {r === role && <span className="text-caption font-medium text-accent">あなたの権限</span>}
              </div>
              <p className="mt-2 text-caption text-ink-muted">{ROLE_SUMMARY[r]}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Table>
            <thead>
              <tr>
                <Th>できること</Th>
                {ROLES.map((r) => (
                  <Th key={r} align="center" width="w-20" className={r === role ? "bg-accent-soft text-accent" : undefined}>
                    {ROLE_LABELS[r]}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map(([label, who]) => (
                <Tr key={label}>
                  <Td tone="ink">{label}</Td>
                  {ROLES.map((r) => (
                    <Td key={r} className={r === role ? "bg-accent-soft/60 text-center" : "text-center"}>
                      {can(who, r) ? (
                        <CircleCheck className="mx-auto size-4 text-success" aria-label="できる" />
                      ) : (
                        <Minus className="mx-auto size-4 text-ink-faint" aria-label="できない" />
                      )}
                    </Td>
                  ))}
                </Tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-caption text-ink-subtle">
            できない操作は、ボタンが表示されないか、押すと「権限がありません」と表示されます。
          </p>
        </div>
      </Section>

      <Section id="flow" title="審査の流れ" lead="1件のエントリーは、システム上この順に記録していきます。記録すると、一覧や詳細にはこの印が付きます。">
        <ol className="relative space-y-3">
          {(
            [
              { title: "応募が届く", body: "エントリーフォームから送られた内容が、自動でエントリー一覧に入ります。操作は不要です。", mark: <Badge tone="neutral" size="sm">自動</Badge>, who: null },
              { title: "1次審査の結果を記録する", body: "エントリー詳細の「1次審査通過」または「選外」を押します。", mark: <ReviewBadge status="first_passed" size="sm" />, who: [A] as Role[] },
              { title: "2次審査用の商品が届いたら記録する", body: "事務局で受け取ったその場で「2次審査商品到着」を押します。", mark: <ItemArrivalBadge status="second_arrived" size="sm" />, who: [A, R, E] as Role[] },
              { title: "2次審査の結果を記録する", body: "「2次審査通過」または「選外」を押します。", mark: <ReviewBadge status="second_passed" size="sm" />, who: [A] as Role[] },
              { title: "最終審査用の商品が届いたら記録する", body: "「最終審査商品到着」を押します。", mark: <ItemArrivalBadge status="final_arrived" size="sm" />, who: [A, R, E] as Role[] },
              { title: "受賞を決める", body: "「受賞を設定」から最高金賞・金賞・銀賞・銅賞を選びます。グランプリは最高金賞のなかから1点だけ、審査員特別賞は賞の名前を添えて設定します。", mark: <PrizeBadge prizeLevel="金賞" size="sm" />, who: [A] as Role[] },
              { title: "応募者へご連絡する", body: "審査状況や受賞枠で宛先を絞って、まとめてメールを送ります。", mark: null, who: [A, R] as Role[] },
            ] satisfies { title: string; body: string; mark: ReactNode; who: Role[] | null }[]
          ).map((s, i, all) => (
            <li key={s.title} className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-4">
              {i < all.length - 1 && <span aria-hidden="true" className="absolute left-[1.0625rem] top-9 -bottom-3 w-px bg-line-strong" />}
              <span className="relative z-10 grid size-9 place-items-center rounded-full border-2 border-accent bg-surface text-sm font-semibold text-accent tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 rounded-lg border border-line bg-surface px-4 py-3">
                <p className="text-sm font-semibold text-ink">{s.title}</p>
                <p className="mt-0.5 text-caption text-ink-muted">{s.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {s.mark}
                  {s.mark && s.who && <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />}
                  {s.who && <WhoBadges who={s.who} />}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="screens" title="画面の案内" lead="番号の付いた枠が、下の説明の番号と対応しています。説明にカーソルを合わせると、画面の枠が光ります。">
        <ScreenBlock title="ダッシュボード" who="all" role={role} description="選んでいる年度の全体像です。ログインすると最初に開きます。">
          <AnnotatedShot shot={HELP_SHOTS.dashboard} alt="ダッシュボード" items={legendItems("dashboard", role)} />
        </ScreenBlock>

        <ScreenBlock title="エントリー一覧" who="all" role={role} description="応募の一覧です。写真、商品名、企業名、ご当地、ご担当者、審査状況、商品到着、回答日が並びます。">
          <AnnotatedShot shot={HELP_SHOTS.entries} alt="エントリー一覧" items={legendItems("entries", role)} note="企業名・商品名・ご担当者名は見本です。" />
        </ScreenBlock>

        <ScreenBlock
          title="エントリー詳細"
          who="all"
          role={role}
          description="一覧で商品名を押すと開きます。1件の応募内容がすべて見られ、審査の記録もここで行います。下にスクロールすると、企業・ご担当者情報、商品情報、写真、アピールポイント、許認可・衛生情報が続きます。"
        >
          <AnnotatedShot shot={HELP_SHOTS["entry-detail"]} alt="エントリー詳細" items={legendItems("entry-detail", role)} note="企業名・商品名は見本です。" />
        </ScreenBlock>

        <ScreenBlock title="審査状況" who="all" role={role} description="審査の進み具合をまとめて見る画面です。数字の入ったタイルを押すと、その状態のものだけに絞り込めます。">
          <AnnotatedShot shot={HELP_SHOTS.reviews} alt="審査状況" items={legendItems("reviews", role)} note="企業名・商品名は見本です。" />
        </ScreenBlock>

        <ScreenBlock title="受賞一覧" who="all" role={role} description="受賞した商品だけを集めた画面です。グランプリと審査員特別賞もここで確認できます。">
          <AnnotatedShot shot={HELP_SHOTS.awards} alt="受賞一覧" items={legendItems("awards", role)} note="企業名・商品名は見本です。" />
        </ScreenBlock>

        <ScreenBlock title="応募者へメール配信" who={[A, R]} role={role} description="エントリー一覧の「応募者へメール配信」から開きます。年度・審査状況・受賞枠で宛先を絞って、まとめて送ります。">
          <AnnotatedShot shot={HELP_SHOTS.email} alt="応募者へメール配信" items={legendItems("email", role)} />
        </ScreenBlock>

        <ScreenBlock title="請求書" who={[A, R]} role={role} description="エントリー費用などの請求書を作り、PDFで発行してメールで送ります。上段に年度ごとの売上が出ます。">
          <AnnotatedShot shot={HELP_SHOTS.invoices} alt="請求書" items={legendItems("invoices", role)} note="宛先・金額は見本です。" />
        </ScreenBlock>

        <h3 className="mt-4 text-base font-semibold text-ink">そのほかの画面</h3>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">個人の連絡先や自由記述のメモが多く写るため、画面の写真は載せていません。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              { title: "メール配信リスト", href: "/contacts", body: "連絡先の名簿です。リストに分けて管理し、一斉メールもここから送ります。開くと見出しは「見込み客・連絡先」と表示されます。送信時に特定のリストを除外できます。", who: [A, R] },
              { title: "追客リスト", href: "/prospects", body: "これから声をかけたい冷凍食品メーカーの一覧です。コンタクト状況、担当者、連絡先、メモを記録します。Excelからまとめて取り込めます。", who: [A, R, E] },
              { title: "フォーム", href: "/forms", body: "説明会の申込や資料請求などのフォームを作って公開できます。回答はこの画面に溜まります。", who: [A, R] },
              { title: "管理メニュー", href: "/users", body: "配信履歴（メールが届いたか）、年度管理、ユーザー管理、設定（差出人・請求書の発行者情報）、操作ログ（誰がいつ何をしたか）、サイト管理。", who: [A] },
            ] satisfies { title: string; href: string; body: string; who: Role[] }[]
          ).map((m) => {
            const ok = can(m.who, role);
            return (
              <Card key={m.title} padding="sm" className={ok ? undefined : "opacity-50"}>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-ink">{m.title}</h4>
                  <WhoBadges who={m.who} />
                </div>
                <p className="mt-1.5 text-caption text-ink-muted">{m.body}</p>
                {ok ? (
                  <ButtonLink href={withYear(m.href, m.href === "/prospects")} variant="link" size="sm" className="mt-2" iconRight={<ArrowUpRight />}>
                    画面を開く
                  </ButtonLink>
                ) : (
                  <p className="mt-2 text-caption font-medium text-warning-ink">あなたの権限では開けません</p>
                )}
              </Card>
            );
          })}
        </div>
      </Section>

      <Section id="howto" title="よくある作業" lead={<>日々の作業を手順にしました。<Ref>詳細④</Ref>のような印は、「画面の案内」の写真の番号を指しています。</>}>
        <div className="grid gap-3 md:grid-cols-2">
          <Recipe
            id="howto-new-entry"
            title="新しい応募が届いたか確認する"
            who="all"
            role={role}
            steps={[
              "左上の開催年度が合っているか確認します",
              "「エントリー一覧」を開きます",
              "見出しの横の件数が増えていれば、新しい応募があります",
              <>商品名<Ref>一覧⑦</Ref>を押すと内容を確認できます</>,
            ]}
          />
          <Recipe
            id="howto-arrival"
            title="審査用の商品が届いたことを記録する"
            who={[A, R, E]}
            role={role}
            steps={[
              "エントリー一覧で商品名を押し、詳細を開きます",
              <>「2次審査商品到着」または「最終審査商品到着」<Ref>詳細⑥</Ref>を押します</>,
              "間違えたときは、もう一度押すと取り消せます",
            ]}
            tip={<>何件もまとめて記録するときは、一覧の左のチェック<Ref>一覧⑥</Ref>を入れると、下に一括設定のボタンが出ます。</>}
          />
          <Recipe
            id="howto-comment"
            title="審査コメントを書く"
            who={[A, R, J]}
            role={role}
            steps={[
              "エントリー一覧で商品名を押し、詳細を開きます",
              <>「審査コメント」の欄<Ref>詳細⑦</Ref>に書き込み、「投稿」を押します</>,
              "投稿したコメントは、エントリー詳細を開いた人は誰でも読めます",
            ]}
            tip="自分のコメントは、あとから削除できます（管理者はすべてのコメントを削除できます）。"
          />
          <Recipe
            id="howto-review"
            title="審査結果と受賞を記録する"
            who={[A]}
            role={role}
            steps={[
              "エントリー詳細を開きます",
              <>「1次審査通過」「2次審査通過」「選外」<Ref>詳細⑤</Ref>から押します</>,
              <>受賞が決まったら「受賞を設定」<Ref>詳細④</Ref>から賞を選びます</>,
              "グランプリは最高金賞のなかから1点だけ、審査員特別賞は賞の名前を添えて設定します",
            ]}
            tip="まとめて設定するときは、一覧でチェックを入れて一括設定します。最高金賞を外すと、グランプリの称号も自動で外れます。"
          />
          <Recipe
            id="howto-pdf"
            title="審査資料のPDFを出す"
            who={[A, R, E]}
            role={role}
            steps={[
              "エントリー詳細を開きます",
              <>右上の「PDF」<Ref>詳細②</Ref>を押します。数秒で保存されます</>,
              "そのまま審査員や後援・協賛の方にお渡しください",
            ]}
            tip="このPDFには、ご担当者名・メールアドレス・電話番号・審査状況・受賞は入りません。"
          />
          <Recipe
            id="howto-prospect"
            title="追客リストに記録する"
            who={[A, R, E]}
            role={role}
            steps={[
              "「追客リスト」を開きます",
              "新しいメーカーは「新規追加」から登録します。まとめて登録するときは「Excelインポート」を使います",
              "行を押すと編集画面が開きます。コンタクト状況（未着手・連絡済・資料送付済・エントリー意向・追客しない）、担当者、連絡先、メモを更新して保存します",
              "一覧の上の絞り込みで、コンタクト状況や県ごとに探せます",
            ]}
            tip="追客リストからの削除は管理者だけができます。"
          />
          <Recipe
            id="howto-mail"
            title="応募者へ一斉メールを送る"
            who={[A, R]}
            role={role}
            steps={[
              <>エントリー一覧の「応募者へメール配信」<Ref>一覧③</Ref>を押します</>,
              <>年度<Ref>配信①</Ref>を選び、必要なら審査状況・受賞枠<Ref>配信②③</Ref>で絞ります</>,
              <>対象人数<Ref>配信④</Ref>を確認します</>,
              <>件名と本文を書きます。<Ref>配信⑤</Ref>のボタンでお名前・会社名を差し込めます</>,
              <strong key="check" className="font-semibold">プレビュー<Ref>配信⑥</Ref>とテスト送信<Ref>配信⑦</Ref>で必ず確認します</strong>,
              "問題なければ送信します",
            ]}
            tip="配信停止リンクと事務局の連絡先は、本文の末尾に自動で付きます。"
          />
          <Recipe
            id="howto-invoice"
            title="請求書を作って送る"
            who={[A, R]}
            role={role}
            steps={[
              <>初回だけ、「請求項目マスタ」<Ref>請求②</Ref>に品名と単価を登録しておきます</>,
              <>「新規作成」<Ref>請求③</Ref>を押し、対象のエントリーを選びます。宛名は企業名が自動で入ります</>,
              "明細を項目マスタから選びます。金額は自動で計算されます",
              <>保存してから送信します。送信後は「送信済み」と日時<Ref>請求④</Ref>が出ます</>,
            ]}
          />
        </div>
      </Section>

      <Section id="care" title="気をつけること" lead="取り返しがつかない操作と、間違えやすい箇所です。">
        <div className="space-y-3">
          {(
            [
              { title: "メールの送信は取り消せません", body: "一度送ったメールは戻せません。送る前に必ず「プレビュー表示」と「テスト送信」で確認してください。宛先の人数も送信前に表示されます。" },
              { title: "個人情報の扱いにご注意ください", body: "ご担当者名・メールアドレス・電話番号は、閲覧者と審査員には表示されません。画面を共有したりExcelを転送したりする前に、相手が見てよい情報かを確かめてください。" },
            ] as const
          ).map((c) => (
            <div key={c.title} className="flex gap-3 rounded-lg border border-warning-line bg-warning-soft p-4">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-warning-ink">{c.title}</p>
                <p className="mt-0.5 text-sm text-ink">{c.body}</p>
              </div>
            </div>
          ))}

          <div className="flex gap-3 rounded-lg border border-warning-line bg-warning-soft p-4">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-warning-ink">CSVの取り込みは、モードを確かめてから</p>
                <WhoBadges who={[A]} />
              </div>
              <p className="mt-0.5 text-sm text-ink">
                「新規登録」は新しいエントリーを追加し、「一括更新」はすでにあるエントリーの項目を書き換えます。モードを間違えると「0件登録、○件スキップ」と出て何も変わりません。
              </p>
              <div className="mt-4 rounded-lg bg-surface p-4">
                <AnnotatedShot shot={HELP_SHOTS.upload} alt="CSVアップロード" items={legendItems("upload", role)} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border border-line bg-surface p-4">
            <Info className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">操作はすべて記録されます</p>
              <p className="mt-0.5 text-sm text-ink">誰がいつ何を変えたかは「操作ログ」に残ります。おかしなことが起きたら、そのまま{CONTACT.name}までお知らせください。記録があるので原因を追えます。</p>
            </div>
          </div>
        </div>
      </Section>

      <Section id="trouble" title="困ったとき" lead="よくあるつまずきと、その原因です。">
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["メニューに項目が出てこない", "権限によって表示が変わります。「権限のちがい」の表でご確認ください。業務で必要なら、権限を変更できます。"],
              ["「権限がありません」と出る", "その操作がご自身の権限に含まれていません。必要な場合はご相談ください。"],
              ["エントリーや受賞が見当たらない", "左上の開催年度が、探している年度になっているか確かめてください。"],
              ["CSVを上げたのに反映されない", "「新規登録」のまま既存データを上げると、全件が重複としてスキップされます。「一括更新」に切り替えて上げ直してください。"],
              ["メールの送信対象が0人になる", "その年度のエントリーにメールアドレスが登録されていないと、宛先になりません。過去の年度を取り込んだデータなどで起こります。"],
              ["メール本文に受賞名を入れたい", "本文に受賞名を自動で差し込む機能はありません。受賞枠で「金賞」などに絞り、賞ごとに文面を分けて送ってください。"],
              ["画面が崩れる・古い内容が出る", "Macは ⌘ + Shift + R、Windowsは Ctrl + Shift + R で再読み込みしてください。"],
              ["パスワードを忘れた", "ご自身で再設定する機能はありません。下の連絡先までご連絡ください。"],
            ] as const
          ).map(([q, a]) => (
            <Card key={q} padding="sm">
              <p className="text-sm font-semibold text-ink">{q}</p>
              <p className="mt-1 text-caption text-ink-muted">{a}</p>
            </Card>
          ))}
        </div>

        <Card padding="md" className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">わからないこと・うまくいかないこと</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {CONTACT.name}までお問い合わせください。
                <span className="ml-1 select-all font-medium text-ink">{CONTACT.email}</span>
              </p>
            </div>
            <ButtonLink href={`mailto:${CONTACT.email}`} external variant="secondary" icon={<Mail />}>
              メールを書く
            </ButtonLink>
          </div>
        </Card>

        <p className="mt-6 flex items-start gap-1.5 text-caption text-ink-faint">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          画面の写真は実際の管理システムのものです。写っている企業名・商品名・お名前・メールアドレス・請求金額は、個人情報を守るため見本に置き換えています。
        </p>
      </Section>
    </PageContainer>
  );
}
