import { Badge } from "@/components/ui/badge";
import { Check, TriangleAlert } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  CAMPAIGN_STATUS_LABELS,
  DECISION_BADGE_CLASS,
  DECISION_LABELS,
  PARTICIPATION_LABELS,
  RESPONSE_BADGE_CLASS,
  RESPONSE_LABELS,
  isCampaignStatus,
  isDecision,
  isResponse,
  type ParticipationState,
} from "@/lib/retail-shared";

// 参加状況の印。「採用＝この企画に出る」だけを塗りつぶしで強く見せ、確定待ちは枠線、ほかは文字だけにする
const MARK_CLASS: Record<ParticipationState, string> = {
  adopted: "bg-emerald-600 text-white",
  pending: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/30",
  declined: "text-rose-600",
  no: "text-ink-subtle",
  none: "text-ink-faint",
  outside: "text-ink-faint",
};

const MARK_TEXT: Record<ParticipationState, string> = {
  ...PARTICIPATION_LABELS,
  pending: "希望",
  none: "—",
};

/** 商品 × 企画のセル。conflict は採用のあとに企業が「参加しない」と答えたもの */
export function ParticipationMark({ state, conflict = false }: { state: ParticipationState; conflict?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-caption font-medium",
          state === "none" || state === "outside" ? "px-0 font-normal" : "",
          MARK_CLASS[state],
        )}
      >
        {state === "adopted" && <Check className="size-3.5" aria-hidden="true" />}
        {state === "none" ? <span aria-label="未回答">—</span> : MARK_TEXT[state]}
      </span>
      {conflict && (
        <span title="採用のあとに、企業が「参加しない」と答えました">
          <TriangleAlert className="size-4 text-warning-ink" aria-label="企業の回答は「参加しない」" />
        </span>
      )}
    </span>
  );
}

/** 印の見方（参加状況の表の上に出す） */
export function ParticipationLegend() {
  const items: [ParticipationState, string][] = [
    ["adopted", "＝この企画に出る"],
    ["pending", "＝企業が参加を希望（事務局は未定）"],
    ["declined", "＝事務局が見送り"],
    ["no", "＝企業が参加しない"],
    ["none", "＝未回答"],
    ["outside", "＝企画の対象年度の外"],
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-ink-subtle">
      {items.map(([state, text]) => (
        <li key={state} className="flex items-center gap-1">
          <ParticipationMark state={state} />
          <span>{text}</span>
        </li>
      ))}
      <li className="flex items-center gap-1">
        <TriangleAlert className="size-4 text-warning-ink" aria-hidden="true" />
        <span>＝採用のあとに企業が「参加しない」と回答</span>
      </li>
    </ul>
  );
}

export function CampaignStatusBadge({ status }: { status: string }) {
  if (!isCampaignStatus(status)) return <Badge tone="neutral">{status}</Badge>;
  if (status === "open") return <Badge tone="success" dot="pulse">{CAMPAIGN_STATUS_LABELS.open}</Badge>;
  if (status === "closed") return <Badge tone="outline">{CAMPAIGN_STATUS_LABELS.closed}</Badge>;
  return <Badge tone="neutral">{CAMPAIGN_STATUS_LABELS.draft}</Badge>;
}

/** 企業の回答。未回答は outline（不在） */
export function ResponseBadge({ response, size }: { response: string; size?: "md" | "sm" }) {
  if (!isResponse(response)) return <Badge tone="neutral" size={size}>{response}</Badge>;
  if (response === "") return <Badge tone="outline" size={size}>{RESPONSE_LABELS[""]}</Badge>;
  return (
    <Badge tone="custom" size={size} className={RESPONSE_BADGE_CLASS[response]}>
      {RESPONSE_LABELS[response]}
    </Badge>
  );
}

/** 事務局の確定。未定は何も出さない呼び出し側もあるので null を返さず outline にする */
export function DecisionBadge({ decision, size }: { decision: string; size?: "md" | "sm" }) {
  if (!isDecision(decision)) return <Badge tone="neutral" size={size}>{decision}</Badge>;
  if (decision === "") return <Badge tone="outline" size={size}>{DECISION_LABELS[""]}</Badge>;
  return (
    <Badge tone="custom" size={size} className={DECISION_BADGE_CLASS[decision]}>
      {DECISION_LABELS[decision]}
    </Badge>
  );
}
