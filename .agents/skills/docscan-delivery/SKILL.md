---
name: docscan-delivery
description: 日付スキャンの機能実装やバグ修正を進めるときに使う。調査だけ・公開操作だけでは使わない。
---

# docscan-delivery

目的: PROJECT_BIBLEの1経路を動かす変更と検査証拠を作る。
入力: タスク、対象diff/既存コード、STATE。必要範囲だけの設計を読む。
手順: 受入条件を確認→実装/関連検査→失敗修正→必要なら読取りレビュー→STATE/PLANS/EVALS更新。
完了: 変更範囲、実行証拠、未検証、次の作業が明確。安全な次工程は毎回許可を取り直さず継続。
禁止: モックだけの完成扱い、文書外部送信、課金、main/本番への無承認反映。
公開/移行の作業ではdocscan-safe-updateを読む。画像/保存の契約変更ではdocscan-fidelityを読む。
