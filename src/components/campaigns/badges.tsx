import { Badge } from "@/components/ui/badge";
import {
  CAMPAIGN_STATUS_LABELS,
  DECISION_BADGE_CLASS,
  DECISION_LABELS,
  RESPONSE_BADGE_CLASS,
  RESPONSE_LABELS,
  isCampaignStatus,
  isDecision,
  isResponse,
} from "@/lib/retail-shared";

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
