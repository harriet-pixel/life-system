# 緊急回退與本地儲存修復（2026-10-28）

正式站自動同步 **停用**（AUTO_SYNC_ENABLED=false；runtime拒絕顯式啟用、UI不得重新啟用），Cloudflare不變。此決定取代以下舊啟用記錄，保留最新頁面功能，不回退Git commit。

## 根因與證據

1. localStorage同步sidecar同時持有完整observed主文件（含Undo）、outbox交易及所有已讀checkpoint/operation快取。每次persist全量序列化，舊快照未從快取淘汰；12 MiB字元上限遠高於常見localStorage配額，且UTF-16實際占用更大。主資料和sidecar共用來源配額，故sidecar先佔滿空間後，data.persist的正式setItem也會拋QuotaExceededError。舊catch抹去原始類型，僅留下泛用「無法儲存」；切成手動只close runtime，未釋放sidecar容量，不能恢復可用性。已在1.4MB模擬手機配額，以及Chromium原生配額下重現：後者journal原文占10,480,780 bytes，正式寫入拋QuotaExceededError且主資料未變；移存並讀回核對後，同樣本地修改成功。
2. 舊快照revision歸零但Redo排序保留，已由前次專項重現。完整備份與同步增量本來應有不同envelope；這次補強Drive回應metadata及內容format/version/id/kind一致性、明確區隔lifeSystemFormat與lifeSystemSyncVersion。驗證訊息列出schema欄位或紀錄位置，engine記錄validate-local-checkpoint／validate-cloud-checkpoint階段；永久格式錯誤不退避重試。**無法存取使用者真實Drive回應，因此不能宣稱已辨識此帳號每一筆失敗檔案的根因或完成真實API驗收。**
3. runtime.pending與restoreBaseline要求confirmed，使同步失敗成為還原的永久前置阻擋；舊手動模式dirty同樣阻擋。現在手動還原以「先安全保留本地、再還原」取代「一定先同步成功」，不是移除安全檢查。

## 保存與恢復

- 開機及正式交易前，在primary寫鎖內將完整journal原文寫入IndexedDB `life-system.recovery-vault.v1/archives`，交易完成並讀回逐字核對，確認來源未變後，才將原localStorage journal鍵替換為小型索引。原文、outbox、checkpoint快取、既有錯誤均留在vault，不clear、不刪雲端。保護副本以內容hash去重，支援strict durability的瀏覽器使用strict。
- 保存失敗不替換原journal，也不全站停用按鈕；剩餘配額允許時仍可本地寫入。若primary本身也超出配額或IndexedDB被封鎖，不能承諾有無限儲存空間，維持資料並給錯誤，不刪資料騰空間。
- data.persist保留QuotaExceededError／SecurityError等類型、操作類型、嘗試byte數及primary/journal/其他localStorage估算；只保留20筆無個資記憶體診斷，不記全文、key名稱、Token或密碼。雲端窗顯示文字儲存估算。
- 歷史備份下載／解密／完整schema及圖片驗證仍保留；使用者明確確認後，在原maintenance鎖與revision核對下，把目前primary原文及完整待送journal存入vault並讀回確認，再執行既有原子replace。任一步失敗，primary不替換。保護副本可從雲端視窗「下載還原前本地備份」匯出正常備份格式。
- vault中所有仍在本機的圖片引用繼續保護；遠端快取引用但本機尚無Blob，不會阻擋目前資料備份。無法解析舊引用時保守保留所有本機圖片；不自動刪圖。回覆庫清理也保護archive引用，不讀聊天DB。
- 舊同步協定仍封存；索引型journal不得直接重新交給舊同步引擎。修復容量與協定、真實Google驗收前不得只翻開關啟用。

## 驗收範圍

新增tests/storage-emergency.test.mjs與tests/emergency-storage.cjs：低配額重現、診斷不含個資、失敗後local任務儲存、完整journal逐字保存與重載、登入零自動Drive請求、備份／同步格式區隔、有未備份資料的安全還原與下載、圖像引用、IDB保存失敗時保留原資料及阻擋不安全還原。完整304項單元測試、八寬度、手動明文／舊加密還原、81項回覆庫與16項正式事件回歸通過。保護備份下載含原圖片也通過。

緊急版手動上傳也預設preserveExisting=true，暫停舊的20筆超額清理；21筆舊手動版本＋新上傳驗證零DELETE。

Google流量皆HTTP mock；配額為Chromium模擬手機限制，**不是真實Android/Windows或真實Google驗證**。實際帳號檔案內容、裝置配額與原始錯誤無法由執行環境直接讀取。發布狀態由對應gh-pages SHA的Pages工作流確認；公開網站直讀受環境代理403限制。

使用者操作：關閉其他舊分頁；Windows Ctrl+F5、Android重新整理。先新增／編輯待辦並刷新確認本地保存。需要Google時再登入並手動上傳；還原選擇歷史版本，閱讀「先保留本地」確認，完成後關窗；可重新開窗下載還原前備份。不清除網站資料、不刪雲端檔案。自動同步維持暫停。

---

以下是歷史驗收，啟用決策已被本次緊急停用取代。

# Undo／Redo 同步修正（2026-10-28）

實際回報「備份結構驗證失敗」可由首次同步前執行Undo重現。舊同步把快照revision歸零，但保留redoable紀錄的undoOrder；既有完整備份驗證要求undoOrder不超過revision，因而拒絕合法快照。這是協定版本計數處理錯誤，不需清除資料。

修正：新同步快照保留合法版本計數；已驗證hash的舊零版本快照及套用增量，僅在記憶體將revision提高到既有Redo排序所需的最低值，再進行原有完整schema／復原鏈驗證。未更動紀錄ID、順序、金額、獎勵、欄位guard或資料hash比較規則，不重寫／刪除舊雲端快照。dataStore原有max(local+1,incoming)持久計數維持下一次Undo排序單調。成功後清除過時錯誤訊息。

新增：首次同步前Undo、既有同步後Undo／跨裝置Redo、舊失敗零版本快照重載恢復，完整299項單元與33項同步專項通過，lint／build與雙瀏覽器、runtime離線／授權、手動備份還原回歸通過。正式runtime＋Drive HTTP mock流程涵蓋帶Redo資料的首次自動同步、手動完整上傳與新手機載入。仍未直接存取使用者Google帳號；真實重試由使用者刷新後核對。

快取只更新同步model／engine／runtime、雲端視窗及六頁shell入口為sync-redo-20261028；dataStore／status／資產引用等有狀態共用模組維持原URL，避免第二份singleton。

---

# 2026-10-28 現有網站啟用驗收

使用者後續明確授權：現有網站尚無重要正式資料，直接在現有GitHub Pages啟用並由Windows與Android實測；不建立獨立測試站。此決定取代下方歷史報告的停用／專用測試站前提，Cloudflare繼續暫停，無新增後端。

## 本次啟用修正

- 所有前端ES模組依賴（含原本未版本化的同步狀態模組）與六頁入口統一sync-live-20261028，dataStore／engine／adapter／runtime介面一致，避免舊快取缺replaceSynchronized及多重singleton；後端共用AIError版本也保持一致，未部署後端。
- 預設開啟，雲端視窗提供持久手動回退；關閉／重啟runtime不重複註冊圖片來源。圖片引用保護直接讀持久journal，手動模式仍保護待送圖片。
- 沒有歷史但有匯入／個人設定資料的裝置不視為空白；僅預設空資料與初始好感度中繼資料可自動採用雲端。首次不同資料需明確選擇，不能擅自覆蓋。
- JSON物件欄位順序不再被備份／復原驗證當作內容差異；禁止憑證欄位仍拒絕。上傳保持原物件順序，內容hash仍canonical。本地快取內容每次核對hash，排程中又有正式修改時不顯示已同步；無輪詢、重試有上限。
- 自動完整備份與解衝突前保護備份不執行舊備份保留數清理；新同步adapter只刪有保留證據的同步增量。使用者自行手動上傳仍沿原最近20筆政策。
- 手機日期與通知移入同一區塊、間距0；保留通知高度避免頁面位移。

## API與資料檢查

Drive僅drive.appdata scope；同步appProperties與lifeSystemFormat=1的手動備份分開。同步屬性key+value均低於Drive單筆124-byte限制。分頁100筆、4096筆總上限；下載串流容量上限、內容SHA256、上傳Location來源白名單與回讀確認；401停用憑證、429/5xx及quota退避最多6次並尊重Retry-After。Resumable Location須由真實Drive以CORS暴露，mock不能證明此條件。沒有跨裝置鎖，不宣稱原子資料庫；多初始根／快照分支停止且保留，不按時間選擇。

無真實OAuth／使用者Drive可用於本環境，因此**尚未讀取您帳號既有雲端檔案**。網站登入後先列出與驗證既有同步紀錄，通過才上傳／套用；多根或未知／不完整資料會停止。舊drive-sync.v1設定停用但保留，不遷移或刪除其資料。持久主資料與journal各自保存，metadata失敗可由主資料重建差異；圖片及人工回覆庫沿IndexedDB，不納入聊天DB。瀏覽器清除網站資料仍會刪除本地資料，不可作為排障步驟。

## 實際操作

1. Windows先重新整理現有網站，雲端icon→登入。沿原Google帳號；授權仍有效可沿用，失效或新裝置需登入，不新增scope。先只開這一部裝置，修改一句話／新增事件，等雲端icon顯示已同步。
2. Android開同一網址，以相同Google帳號登入；尚無自己的資料會自動取得雲端。若本地已有另一份資料，會保留並提示衝突，先備份後才選擇分支。不要同時用兩部空裝置建立第一份資料。
3. 手機修改後等已同步；電腦重新整理核對。另測完成一次事件／M打卡，確認數值只增加一次，重整不加第二次。
4. 手機離線修改後重新整理，確認本地仍在；恢復連線後核對，再用電腦重整。授權到期從雲端icon重新登入。
5. 雙方離線修改同一事件後連線應提示衝突，不能悄悄覆蓋；先備份再選擇。多個初始根不提供強制選最新，停用並回報訊息，不刪雲端檔案。
6. 回退：雲端icon→切換手動備份模式；每部裝置分別切換。保留本地／outbox／雲端，之後可重新啟用。待送資料未完成前不要清除網站儲存空間。手動還原資料後再啟用可能須處理舊基準差異。

## 測試與限制

本次lint與build通過；完整單元296項（同步專項30項）通過。瀏覽器：預設runtime／Drive HTTP adapter、雙context／同源分頁、runtime授權離線／回退、八寬度與200%色碼欄／手機日期通知零額外間距、手動備份還原、81項回覆庫與16項正式事件回歸通過。自動完整備份保留21筆既有手動備份的HTTP mock檢查通過。新增預設runtime＋真實adapter的HTTP mock驗證，涵蓋自動三秒上傳、新手機採用、重整取得、無修改不上傳、手動回退再啟用。既有雙context／同源分頁／衝突／獎勵／Undo／圖片／回覆庫測試保留。所有Google流量為mock，**未完成真實Google、實體Windows/Android、Location CORS、權限撤銷／quota與長期容量驗收**。公開網站直接讀取受執行環境網路政策限制；部署以對應SHA的Pages工作流核對。

安全容量上限仍為512增量、64快照、32768保留hash、本地sidecar12MiB、列表4096；達限會停止並保留資料，長期輪替未驗收。這是直接現站實測版本，不宣稱長期無人維護服務已驗收。行動版beforeunload不保證觸發，不能依賴關頁警告才保存。

---

# 以下為啟用前歷史報告（停用決策已被上述授權取代）

# 介面與同步整合驗收（2026-10-28）

## 發布界線

第一、二階段的介面及手動備份／還原可發布。`assets/cloud-sync-status.mjs` 的 `AUTO_SYNC_ENABLED` **維持 false**；一般網站不載入同步 engine／Drive adapter／runtime、不建立新同步 journal、不進行自動雲端讀寫。下列測試的同步後端都是 mock，不能視為真實 Google Drive 或實體雙裝置驗收。

不得僅修改一個開關就啟用。需要完整版本圖一致（尤其 dataStore 的 replaceSynchronized 能力）、真實測試帳號與兩部裝置驗收、完整保留現有雲端資料，以及檢查下方限制。

## 階段與資料

1. 第一階段：首頁名稱以 `periodId:habit:slot` 穩定識別碼進原習慣設定，不比對名稱、不建立第二表單；移除管理習慣。手機通知為頁首固定兩行高度、長文內捲，桌面為立繪下單一通知。共用色碼列／色塊只修改草稿。原生 details 預設收合 M/P/E 手動分配。新 `saveLivePeriod` 明確保存目前半月週期後立即生效，舊草稿不在載入時自動轉正，舊版本／獎勵快照保留。原網站沒有每週目標次數資料，本次沒有憑空建立新週目標系統。導覽只移除獨立聊天室入口，角色聊天室與資料保留。
2. 第二階段：雲端同步與備份視窗使用右上叉叉／外點／Escape及三等寬按鈕。開窗只讀版本 metadata；還原時才下載、驗證並明確確認。未備份本地變更阻擋還原。關閉視窗不取消已提交上傳，未提交還原用 epoch 失效。裝置只顯示一般平台，未記錄／未知不捏造。修改、同步及備份時間分開，沒有可靠資料時間時顯示未記錄。完整快照 hash 包含長期歷史／Undo，完全相同內容不重複建版本。
3. 第三階段：新增停用中的同步 model、engine、Drive adapter、runtime，以及既有 dataStore 的受檢查原子套用能力。沒有第二份正式餘額／事件資料；`life-system.cloud-sync-state.v1` 是共同基準、待送增量、已驗證快取及還原意圖的本機 sidecar。正式資料仍是既有 `life-system.data.v1`；圖片、回覆庫與聊天各用原有儲存。
4. 第四階段：整合遠端最新日常回覆庫，回歸第一／二階段與原角色回應，發布時仍不啟用同步。

## 同步協定與安全取捨

- 操作以穩定 ID、actor/sequence/previous/parents、共同 epoch、內容 SHA-256、欄位前後 hash 及交易明細判斷；不以 revision、建立順序或最後時間選贏家。資料時間只作資訊。
- 增量使用物件路徑／實體 ID；不為一筆任務重新上傳所有實體或圖片。Google appDataFolder 的同步紀錄與舊 `lifeSystemFormat=1` 完整備份分開查詢；沒有新 scope／後端／Cloudflare。
- 不可變操作允許並行分支；同一資料領域或共用數值、角色、Undo 相依無法證明可交換時，停止該整個交易群組。其他可驗證群組仍保存。這不是任意欄位的泛用合併器，特別是同一 tasks／stats 領域的並行操作可能需要選擇。
- 離線 outbox 持久保存；中途新本地操作不當成已上傳。相同 ID 不同內容、序列分叉、缺基準、篡改、缺圖、quota、未知版本都停止，正式資料不清空。三秒事件合併、啟動／登入／恢復網路觸發，無五秒輪詢；暫時錯誤依 Retry-After／最多六次退避。
- 新圖片及人工日常回覆庫分類以內容 hash 分開上傳、去重及驗證；保留既有引用與暫存保護。只讀正式回覆庫分類，**不讀聊天 IndexedDB** 或上傳短期聊天全文。
- 受影響分支選擇前先建立完整備份，重新核對本地版本及雲端紀錄，再建立不可變子基準。歷史還原使用持久 restoreIntent、新聊天／回覆庫 epoch、已確認新同步基準和原子本地替換；失敗保留原資料與意圖、停止後續自動套用。舊裝置有待送變更時不能覆蓋新基準。
- 同步快照與完整歷史備份分開。確認同步後的變更可在約十分鐘做快照／完整備份檢查；相同完整快照不重複上傳。背景完整備份遇到舊資料時間不明時暫停，不偷開確認視窗。
- 未同步時有原生 beforeunload；行動瀏覽器不保證觸發。離線／授權失效用一次性事件提示，主動登出不當成意外斷線；重新登入仍需使用者點擊，憑證沿原短期 session 授權。

## 已完成的自動化驗證

- `npm run lint`、`npm run build`、完整 Node 單元測試。
- `tests/cloud-sync.test.mjs`：26 個同步專項。雙向、去重、三秒排程／重載持久化、任務與習慣獎勵、Undo、衝突及明確初始分支選擇、還原新基準／失敗意圖、離線／Token／429、圖片、快照清理、篡改／序列／quota、首次上傳競爭、舊 queued revision 及復原過期無 revision churn。
- `tests/cloud-sync-browser.cjs`：兩個獨立 Chromium context（電腦／手機），實際 localStorage／IndexedDB／原 dataStore與維護鎖；共同 mock 後端。雙向、獎勵精確一次、Undo/Redo、圖片、正式角色／人工回覆庫資產、衝突選擇、同來源雙分頁與重載；確認一般載入不啟動同步。
- `tests/cloud-sync-runtime.cjs`：停用開關零 I/O、只有待同步時警告離開、離線與授權事件只提示一次、重連及主動登出；沒有真實 Google 資料請求。
- `tests/sync-stage1.cjs`：320／375／390／450／451／768／1024／1280px，通知固定、同名識別、共用設定、收合分配、HEX 預覽、導覽及 200% 字體。
- `tests/sync-stage2.cjs`：八寬度視窗、登入／時間／裝置、等寬、無多餘下載／重複快照、未備份還原阻擋、明文／舊加密還原、錯誤密碼、外點／Escape、上傳中關窗。
- `tests/replies-browser.cjs`、`tests/replies-events.cjs`：保留最新回覆庫與正式生活事件流程。

## 真實驗收仍未完成

必須使用專用 Google 測試帳號及兩部實體裝置，不能對既有正式資料直接試開：

- 真實 GIS 登入、原 appData scope、Token 到期、撤銷、登出／再登入及可見的授權提示。
- Drive metadata／resumable upload／Location CORS、內容回讀確認、列表延遲、重複不可變紀錄、429／quota／Retry-After與離線中斷。
- 電腦寫入後手機重開、手機寫入後電腦刷新；長期離線、有未同步舊基準、同時初始連線、同時建立快照、同時還原選擇。
- 真實角色圖、裁切、收藏、日常回覆庫、本機及舊雲端明文／加密備份；原有正式備份不被新同步清理。
- 真實手機關頁／背景暫停／強制關閉：本地寫入與下次補送要成立，不依賴 beforeunload 一定出現。

## 限制與啟用阻擋

- Google Drive 不是跨裝置資料庫鎖。兩個不同初始根或不可證明的多重快照分支會暫停，不用時間選贏家；這類情境可能需要受控人工選擇，不能清除雲端檔案排障。
- 目前安全上限為每批 512 個增量、64 個同步快照、32768 個保留操作 hash、本地 sidecar 12 MiB、同步檔案列表4096。達上限停止，不自動丟棄資料；長期容量／輪替及真實 Drive quota 還需驗收。
- 未通過實體裝置、真實 Drive及長期容量驗收，因此本次**只發布介面與停用的實作**。不得把此報告當成正式自動同步已完成或已啟用的證明。

## 本次第四階段結果

- `npm run lint`：通過 JavaScript 語法、HTML ID及本地資產檢查。
- `npm run build`：通過；發布成果為 work/build，未放入憑證。
- `npm test`：**292 項通過、0 失敗**，其中26項同步專項。
- 第一、二階段八種寬度（含450/451）及200%文字回歸通過；舊加密備份與錯誤密碼、完全相同快照不重複上傳通過。
- 兩個獨立瀏覽器context、同來源雙分頁、角色／日常回覆庫資產、正式數值與Undo/Redo、衝突選擇及重新載入通過；背景保護、原生離開警告與提示單次性通過。全部使用隔離資料與mock後端。
- 整合遠端夥伴回覆庫後，原回覆庫81項操作與16項正式事件顯示檢查通過。
- 真實Google／實體雙裝置／長期容量：**未完成**。沒有真實Google憑證或跨裝置帳號操作，不以mock替代驗收。開關仍false；本次不得啟用自動同步。

階段提交：第一階段 `78a8212`；第二階段 `0bd19cf`；整合最新遠端回覆庫 `fe1446e`（保留`6e0b308`）；第三階段 `12a6e87`。第四階段報告與最終main／gh-pages、Pages工作流結果由交付訊息列出，避免文件自引自己的commit。

窄版補查：320px分類長標籤曾使HEX欄位僅18px。共用元件改以受限寬度caption與彈性輸入框、將分類預設色提示獨立成小字，原生選色器亦同排。`tests/color-field-layout.cjs`八寬度／200%／即時預覽／主題色控制通過，第一階段八寬度再次通過；未改資料格式、正式顏色值或同步開關。
