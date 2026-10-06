# 根拠台帳｜設計2.0
照会日: 2026-10-02（日本時間）。以下は公式Webの取得内容とDラボ接続ツールの検索範囲の記録。

## 扱いの原則
外部サービス・APIの説明は出典の確認内容、構成の採否は本案件の設計判断、秒数・枚数・画質は未実測の受入目標として区別する。技術の最新の版番号を推測で固定しない。実装着手時と公開前に変動する料金・制限・APIの互換性を再確認する。

本資料は原典の全文転載ではない。URLは再確認用。文中の [Wxx] / [Oxx] / [Dxx] はこの台帳のID。

## 公式一次資料

### W01｜Apple｜iPhoneのSafariでウェブサイトをアプリにする
出典: https://support.apple.com/ja-jp/guide/iphone/iphea86e5236/ios

確認・利用範囲: ホーム画面へ追加する利用経路。ストア配布ではない。本アプリの動作保証をする資料ではない。

### W02｜Apple｜Apple Developer Program
出典: https://developer.apple.com/programs/

確認・利用範囲: 通常のプログラム年額US$99。地域により表示通貨等が異なる。PWAの初版ではこの登録を前提にしない。

### W03｜Cloudflare｜Pages Pricing
出典: https://developers.cloudflare.com/pages/functions/pricing/

確認・利用範囲: 静的アセットのリクエストは無料・無制限との説明。Functions等の動的利用は区別する。

### W04｜Cloudflare｜Pages Limits
出典: https://developers.cloudflare.com/pages/platform/limits/

確認・利用範囲: Freeの月500ビルド、同時1ビルド、単一配信アセット25MiB等。利用者端末のPDFへの上限とは別。

### W05｜Cloudflare｜Git integration
出典: https://developers.cloudflare.com/pages/configuration/git-integration/

確認・利用範囲: Git連携によるビルド・デプロイ。初回認証と公開権限は必要。

### W06｜Cloudflare｜Rollbacks
出典: https://developers.cloudflare.com/pages/configuration/rollbacks/

確認・利用範囲: 配信版を戻す機能。端末内DB・適用済みSWの巻き戻しまで保証しない。

### W07｜Cloudflare｜Preview deployments
出典: https://developers.cloudflare.com/pages/configuration/preview-deployments/

確認・利用範囲: プレビューのアクセス範囲。非公開リポジトリだけでサイトの非公開性を推定しない。

### W08｜WebKit｜Updates to Storage Policy
出典: https://webkit.org/blog/14403/updates-to-storage-policy/

確認・利用範囲: Storage APIと永続モード・割当・消去の方針。許可も端末外バックアップの代替ではない。

### W09｜WebKit｜Tracking Prevention
出典: https://webkit.org/tracking-prevention/

確認・利用範囲: ホーム画面WebアプリのITP制限の扱い。すべてのPWAが必ず7日で消えるとは解釈しない。

### W10｜W3C｜Web Share API
出典: https://www.w3.org/TR/web-share/

確認・利用範囲: secure context、transient activation、files対応の検査。共有成功はメール送達の証明ではない。

### W11｜W3C｜HTML Media Capture
出典: https://www.w3.org/TR/html-media-capture/

確認・利用範囲: file入力のcaptureヒントとユーザー操作。返却形式や撮影画質の全機種統一は保証されない。

### W12｜WebKit｜WebKit Features in Safari 17.0
出典: https://webkit.org/blog/14445/webkit-features-in-safari-17-0/

確認・利用範囲: HEICとStorage APIの導入情報。iOS17を暫定下限にする設計の参照。現行OSや全デコード経路の合格とは別。

### W13｜OpenCV｜Geometric Transformations of Images
出典: https://docs.opencv.org/4.x/dd/d52/tutorial_js_geometric_transformations.html

確認・利用範囲: 画像の幾何変換・射影補正のAPI。自動四隅検出の精度を保証する資料ではない。

### W14｜OpenCV｜Image Thresholding
出典: https://docs.opencv.org/4.x/d7/dd0/tutorial_js_thresholding.html

確認・利用範囲: しきい値処理等。薄字を守るパラメーターと比較試験は本案件で定義する。

### W15｜OpenCV｜Using OpenCV.js
出典: https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html

確認・利用範囲: JS側の利用とメモリ解放。採用版・配信形式はM0でロックする。

### W16｜Dexie｜Dexie.transaction()
出典: https://dexie.org/docs/Dexie/Dexie.transaction()

確認・利用範囲: IndexedDBトランザクションの利用。OSによる消去を防ぐ保証とは別。

### W17｜Dexie｜Best Practices
出典: https://dexie.org/docs/Tutorial/Best-Practices

確認・利用範囲: 短いトランザクション、非DB非同期処理と例外処理の注意。

### W18｜pdf-lib｜PDFDocument
出典: https://pdf-lib.js.org/docs/api/classes/pdfdocument

確認・利用範囲: JPEG/PNGの埋込みとPDFシリアライズ。生成時の全体メモリを一定にする保証はない。

### W19｜Vite PWA｜Prompt for update
出典: https://vite-pwa-org.netlify.app/guide/prompt-for-update

確認・利用範囲: 更新を利用者に知らせて適用する方式。作業中断やDB移行安全性は追加設計する。

### W20｜Playwright｜Browsers
出典: https://playwright.dev/docs/browsers

確認・利用範囲: WebKit等の自動検査。ブランド版Safariや物理iPhoneのカメラ/共有を完全再現するものではない。

### W21｜Vite｜Getting Started
出典: https://vite.dev/guide/

確認・利用範囲: 静的フロントエンド開発と環境要件。互換性のある版をM0で固定する。

### O01｜OpenAI｜Models
出典: https://learn.chatgpt.com/docs/models

確認・利用範囲: 取得時点のモデル選択案内。実クライアントで使えるモデルと利用枠を確認する。

### O02｜OpenAI｜AGENTS.md
出典: https://developers.openai.com/codex/agent-configuration/agents-md

確認・利用範囲: エージェント向けプロジェクト指示の配置と読み込み。

### O03｜OpenAI｜Build skills
出典: https://learn.chatgpt.com/docs/build-skills

確認・利用範囲: 現行のリポジトリ内.agents/skillsとSKILL.md、必要時の読み込み。ファイル作成と認識済みを区別。

### O04｜OpenAI｜Using PLANS.md for multi-hour problem solving
出典: https://developers.openai.com/cookbook/articles/codex_exec_plans

確認・利用範囲: 自己完結した実行計画、進捗・決定・検証の継続更新。本案件の工程を具体化する基礎。

### O05｜OpenAI｜Codex Best practices
出典: https://developers.openai.com/codex/learn/best-practices

確認・利用範囲: 明確なタスク・文脈・検証を与える運用の参照。

### O06｜OpenAI｜Config basics
出典: https://learn.chatgpt.com/docs/config-file/config-basic

確認・利用範囲: sandboxと承認など設定例の基礎。環境が違えば再照合し、既存設定を上書きしない。

### O07｜OpenAI｜Rethinking skills and prompts for GPT-6 Astra
出典: https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra

確認・利用範囲: 簡潔な指示、狭いトリガー、必要範囲の文脈という運用。古い長大な指示の無条件コピーを避ける。

## Dラボ接続検索｜取得範囲を限定して利用
実施したのはAIチャンネルのナレッジ検索（動画/記事の抜粋）と最新ブログ一覧の取得。全動画の視聴や全記事本文の精読ではない。ここで紹介された一般論の数値や他製品の宣伝を、本アプリの性能・工数・費用削減保証として扱わない。ChatGPT側の接続がCodexへ自動継承されるとは想定せず、この台帳とSTUDY.mdを渡す。

### D01｜詳細な実行計画書「PLANS.md」完全ガイド
公開日: 2025-11-25
出典: https://daigovideolab.jp/blog/3far70h8ja58zz0k1qe1km
取得: ナレッジ検索の該当記事抜粋。目的、具体的な手順、進捗、決定、再現可能な検証方法の紹介。
適用: PLANS.mdのM0-M6、STATE.md、受入条件。引用元として紹介されたOpenAI公式O04も照合。

### D02｜Codexの自律型エンジニアリングの紹介
公開日: 2026-02-26
出典: https://daigovideolab.jp/blog/awgyn98b9ef2qncp03381k
取得: AGENTS.md、Skills、並行作業、レビューに関する検索抜粋。
適用: 監督と実装者の分業、短いAGENTS、実装と検証の成果物を分離。記事中のコード生成率・レビュー有効率は本件の保証に使わない。

### D03｜Codexのスレッド整理・worktree並列タスク管理デモ
公開日: 2026-06-09
出典: https://daigovideolab.jp/blog/k5fv2fxzjlggfln99w3ad
取得: 作業環境整理、Agent Skills、画面へのフィードバックに関する検索抜粋。
適用: Codex側に進捗・レビュー・証拠整理を持たせる。大量並列や無断自動公開を標準化する根拠にはしない。

### D04｜OpenAI DevDay 2026まとめ
公開日: 2026-09-30
出典: https://daigovideolab.jp/blog/nijg1vw0yrdkr0zk418ik
取得: 最新ブログ一覧と説明抜粋。取得した一覧での最新記事として確認。
適用: 新モデル・提供形態は公式O01等で再照合。最新発表を全採用するのではなく、必要な作業のみに使う。

## 引き継がない古い前提
v1のAndroid専用構成、Playへの費用前提、SDKが返す切り抜き済み画像しか残さない前提、監査のみの開始指示はv2の有効な根拠にしない。古いSkills紹介にある過去の配置場所は、現行公式と矛盾するなら現行を優先する。

## 保証しない項目
CamScannerとの画質同等、全iPhone/Androidの互換性、完全な消失防止、必ず成功する自動検出、特定メールへの強制添付、共有後の送達、全利用者への即時更新、無限容量、無期限の無料枠、AIの無監督・無停止の完遂。未検証を合格へ読み替えない。
