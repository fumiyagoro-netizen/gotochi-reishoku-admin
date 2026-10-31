"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { useRole } from "@/lib/role-context";

// 流通企画の画面の切り替え。?year= はサイドバーの年度選択をそのまま引き継ぐ
const TABS = [
  { href: "/campaigns", label: "参加状況", manageOnly: false },
  { href: "/campaigns/invites", label: "案内・申請URL", manageOnly: true },
];

export function CampaignTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { permissions } = useRole();
  const year = searchParams.get("year");

  const activeHref = pathname.startsWith("/campaigns/invites") ? "/campaigns/invites" : "/campaigns";

  return (
    <nav aria-label="流通企画" className="mb-6 inline-flex rounded-md bg-surface-muted p-0.5">
      {TABS.filter((t) => !t.manageOnly || permissions.canManageCampaigns).map((t) => {
        const active = t.href === activeHref;
        return (
          <Link
            key={t.href}
            href={year ? `${t.href}?year=${year}` : t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-[5px] px-3 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              active ? "bg-surface font-medium text-ink shadow-xs" : "text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
