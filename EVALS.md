# EVALS｜証拠付きの合格判定
版2.0 / 実装検査更新 2026-10-03。合成検査とブラウザー/実機受入れを分ける。

## 記録ルール
PASS / FAIL / NOT_RUN / NEEDS_HUMAN_TEST / BLOCKEDを区別。実機の機種・OS・ブラウザー/起動形態・メールアプリ・アプリbuild・試験日時・結果・証拠を残す。
「AIに見せた」「Playwright WebKitで通った」をiPhone実機合格にしない。数値は受入目標、実測結果は別欄。

| ID | 検査 | 合格条件 | 現在の判定 |
|---|---|---|---|
| Q01 | 文字の忠実性 | 8-10pt本文/数字/小数点/細線が最終PDFでも読め、欠落を作らない | NEEDS_HUMAN_TEST |
| Q02 | フィルター退避 | 鉛筆/印影/影/複写紙でも元に戻れ、標準の欠損を見逃さない | NEEDS_HUMAN_TEST |
| Q03 | 解像度 | サムネイル流用なし、ピクセル寸法/圧縮/印刷換算を記録 | BLOCKED |
| Q04 | 4点座標 | EXIF8方向、90度回転、ズーム、四隅交差、再編集の正確さ | BLOCKED |
| S01 | 1枚保存 | コミット後に保存表示、原本hash不変、下書き復帰 | BLOCKED |
| S02 | 中断/再起動 | 画像/PDFの途中停止が過去の確定済みデータを壊さない | BLOCKED |
| S03 | 容量不足 | QuotaExceeded等で既存データを変更せず再試行案内 | BLOCKED |
| S04 | 日付 | 深夜0時/タイムゾーン/日付変更で保存先が意図せず変化しない | BLOCKED |
| S05 | 複数タブ | 二重編集・古いジョブcommit・DB versionchangeが安全 | BLOCKED |
| F01 | 名前と順序 | 日本語/空白/長名/同名/記号、選択順、外部コピーの区別 | BLOCKED |
| P01 | 1/5/10ページPDF | ページ数、順序、向き、文字、別ビューア一致 | BLOCKED |
| P02 | 20ページ拡張 | 対象実機でOS終了/欠落/勝手な画質低下なし | NEEDS_HUMAN_TEST |
| P03 | PDF競合と取消 | ボタン連打、途中編集、再試行でも固定版の完成品が1件 | BLOCKED |
| P04 | 実PDF表示 | 完成PDFを開いて検査し、画像一覧だけで合格にしない | BLOCKED |
| H01 | 直接メール添付 | 対象両OSでFile共有→メール添付→受信側の名前/全ページ確認 | NEEDS_HUMAN_TEST |
| H02 | 共有取消/非対応 | PDF保持、誤送信済みなし、ファイル保存の救済 | BLOCKED |
| H03 | 時間を置いた送信 | 下書き保存・アプリ復帰後も添付が正しい | NEEDS_HUMAN_TEST |
| B01 | 書出し/復元 | 別保存領域で日付/原本hash/現在版/順序/PDFを復元 | BLOCKED |
| B02 | 不正ZIP | path traversal/過大展開/偽MIME/hash違い/重複を安全に拒否 | PASS（Node合成） |
| B03 | OSを跨ぐ復元 | HEIC未対応でも既存編集版表示/PDF生成、制限を正しく表示 | NEEDS_HUMAN_TEST |
| U01 | オフライン | 準備完了後機内モードで撮影→加工→保存→PDF。初回未準備は正しく案内 | NEEDS_HUMAN_TEST |
| U02 | 旧→新更新 | 20原本/日付/順序/PDF保持、編集中強制更新なし | NEEDS_HUMAN_TEST |
| U03 | 更新失敗/rollback | 新資源取得失敗/DB互換性不一致で初期化せず救済可能 | BLOCKED |
| U04 | URL/起動形態 | preview/本番/Safari/ホーム画面の別領域を混同しない | NEEDS_HUMAN_TEST |
| N01 | 情報流出 | 本文/原本の外部通信なし、不要SDKなし、PDFに位置情報なし | BLOCKED |
| C01 | 運用費 | 有料API/動的サーバーなし、無料枠/ビルド回数/資源サイズ記録 | NOT_RUN |
| C02 | 課金/公開境界 | 自動課金や未承認preview/本番反映がない | PASS（未公開・無課金の作業境界） |
| D01 | iPhone | 実機で撮影/HEIC/四隅/共有/再起動/更新の主要経路を完了 | NEEDS_HUMAN_TEST |
| D02 | Android | 実機で同上、権限取消/写真選択/共有を含む | NEEDS_HUMAN_TEST |
| A01 | 監督型運用 | 技術細部を本人へ投げず、安全作業継続/判断カード/再開点を記録 | PASS（安全作業継続と記録） |

## 試験素材
架空の書式30枚: 本文8-10pt、数字/小数点、赤青の架空印影、鉛筆、細い罫線、複写紙、色紙、影、斜め、しわ、光沢、白机。6ptはストレス条件。24/48MP、JPEG/PNG/HEIC、破損画像を追加。
顧客資料・個人の住所氏名・本物の印影/署名は使わない。匿名の字形見本も人の実名ではなく架空値にする。
画素比較は幾何/回帰補助。読めるかと印影欠落は目視で別判定。生成AIが「読めます」と言うだけを証拠にしない。

## 性能目標（暫定）
受取後の1枚保存5秒、10ページPDF30秒を初期目標とし、機種条件を添えて測る。撮影時間/初回ダウンロード/メール送信は除外。未達なら原因と改善案を示し、勝手に基準を緩めない。
JS heapが見えない環境は、見えないと記録する。OS終了の有無、反復実行、処理時間、展開サイズ等も残す。memory API非対応をメモリ問題なしと扱わない。

## リリースを止める条件
P0: 文書の流出、原本/既存データの破壊、選択外文書の混入、無承認の外部行為。
P1: 最終PDFの内容欠損/数字変化、主要経路が対象iPhoneで通らない、復元不可、作業中更新でデータ消失。
P0/P1の未解決が1件でもあれば一般配布しない。共有の代替だけ、端末未検証、CamScanner相当の宣伝等を「完成」にしない。

## 2026年10月3日の自動検査証拠

`npm test` は21件PASS。`evidence/unit-tests.txt` に実出力があります。対象はNode 24.19.0で実行した処理・形式の検査です。

- 日付のローカル計算、実在日付、日本語のPDF名。
- 四隅の交差/逆順/範囲外/退化拒否、原本寸法の保持、逆射影の四隅一致。
- 実際のWorkerコードの全画角色画素保持と90度回転。EXIFデコードは未検査。
- 1/5/10ページPDFの構造・向き・順序、取消・重複・非対応MIMEの拒否。`evidence/synthetic-1-pages.pdf`等は架空小画像です。実紙の細字/印影/別ビューア比較・スマホの処理時間は合格にしていません。
- ZIPのハッシュ/MIME/版/日時/スナップショットID、重複パス、トラバーサル、部の不足・衝突、宣言サイズを偽った展開の拒否。
- 書込み世代・期限切れ・他画面・互換版の拒否。実ブラウザーのIndexedDBでの原子性・Quota・中断は未検査。
- Service Workerの要求資源取得と更新待機、多画面での適用拒否、APPLY待機中の作業停止。モックのCache/Service Worker通信での制御検査であり、実配信の旧→新更新ではありません。
- 同梱ライブラリとライセンスのSHA-256一致。

`npm run lint` / `npm run check:syntax` は構文と危険パターンを検査。TypeScriptの型検査は未実施です。`npm run build` は成功し `evidence/build.txt` に出力があります。

## ブラウザー検査が実行できない理由

ローカルサーバーは `listen EPERM: operation not permitted 127.0.0.1:4173`。通信をせずビルド資源を渡す方式へ変えてもChromiumが `setsockopt: Operation not permitted` で起動失敗しました。`evidence/browser-results.json` と `evidence/browser-blockers.txt` に記録しています。空のresultsを成功と扱いません。WebKitの実行ファイルも未インストールです。カメラ、HEIC、共有、IndexedDB、オフラインの実動作とiPhone/Androidは未合格です。

## 次の実行

まず起動可能なサンドボックスまたはWindowsのローカル環境で `npm run test:e2e` を実行し、画面/IndexedDB/PDF表示/追加復元を検査・修正します。公開済み検証URLはありません。URLを公開する場合は別の承認が必要です。実機手順は `docs/DEVICE_TEST_GUIDE.md` にあります。

## 2026-10-06 Windows検査
構文14モジュールPASS、合成21件PASS、build PASS。実localhost配信でスマホ幅390×844のChromium E2E 8件PASS。evidence/browser-results.jsonと3枚のPNGを参照。PDF待機を描画完了と暗色画素検査へ修正。共有取消はモックでありメール送信ではない。WebKitと実機、更新・Quota・中断は未合格。

## 2026-10-06 実機試験前の追加検査
- build 87b14b90678791dd。日付ラベルの入力関連付けを修正。
- npm run test:mobile-quality: Chromiumタッチ模擬5画面条件（320×568/360×800/390×844/412×915/844×390）、各5項目PASS。画面内収まり、日付アクセシブル名、編集枠内収まり、44px以上の保存ボタン到達、編集取消後の下書き再読込み。evidence/mobile-quality/results.jsonとPNG。
- npm run lint: 14モジュール構文PASS。主要test:e2e: 実localhostで8件PASS、errors/external空。合成21件は前回証拠を継承。
- 実機と初見者試験はNOT_RUN。Androidのみ確保可能、iPhone NEEDS_HUMAN_TEST。UX01〜03と暫定ゲートはdocs/QUALITY_READINESS.md。古い一覧のBLOCKEDは当時の状態であり、現在の部分証拠は上記を参照。各要求全体を一括PASSに変更しない。
- 配布候補ZIP: 全29資源のSHA-256一致・再読込みPASS、約1MB。公開ヘッダー適用/HTTPS/実機共有/実機更新は未検証。

## 2026-10-07 公開先での回帰修正
Cloudflareのindex.html転送により初回E2Eの2画面目でERR_FAILEDを検出・修正。修正版93e093055e8d0ad7: 合成22件PASS、公開URLのE2E8件PASS。初回失敗と再試験はevidence/public-browser-first-run.json / public-browser-results.json。公開URLのbuild一致、HTTPSとセキュリティヘッダー確認済み。実機共有・旧新版更新の全試験は未合格。

## 2026-10-08 docPDF LINE入口の分岐検査
- 本線固定8fe715fの90ファイルblob SHA一致で復元。終了前も本線先端一致、リモート書込みなし。
- 27合成検査PASS: LINE bootstrapで文書import/DBゼロ、URLからクエリ/fragment除去、切替URL、コピー拒否の救済、canonical HTMLの別経路キャッシュ、本線サイトURLの設定拒否、既存22回帰。evidence/line/unit-tests.txt。
- 構文17モジュール・安全パターンPASS。完全なTypeScript型検査ではない。evidence/line/syntax-check.txt。
- build 9bc8137a41c23e08、32ビルド資源+SW/build.json=配布34ファイル。evidence/line/build.txt。
- 静的4項目PASS: 動的importのJS化、guard前の文書scriptなし、src/HTMLに外部URL/HTTP書込み/LINE SDKなし、制限ヘッダー宣言。実通信や実ホスト適用を証明する検査ではない。evidence/line/static-checks.json。
- ブラウザー起動BLOCKED（IPC）。npm run test:lineの実行済みブラウザー検査0。新入口経由の文書E2E・画面・実通信は未実施。evidence/line/browser-results.json。空のerrors/external/writesを合格としない。
- 別エージェント1名の読取りレビュー実施、指摘修正。Node VMのJSZip ES module/合成ZIP確認でありブラウザー確認ではない。docs/DOCPDF_LINE_REVIEW.md。
- 34ファイルのZIP再読込SHA一致。約1MB、書類/PDF/秘密/検査証拠なし。evidence/preview-package.json。メニューPNGは2500×843/64702 bytes、表示素材の目視確認のみ。
- L01〜L07、iPhone/Android、共有/受信、旧→新20原本、Quota/中断/10枚等は未合格。一般提供・実務利用NO-GO。

## 2026-10-08 docPDF GitHub保存確認
APIで43ファイルを基準tree873667cへ適用しtree8feaa52、実装commit729a6deを作成、新規codex/docpdf-lineへ登録。元treeの117ファイル保持、削除0、変更43のblob SHA一致。refの先端一致とsrc/entry.ts/package.json再読取り成功。本線refは8fe715fのまま。承認済みZIPのアーカイブSHA-256と34全資源ハッシュ一致。アプリ変更なしのため合成検査を無意味に繰り返していない。Cloudflare未公開・公開URLなし・実ブラウザー/LINE/実機未検証。

## 2026-10-08 docPDF UX改修検査

編集3工程・参照配色・ごみ箱/復元/未参照写真の完全削除をLINE独立版へ実装。合成37 PASS、構文19・静的4・ZIP一致PASS。ブラウザーはIPC拒否でBLOCKED（0 PASS）。詳細と次作業はdocs/DOCPDF_UX_RELEASE.md。完成PDF参照の写真は完全削除禁止。原本の書換/メール送信成功の自動判定なし。

## 2026-10-09 固定編集画面

本人の前版実機フィードバックを受け、固定写真枠/タブ/画面内の決定・文書化・保存、差分ドラッグ、小印＋44pxヒット領域へ変更。40合成・20構文・静的4・ZIP一致PASS。ブラウザーはIPC拒否でBLOCKED。詳細はdocs/DOCPDF_EDITOR_FIXED.md。独立LINE分岐のみ、次は同じ専用サイトへの更新と架空書類の操作確認。

## 2026-10-09 自動公開の事前検査

- 合成43 PASS、fail0。固定URL照合に追加3件: 配信途中の旧buildから一致への待機、不一致build/filesの有限回失敗、HTTP503を成功にしない。fetch/sleep模擬、実ネットワークではない。evidence/line/publication-unit-tests.txt。
- 構文20モジュール/危険パターンPASS（完全型検査ではない）、新mjsのnode --check、diff --check PASS。
- build6dc49a208f65eb40/files35、静的4 PASS、配布37ファイルのallowlist/全資源SHA-256/ZIP再読込一致。新ZIP hashはevidence/preview-package.json。
- PyYAML BaseLoaderでworkflow解析: push専用branch、初期無効化スイッチ、contents:read、各Action40桁SHA、検査後だけdist配信、既存project/Production branch、配信後固定URL照合を確認。実GitHub ActionsやCloudflare認証/課金確認は未実施。新しい独立レビューなし。
- GitHub公式refからcheckout v6/setup-node v6/wrangler-action v4のSHAを取得、公式wrangler-action action.ymlのinputs/node24対応、workers-sdk release wrangler@4.149.0を確認。取得成功とCIの成功は別。
- 環境credential readinessは現在観測、外部認証binding空。Cloudflare/LINEプラグイン検索0。既存public buildをクラウドから再検証できていない。新画面の実機/LINE/ブラウザーは未検証。
