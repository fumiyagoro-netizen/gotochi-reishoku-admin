# src/components/ui の約束事

- クラス結合は `cn()`（`@/lib/cn`）。falsy を落として空白で繋ぐだけなので、条件は `cond && "class"` の形で渡す。
- Tailwind 3.4 の JIT のため `bg-${hue}-50` のような動的結合は禁止。完全なクラス文字列だけを書く。
- 賞・審査・到着などドメイン色はトークン化せず `src/lib/*-shared.ts`（prize / review-status / item-arrival）の完全文字列を `Badge tone="custom"` や `TogglePill toneClassName` に渡す。
- 高さの物差しは md=`h-9` / sm=`h-8`（Button・Input・チップ類）。Badge は md=`h-6` / sm=`h-5`。同じ行に並ぶ部品は同じ高さにする。
- 文字は本文 `text-sm`、注記・th・バッジ・ヒントは `text-caption`（13px）。管理画面で `text-xs` は使わない。
- フォーカスは `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`。入力欄だけ `focus:border-accent focus:ring-2 focus:ring-accent/20`。
- 角丸は部品 `rounded-md`、カード `rounded-lg`、ピル・バッジ `rounded-full`。`rounded-xl` は Modal だけ。
- アイコンは `./icons`（lucide の re-export）から。ボタン内は `[&_svg]:size-4`、バッジ内は `[&_svg]:size-3.5` で自動調整されるので size クラスを付けない。絵文字は使わない。
- `"use client"` は hooks や DOM イベントの購読が必要なファイル（modal / popover / field-controls）だけ。field-controls はディレクティブがファイル単位なので Input / Select / Textarea / Checkbox / Radio も client component になるが hooks は無く、サーバーページから name / defaultValue で描画できる（関数 props を渡すのはクライアント側から）。それ以外は付けず、サーバーページから import できる状態を保つ。
- 既存画面を置き換えるとき、機能・文言・href・権限分岐・API 呼び出しは変えない。`disabled` は呼び出し側の式をそのまま渡し、`loading` で勝手に disabled にしない。

## 方針書との差分（レビューで確定したもの）

- Button: 文字サイズは base ではなく size 側（md=`text-sm` / sm=`text-caption`）。同じ要素に両方を重ねて出力順に依存させない。
- Badge: `dot` は `boolean | "pulse"`（受付中の animate-pulse は `dot="pulse"`）。`[&_svg]:size-3.5` でアイコン寸法を自動調整。
- PrizeBadge / ReviewBadge / ItemArrivalBadge は badge.tsx にもある（既存 props ＋ `size?`）。置換段階では各 selector から `export { PrizeBadge } from "@/components/ui/badge"` の形で再 export し、import 先（entry-table / entry-detail / reviews）を変えない。
- EmptyState の `icon` は ReactNode ではなく lucide のコンポーネント（`icon={Lock}`）。`title` は ReactNode。
- Card / BackLink に `className?` あり（StatCard・login・PageHeader が前提にしている）。CardFooter は `items-center`。
- IconButton の `type` 既定は `"button"`。hover 色は tone 側に持つ。
- TableSkeleton: `thumb` 時は行高 `h-14`（サムネ付き行 56px に合わせる）。`cols` は必須。
- Checkbox は bare `rounded` ではなく `rounded-sm`（native checkbox は appearance を外さない限り border-radius を無視するので見た目は同じ）。
- Input / Select / Textarea の invalid は `focus:border-danger` も付く（青枠＋赤リングの混在を防ぐ）。
- TogglePill: `[&>svg]:size-3.5` は直下の svg だけ（Spinner の size-3 を上書きしない）。pending 中は aria-busy。`toneClassName` は optional。
- InlineConfirm の確認ボタンは `disabled={loading}`（置換対象の「削除中...」「実行中...」が既存でも disabled だったため）。キャンセルは disabled にしない。
- RoleBadge は `role: string` で受け、未知値は viewer 色＋生文字列。
- FileInput に `hint?`（未選択時の右側テキスト）。Alert は `icon={null}` でアイコン非表示。
- Th / Td / Tr は native 属性（className / colSpan / scope / title / onClick 等）を `...rest` で透過。Table の compact は context ではなく `[&_td]:py-1.5`。
- Modal の size 既定は `md`。パネルは `tabIndex=-1` で入力欄が無くても初期フォーカスを受ける。初期フォーカスは disabled でない最初の input / textarea / select。Tab のフォーカストラップは持たない（背景は overflow-hidden のみ）。
- Popover の外側クリック判定はパネルではなく親ラッパー（`relative` の div）基準。トリガーはその中に置く。
- KeyValue の `link` は `mailto:` 始まりなら同タブ、それ以外は target=_blank。リンクにも focus-visible リングを付ける。
- Pagination は range が無いときも左の `<p>` を空で描画し、前へ／次への位置を固定する。
- SegmentedControl の onChange は選択中の項目を押しても呼ぶ（upload の result リセット挙動を維持）。
- Spinner はフラグメント（svg ＋ sr-only）。幅を固定したい場所では呼び出し側の span で包む。Button 内は自前で Loader2 を出すので Spinner は不要。
- `src/app/_ui-preview/page.tsx` は開発時の目視用（.gitignore 済み・コミットしない）。middleware の認証対象なのでログイン後に開く。
