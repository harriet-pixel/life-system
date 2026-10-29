# 全站互動效能稽核（2026-10-29，台北時間）

原始碼基準：`01963b7c4006fa263001037f044b758624d2c61e`。從最新遠端 main 建置並凍結基準；工作區起始乾淨。沒有重新啟用 Cloudflare、後端或自動同步。

## 範圍與方法

實際路由為首頁、待辦、習慣、我的資料、角色、設定，以及靜態隱私頁。`tests/interaction-inventory.mjs` 依 HTML 控制項及 JS 註冊位置產生清單（221 個靜態控制項、56 個含可辨識事件註冊的模組、446 個註冊位置）；動態產生的清單／視窗另依元件程式盤點。它不是 runtime listener 數量，也不表示每個控制項都經效能量測。

主測試 `tests/interaction-performance.cjs` 覆蓋 36 組操作：六頁快取導覽、首頁頁籤、待辦頁籤／對話框／輸入／新增／編輯／完成／排序／刪除、習慣頁籤／M/P／加分／統計展開／設定視窗、資料設定視窗／頁籤／輸入／儲存、角色階段／選擇／輸入／儲存、聊天輸入／頁籤、設定頁籤／展開、Undo／Redo、雲端視窗。另以背景測試覆蓋 AI 等待、手動 Drive 上傳等待及已存 IndexedDB 訊息的輸入。

建置程式為靜態複製，沒有開發版 HMR 或框架雙重渲染；本次使用 production build、隔離瀏覽器 context、同一執行環境、相同假資料、相同字型及正常動畫；Date 固定於假資料建立時間，原生計時器及 performance 時鐘維持運作，排除台北午夜跨日。小量資料 24 事件／40 歷史／2 角色，大量資料 200 事件／2500 歷史／8 角色；全為人工假資料，沒有讀取使用者個資。桌面 1280×900，手機觸控模擬 390×900、CPU 4 倍減速。這不是實體手機測試。執行環境曾中斷；已完整保存的組別保留，未完成組別以同一 fixture、瀏覽器及 CPU 設定接續，未把不完整樣本當作通過。主機排程／負載不是專用實驗室控制條件。

`compare-interaction-performance.cjs` 比較相同條件，若中位數退步超過 25% 且至少 50ms 就失敗；另列 p95 回饋超過 100ms 的入口，不將其隱藏成通過。

每組每條件重複 12 次，p50/p95 使用 nearest-rank；12 次的 p95 即最大值，不能當成大量真實流量的統計估計。從 pointerdown／keydown 起算，首次可見 DOM／樣式變化後的 animation frame 作為視覺回饋代理，明確 readiness 條件連續兩幀成立作為更新完成。輸入框 value 無 DOM mutation 時採 readiness 的上界。下拉選單由 Playwright selectOption 派發 input/change，非實體選單展開耗時。

同步 handler 由包裝 listener 與 EventTiming 記錄；EventTiming 僅回報超過瀏覽器門檻的事件，空白不是 0ms。包裝 listener 的巢狀時間不能相加解讀為獨佔 CPU。另記錄 ≥50ms longtask、CDP script/layout/task 時間、structuredClone、JSON、localStorage、IndexedDB 讀取。原始 idbReadCount 是請求建立加完成事件的合計，不當成單純的讀取呼叫次數；idbReadMs 是觀測窗口內已完成請求的累積耗時，非獨佔 CPU 時間。儀器會增加開銷，前後條件一致；這些數值不是實體螢幕的 input-to-photon 測量。

## 根因與修正

- 待辦完成票證及完成計算只需 revision／tasks／stats，改為一次隔離投影讀取；正式 transact 仍組出完整文件並重新驗證，取消完成與刪除獎勵仍保留所需的歷史／Undo 證據。新增對照測試確認票證一致、另一分頁資料不被覆寫，以及不能重複發獎。
- 原本讀一個 revision、設定或數值，也會 structuredClone 整份正式文件，包含歷史、角色及 Undo 快照；多個訂閱者重複複製。增加隔離的欄位投影讀取／訂閱，仍回傳獨立副本；原 get/subscribe 預設完整文件契約保留。
- 快取頁面恢復時，重新訂閱已立即送出目前資料，待辦／習慣卻又在 onResume 重畫一次；移除這個重複 render，跨日更新仍由重新訂閱的 render 及原有日期事件處理。
- busy 通知令習慣等畫面重建未改變的 DOM；改用 changesOnly，部分狀態使用內容一致檢查。控制項忙碌通知仍接收，習慣操作以局部 disabled 更新保留忙碌回饋，錯誤／完成流程保留。
- 同一份未變動儲存資料在跨頁／取得鎖時重讀、解析並通知所有訂閱者。refresh 僅在原始字串完全一致時重用已驗證狀態；復原到期及時鐘倒退仍重算。每次正式持久化仍重新讀取、驗證復原鏈並檢查 revision，沒有跳過寫入安全檢查。
- 雲端變更標記原先先深複製完整文件再丟棄歷史；現在投影時排除不比較的歷史，canonical 比較結果相同。手動備份仍取得完整資料並驗證上傳。
- 生活事件觀察者只在相關正式交易取得所需角色／回覆庫欄位。事件 before/after、去重、來源確認、AI 取消及 450ms 合併規則保持。
- 個人資料編輯草稿只擷取實際使用的資料／數值／圖片與 revision；圖片草稿不再複製無關的待辦及全部歷史。
- 歷史頁僅切出顯示的五筆後反轉，重用日期格式器及既有分頁選項。習慣年度圖只在資料、年月、寬度或字型變更時重建；沒有刪除圖表、改動分數、縮短動畫或更改有效期限。

- CPU Profiler 的備份熱點為 `copy → notify → refresh → backupNow/upload/withBackup`；不是未經量測就歸因網路。除了去除重複通知，同次備份的隔離快照已在維護鎖內整理復原鏈並完整驗證，圖片盤點可重用這份證明；一般稽核與刪圖仍照原方式重驗。待上傳快照保守保護所含圖片，沒有刪除紀錄或改變復原有效期限。
- 手動完整備份的 canonical 建構按短批次讓出主執行緒，完整驗證階段之間也讓出執行權；維護鎖保留至捕捉完成，避免另一分頁改寫。單元測試確認 canonical 位元內容、順序、非變異及排程交接；備份格式、SHA、AES、密碼迭代、20 筆保留與上傳後下載驗證不變。沒有加入 Worker、後端或常駐排程。

- 確認 UI 先回饋後，完整交易仍可能搶在下一次繪製前執行。待辦完成、檢視設定及 Undo／Redo 在既有 busy／pending 狀態後先讓出一幀，再取得寫入鎖；隱藏頁面直接進行，另設64ms排程保底以免依賴停發的animation frame（瀏覽器仍可能節流計時器）。這不是 debounce，不改同步頻率；所有 revision／重複發獎及失敗回復檢查保留。

- 連續切換待辦排序時，舊的尚未提交操作可能令後一次選擇被 busy 拒絕。檢視設定按輸入次序序列執行，每次開始時重新讀取必要欄位；先隔離輸入參數，失敗後仍可繼續下一筆，保留正式交易與版本檢查。

## 重現

先建立基準 build 的獨立目錄，再修改原始碼。不要同時執行兩個效能測試或其他密集測試。

```sh
node tests/make-performance-fixtures.mjs
npm run build
node tests/interaction-inventory.mjs
# 以本機 HTTP server 提供 frozen baseline 與 work/build
BASE_URL=http://127.0.0.1:3029/work/audit/baseline/ OUTPUT=work/audit/before.json node tests/interaction-performance.cjs
BASE_URL=http://127.0.0.1:3029/work/build/ ASSET_VERSION=interaction-perf-20261028 OUTPUT=work/audit/after.json node tests/interaction-performance.cjs
BASE_URL=http://127.0.0.1:3029/work/audit/baseline/ ASSET_VERSION=action-ready-20261028 OUTPUT=work/audit/background-before.json node tests/interaction-background-performance.cjs
BASE_URL=http://127.0.0.1:3029/work/audit/baseline/ ASSET_VERSION=action-ready-20261028 OUTPUT=work/audit/durable-before.json node tests/interaction-durable-performance.cjs
BASE_URL=http://127.0.0.1:3029/work/build/ ASSET_VERSION=interaction-perf-20261028 OUTPUT=work/audit/background-after.json node tests/interaction-background-performance.cjs
BASE_URL=http://127.0.0.1:3029/work/build/ ASSET_VERSION=interaction-perf-20261028 OUTPUT=work/audit/durable-after.json node tests/interaction-durable-performance.cjs
node tests/summarize-interaction-performance.cjs work/audit/before.json work/audit/after.json > work/audit/comparison.csv
node tests/compare-interaction-performance.cjs work/audit/before.json work/audit/after.json
```

背景測試只替代外部服務的網路回應，不替代正式本機處理；每頁明確啟動 AI，導覽依既有規則取消上頁工作。Drive 從真實手動備份程式進入延遲的 mock PUT，放行後仍下載驗證。沒有真實 Google 帳號或供應商金鑰，因此不能據此聲稱已驗收真實 OAuth 彈窗、Drive 網路、AI 服務或實體手機。正式公開網站連線若受環境網路限制，也須單獨標示。

### 功能覆蓋界線

|頁面／共用|計時入口|其他功能驗證|
|---|---|---|
|全站外框|六路由、頁籤、視窗、輸入|導覽失敗重試、快取更新、鍵盤、觸控、RWD、焦點及動畫偏好回歸|
|首頁|頁籤與跨頁返回|今日事項與習慣共用獎勵、今／明、夥伴定位、通知|
|待辦|CRUD、完成、排序、輸入與視窗|日期／週期、固定分配、雙分頁完成、獎勵撤回、清單鍵盤|
|習慣|M/P、加分、統計展開、設定視窗|設定保存、取消、補登、圖表更正、首頁共用、失敗回復|
|我的資料|視窗、頁籤、輸入、儲存|資料驗證、圖片保護、歷史／Undo／Redo、重新載入持久化|
|角色／聊天|階段、選角、輸入、儲存、訊息載入與輸入|角色草稿、好感度、圖片交易、訊息隔離／過期／取消／重試／備份排除|
|設定／資料|頁籤、展開、Undo／Redo、雲端視窗|外觀、AI 共用連線、手動上傳驗證／保留20筆、加密匯出／匯入、還原衝突與圖片保護|
|隱私頁|無可變資料入口|靜態內容與導覽盤點；不冒稱互動量測|

主測試 tasks.sort 的準備寫入可能與當筆動作重疊，原生 select.value 改變也不產生 DOM mutation；因此其首次回饋／完成時間不納入合格對照，4組排序全部改由補測評估。history.redo 原 readiness 有部分樣本只觀察到介面狀態，不能當作持久化完成時間，其完整寫入亦由補測驗證。另由 `interaction-durable-performance.cjs` 以相同原始 fixture、連續排序及獨立的 Undo／Redo 工作負載，等待正式 commit／非 busy 狀態，並要求量測窗口至少一次主資料寫入、逐次核對儲存內容。這是補充負載，不與主測試混成同一組數據。

以上其他功能以既有單元／瀏覽器回歸為依據；不代表所有分支都有獨立的 p50/p95。AI／Drive 使用 mock，真實外部服務仍待驗收。舊 `backup-delay.cjs` 要求已停用的10分鐘自動備份，並非現行手動模式的驗收項目；本次用 manual-cloud-retention 及實際待上傳並行寫入測試驗證現行規則，沒有為了讓舊測試通過而重啟自動同步。

## 量測與回歸結果

單位 ms，欄位為 p50/p95。p95 在12筆樣本下是最大值。所有數值都是受控瀏覽器的事件派發／frame代理，不是實體手機顯示延遲。

|資料／裝置|操作|首次回饋：前→後|更新完成：前→後|
|---|---|---|---|
|small/desktop|route.tasks|23/29 → 15/17|30/58 → 24/33|
|small/desktop|tasks.dialog.open|14/23 → 14/23|40/46 → 36/44|
|small/desktop|tasks.create|16/23 → 14/74|98/182 → 66/100|
|small/desktop|tasks.complete|54/64 → 15/16|256/289 → 145/165|
|small/desktop|habits.check|14/19 → 15/16|372/489 → 132/172|
|small/desktop|habits.bonus|128/153 → 15/93|309/360 → 96/114|
|small/desktop|profile.dialog|28/42 → 22/29|41/57 → 38/45|
|small/desktop|profile.save|33/39 → 14/83|155/193 → 79/107|
|small/mobile|route.tasks|133/172 → 87/103|165/260 → 122/140|
|small/mobile|tasks.dialog.open|81/107 → 66/87|87/120 → 71/92|
|small/mobile|tasks.create|85/136 → 51/59|505/846 → 242/363|
|small/mobile|tasks.complete|307/375 → 73/100|1348/2070 → 593/703|
|small/mobile|habits.check|25/34 → 26/32|1759/2308 → 613/875|
|small/mobile|habits.bonus|621/752 → 49/63|1440/1740 → 418/569|
|small/mobile|profile.dialog|96/133 → 44/69|104/138 → 51/75|
|small/mobile|profile.save|189/228 → 34/44|889/1048 → 327/469|
|large/desktop|route.tasks|187/208 → 29/32|203/218 → 39/52|
|large/desktop|tasks.dialog.open|14/96 → 14/24|82/114 → 37/44|
|large/desktop|tasks.create|136/233 → 26/36|899/1530 → 317/490|
|large/desktop|tasks.complete|360/431 → 20/23|1683/1950 → 594/683|
|large/desktop|habits.check|15/17 → 15/17|1728/2430 → 452/643|
|large/desktop|habits.bonus|447/593 → 22/25|1110/1355 → 250/289|
|large/desktop|profile.dialog|55/59 → 21/30|63/70 → 37/46|
|large/desktop|profile.save|128/159 → 14/216|601/733 → 221/239|
|large/mobile|route.tasks|931/1080 → 169/203|972/1138 → 206/248|
|large/mobile|tasks.dialog.open|466/626 → 77/94|472/638 → 85/104|
|large/mobile|tasks.create|703/841 → 148/166|4752/5797 → 1437/2077|
|large/mobile|tasks.complete|1729/2461 → 95/125|8104/11292 → 2691/2880|
|large/mobile|habits.check|29/39 → 24/35|8619/12198 → 2110/2864|
|large/mobile|habits.bonus|2187/2459 → 121/148|5172/5767 → 1095/1438|
|large/mobile|profile.dialog|294/453 → 44/73|303/461 → 50/78|
|large/mobile|profile.save|660/729 → 27/35|2927/3667 → 856/1009|

### 正式寫入完成補測

此負載從相同原始 fixture 連續排序、再獨立 Undo／Redo；不是把主測試的介面狀態誤當持久化完成。

|資料／裝置|操作|首次回饋：前→後|已核對正式寫入：前→後|
|---|---|---|---|
|small/desktop|tasks.sort.durable|50/131 → 9/16|104/156 → 68/114|
|small/desktop|history.redo.durable|89/101 → 14/16|96/103 → 75/87|
|small/mobile|tasks.sort.durable|83/262 → 13/65|519/872 → 259/456|
|small/mobile|history.redo.durable|72/459 → 17/18|471/827 → 247/281|
|large/desktop|tasks.sort.durable|184/594 → 9/25|1280/1366 → 395/504|
|large/desktop|history.redo.durable|106/112 → 14/16|860/924 → 492/524|
|large/mobile|tasks.sort.durable|775/3223 → 25/105|5652/7009 → 1782/2464|
|large/mobile|history.redo.durable|512/642 → 18/24|4237/5400 → 2160/2362|

### 主要成本與長任務

|資料／裝置|習慣打卡 clone p50：前→後|主要寫入 p50/p95：前→後|所有操作觀測到的長任務總數：前→後|
|---|---|---|---|
|small/desktop|230 → 41|3/3 → 2/4|28 → 79|
|small/mobile|1063 → 203|10/18 → 16/37|58 → 41|
|large/desktop|1393 → 254|9/14 → 10/16|31 → 111|
|large/mobile|6864 → 1164|58/186 → 49/70|53 → 49|

### 外部工作等待期間

每個入口仍逐組12次；下表列該條件中最慢入口的 p95 首次回饋／完成時間，不混成同一種操作的分位數。

|資料／裝置／模式|最慢入口回饋 p95：前→後|最慢入口完成 p95：前→後|
|---|---|---|
|small/desktop/idle|26 → 26|48 → 48|
|small/desktop/ai|25 → 27|46 → 44|
|small/desktop/drive|26 → 30|49 → 49|
|small/mobile/idle|103 → 86|115 → 101|
|small/mobile/ai|130 → 93|144 → 100|
|small/mobile/drive|115 → 104|128 → 133|
|large/desktop/idle|76 → 47|101 → 74|
|large/desktop/ai|75 → 27|102 → 47|
|large/desktop/drive|77 → 41|92 → 80|
|large/mobile/idle|518 → 240|540 → 371|
|large/mobile/ai|323 → 124|336 → 136|
|large/mobile/drive|326 → 201|384 → 314|

### 備份準備剩餘長任務

每個裝置／資料條件4次手動備份準備，獨立於網路等待樣本。

|資料／裝置|ScriptDuration p50/p95：前→後|單次最長任務 p50/p95：前→後|
|---|---|---|
|small/desktop|18/27 → 3/4|0/0 → 0/0|
|small/mobile|78/164 → 11/21|76/169 → 0/0|
|large/desktop|338/372 → 26/29|306/329 → 0/0|
|large/mobile|1657/1934 → 86/104|1525/1732 → 156/183|

### 未達 100ms 的首次回饋

主測試共140組可比較的回饋條件／操作（另4組排序改以正式寫入補測評估），123組 p95≤100ms，17組超過。這不是全部完整寫入都在100ms內完成；完整更新超標值可直接查上表與 CSV。

- small/desktop tasks.delete：135ms
- small/mobile route.tasks：103ms
- small/mobile route.habits：114ms
- small/mobile route.home：131ms
- small/mobile habits.dialog：146ms
- large/desktop profile.save：216ms
- large/mobile route.tasks：203ms
- large/mobile route.habits：119ms
- large/mobile route.settings：133ms
- large/mobile route.home：176ms
- large/mobile tasks.create：166ms
- large/mobile tasks.edit：221ms
- large/mobile tasks.complete：125ms
- large/mobile tasks.delete：235ms
- large/mobile habits.bonus：148ms
- large/mobile habits.dialog：133ms
- large/mobile characters.save：129ms

大量文件完整寫入仍須維持復原鏈、資料驗證、序列化及原子 localStorage 寫入。備份另有完整結構／圖片完整性檢查。保留這些保護，沒有以假成功、減少驗證或更改資料結構換取分數；上表超標入口不能宣稱達標。

Fixture SHA-256：`06169082bbd2a66b0ca07e57ef1b0f2fb13e6c224339a653953ad9182c7d16c2`。Chromium 154.0.8037.57；desktop 1280×900 CPU1，mobile 390×900觸控 CPU4。實體手機、Google Chrome branded stable、真實 Google／AI 與公開網站網路延遲未由這個 localhost 測試證明；CPU模擬不是手機硬體。導覽主要比較預熱頁面，不能冒稱已量到冷網路首次載入。


## 回歸與限制

- lint、production build、320個單元測試通過。25組瀏覽器回歸通過，另通過 baseline01963b7 的375／1280px快取升級。固定分配舊測試改用現行分類標題、可見提交按鈕，並將已不存在的 placeholder companion 診斷改為核對無出場角色時不新增 API 請求；沒有為舊測試重啟已移除功能。習慣備份測試改讀 BASE_URL。
- 覆蓋實際雙分頁完成只發一次獎、Undo／Redo、M/P即時待處理與儲存失敗回復、AI保存分配後完成不再分配、跨頁草稿、圖片裁切／資產保護／舊資料遷移、聊天取消／期限／隔離、密碼備份與還原、20版本驗證及清理失敗保護。等待中的AI／手動Drive上傳期間，本地固定任務可提交且重新整理不丟資料；較新的本地資料不被舊上傳快照覆寫。
- 沒有新增正式追蹤、輪詢或服務。Drive維持手動模式；登入／11分鐘閒置／online／focus不自動上傳。AI共用連線與既有取消規則保留。日期、親密度結算、復原到期、聊天期限等既有本地計時機制保留，不當成自動同步移除。
- 背景56組中51組首次回饋p95≤100ms，5組未達：小量手機Drive中的待辦視窗104ms；大量手機閒置待辦視窗105ms、聊天頁籤240ms；AI等待時待辦視窗124ms；Drive等待時聊天頁籤201ms。正式寫入補測8組中7組達標，大量手機排序105ms。這些項目亦不宣稱通過100ms。
- 仍有長任務。主操作窗口內已送達的longtask事件數有部分桌面組增加；Observer在窗口結束後才交付的事件可能漏記，不能據計數聲稱全站長任務總數下降或已歸零。CSV同時保留CDP TaskDuration、ScriptDuration、LayoutDuration及原始事件數供檢查。備份準備另有完整階段的觀測，最大單一長任務在大量手機仍約183ms。
- 原生confirm與系統下拉選單不在DOM探針內；刪除數值包含測試自動確認往返。輸入值的視覺時間採保守readiness上界。數據不能冒稱input-to-photon或真機SLA。
- 未連線真實Google帳號／AI服務，未以本次mock測試盤點真實雲端版本數；未批次刪除任何既有雲端資料。公開github.io網站受此環境網路政策限制，正式外網、真機、冷網路載入及AI完整回應後處理仍需實際環境驗收。

主測試140組、背景56組與正式寫入補測8組，均未出現超過預設25%且至少50ms容許幅度的中位數退步。原始資料及逐組p50/p95見隨附CSV；事件處理時間有EventTiming門檻／交付限制，空白不表示0ms。
