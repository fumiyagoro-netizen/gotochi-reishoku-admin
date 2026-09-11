import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // *-shared.ts に置いた完全クラス文字列（bg-sky-50 等）を purge させない
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 面・線
        canvas: "#fafafa",
        surface: { DEFAULT: "#ffffff", muted: "#f4f4f5", sunken: "#e4e4e7" },
        line: { DEFAULT: "#e4e4e7", strong: "#d4d4d8" },
        // 文字。faint は placeholder・disabled・休止アイコン専用で文字には使わない
        ink: {
          DEFAULT: "#18181b",
          hover: "#27272a",
          muted: "#52525b",
          subtle: "#71717a",
          faint: "#a1a1aa",
        },
        // 主ボタン（依頼者の決定で青。accent と同値）
        primary: { DEFAULT: "#2563eb", hover: "#1d4ed8", fg: "#ffffff" },
        // アクセントはリンク・選択行・アクティブフィルタ・フォーカスリングにのみ使う
        accent: { DEFAULT: "#2563eb", hover: "#1d4ed8", soft: "#eff6ff", line: "#bfdbfe" },
        // 意味色（DEFAULT=塗り/アイコン, ink=文字, soft=背景, line=枠）
        success: { DEFAULT: "#059669", ink: "#047857", soft: "#ecfdf5", line: "#a7f3d0" },
        warning: { DEFAULT: "#d97706", ink: "#b45309", soft: "#fffbeb", line: "#fde68a" },
        danger: { DEFAULT: "#dc2626", ink: "#b91c1c", soft: "#fef2f2", line: "#fecaca" },
        info: { DEFAULT: "#2563eb", ink: "#1d4ed8", soft: "#eff6ff", line: "#bfdbfe" },
        // サイト管理（/site）のサイドバー専用。公開サイトの紺（--ink）・青（--blue）・シアン（--cyan）と同値で、
        // 「公開サイトを触っている区画」だと一目で分かるようにする。本文の部品には使わない
        site: {
          DEFAULT: "#0b2545",
          blue: "#0a4f8f",
          accent: "#19b4d7",
          ink: "#d3deea",
          subtle: "#8499b3",
          line: "rgb(255 255 255 / 0.1)",
          hover: "rgb(255 255 255 / 0.08)",
          active: "rgb(255 255 255 / 0.13)",
        },
      },
      fontFamily: {
        // 日本語フォントを先頭に。Windows は Yu Gothic Medium を Yu Gothic より前に
        sans: [
          "\"Hiragino Sans\"",
          "\"Hiragino Kaku Gothic ProN\"",
          "\"Yu Gothic Medium\"",
          "\"Yu Gothic\"",
          "Meiryo",
          "system-ui",
          "-apple-system",
          "\"Segoe UI\"",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        // 13px。注記・th・バッジ・ヒント用。管理画面では text-xs の代わりに使う
        caption: ["0.8125rem", { lineHeight: "1.125rem" }],
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        popover: "0 4px 16px -4px rgb(0 0 0 / 0.12), 0 0 0 1px rgb(0 0 0 / 0.04)",
        modal: "0 24px 48px -12px rgb(0 0 0 / 0.25)",
      },
      spacing: {
        // サイドバー幅。w-sidebar と pl-sidebar が同じ値を参照する
        sidebar: "15rem",
      },
      maxWidth: {
        // 一覧ページの最大幅
        page: "72rem",
      },
    },
  },
  plugins: [],
};

export default config;
