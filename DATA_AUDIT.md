# 舊資料與冗餘盤點

本次以最新 main `5231d46` 為基礎作程式靜態檢查與隔離測試資料驗證；未讀取、檢查或宣稱整理過使用者裝置的實際儲存。只修正還原操作列、字數提醒及使用者設定底部排列，不執行額外資料清理或數值重設。

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

## 保留與後續建議（本次不清理）

| 分類 | 檔案／項目 | 判斷與後續影響 |
| --- | --- | --- |
| 有相容用途 | data.mjs、recovery.mjs、backup.mjs的舊欄位／舊history／dataVersion 2處理 | 仍供舊瀏覽器資料或備份使用，不能僅因新介面不用就刪除。 |
| 有實際用途 | profile-images.mjs的photoWorkingBase／avatarWorkingBase | 判斷未保存裁切草稿；不是多餘的圖片快照。 |
| 有實際用途 | history-view.mjs、history DOM及分頁CSS | 仍供設定頁使用，不能因我的資料移除歷史而一起刪除。 |
| 確認目前無呼叫用途 | appearance.css的.history-record-setting規則；profile.css的.favorite-add-row | 對應DOM已移除，僅樣式殘留。可另案刪除，無持久資料影響。 |
| 確認目前無設定來源 | profile.css多段--profile-tabs-height fallback、重複portrait-library／dialog／summary規則 | 舊頁籤尺寸計算程式已移除；部分舊規則被後段覆寫。需先逐尺寸比較cascade再合併，不可整段盲刪。 |
| 確認排程未啟用 | profile-images.mjs的timer、scheduled | 未見timer賦值或scheduled=true；清除與busy分支仍有引用。後續可一併精簡，須回歸取消／裁切／圖片處理狀態。 |
| 通用但目前未使用的參數 | avatar-crop.mjs的widthInput／heightInput | 現有createImageCropper呼叫均未提供，HTML亦無對應百分比欄。屬通用選用介面，移除前需確認未來是否保留，不能當成仍有水平／垂直滑桿。 |
| 文件衝突 | README.md「響應式導覽與單步Undo」、DEPLOYMENT.md早期無建置及單頁發布敘述 | 已被後段新規範及現行AGENTS/design取代，仍可能誤導；建議另案整份整併，不執行舊流程。 |
| 歷史說明 | SETTINGS.md較早日期段落與驗證筆數 | 部分是過去交付紀錄；現行政策須讀最新固定復原章節，舊筆數不能充作本次結果。 |

本次僅移動同一個unlock-restore按鈕、集中還原階段狀態，移除其原位置與舊的分散hidden/disabled賦值；字數提示取消局部字級／顏色覆寫以沿用共用small-note。沒有發現仍註冊至已移除歷史頁籤、預設外觀按鈕或安全備份按鈕的現行事件處理。AGENTS.md、design.md對應章節已同步更新；其他清理留待後續決定。
