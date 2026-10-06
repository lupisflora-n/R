# DECISIONS｜決定・提案・未確認
版2.0 / 2026-10-02

| ID | 内容 | 状態 | 理由/扱い |
|---|---|---|---|
| ADR01 | iPhoneとAndroidを初版対象 | USER_FIXED | 最新の明示条件 |
| ADR02 | 基本無料、本人は確認/判断 | USER_FIXED | 最新の明示条件。開発利用枠は別 |
| ADR03 | PWA＋無料静的配信 | DESIGN_DEFAULT | 無料/iPhone/更新の両立。実機合格を要する |
| ADR04 | 1枚ずつ原本保存、必要時PDF | DESIGN_DEFAULT | 中断保護と選択自由。v1継承 |
| ADR05 | 手動四隅を必須、自動は任意 | DESIGN_DEFAULT | ユーザーの安定性優先に沿う |
| ADR06 | IndexedDBにBlobと情報を同居 | DESIGN_DEFAULT | 初版の二重管理を避ける |
| ADR07 | PDF外部保存＋日付復元パック | DESIGN_DEFAULT | ブラウザー保存消失への備え |
| ADR08 | Cloudflare Pages、動的機能なし | DESIGN_DEFAULT | 課金対象を増やさない |
| ADR09 | iOS17以降を暫定対象 | TEST_PENDING | 実際の配布対象/実機結果で確定。対象縮小は確認 |
| ADR10 | 10ページ認証、20ページ拡張 | TEST_PENDING | 画質を守るメモリ試験が先 |
| ADR11 | メールはFileの直接共有 | TEST_PENDING | iPhoneとAndroid実機必須。救済動線のみでは合格不可 |
| ADR12 | 認証/公開/費用は監督承認 | USER_POLICY | 制作の自律性と外部行為を分ける |
| ADR13 | 監査・PoCで止まらない | DESIGN_DEFAULT | 内部ゲートはCodexが検査して継続 |
| ADR14 | モデルは利用可能なものから | ENV_PENDING | 提供差、既存枠、過剰切替を避ける |
| ADR15 | 正式origin/リポジトリ | UNSET | 読取りで特定してから必要な承認を得る |

## 撤回するv1方針
Androidのみ、Kotlin/Compose/Room、ML Kit前提、Play配布前提、切り抜き前原本の復元不可、完全復元はすべて初版範囲外、最初は監査で終了。新構成と矛盾する旧指示は有効ルートから外すが、既存原本を破壊しない。

## 2026年10月3日の実装判断

| ID | 内容 | 状態と根拠 |
|---|---|---|
| ADR16 | 引き継ぎ資料を既存のローカルRへ統合 | SESSION_SCOPE。ユーザーがこのRで開発開始を依頼。既存README/AGENTSはdocs/initial-projectに保管。リモートと公開先は未設定 |
| ADR17 | 初回の無料依存取得 | USER_APPROVED。ユーザーの「承認」を受領。ただし権限付き実行要求が2回返らず本人が中断。取得成功とは記録しない |
| ADR18 | 新規取得を保留し、既存の無料資源を同梱 | IMPLEMENTED。pdf-lib 1.17.1、JSZip 3.10.1、PDF.js 5.6.205 legacy。ライセンスとSHA-256をvendorに保持。依存の脆弱性情報をオンラインで監査したとは説明しない |
| ADR19 | 暫定UI/保存/透視補正はブラウザー標準 | IMPLEMENTED。React/Vite/Dexie/OpenCVは未取得。TypeScriptの構文をNodeで除去して静的ビルド、標準IndexedDB、単一Workerの射影・双線形補間。iPhone/無料/原本保持/必要時PDFは維持。技術案の変更であり中核仕様の縮小ではない。21件の純粋処理検査、実機は未検証 |
| ADR20 | ブラウザー検査を未実施として記録 | BLOCKED。標準サンドボックスでlisten EPERM、ChromiumのIPC setsockopt EPERM。追加権限要求で再び無期限に待たない。型検査も未導入であり、構文検査を型検査とは扱わない |
| ADR21 | 処理・復元の暫定メモリ上限 | TEST_PENDING。1入力50MiB/24MP、1PDF10枚、ZIP1部50MiB/10枚、全体100MiB。書出しと読込みを整合させ、原本を黙って落とさない。100MiB超の段階的復元は今後実装。実機の性能に基づいた認証値ではない |
| ADR22 | 公開・認証・GitHub書込み・課金 | NOT_PERFORMED。今回の承認は無料依存取得まで。GitHubのorigin、Cloudflareプロジェクト、プレビューURLは設定していない |

## 変更記録テンプレート
日時 / 問題 / 根拠（公式または実測）/ 候補 / 推奨 / 採否 / 影響ファイル / 利用者への影響 / データ互換性 / 復旧方法 / 監督承認要否 / 証拠。
