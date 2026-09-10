import { cn } from "@/lib/cn";
import { Snowflake } from "./icons";

export type BrandSize = "sm" | "lg";

/** ロゴ＋名称。sm はサイドバー、lg はログイン画面。文言は現状維持でリンクにはしない */
export function Brand({ size = "sm" }: { size?: BrandSize }) {
  const lg = size === "lg";
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-md bg-ink text-white",
          lg ? "size-10" : "size-7",
        )}
      >
        <Snowflake className={lg ? "size-5" : "size-4"} />
      </span>
      <span>
        <span className={cn("block font-semibold leading-tight text-ink", lg ? "text-lg" : "text-sm")}>
          ご当地冷凍食品大賞
        </span>
        <span className="block text-caption text-ink-subtle">管理システム</span>
      </span>
    </div>
  );
}
