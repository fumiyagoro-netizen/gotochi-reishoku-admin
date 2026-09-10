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
- `src/app/ui-preview/page.tsx` は開発時の目視用（.gitignore 済み・コミットしない）。middleware の認証対象なのでログイン後に `/ui-preview` を開く。

## 画面置換の要望で追加したもの（既存 props・既定の見た目は不変）

- Button / ButtonLink: variant `link`（text-accent）と `linkDanger`（text-danger）。hover:underline underline-offset-4、高さ・余白なしの inline-flex で行高 40px を崩さない。文字サイズだけ size に従う（md=`text-sm` / sm=`text-caption`）。表内の「編集」「配信を再開」「削除」等の文字ボタン用。フォーカスリングの色は variant 側（accent / danger）。
- IconButton: size `xs`（`size-6`、アイコン `size-3.5`）。表の行内用。アイコン寸法は size 側に持ち base の `[&_svg]:size-4` は撤去（出力順に依存させない）。
- TogglePill: `...rest`（ButtonHTMLAttributes、`type` / `className` / `children` を除く）を透過。`aria-expanded` / `aria-haspopup` を付けられる。rest は先に展開するので `type="button"` / `aria-pressed` / `aria-busy` は上書きされない。
- CardTitle / CardHeader: `as?: "h2" | "h3"`（既定 h2）。CardFooter: `start?`（左スロット）。`start` があるときだけ `mr-auto` の箱を挟み、無いときは children を直接置く（settings の `mr-auto` 運用を壊さない）。
- InlineConfirm: `className`（外枠に追加）と `loadingLabel`（loading 中の確認ボタン文言。既定は confirmLabel）。
- PageHeader: 見出し側を `flex-1`（basis 0）にし、actions は `flex-wrap justify-end`。actions は自分の幅がページ幅を超えたときだけ縮んで折り返し、長い件名は従来どおり先に truncate される。
- Field: `className`（inline ではラベル行、それ以外は外側要素）と `labelHint`（ラベル横の薄字補足 `text-caption text-ink-subtle font-normal`。labelAddon の前）。新規 `FieldLabel`（label 要素を使わない見出しだけ。`hint` / `addon` / `id` / `className`）。CheckPill 群・FileInput のように子が自前の label を持つ場合に使い、二重の label を作らない。
- Pagination: `total` だけでも左に「{total}件」を出す（`pageSize` が無ければ範囲は出さない）。
- icons.ts: `Heading` / `Text` / `Image` と、DOM のグローバル名と被らない別名 `HeadingIcon` / `TextIcon` / `ImageIcon`。
- badge.tsx: `FormStatusBadge`（draft=neutral「下書き」/ published=success「公開」/ closed=warning「受付終了」。文言は forms/page.tsx の定義を正としたもの。未知は neutral ＋ 生文字列）。
- Td: `tone="ink"`（text-ink だが font-medium ではない）。文字色は1つだけ出し、既定の text-ink-muted は tone 未指定時だけ付ける。Th: `compact`（チェック列用 px-2。`first:pl-4` はそのまま）。
- ModalFooter: `flex-wrap` と `note?`（basis-full の確認文スロット。ボタン行の上に出る）。右のボタン列は `ml-auto` で折り返し後も右寄せ。Modal にも `footerNote?` を通した。
- KeyValue: `align?: "start" | "center"`（既定 start）。center は dt / dd を `self-center` にし、編集中の入力欄（h-8）と dt が中央で揃う。
- src/lib/item-arrival-shared.ts: `ITEM_ARRIVAL_COLORS` と絵文字の `icon` を削除（参照なしを確認済み）。
