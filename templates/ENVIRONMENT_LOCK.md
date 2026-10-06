# 日付スキャン v2 の環境記録

確認日: 2026-10-03 UTC。スマホChatGPTリモートから選択された管理クラウド、作業場所 `/workspace/R`。

- Node: 24.19.0 / npm: 11.9.0。ビルドの下限はNode24.3。モデル設定は変更していない。
- ローカルGit: `codex/docscan-v2`。origin未設定。GitHubのリポジトリ・可視性・自動配信は未確認。
- package-lock SHA-256: `7aa437f94c164c41edac8081199a84cf5396d284737ee2cf9d6c8a02889312ad`。npmからの追加依存なし。`npm ci --offline --ignore-scripts`で構成可能。
- 同梱: pdf-lib1.17.1 / JSZip3.10.1 / PDF.js5.6.205 legacy。入手元は既存クラウドランタイムのインストール済みパッケージ。版・ライセンス・資源ハッシュは `vendor/INTEGRITY.json`。
- 暫定実装: 標準DOM・IndexedDB・単一Web Workerの透視補正、Nodeの型除去ビルド。React/Vite/Dexie/OpenCVは未取得。TypeScript型検査は未実施。
- Playwright: 既存1.62.1。付属のChromium/WebKit実行ファイルは未インストール。システムChromiumは存在するがIPC起動がEPERMで拒否。
- ローカルHTTP待受け: 127.0.0.1:4173はlisten EPERM。外部公開なし。
- iPhone/Android: 機種・OS・ブラウザー・メールアプリ未確認。実機試験未実施。
- Cloudflare: プロジェクト/認証/正式origin未設定。契約・課金・公開は未実施。
- 許可: ワークスペース内の可逆的実装・合成検査。無料依存の初回取得はユーザーが承認したが、権限付き要求が2回応答せず中断された。取得成功とは扱わない。
- 依存監査: 同梱ライセンス・SHA-256の検査は完了。オンライン脆弱性照会は未実施。
- 実出力: `evidence/unit-tests.txt` / `syntax-check.txt` / `build.txt` / `browser-blockers.txt`。

秘密値は記入していない。認証登録やGitHub書込み・公開をこの記録の作成で承認済みとは扱わない。
