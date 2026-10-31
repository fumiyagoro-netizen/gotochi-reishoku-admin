import Link from "next/link";
import type { CampaignItemRow } from "@/lib/retail";
import { PRIZE_LEVELS } from "@/lib/prize-shared";
import { adoptedButDeclined, formatJstDateTime, participationState } from "@/lib/retail-shared";
import { Badge, GrandPrixBadge, PrizeBadge } from "@/components/ui/badge";
import { Table, Td, Th, Thumb, Tr } from "@/components/ui/table";
import { TriangleAlert } from "@/components/ui/icons";
import { ParticipationMark, ResponseBadge } from "./badges";

export type ParticipantVariant = "adopted" | "pending" | "closed" | "unanswered";

/**
 * 企画のページ（見るだけ）の商品の表。操作は置かない（採用・見送りの変更は /campaigns/[id]/decide）。
 * closed は見送り・参加しないをまとめて出し、どちらかを印で示す。unanswered は回答する担当者を出す
 */
export function ParticipantTable({
  rows,
  variant,
  yearQuery,
}: {
  rows: CampaignItemRow[];
  variant: ParticipantVariant;
  yearQuery: string;
}) {
  const answered = variant !== "unanswered";
  return (
    <Table>
      <thead>
        <tr>
          <Th width="w-16">写真</Th>
          <Th>商品</Th>
          {variant === "closed" && <Th>状況</Th>}
          {answered ? (
            <>
              <Th>企業の回答</Th>
              <Th>回答者・連絡事項</Th>
            </>
          ) : (
            <Th>回答する担当者</Th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td top>
              <Thumb src={r.mainImageId ? `/api/images/${r.mainImageId}` : undefined} alt="" />
            </Td>
            <Td top>
              <Link
                href={`/entries/${r.id}${yearQuery}`}
                className="font-medium text-ink hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {r.productName}
              </Link>
              <p className="text-caption text-ink-subtle">{r.companyName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Badge tone="neutral" size="sm">{r.year}年度</Badge>
                {(PRIZE_LEVELS as readonly string[]).includes(r.prizeLevel) ? (
                  <PrizeBadge prizeLevel={r.prizeLevel} size="sm" />
                ) : (
                  r.prizeLevel && <Badge tone="neutral" size="sm">{r.prizeLevel}</Badge>
                )}
                {r.grandPrix && <GrandPrixBadge size="sm" />}
                {r.outOfScope && <Badge tone="warning" size="sm">対象年度の外</Badge>}
              </div>
              {variant === "adopted" && adoptedButDeclined(r) && (
                <p className="mt-1.5 flex items-center gap-1 text-caption text-warning-ink">
                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                  採用のあとに、企業が「参加しない」と答えました
                </p>
              )}
            </Td>
            {variant === "closed" && (
              <Td top>
                <ParticipationMark state={participationState(r)} />
              </Td>
            )}
            {answered ? (
              <>
                <Td top>
                  <ResponseBadge response={r.response} />
                  {r.respondedAt ? (
                    <p className="mt-1 text-caption text-ink-subtle tabular-nums">
                      {formatJstDateTime(r.respondedAt)}
                      {r.respondedVia === "staff" && "（事務局が入力）"}
                    </p>
                  ) : (
                    variant === "adopted" && <p className="mt-1 text-caption text-ink-subtle">事務局が採用</p>
                  )}
                </Td>
                <Td top className="max-w-xs">
                  {r.respondentName || r.respondentContact ? (
                    <>
                      <p className="text-ink">{r.respondentName}</p>
                      {r.respondentContact && (
                        <p className="whitespace-nowrap text-caption text-ink-subtle tabular-nums">{r.respondentContact}</p>
                      )}
                    </>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                  {r.companyNote && <p className="mt-0.5 whitespace-pre-wrap text-caption">{r.companyNote}</p>}
                  {r.staffMemo && (
                    <p className="mt-0.5 whitespace-pre-wrap text-caption text-ink-subtle">メモ: {r.staffMemo}</p>
                  )}
                </Td>
              </>
            ) : (
              <Td top>
                <p className="text-ink">{r.answererName || "—"}</p>
                <p className="text-caption text-ink-subtle break-all">{r.answererEmail}</p>
                {r.contactOverridden && <Badge tone="info" size="sm" className="mt-1">案内先を変更済み</Badge>}
              </Td>
            )}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
