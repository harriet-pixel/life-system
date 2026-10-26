# 首屏與裝置日期

## 今日清單先顯示（2026-10-26）

原本 index.html 的「正在讀取今日待辦…」要等 app-shell 的全部靜態依賴與動態 home 模組圖下載、執行後才替換，包含雲端還原、AI、事件編輯器等；不是每次向 Google 下載待辦。

現在首頁以獨立的小型模組入口提早讀取同一個 dataStore，等待原有圖片／數值遷移、跨分頁寫入鎖與復原期限整理完成，才用 home-today.mjs 的共用渲染函式顯示今日清單。資料 schema、交易、雲端備份啟動時間與既有安全檢查均不變。預覽期間勾選與新增事件停用，輔助名稱說明操作準備中；完整首頁掛載後移除預覽訂閱、接上既有完成／取消功能。預覽仍反映其他分頁的資料更新，載入失敗顯示錯誤且保留資料。從其他頁進入首頁沿用正式掛載，不執行匯入 HTML 中的腳本。

本機 Chromium 375px 同一空資料環境單次對照：初次載入清單約808→431ms、暖快取129→74ms；模擬150ms延遲、160KiB/s下載、80KiB/s上傳時8056→2329ms。這是本機測試、不是正式網站或使用者裝置的保證值；完整操作模組在慢網路仍可能較晚就緒。

可重現檢查：npm run lint、npm run build、node --test --test-isolation=none tests/*.test.mjs；BASE_URL 指向建置成果後執行 tests/home-first-paint.cjs（375／1280px×四字型，刻意阻擋外框依賴，驗證真實今日清單、跨分頁、唯讀接管、完成與Undo、四頁導覽、遷移鎖等待與損毀資料保護）。tests/home-load-timing.cjs 輸出冷／暖／慢載入的首次清單顯示時間，不以不穩定毫秒門檻作正確性測試。

## 先前首屏與日期修正紀錄（2026-10-25）

首頁日期不再寫死2026-10-21，使用裝置的當地年月日／星期；沿用正式待辦的當地日期判斷，跨日每分鐘、前景、站內返回更新。裝置時間／時區若設定錯誤，網站會依該設定顯示，不以伺服器UTC或示意日期覆蓋。

舊畫面原因：手機CSS依賴掛載後的data-page-view，初始HTML沒有該scope；首頁activity-tabs初始hidden、兩個舊面板卻同時可見，手機內嵌夥伴也在模組執行前佔空間。錄製修正前慢載入可重現舊歡迎文字、示意日期、內嵌夥伴與上下雙清單。CSS本來就是head內的同步stylesheet，並非媒體查詢太晚下載；未找到Service Worker或Cache API策略。

修正：各頁body／main初始帶目前scope；首頁直接啟用目前頁籤語意與預設面板、隱藏非選取面板；只有尚未具備控制的手機浮動夥伴元件等掛載後顯示，沒有整頁隱藏或固定等待。初始模組先準備完才搬移原DOM，避免動態匯入期間移除既有畫面。日期旁的小型同步腳本以裝置時間填入日期；SPA進入首頁也沿用同一helper。CSS／JS及shell版本同步升為local-clock-23，站內fetch沿用no-cache及版本不符保護。發布先建置完整四頁與assets，再推送同一gh-pages提交，不混用原始與發布版本。

驗證命令：npm test、npm run lint、npm run build；tests/home.cjs、tests/drive-sync-browser.cjs，以及PLAYWRIGHT_BROWSERS_PATH設定可用ffmpeg後執行tests/first-paint.cjs。測試不寫入正式資料。

實測：390×844 Chromium錄製四頁cold／cached reload／slow共12段影片；快取模式觀察到10～81筆cache命中，慢網路為150ms延遲、160KiB/s下載、80KiB/s上傳、停用快取。另刻意阻擋模組，驗證初始HTML已套手機版、沒有舊內嵌夥伴或雙清單；影片逐秒抽幀確認，未再顯示舊版配置。台北／洛杉磯時區、跨年／當地午夜、前景及從設定站內返回首頁日期通過。首頁320／375／390／768／1280px、200%文字、示意打卡保存通過；165項單元與mock Drive加密／離線／衝突回歸通過。

影片保存在交付工作區/workspace/artifacts/life-load（不隨網站發布），包含修正前index-before／tasks-before及修正後四頁三模式。此為桌面Chromium手機尺寸錄影，非實體手機Safari／Chrome驗收；未強迫清使用者快取，也未改資料／同步／獎勵交易。GitHub Pages CDN的HTML可能短暫受平台快取影響，本站沒有設定HTTP伺服器快取標頭的後端；版本化資產及初始HTML一致性是本次修正範圍。
