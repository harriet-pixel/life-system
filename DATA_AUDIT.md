# 舊資料與冗餘盤點

本次以 main `73a6602` 為整理前基準，作程式靜態檢查與隔離測試資料驗證；未讀取或整理使用者裝置的實際儲存。不改資料格式、遷移、備份與復原規則，不執行資料清理或數值重設。

## 遷移與實際寫回

- `assets/data.mjs` 的 `load()`：JSON讀取後移除舊settings.history（`appearance-core.js/normalizeSettings`保留其他設定），正規化相容欄位並呼叫 `maintainRecovery`。讀取／refresh本身只更新記憶體。
- 網站啟動在共用寫入鎖內執行 `refresh()`、`maintain()`；`maintain()` 比較原始localStorage文件與整理後文件，不同才由 `persist()` 一次寫回並增加revision。無資料的新站不因此先建空文件。失敗保留原文件並顯示錯誤。
- `assets/recovery.mjs` 只在缺少historyVersion時拆分舊history，產生historyVersion=1；長期history保留時間、類型、欄位名稱、數值delta及狀態，before/after轉入有效undoHistory。原始時間不更新；未知欄位／不可辨識時間／不安全鏈不提供復原，仍保留行動中繼資料。新schema不再重跑舊拆分。
- 交易與Undo/Redo前、圖片audit/delete及備份前均執行maintain；共用到期計時器持鎖整理。關站不要求背景整理，重新開啟再檢查。純storage事件的refresh不是自行寫回；之後安全維護節點才持鎖發布。
- 舊data:image轉為Blob是`image-store.mjs/migrateImages`的相容路徑：先存圖片，再原子替換引用，失敗保留原文件。現有asset ID不重建。
- `migrateStatsRules`仍保有既有舊數值版本的一次性相容路徑，明確statsRulesVersion=2會立即返回。本次未修改、手動呼叫或重跑此路徑，也不藉其清空資料。
- 備份接受dataVersion 2及3。`backup.mjs/readBackup`先驗原檔結構、圖片引用及完整性，再於記憶體遷移／整理期限；預覽不寫入。只有最後確認才持跨分頁維護鎖暫存必要Blob、原子發布新文件；失敗保留目前資料。

## 快照與圖片

- 正常遷移、新交易及合法匯入的長期history不含個人資料／圖片before/after，只有短期undoHistory保留必要快照。`actionMetadata`使用欄位白名單，備份驗證也禁止長期history攜帶快照。已由舊版50筆規則遺失的行動不能憑空找回。
- 未啟動新版、遷移寫回失敗，或最後一次使用後才到期的舊文件，可能尚在磁碟保留舊快照，直到下一次成功維護；不能宣稱使用者裝置已全部遷移。手動竄改或損毀文件也不列為已驗證資料。
- `image-references.mjs`集中掃描目前圖片、最愛、有效undoHistory及註冊來源；未知／缺圖或檢查失敗時停止。草稿鎖阻擋清理／備份，瀏覽器釋放關閉分頁的鎖；進行中備份持有維護／寫入鎖。
- `storeImage`新資產有24小時protectedUntil暫存保護，保護結束不會自動刪除。失敗還原可能留下已暫存但未引用Blob，仍需使用者主動確認清理。無引用且無暫存保護才列為未使用；確認刪除前再次計算引用並持鎖執行IndexedDB交易。
- Object URL在縮圖清單切換／重載／pagehide及實際刪圖時釋放；共用URL快取在pagehide釋放。釋放URL不刪Blob。

## 本輪整理結果

| 類別 | 檔案與處理 | 安全界線 |
| --- | --- | --- |
| 無 DOM 樣式 | appearance.css 的 history-record-setting；profile.css 的 favorite-add-row、舊裁切預覽／操作列等 | 全站及測試無對應 DOM，已刪除。 |
| 重複樣式 | profile.css 最愛清單、對話框、圖片按鈕、數據列及基本資料版面 | 依 cascade 合併；保留斷點高度、手機字級與桌面一句話樣式。 |
| 無設定來源 | --profile-tabs-height 的舊 min-height fallback | 最終原本已被 min-height:0 覆寫，已移除。 |
| 未啟用程式 | profile-images.mjs 的 timer、scheduled、永不成立的 avatar.dirty 分支及未使用介面 | 保留實際圖片工作狀態、非同步任務與 Object URL 釋放。 |
| 無呼叫介面 | avatar-crop.mjs 的 widthInput／heightInput、preview、cropRectangle 與公開 output | 全站及測試無呼叫；保留內部輸出與現行拖曳、縮放、鍵盤及裁切流程。 |
| 文件 | README、DEPLOYMENT、SETTINGS、NAVIGATION_UNDO | 改為現行流程；歷史交付紀錄另見 docs/DELIVERY_HISTORY.md，不混作本次結果。 |

## 仍須保留

- data.mjs、recovery.mjs、backup.mjs 的舊欄位、舊 history、舊數值版本及 dataVersion 2 相容路徑：仍可能接收舊瀏覽器資料與備份，不能刪除。
- photoWorkingBase／avatarWorkingBase、裁切草稿與處理中任務：仍供取消、未儲存判斷及圖片保護使用。
- history-view.mjs、歷史 DOM 與分頁 CSS：仍供設定頁使用。
- 共用鎖、交易、圖片引用與暫存保護、原子還原，以及 24 小時／7 天／全站15次規則均未修改。
- 部分重複選擇器是有意的媒體查詢覆寫；個人資料 flex 區仍保留不參與排版的 grid-template computed 值，避免無必要差異。未作全站抽象化或大規模重寫。

## 可重現的整理前後驗證

`tests/cleanup-equivalence.cjs` 固定時間、圖片、資料、900px視窗高度、四種字型及深藍／淺色主題。寬度375、450、451、1024、1280px，各比對首頁、個人資料及設定頁共14種狀態：合計560個狀態、70張截圖。可用下列方式重新建立基準（需 Playwright、Chromium；像素差異診斷使用 Pillow）：

```sh
mkdir -p work/cleanup-before
git archive 73a6602 index.html profile.html settings.html assets | tar -x -C work/cleanup-before
# 在專案根目錄另啟動 python3 -m http.server 3013 --bind 127.0.0.1
BASE_URL=http://127.0.0.1:3013/work/cleanup-before/ node tests/cleanup-equivalence.cjs before
BASE_URL=http://127.0.0.1:3013/ node tests/cleanup-equivalence.cjs after
```

本輪560個狀態的可見 DOM、幾何及 computed style 比對通過。截圖只有樣式／幾何完全相同時，容許最多20個像素、每色頻最多2階的抗鋸齒差異；不是忽略版面變化。本次 lint、build 與40項單元測試通過；10個既有瀏覽器腳本亦通過（圖片、裁切、最愛、保存／取消、重新開始、Undo／Redo、兩種還原、外觀、跨分頁、清理及模擬Google失敗）；歷史測試筆數不作本次結果。公開網站與Pages結果於發布後另行確認。
