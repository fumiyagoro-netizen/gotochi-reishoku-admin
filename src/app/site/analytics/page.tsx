import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { ExternalLink } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { GaError, SITE_EVENTS, gaConfig, gaServiceAccountEmail, loadGaReport, type GaReport } from "@/lib/ga";

export const dynamic = "force-dynamic";
export const metadata = { title: "アクセス状況" };

// アクセス状況（サイト管理）。公開サイトの Google アナリティクスの記録を、よく見る数字だけに絞って出す。
// 詳しい分析は「アナリティクスで詳しく見る」から GA4 の画面へ。つながっていないあいだは接続の手順を出す。

const PERIODS = [7, 28, 90] as const;

const CHANNEL_LABEL: Record<string, string> = {
  "Organic Search": "検索エンジン",
  Direct: "直接（ブックマーク・URL入力など）",
  Referral: "ほかのサイトのリンク",
  "Organic Social": "SNS",
  "Organic Video": "動画サイト",
  Email: "メール",
  "Paid Search": "検索広告",
  "Paid Social": "SNS広告",
  Display: "ディスプレイ広告",
  Unassigned: "分類できないもの",
};

const DEVICE_LABEL: Record<string, string> = { mobile: "スマホ", desktop: "パソコン", tablet: "タブレット", "smart tv": "テレビ" };

const fmt = (n: number) => n.toLocaleString("ja-JP");

/** 前の期間と比べた増減（例: +12%）。前の期間が0なら出さない */
function change(now: number, before: number): string | undefined {
  if (!before) return undefined;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

/** ページ名。どのページにも付く「｜日本全国！ご当地冷凍食品大賞」は省く。トップはサイト名だけなので「トップページ」 */
function pageName(title: string, path: string): string {
  if (path === "/") return "トップページ";
  const t = title.replace(/｜日本全国！ご当地冷凍食品大賞$/, "").trim();
  return t || path;
}

/** 20261009 → 10/9 */
function shortDate(d: string): string {
  return d.length === 8 ? `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}` : d;
}

export default async function SiteAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: daysParam } = await searchParams;
  const days = PERIODS.find((p) => String(p) === daysParam) ?? 28;
  const cfg = gaConfig();

  const periodLinks = (
    <div role="radiogroup" aria-label="期間" className="inline-flex rounded-md bg-surface-muted p-0.5">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={`/site/analytics?days=${p}`}
          role="radio"
          aria-checked={p === days}
          className={cn(
            "inline-flex h-8 items-center rounded-[5px] px-3 text-sm transition-colors",
            p === days ? "bg-surface text-ink shadow-xs" : "text-ink-subtle hover:text-ink",
          )}
        >
          {p}日
        </Link>
      ))}
    </div>
  );

  if (!cfg) {
    return (
      <PageContainer width="form">
        <PageHeader title="アクセス状況" description="公開サイト（gotouchireisyoku.com）の訪問者数や、よく見られたページを表示します。" />
        <Setup email={gaServiceAccountEmail()} />
      </PageContainer>
    );
  }

  let report: GaReport | null = null;
  let error: GaError | null = null;
  try {
    report = await loadGaReport(cfg, days);
  } catch (e) {
    error = e instanceof GaError ? e : new GaError("api", "アナリティクスから読み込めませんでした");
  }

  const gaLink = `https://analytics.google.com/analytics/web/#/p${cfg.propertyId}/reports/intelligenthome`;

  return (
    <PageContainer>
      <PageHeader
        title="アクセス状況"
        description={`公開サイト（gotouchireisyoku.com）の直近${days}日間。Google アナリティクスの記録を15分ごとに読み込みます。`}
        actions={
          <>
            {periodLinks}
            <ButtonLink href={gaLink} target="_blank" iconRight={<ExternalLink />}>
              アナリティクスで詳しく見る
            </ButtonLink>
          </>
        }
      />
      {error || !report ? (
        <Alert tone="danger" title={error?.message ?? "読み込めませんでした"}>
          {error?.kind === "permission"
            ? `GA4 の「管理」→「プロパティのアクセス管理」に ${cfg.credentials.client_email} を「閲覧者」で追加してください。`
            : error?.kind === "auth"
              ? "Vercel に登録したサービスアカウントの鍵（GA_SERVICE_ACCOUNT_JSON）が正しいか確認してください。"
              : "時間をおいて開き直してください。続くときは GA_PROPERTY_ID が正しいか確認してください。"}
        </Alert>
      ) : (
        <Report report={report} />
      )}
    </PageContainer>
  );
}

async function Report({ report }: { report: GaReport }) {
  const { totals, previous, days } = report;
  const vs = `前の${days}日間と比べて`;

  // 受賞商品ページ（/winners/<年>/<id>）を商品名に置き換える
  const ids = report.winnerPages.map((p) => Number(p.path.split("/")[3])).filter(Number.isInteger);
  const entries = ids.length
    ? await prisma.entry.findMany({ where: { id: { in: ids } }, select: { id: true, productName: true, companyName: true } })
    : [];
  const nameOf = (path: string) => entries.find((e) => e.id === Number(path.split("/")[3]));

  const eventCount = (name: string) => report.events.find((e) => e.name === name)?.count ?? 0;
  const totalSessions = report.channels.reduce((a, c) => a + c.sessions, 0) || 1;
  const totalDeviceUsers = report.devices.reduce((a, d) => a + d.users, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="訪問した人" value={fmt(totals.users)} hint={change(totals.users, previous.users) && `${vs} ${change(totals.users, previous.users)}`} />
        <StatCard label="見られたページ数" value={fmt(totals.views)} hint={change(totals.views, previous.views) && `${vs} ${change(totals.views, previous.views)}`} />
        <StatCard label="訪問の回数" value={fmt(totals.sessions)} hint={change(totals.sessions, previous.sessions) && `${vs} ${change(totals.sessions, previous.sessions)}`} />
      </div>

      <Card padding="none">
        <CardHeader title="日ごとの訪問した人" description="棒にカーソルを合わせると、その日の人数とページ数が出ます。" />
        <div className="p-5">
          <DailyChart daily={report.daily} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="よく見られたページ">
          {report.pages.length ? (
            <Table>
              <thead><tr><Th>ページ</Th><Th align="right">表示</Th></tr></thead>
              <tbody>
                {report.pages.map((p) => (
                  <Tr key={p.path}>
                    <Td tone="ink" truncate={`${pageName(p.title, p.path)}（${p.path}）`}>
                      {pageName(p.title, p.path)}
                    </Td>
                    <Td numeric>{fmt(p.views)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : <Empty />}
        </Section>

        <Section title="よく見られた受賞商品のページ" note="商品ページを直接開いた回数です（一覧から開いたポップアップは「サイトでの操作」の「商品の詳しい情報を開いた」に数えます）。">
          {report.winnerPages.length ? (
            <Table>
              <thead><tr><Th>商品</Th><Th align="right">表示</Th></tr></thead>
              <tbody>
                {report.winnerPages.map((p) => {
                  const e = nameOf(p.path);
                  return (
                    <Tr key={p.path}>
                      <Td truncate={e ? `${e.productName}（${e.companyName}）` : p.path}>
                        <span className="text-ink">{e?.productName ?? p.path}</span>
                        {e && <span className="ml-2 text-caption text-ink-subtle">{e.companyName}</span>}
                      </Td>
                      <Td numeric>{fmt(p.views)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          ) : <Empty />}
        </Section>

        <Section title="どこから来たか">
          {report.channels.length ? (
            <Table>
              <thead><tr><Th>経路</Th><Th align="right">訪問</Th><Th align="right">割合</Th></tr></thead>
              <tbody>
                {report.channels.map((c) => (
                  <Tr key={c.name}>
                    <Td tone="ink">{CHANNEL_LABEL[c.name] ?? c.name}</Td>
                    <Td numeric>{fmt(c.sessions)}</Td>
                    <Td numeric>{Math.round((c.sessions / totalSessions) * 100)}%</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : <Empty />}
        </Section>

        <Section title="来たサイト（上位）" note="google は検索、(direct) は直接の訪問です。">
          {report.sources.length ? (
            <Table>
              <thead><tr><Th>サイト</Th><Th align="right">訪問</Th></tr></thead>
              <tbody>
                {report.sources.map((s) => (
                  <Tr key={s.name}>
                    <Td tone="ink">{s.name === "(direct)" ? "直接" : s.name}</Td>
                    <Td numeric>{fmt(s.sessions)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : <Empty />}
        </Section>

        <Section title="サイトでの操作">
          <Table>
            <thead><tr><Th>操作</Th><Th align="right">回数</Th></tr></thead>
            <tbody>
              {Object.entries(SITE_EVENTS).map(([name, label]) => (
                <Tr key={name}>
                  <Td tone="ink">{label}</Td>
                  <Td numeric>{fmt(eventCount(name))}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <div className="space-y-6">
          <Section title="使われた端末">
            {report.devices.length ? (
              <Table>
                <thead><tr><Th>端末</Th><Th align="right">人</Th><Th align="right">割合</Th></tr></thead>
                <tbody>
                  {report.devices.map((d) => (
                    <Tr key={d.name}>
                      <Td tone="ink">{DEVICE_LABEL[d.name] ?? d.name}</Td>
                      <Td numeric>{fmt(d.users)}</Td>
                      <Td numeric>{Math.round((d.users / totalDeviceUsers) * 100)}%</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : <Empty />}
          </Section>

          <Section title="サイト内でよく検索された言葉">
            {report.searchTerms.length ? (
              <Table>
                <thead><tr><Th>言葉</Th><Th align="right">回数</Th></tr></thead>
                <tbody>
                  {report.searchTerms.map((t) => (
                    <Tr key={t.term}>
                      <Td tone="ink">{t.term}</Td>
                      <Td numeric>{fmt(t.count)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : <Empty />}
          </Section>
        </div>
      </div>

      <p className="text-caption text-ink-subtle">
        アナリティクス側の集計に時間がかかるため、今日と昨日の数字は少なめに出ることがあります。
        「訪問した人」は同じ人が何度来ても1人と数えます（ブラウザや端末が違うと別の人になります）。
      </p>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      {note && <p className="-mt-1 mb-2 text-caption text-ink-subtle">{note}</p>}
      {children}
    </section>
  );
}

function Empty() {
  return (
    <Card>
      <p className="text-sm text-ink-subtle">この期間の記録はまだありません。</p>
    </Card>
  );
}

/** 日ごとの棒グラフ（訪問した人）。サーバーで SVG を組み立てる */
function DailyChart({ daily }: { daily: GaReport["daily"] }) {
  if (!daily.length) return <p className="text-sm text-ink-subtle">この期間の記録はまだありません。</p>;
  const W = 900;
  const H = 180;
  const max = Math.max(...daily.map((d) => d.users), 1);
  const step = W / daily.length;
  const bar = Math.max(2, step * 0.7);
  const labelEvery = Math.ceil(daily.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="h-auto w-full" role="img" aria-label="日ごとの訪問した人の棒グラフ">
      <line x1="0" x2={W} y1={H} y2={H} className="stroke-line" strokeWidth="1" />
      <text x="0" y="10" className="fill-ink-subtle" fontSize="11">{fmt(max)}人</text>
      {daily.map((d, i) => {
        const h = (d.users / max) * (H - 18);
        const x = i * step + (step - bar) / 2;
        return (
          <g key={d.date}>
            <rect x={x} y={H - h} width={bar} height={Math.max(h, 0.5)} rx="2" className="fill-accent">
              <title>{`${shortDate(d.date)}　訪問した人 ${fmt(d.users)}人・ページ ${fmt(d.views)}`}</title>
            </rect>
            {(i % labelEvery === 0 || i === daily.length - 1) && (
              <text x={x + bar / 2} y={H + 16} textAnchor="middle" className="fill-ink-subtle" fontSize="11">
                {shortDate(d.date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** まだつながっていないときの案内 */
function Setup({ email }: { email: string }) {
  const steps = [
    {
      t: "Google Cloud で「Google Analytics Data API」を有効にする",
      d: "Google Cloud コンソールでプロジェクトを選び（無ければ作成）、「API とサービス」→「ライブラリ」で Google Analytics Data API を探して「有効にする」。料金はかかりません。",
    },
    {
      t: "読み取り専用のサービスアカウントを作り、鍵をダウンロードする",
      d: "「IAM と管理」→「サービスアカウント」→「作成」。名前は例えば ga-reader。作成後「鍵」→「鍵を追加」→「JSON」でファイルがダウンロードされます（他の人に渡さないでください）。",
    },
    {
      t: "GA4 にサービスアカウントを「閲覧者」で追加する",
      d: email
        ? `GA4 の「管理」→「プロパティのアクセス管理」→「＋」で ${email} を「閲覧者」として追加。`
        : "GA4 の「管理」→「プロパティのアクセス管理」→「＋」で、サービスアカウントのメールアドレス（…@….iam.gserviceaccount.com）を「閲覧者」として追加。",
    },
    {
      t: "Vercel に2つ登録して、反映し直す",
      d: "Vercel のプロジェクト →「Settings」→「Environment Variables」に、GA_PROPERTY_ID（GA4 の「管理」→「プロパティの詳細」にある数字）と、GA_SERVICE_ACCOUNT_JSON（ダウンロードした JSON ファイルの中身をそのまま貼る）を Production で登録。登録後に最新のデプロイを「Redeploy」すると、この画面に数字が出ます。",
    },
  ];
  return (
    <Card padding="none">
      <CardHeader
        title="まだアナリティクスとつながっていません"
        description="公開サイトの計測（Google タグ）はすでに動いています。下の手順で読み取りの許可を出すと、ここに数字が表示されます。"
      />
      <ol className="space-y-4 p-5">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-caption font-semibold text-ink">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-ink">{s.t}</p>
              <p className="mt-0.5 text-caption leading-relaxed text-ink-subtle">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
