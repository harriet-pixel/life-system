# 首屏與裝置日期查核（2026-10-25）

首頁日期不再寫死2026-10-21，使用裝置的當地年月日／星期；沿用正式待辦的當地日期判斷，跨日每分鐘、前景、站內返回更新。裝置時間／時區若設定錯誤，網站會依該設定顯示，不以伺服器UTC或示意日期覆蓋。

舊畫面原因：手機CSS依賴掛載後的data-page-view，初始HTML沒有該scope；首頁activity-tabs初始hidden、兩個舊面板卻同時可見，手機內嵌夥伴也在模組執行前佔空間。錄製修正前慢載入可重現舊歡迎文字、示意日期、內嵌夥伴與上下雙清單。CSS本來就是head內的同步stylesheet，並非媒體查詢太晚下載；未找到Service Worker或Cache API策略。

修正：各頁body／main初始帶目前scope；首頁直接啟用目前頁籤語意與預設面板、隱藏非選取面板；只有尚未具備控制的手機浮動夥伴元件等掛載後顯示，沒有整頁隱藏或固定等待。初始模組先準備完才搬移原DOM，避免動態匯入期間移除既有畫面。日期旁的小型同步腳本以裝置時間填入日期；SPA進入首頁也沿用同一helper。CSS／JS及shell版本同步升為local-clock-23，站內fetch沿用no-cache及版本不符保護。發布先建置完整四頁與assets，再推送同一gh-pages提交，不混用原始與發布版本。

驗證命令：npm test、npm run lint、npm run build；tests/home.cjs、tests/drive-sync-browser.cjs，以及PLAYWRIGHT_BROWSERS_PATH設定可用ffmpeg後執行tests/first-paint.cjs。測試不寫入正式資料。

實測：390×844 Chromium錄製四頁cold／cached reload／slow共12段影片；快取模式觀察到10～81筆cache命中，慢網路為150ms延遲、160KiB/s下載、80KiB/s上傳、停用快取。另刻意阻擋模組，驗證初始HTML已套手機版、沒有舊內嵌夥伴或雙清單；影片逐秒抽幀確認，未再顯示舊版配置。台北／洛杉磯時區、跨年／當地午夜、前景及從設定站內返回首頁日期通過。首頁320／375／390／768／1280px、200%文字、示意打卡保存通過；165項單元與mock Drive加密／離線／衝突回歸通過。

影片保存在交付工作區/workspace/artifacts/life-load（不隨網站發布），包含修正前index-before／tasks-before及修正後四頁三模式。此為桌面Chromium手機尺寸錄影，非實體手機Safari／Chrome驗收；未強迫清使用者快取，也未改資料／同步／獎勵交易。GitHub Pages CDN的HTML可能短暫受平台快取影響，本站沒有設定HTTP伺服器快取標頭的後端；版本化資產及初始HTML一致性是本次修正範圍。
