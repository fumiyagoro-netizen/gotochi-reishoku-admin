# 公開サイト移行（WordPress → 管理画面と同一アプリ）設計メモ

最終更新: 2026-09-11。プロトタイプは社内承認中。次の作業は **サイト管理（管理画面側）の画面案** 作成。

- 公開中のプロトタイプ（トップページ v3.3）: https://claude.ai/code/artifact/8ecbcf1d-dacf-4a47-8852-8432e35b17a9
- 同じものが `prototype/gotouchi-2027-prototype.html` にある（ブラウザで直接開ける。単一HTML、画像は data URI 埋め込み）。

## 1. 目的と方針

- 現行の公開サイト https://gotouchireisyoku.com/ （WordPress）をやめ、この管理画面（Next.js 15 / Prisma / Neon / Vercel）と同じアプリ・同じDBで公開サイトを配信する。
- 受賞商品・企業名・写真・こだわり・参考URLはエントリーのデータをそのまま使い、事務局の二重入力を作らない。
- サイト固有の内容（お知らせ、審査員、受賞者の声、パートナー、年度の開催概要、バナー）は管理画面の **「サイト管理」区画**（管理者のみ）で編集する。
- デザインは刷新（シンプル・モダン・動きのある UI）。テキストロゴと受賞ロゴは現行を踏襲。

## 2. 公開サイトの構成（トップページ、上から順）

| セクション | 内容 | データの出どころ |
|---|---|---|
| お知らせバナー | 上部の1行バナー（説明会など）。閉じるとセッション内は非表示 | サイト管理: バナー |
| ヘッダー | テキストロゴ、ナビ（開催概要/審査員/受賞商品/受賞者の声/お知らせ）、エントリーボタン | 固定 |
| ヒーロー | 大きな「2027」＋年度なし受賞ロゴ（グランプリ）、キャッチ、募集期間・費用チップ、CTA、実績数、商品タイル最大4件 | 年度設定＋トップ掲載商品（未指定なら最新回のグランプリ＋最高金賞を自動） |
| マーキー | 受賞商品名が流れる帯 | 受賞商品 |
| ダイジェストムービー | 紺の帯にサムネイル＋再生ボタン。クリックでモーダル再生 | 年度設定: YouTube ID |
| コンセプト | 説明文、主催/後援/協力、主催・後援のロゴカード | 固定文＋パートナー |
| 受賞発表の特別枠 | 最新回のグランプリ大＋最高金賞4件、賞ごとの件数、「すべて見る」→年度別一覧ページ | 年度2フラグ（§3） |
| お知らせ | 最新3件、一覧へ | サイト管理: お知らせ |
| 開催概要・募集要項 | 表形式（名称/対象/資格/期間/審査の流れ/賞/発表/特典）、右に費用3段階（現在の期間を強調）と締切カウントダウン、3ステップ、タイムライン | 年度設定 |
| 審査員 | 5名（写真150px円形、氏名、肩書き） | サイト管理: 審査員 |
| 4つの賞 | 階段グラフ。各段の上に受賞ロゴ（銅/銀/金/最高金/グランプリ） | 固定 |
| 過去の受賞商品 | 年度タブ＋地域タイル絞り込み＋カード。特別枠に出ている年度は除外 | 受賞商品 |
| 受賞者の声 | 横スクロールカード（写真＋4行抜粋）。クリックで全文＋写真スライドのモーダル | サイト管理: 受賞者の声 |
| 掲載情報 | 動画3本（モーダル再生）＋媒体名 | 年度設定/サイト設定 |
| パートナー | ロゴの帯 | サイト管理: パートナー |
| CTA / フッター | エントリー・説明会、フッターにテキストロゴ | 固定 |

別ページ: `/winners/[year]`（年度別の受賞商品一覧。賞ごとにグループ表示、カードはモーダル）、`/news`、`/news/[id]`、プライバシーポリシー。既存の `/entry`、`/f/[slug]`、`/results`、`/unsubscribe` はそのまま。

### 商品モーダル（確定）

| 表示 | エントリー項目（Prisma `Entry`） |
|---|---|
| 商品名・企業名・都道府県 | productName / makerName / prefecture |
| 賞・回 | prizeLevel / award |
| 写真（スライド、最大3枚） | EntryImage（main 1 + sub 2）。サイト側で「どれを出すか」だけ選ぶ |
| ご当地のこだわり | `localAppeal` をそのまま自動表示（事務局編集なし） |
| 「公式サイトを見る」 | `referenceUrl`。未入力ならボタンを出さない |

受賞者の声のモーダルも同じスライド部品（写真最大3枚＋全文）。

## 3. 受賞商品の表示ルール（年度ごとの2フラグ）

| フラグ | 意味 | 操作 |
|---|---|---|
| `winnersPublished` 受賞商品を公開 | その年度の受賞商品をサイトに出してよい | 発表時にON。以後ずっとON |
| `isFeatured` 最新の受賞発表として掲載 | 上の特別枠に表示する年度（同時に1つ） | 発表時にON。`featuredUntil`（初期値 6/30）を過ぎたら自動OFF |

- 特別枠 = `isFeatured` の年度。無ければ枠ごと非表示。
- 過去の受賞商品 = `winnersPublished` の年度すべて − 特別枠に出ている年度（重複させない）。
- OFF にした瞬間、その年度はアーカイブの最新タブに自動で現れる。商品を「移動」する操作は存在しない。
- 年度別一覧ページはフラグに関係なく公開済み年度ぶん常に存在。ナビの「受賞商品」は特別枠があればそこへ、無ければアーカイブへ。

年間の事務局作業: 発表日にスイッチ2つをON（＋トップ掲載商品を確認）。7月に自動OFF。

## 4. サイト管理（管理画面）の設計案

- 入口: 既存サイドバー下部に「🌐 サイト管理」（管理者のみ）。`/site` 配下に移るとサイドバーがサイト管理用に切り替わる。左上に「エントリー管理に戻る」。
- 権限: `src/lib/role-shared.ts` の PERMISSIONS に `canManageSite` を追加（当面 admin のみ true）。API/ページは既存パターン同様にこのフラグで先にゲートする。
- 別アプリにはしない（ログイン・権限・デプロイの二重化とデータ同期を避ける）。

| メニュー | 内容 | 頻度 |
|---|---|---|
| 公開状況 | プレビューリンク、表示中の年度、特別枠ON/OFFと終了日、バナー状態 | 常時 |
| お知らせ | 作成・公開日・カテゴリ（開催情報/結果発表/メディア）・下書き・ピン留め | 月1〜2 |
| 受賞商品の公開 | 年度別にエントリーを賞ごとに一覧。商品ごとの公開ON/OFF、表示写真の選択（最大3）、参考URL確認。「この年度をまとめて公開」 | 年1 |
| トップ掲載商品 | ヒーローの最大4件と順番。未指定なら自動 | 年1〜 |
| 受賞者の声 | エントリーに紐づけてコメント＋写真（最大3） | 年1 |
| 審査員 | 年度ごとに氏名・肩書き・写真・並び順 | 年1 |
| 開催概要 | 募集期間、費用3段階（早割/通常/割増）、締切、発表日、展示日、リーフレットPDF、タイムライン | 年1 |
| ムービー・メディア | ダイジェストの YouTube ID、掲載メディア動画と媒体名一覧 | 半年 |
| パートナー・ロゴ | 主催/後援/協力/協賛のロゴ・URL・順番 | 半年 |
| バナー・サイト設定 | 上部バナー（文言・リンク・期間）、OGP、フッターリンク、プライバシーポリシー | 随時 |

### データモデル案（Prisma、名称は仮）

- `SiteAwardSettings`（awardId unique）: winnersPublished, isFeatured, featuredUntil, entryStart/End, fees(json: 早割/通常/割増の金額と期間), scheduleItems(json), announceDate, exhibitionText, leafletUrl, digestVideoId, heroEntryIds(json, 最大4), mediaVideos(json)
- `SiteNews`: title, body, category, publishedAt, isPublished, isPinned
- `SiteJudge`: awardId, name, title, photoUrl, sortOrder, isPublished
- `SiteVoice`: entryId, quote, photoUrls(json 最大3), sortOrder, isPublished
- `SitePartner`: kind(主催/後援/協力/協賛), name, logoUrl, url, sortOrder
- `SiteBanner`（または Setting）: text, linkUrl, startAt, endAt, isActive
- `Entry` に追加: `sitePublished` Boolean, `sitePhotoIds` Json（EntryImage id 最大3）
- 画像は既存の Vercel Blob（private）＋ `/api/images/[id]` プロキシを流用。公開サイト向けにキャッシュヘッダを長くする。

## 5. 技術方針

- 同一リポジトリ。ホスト名でルーティング: `gotouchireisyoku.com` → 公開サイト（route group `(site)`）、`dashboard.gotouchireisyoku.com` → 管理画面。`src/middleware.ts` の PUBLIC_PATHS に公開サイトのパスを追加。
- 公開サイトは ISR（保存時に revalidate）。フォント: Zen Kaku Gothic New / Noto Sans JP / Manrope（Google Fonts）。動き: GSAP + ScrollTrigger、Lenis（reduced-motion 対応、CDN 不通時は素の表示にフォールバック）。プロトタイプの CSS 変数（--ink #0B2545, --blue #0A4F8F, --cyan #19B4D7, --ground #F3F7FB, --gold #C9A227）をそのまま使う。
- DNS 切替時は Resend の SPF/DKIM レコードを残す。旧リーフレット PDF の URL はリダイレクトを用意。
- 現行 WP の Home ページ内容は `wp-data/home_raw.txt`、添付一覧は `wp-data/attachments.txt`、第1回・第2回の受賞商品名/地域は `prototype/winners.json`（142件。賞の割り当ては入っていない。第1回は管理画面DBに無い可能性が高く、WP から取り込む）。

## 6. 残っている素材・未確定事項

- 受賞ロゴ5種の元データ（AI/SVG）。プロトタイプの銀賞・銅賞は金賞ロゴの文字を差し替えた暫定版。
- 審査員の氏名・肩書き（全員仮テキスト）と残り2名の写真。
- 受賞者の声の写真（現在は商品写真1枚のみ）、第1回商品の写真。
- テキストロゴの白版（フッター/紺背景用）。
- 第1回の受賞データの取り込み方法（WP からの移行）。
- お知らせの本文フォーマット（プレーンテキストか簡易リッチテキストか）。

## 7. プロトタイプの再ビルド

```
cd docs/site-migration/prototype
python3 make_photos.py   # img/ → photos.json
python3 build.py         # proto.template.html → gotouchi-2027-prototype.html
```

`proto.template.html` が編集元。`__WINNERS__` と `__PHOTOS__` の2つの差し込みだけ。`check.js` は Playwright で横はみ出しを確認するスクリプト（`node check.js <dir>`）。

## 8. 次セッションの開始指示（コピペ用）

> `docs/site-migration/README.md` を読んでください。次の作業は「サイト管理」（管理画面側、管理者専用区画）の画面案です。§4 のメニュー10項目を、既存管理画面（`src/components/sidebar.tsx`、`src/app/awards/page.tsx` など）のトーンに合わせた単一HTMLのプロトタイプとして作ってください。特に「公開状況」「受賞商品の公開」「トップ掲載商品」「開催概要」の4画面は操作の流れが分かるように作り込み、他は一覧＋編集フォームの雛形で構いません。公開サイト側のプロトタイプ（`prototype/gotouchi-2027-prototype.html`）と同じ配色にし、Artifact として公開して URL を報告してください。
