---
name: docscan-fidelity
description: 日付スキャンの画像処理・保存・PDF・共有・復元を変更または検査するときに使う。単なる文言修正では使わない。
---

# docscan-fidelity

成果物: 要求とdiffに対応するテスト、画質/保存/添付/復元の証拠、不具合と修正案。
対象に応じてdocs/IMAGE_PDF_SHARE.mdまたはdocs/DATA_AND_BACKUP.md、EVALSを読む。
原本不変、小数点/印影/薄字、四隅座標、短いDBトランザクション、Quota/中断、PDF版固定、直接File共有、ZIP整合性を検査。
実データではなく架空素材を使う。全ページの同時展開や無断の画質低下で試験を通さない。
実機がなければNEEDS_HUMAN_TEST。ブラウザー模擬を実iPhoneの合格としない。
作業前の版を保持し、失敗時は新しい派生物だけを戻す。原本をリセットしない。
