---
name: docscan-safe-update
description: 日付スキャンのService Worker・DB移行・公開・配布更新を変更またはレビューするときに使う。通常UI実装だけでは使わない。
---

# docscan-safe-update

成果物: 更新試験、互換性表、無料枠/公開承認の記録、復旧手順。
docs/RELEASE_AND_COST.mdとEVALSのU/C項目を読む。
固定origin、書込み停止、更新待機、必須資源のオフライン取得、versionchange、旧→新データ保持、ホストrollbackと端末DBの違いを検査。
プレビューも外部公開である。初回の許可範囲を確認し、本番は別承認。mainマージが公開を起動するなら承認前に行わない。
有料機能追加、データ初期化、未保存状態でのreloadは禁止。旧データを保全し、互換修正版または外部保存経路を残す。
