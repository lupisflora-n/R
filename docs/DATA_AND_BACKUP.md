# DATA_AND_BACKUP｜保存・復旧・持ち出し
版 2.0 / IndexedDBの保存と端末外バックアップは別

## 1. 実体の置き場所
メタデータ・原本Blob・確定編集Blob・完成PDF Blobを同じIndexedDBへ保存する。localStorage、Service WorkerのCache Storage、表示用Object URLを文書の正本にしない。
初版ではOPFSとIndexedDBへ実体を分割しない。単一DBの1枚単位トランザクションにして、ファイルとDBの二重管理を避ける。大容量で別方式が必要なら、性能証拠と移行案付きADRを作る。
保存成功表示はDBトランザクション完了後。ブラウザーの消去、OSの整理、端末故障、最後の書込み直後の電源喪失まで防ぐ永続保証ではない。[W08, W16-W17]

## 2. データモデル
| 実体 | 主要フィールド |
|---|---|
| Day | id, documentDate(YYYY-MM-DD), zoneId, createdAt, updatedAt |
| IngestIntent | id, dayId, startedAt, status（カメラ移動前に保存） |
| Asset | id, kind(original/rendered/thumb/pdf), blob, mime, width, height, byteCount, sha256, createdAt |
| Page | id, dayId, orderIndex, capturedAt, originalAssetId, activeRevisionId, state, deletedAt |
| Revision | id, pageId, originalHash, points[4], rotation, filterVersion, params, renderedAssetId, createdAt |
| PdfExport | id, dayId, displayName, orderedRevisionIds, profile, fingerprint, assetId, status, createdAt |
| Job | id, kind, state, inputSnapshot, fencingToken, progress, attempts, errorCode |
| BackupEvent | id, dayId, packageIds, requestedAt, userConfirmedAt?, verifiedImportAt? |
| ShareEvent | id, exportId, action, result, requestedAt, userConfirmedSentAt? |
| AppMeta | dataFormatVersion, minReaderVersion, migrationStatus, editLease, lastBuild |

UUIDを内部キーにし、日本語名や日付を実体のパスに使わない。撮影時刻はUTCの時刻と当時のタイムゾーンを保持、文書日付は別の文字列。日付の初期計算で`toISOString().slice(0,10)`を使い、時差で前日へずらさない。

## 3. 1枚の保存
1. 撮影前にdayIdとIngestIntentを短いトランザクションで記録。
2. File取得後、サイズ・形式の初期検査とハッシュをDBトランザクション外で行う。
3. 原本AssetとPage(DRAFT)、Intent完了を同一書込みトランザクションで保存。
4. コミット確認後のみ「写真を保存しました」。編集未完了は下書きとして残る。
5. デコード・編集・再エンコード・ハッシュ計算はトランザクション外。結果完成後、Asset・Revision・Pageの参照を短いトランザクションで更新。

画像処理や長い非DBのawaitをDexieトランザクションに入れない。例外を握りつぶして部分コミットしない。[W17]
壊れた/非対応の取込はDRAFT_UNSUPPORTED等に分離し、「編集・PDF利用可能」と誤表示しない。撮影取消と保存失敗を混同しない。同じFileの再選択・連打で二重登録しない仕組みを入れる。

## 4. 版と復旧
受取原本は上書きしない。編集はパラメーターと確定出力の新しい版として追加。PDFは作成時の版と順序を保持し、編集後も元のPDFバイトを変えない。
RUNNINGのまま起動したJobはINTERRUPTEDへ。入力原本と選択版があれば先頭から再実行し、部分PDFを共有しない。反復失敗は回数制限を持つ。
複数タブ/ホーム画面の同時起動は単一書込みリースで制限する。リース更新とジョブ確定はDB内の世代トークンで競合検査し、凍結した旧タブの遅いコミットを拒否。BroadcastChannelは通知補助であり唯一の排他根拠にしない。
起動時にAsset参照、Job状態、最低読取版を検査。孤立した原本を無条件削除しない。更新のversionchange時は書込み停止とDB closeを行い、他の画面を閉じる案内を出す。

## 5. ブラウザー保存の限界
`navigator.storage.estimate()`で使用量/割当の概算、`persisted()`で状態、`persist()`で永続モードを要求する。拒否・API不在でもその事実を表示して外部保存へ誘導。許可されてもバックアップ済みとは扱わない。[W08]
ホーム画面WebアプリはWebKitのITPの7日制限に例外があるため、「iPhoneは必ず7日で消える」と断定しない。一方、利用者による削除やその他の消失リスクは残る。[W09]
通常Safariとホーム画面版、異なるブラウザー、preview URLと正式URLの保存を同一と仮定しない。利用開始前にホーム画面版へ統一し、移動が必要なら明示的にバックアップを書き出し読み込む。URL変更をデータ移行と同義にしない。

## 6. 日付単位の復元用バックアップ（初版必須）
通常PDFは読む/送るための成果物。編集を再開するために別途、原本・現在の編集版・編集レシピ・日付/順序/名前・必要なPDF参照を含むZIPを作る。名称例 `2026-10-02_復元用_01.zip`。ZIPは暗号化済みとは説明しない。
初版は日付単位・分割対応とし、全履歴無制限の丸ごとZIPは作らない。初期目標は1部あたり圧縮後50MiB程度以下、ページ上限10。これは実機で確定する仮値。単独の原本が上限を超える場合は理由を表示し、黙って原本を落とさない。

`manifest.json` の契約:
- format=`daily-docscan-backup`, version=1, backupSetId, partId, partIndex, partCount, createdAt, documentDates。
- pages: stableExportId、元の日付/順序、originalAssetRef、currentRevisionRecipe、renderedAssetRef。
- assets: 許可した相対パス、MIME、byteCount、SHA-256、役割。PDFにはorderedPageRefsを付ける。
- すべての原本と現在の確定編集を含む。古い編集履歴は初版バックアップ範囲外と明示。過去PDFは完成バイトとページ参照を保持し、全旧編集画像の再構成を約束しない。

外部保存ボタンを押しただけでは実保存を検証できない。「書き出し要求」「保存したと利用者が確認」「再読込みして整合性を検証」を区別する。ダウンロード成功を自動的に「安全なバックアップ完了」と表示しない。
復元画面は日付・枚数・不足部数・確認結果を表示し、既存の同日データへ無条件上書きしない。別IDへの追加が初期動作。同一packageIdとハッシュの二重取込は冪等に扱う。
ZIPパストラバーサル、zip bomb、過大サイズ、件数過多、重複パス、偽MIME、未知版、ハッシュ不一致を拒否。解凍と検証はDBトランザクション外、検証済みの小さな部単位でコミットする。途中中断は同じ部を安全に再実行できる。

## 7. クロスOS復元
HEICなど片方のOSでしかデコードできない原本に備え、バックアップには既存の編集済みJPEG/PNGを必ず含める。受取側は少なくとも閲覧/PDF再作成できる経路を検証する。原本からの再編集が非対応なら、その制限を表示して対応端末で行う。両OSで完全同等のコーデック対応を約束しない。
必要なら可搬用の全画角JPEGマスターを追加するが、原本よりサイズが増えることと再圧縮を説明し、容量と品質試験後に採用。原本ファイルは落とさない。

## 8. 容量・削除
空き容量見積もりは参考値であり、最後はQuotaExceededError等を処理する。失敗時に既存データを削除して空きを作らない。サムネイルや再生成できる一時資源のみ自動整理可能、原本/完成PDFの削除は明示操作。
削除は対象の枚数と名前を確認し、可能な範囲で取り消しを提供。PDFが参照する旧版の扱いを確認し、意図しない連鎖削除を避ける。未バックアップの日付には注意表示し、勝手な自動削除をしない。
原本には撮影位置などのEXIFが含まれる場合がある。復元用ZIPにそれらが含まれることを外部保存前に知らせる。提出用PDFの画像・メタデータには位置情報を引き継がない。[W11]
