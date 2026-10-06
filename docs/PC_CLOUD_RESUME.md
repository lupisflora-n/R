# PC・Cloudの継続作業

## 2026-10-06 GitHub共有先

ユーザー指定の `https://github.com/lupisflora-n/R.git` は非公開で、GitHub接続から読取り・書込み権限を確認した。空リポジトリだったためmainに案内READMEを初期登録し、実装は `codex/docscan-v2` に保存する。Cloudの既存ローカルGit履歴を持つフォルダと、GitHubの初期履歴は異なる。既存フォルダへ無理にpullせず、初回PC取得は新しいフォルダへcloneする。

PCのCodexに次を依頼する。本人のGitHub認証画面が必要ならそこでログインし、トークンをチャットに貼らない。

```text
https://github.com/lupisflora-n/R.git を新しいフォルダへcloneし、
codex/docscan-v2 ブランチを開いてください。
CODEX_START_PROMPT.mdとSTATE.mdに従って再開し、
必要な無料依存を用意して npm run verify:mobile を実行してください。
スマホ幅のスクリーンショットを確認し、失敗を修正してください。
GitHubへの作業反映はこのブランチへ行い、強制pushはしないでください。
```

CloudはGitHubコネクターで反映できるが、このCloudシェルのGit認証は設定済みとは扱わない。スマホからの今後のCloud作業ではRと同じブランチを指定して開始する。共有するのはコミット済みコードとSTATEで、会話・端末内文書・未保存ファイル・実行中プロセスは共有されない。

## 現在確認できていること

2026-10-05、この会話の実行先はLinuxの `/workspace/R`。WindowsのCodexで同じ会話を開いても、この実行先がWindowsになったとは扱わない。PCの作業フォルダとCloudの作業フォルダは別で、GitHub接続だけでは未コミットのファイルは共有されない。

GitHub接続で取得したアクセス可能なリポジトリ一覧に `lupisflora-n/R` は含まれなかった。存在しないと断定はできないが、共有先として利用できることは未確認。別案件のリポジトリを代用しない。まずPCで開いているプロジェクトのorigin URLを確認する。

## スマホ幅の検証

プロジェクトにNode 24.3以上とPlaywrightが用意された環境で実行する。

```powershell
npm run verify:mobile
```

このコマンドは構文、合成テスト、ビルド、390×844のブラウザー検証を順に行い、失敗した段階で止まる。ネットワークからの依存取得や外部公開は行わない。WindowsでPlaywrightが未導入なら、初回の無料依存取得として次が必要。既存の承認範囲を確認したCodexが実行する。

```powershell
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
```

成功した検査の画面は `evidence/mobile-home.png`、`evidence/editor.png`、`evidence/pdf-preview.png`。検査結果は `evidence/browser-results.json`。古い画像が残っていても今回の合格証拠にはしない。Chromium検査はiPhone実機の合格を意味しない。

PCで操作するローカルプレビューはビルド後に `npm run preview`。`http://127.0.0.1:4173` はそのPC専用であり、スマホから開ける公開URLではない。スマホ用HTTPSプレビューはホストと公開対象を確定してから用意する。

## 継続共有の運用

同じ非公開GitHubリポジトリへ、PCとCloudの両方を接続する。開始時に対象ブランチを取得し、終了時に変更とSTATEをコミットしてpushする。mainへの反映はPRで行う。同じブランチを両方で同時編集しない。作業中の変更がある状態で強制pullやresetを実行しない。

PCは起動してネット接続したときに最新コードを取得する。PCが停止していてもCloudでは作業できるが、停止中のPCのファイルは更新できない。Cloud側のGit認証、リポジトリ選択、初回pushは未完了で、認証情報をチャットへ貼る必要はない。
