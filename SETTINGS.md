# 共用設定與資料服務

本文件描述現行原生三頁共用系統與常駐頁面外框（詳見 [APP_SHELL](docs/APP_SHELL.md)）；歷史交付與過去驗證筆數移至 [docs/DELIVERY_HISTORY.md](docs/DELIVERY_HISTORY.md)。來源使用最新main，gh-pages只接收建置成果。產品與視覺規範見AGENTS.md、design.md，發布流程見DEPLOYMENT.md。

## 資料及歷史

唯一持久資料文件為localStorage的 `life-system.data.v1`，圖片為IndexedDB的 `life-system.images.v1/images`。所有已保存設定、個人資料、圖片、數值及首頁正式打卡共用交易、revision與跨分頁寫入鎖，沒有另一份頁面設定；Google連接後只上傳備份，不跨裝置同步。

### 復原與行動紀錄拆分

- `assets/recovery.mjs` 集中管理分類、期限、15次上限、舊資料拆分、原始時間及鏈相依檢查。24小時適用實際修改profile、外觀settings、photo／avatar、裁切來源、portraits／選用最愛；stats及activities為7天。同一交易實際變更兩類資料時採24小時，數值及獎勵與行動整筆重播。
- 保留 `history` 的id、原始時間、類型、標籤、目標、欄位名稱、數值delta及撤銷狀態，不保留before／after或圖片快照；不另設15筆或時間裁切，也不新增統計功能。`undoHistory` 才保存快照。15次按原始操作時間及穩定順序計算，先取最近15次再判斷期限，過期不會讓超額舊操作復活。純介面、系統整理、備份、授權與整體還原不記成新行動。
- 開啟網站、資料變更、Undo／Redo、圖片掃描及備份時檢查；已開啟頁面由共用資料服務的單一到期計時器更新控制項，關站不背景執行。清理寫入使用同一Web Lock及原子文件，不刪目前資料、行動紀錄或Blob；原操作成功時間不因重播或還原重設。
- 復原／重做各自從目前狀態模擬整條可用鏈，遇到第一個快照不符即停止後續相依鏈並顯示提示。到期、未知、超額或分支淘汰的快照不保護圖片；目前圖片、最愛、草稿／暫存保護及進行中備份的保護保留。舊分頁需重新載入新程式才能採用新規則。
- 舊history完整拆分，不把紀錄當成剛發生。以可確認的實際變更資料根節點辨識期限；未知根節點、缺快照、無法辨識／在未來的原始時間不提供復原，但保留行動中繼資料。時間不可辨識時清單顯示「原始操作時間無法辨識」，不捏造時間。已經由舊50筆規則刪除的紀錄無法重新取得，不宣稱復原它們。
- 舊recordAll開關遷移時移除，其他設定保留；不可再藉舊false值停用新復原機制。原有數值規則升級也保留行動紀錄，不再清掉行動統計來源。

### 備份與還原

新輸出dataVersion=3、數值規則仍為2；繼續接受格式v1／資料v2的既有備份及舊密碼。驗證原檔所有資料、圖片引用及完整性後，才遷移／依原始時間移除過期快照，不重新起算期限。備份前同樣執行期限整理；新輸出不含已過期／超額快照及僅由它們引用的圖片。還原確認期間跨越期限時再次整理，確認期間資料變更及跨分頁保護不變。

加密檔在獨立視窗底部顯示等寬置中的「取消／解密與驗證」，不在密碼區重複按鈕；驗證完成才顯示摘要、覆蓋警告並切換為「取消／確認還原」。按鈕依目前階段與busy統一重算，不由finally還原過期狀態；未加密檔直接驗證後進入相同確認階段。驗證不寫入目前資料。AES-GCM解密失敗顯示「密碼錯誤，或備份檔案已損毀」；已明確辨識的編碼、版本、JSON、結構、引用及完整性錯誤各自保留具體訊息。還原密碼標籤與輸入框同列，取消／關閉／完成清除。仍接受最多1024 UTF-16碼元舊密碼，與新備份8–64碼規則分開。

### 我的資料與設定視窗

- 主畫面的能力值標題改為無障礙名稱，保留雷達圖；數據列與一句話跨立繪及雷達圖區域各自置中，一句話空白不占位。沿用目前手機頭像／桌面立繪顯示規則，未另改手機圖片模式。
- 字數提醒在欄位名稱同列，使用一個空格與「（目前／上限）」；仍依Unicode code point計數、不阻斷組字。刪除設定頁字型技術說明，字型選項、預覽、資源與授權保留。
- 立繪「更換／裁切／添加最愛」三鍵同列等寬，無障礙名稱補足用途；保留停用條件與手動最愛草稿規則。
- 重新開始位於貨幣欄上方；獨立確認清楚列出Lv1、畫面Exp0、貨幣0及五項能力0。未保存數值草稿會被取代，其他個人／圖片草稿保留。確認立即執行stats.restart交易（7天），不需主設定儲存；更新數值比較基準與revision，後續儲存／取消不寫回舊數值。取消設定不撤銷已確認重設，可用Undo。以寫入鎖執行，不取得與本頁草稿衝突的維護鎖。


## 同步與外觀

- 外觀寫入一次設定交易，所有頁面訂閱同份 store；其他分頁透過 storage event 更新。此處的即時外觀更新適用同來源、同瀏覽器；不提供跨裝置自動同步。
- `appearance-core.js` 在 head 同步讀取同份文件，盡早套用 CSS 變數；沒有第二份外觀快取。預覽僅作用於預覽區，保存前不寫入資料或歷史。
- `--color-accent` 保留使用者選色；`--color-primary` 為衍生的可讀控制項／文字用色。表面文字依亮度選黑／白，文字對比至少 4.5:1；focus、hover 與淡色背景集中管理。錯誤等語意色不變。
- 裝置字體：system-ui、-apple-system、Segoe UI、sans-serif。
- 明體：既有 Noto Serif TC Variable 5.3.1；黑體：Noto Sans TC Variable 5.3.1；圓體：Huninn 5.3.1。來源皆為 Fontsource npm 套件（上游 Noto／justfont Huninn），SIL OFL 1.1。各目錄保存 LICENSE、SOURCE.md 與已驗證的封裝 SHA-512。
- 皆自託管 WOFF2、font-display:swap；選到字型才建立對應 stylesheet，unicode-range 依字元載入。fallback 為 Noto／系統 sans 或 serif；未涵蓋的罕見字與載入失敗仍回退，不保證每個系統都具備所有 Unicode 字形。

## 圖片安全與鎖

- 固定 ID 為 `asset:` + 圖片 SHA-256；保留原有 ID、Blob、資料與引用。新圖片才補建立時間，舊資料不捏造檔名或時間。
- 取消自動 GC。`image-references.mjs` 集中掃描已保存文件、仍有效的 undoHistory before/after（含 Undo/Redo）及註冊來源，圖片檔缺失、未知引用、來源失敗時停止。
- 儲存管理只計算 Blob.size，不宣稱是全站磁碟容量。原有 staged asset 保護期限仍生效（不是自動刪除期限）。
- `coordination.mjs` 用 origin-wide Web Locks：寫入共用 exclusive lock；個人資料編輯（含所有圖片／裁切）及未保存外觀各持 shared draft lock。清理、備份、還原必須取得所有 draft exclusive locks 與 write exclusive lock。
- 有草稿時具體指出「我的資料 → 使用者設定」或「設定 → 外觀設定」，要求先儲存或取消。鎖由瀏覽器管理，分頁關閉或程序退出會釋放，不使用永久 localStorage 鎖。瀏覽器不支援 Web Locks 時安全停止維護操作。
- 刪除在確認後重新 refresh／掃描，持有寫入鎖到 IndexedDB transaction 完成，僅刪仍未使用的選取項目；新引用或暫時保護的圖片跳過。
- 此協調適用載入這版共用服務的頁面；部署更新後請重新載入先前開啟的舊版頁面。舊版程式無法被新版遠端強制升級，亦不能宣稱能協調任意第三方或 DevTools 直接寫入儲存的程式。
- 清理縮圖 URL 在切換頁籤、重載清單、pagehide 時釋放；共用圖片 URL 在刪除或 pagehide 釋放。bfcache 返回時 refresh 重新解析圖片，不刪圖片 Blob。

## 備份與原子還原

- `backup.mjs` 的同一版本化格式同時用於本機與 Google。包含目前資料、設定、最愛、長期行動紀錄、有效復原快照及它們引用的實際圖片；不含未使用圖片、草稿、認證 token、密碼或金鑰。草稿存在即停止，不靜默略過。
- manifest 有格式／資料版本、建立時間、可解釋的資料筆數（profile、stats、settings 各一筆，加收藏、活動、歷史數）、圖片數；每張圖含大小、MIME、ID、SHA-256 及實際 bytes。未加密檔另有 payload SHA-256；SHA-256 是完整性檢查，不是來源簽章。
- 選用加密：Web Crypto AES-256-GCM，PBKDF2-SHA256 600,000 iterations，隨機 16-byte salt、12-byte nonce；新Google備份不加密，本機保留可選加密。密碼與解密金鑰只在操作記憶體，不保存、不上傳。相同密碼各次備份使用新 salt/nonce。
- 單一 JSON 檔，不解壓／不執行任何內容；單檔 150 MiB、文件 10 MiB、圖片解碼總量 100 MiB、最多 2,000 張、巢狀深度限制。驗證格式、版本、結構、圖片雜湊與 MIME、引用完整性，瀏覽器另驗證圖像可解碼。
- 寫入前完整驗證，顯示時間／筆數／張數，使用者以「確認還原」明確確認完整取代。本機一般備份下載仍保留。確認期間資料改變則拒絕，避免覆蓋新資料。
- 還原先以內容雜湊 ID 暫存圖片，再用一次 localStorage 原子寫入發布新文件。寫入失敗，原文件及原圖片保留；暫存成功但發布失敗的額外圖片可能留為未引用資產，由使用者之後手動清理。從不先清空資料、不刪原圖，因此失敗不留下部分生效的還原。
- 整體還原不加入一般 Undo／Redo；歷史與備份一致。revision 保持單調，避免重新還原造成跨分頁版本及 redo 排序衝突。下載提示僅說「已觸發」，不宣稱裝置已存檔。


### 輸入盤點與相容性

共用規則位於 `assets/validation.mjs`，HEX 由 appearance-core 的同份正規化規則提供。輸入提示及保存服務均檢查；文字以 Unicode code point 計數，emoji的代理對算1字、組合／ZWJ emoji可能多字。組字中不攔截、不截斷，compositionend及保存再驗證。文字輸出使用 textContent。

| 用途 | 寫入規則 |
| --- | --- |
| 稱呼／一句話／簡介／禁忌 | 30／100／2,000／2,000字，可留白，繁中、標點及emoji皆可 |
| 年齡 | 沿用非負安全整數或留白（0至9,007,199,254,740,991）；既有規則未設生理年齡上限，本次不新增玩法或人口假設 |
| 性別 | 原有男／女／留白選項；未修改舊欄位保留 |
| 等級／內部總經驗／貨幣／能力 | 既有等級≥1、內部總經驗≥100（顯示扣100）、貨幣及能力≥0，皆安全整數；能力差額及等級換算保留既有BigInt溢位保護 |
| HEX | #加六位十六進位；無效輸入提示且不能保存 |
| 歷史跳頁 | 1至實際總頁數的安全整數 |
| 待辦／打卡 | boolean，首頁示意文字非可編輯輸入 |
| 裁切縮放 | 有限數字、1至目前裁切器允許上限（通常4，既有裁切可保留更大倍率）；沿用圖片邊界約束 |
| 圖片檔 | JPEG／PNG／WebP，原始20MB上限；立繪處理後1MiB、頭像上傳處理400KiB／最終裁切200KiB；既有解碼／縮放限制保留 |
| 備份及還原 | 新密碼與舊密碼規則如上；檔案150MiB、圖片總量100MiB／2,000張、文件10MiB、結構深度<40 |

已存在的超長文字在讀取、遷移、備份及還原時完整保留；修改其他欄位不強迫截短。只有實際更改該超長欄位才須符合新上限。匯入以相同結構、數值、資源限制驗證及舊文字相容模式處理，不靜默刪除。永久刪圖、整體還原、備份與授權仍不納入一般 Undo／Redo。


## AI 連線（BYOK）

第五分類沿用定位與外觀，含兩種互斥模式。開發用「瀏覽器直連測試模式」預設關閉，確認風險後可在後端／登入未設定時輸入金鑰；一組測試連線僅存 `life-system.ai-test.v1` sessionStorage，不自動到期，跨同分頁HTML／重載可恢復，換商清 key/model、關閉／中斷清除entry。sessionStorage 不是加密保管庫；不跨分頁廣播，不以關閉分頁當唯一保證。

正式模式仍以頁內記憶體與受驗證後端轉送，目前未部署；只有其 settings.ai 的 provider/model 非敏感偏好可進一般資料。測試 session、key、token 或連線狀態不進一般設定／歷史／Undo／Redo／備份，既有備份相容與白名單保留。沒有後端資源或登入建立，也未重設數值或清理資料。

設定、首頁與我的資料共用恢復／生成／取消服務，獨立測試入口只傳明確輸入的短文字；夥伴仍為 mock。官方支援、CORS 未確認限制及 mock／真實驗收界線見 [AI_CONNECTION.md](AI_CONNECTION.md)。

## Google Cloud Console（需管理者手動完成）

`assets/google-config.mjs` 已設定使用者提供的公開 OAuth Client ID。本機功能不等待 Google 或網路；未建立任何 Cloudflare 或付費資源。

1. 選用／建立 Google Cloud 專案，啟用 Google Drive API；開發與正式環境分開設定。
2. 設定 Google Auth Platform Branding、Audience、Data Access：名稱、支援聯絡資訊、網站首頁與隱私權政策。Testing 狀態加入實際測試帳號。
3. 建立 OAuth **Web application** client。若沿用目前 GitHub Pages 網址，網站為 `https://harriet-pixel.github.io/life-system/`；Authorized JavaScript origin 填 `https://harriet-pixel.github.io`（不含路徑）。正式改用其他網址時填其實際 HTTPS origin。開發專案可另允許 `http://localhost:3000`、`http://127.0.0.1:3000`，不要混入正式 client。
4. 僅選 `https://www.googleapis.com/auth/drive.appdata`，不選整個 Drive 的 scope。GIS token popup 模式不需要本站後端 callback、client secret、refresh token 或服務帳戶金鑰。
5. 建置時提供公開環境變數 `GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com npm run build`，發布 `work/build/`；若直接發布原始靜態檔，僅填入 `assets/google-config.mjs` 的公開 client ID。不要提交任何 client secret。
6. 這個 scope 官方列為 non-sensitive，通常不因 scope 本身要求敏感／限制範圍驗證；公開 External／Published 的品牌資訊、名稱或 logo 仍須依 Google 當時規範完成品牌／網域驗證。個人、Internal、Testing 的例外依 Console 實際資格處理，不保證公開發布免驗證；確認有權驗證網站所用網域，並提供正式隱私權政策。
7. 只有點擊連接才載入 GIS／要求授權（初次載入後可能需再點一次以符合 popup user gesture）；短期 token 存專用 sessionStorage（最長一小時並提前一分鐘失效），重整可恢復，過期須手動重新連接。直連 Google API，不經開發者伺服器；每次資料操作上傳新備份，自動與手動備份共保留最近20筆。
8. `appDataFolder` 是專用隱藏空間，非使用者 Drive UI 可直接瀏覽的備份資料夾；隱藏不等於加密。中斷本頁連接／撤銷授權不會刪除備份。

實作前查閱的 Google 官方文件（2026-10-22）：
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/drive/api/guides/appdata
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
- https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance


## 驗證與維護

lint、build、單元與瀏覽器命令見README.md。瀏覽器腳本涵蓋三頁、跨分頁、Undo／Redo、裁切／最愛、還原及外觀；Google為mock，真實授權仍須Console設定及正式來源實測。字型來源與SIL OFL授權保存於各字型目錄。

[DATA_AUDIT.md](DATA_AUDIT.md)說明資料遷移何時寫回、相容用途及整理結果，不能據此宣稱已檢查使用者裝置。舊資料／備份相容與一次性數值遷移仍保留；不藉整理重跑數值重設、不清空儲存、不自動刪圖。

## 設定分類與跨頁草稿

上層為「一般設定」（預設：外觀、AI、Google Drive）及「資料管理」（本機備份、儲存、歷史），內層可獨立展開／收合，不再使用五個分類頁籤。原控制項不重建，資料與歷史分頁不改。舊 fragment／tab query 會對應到新分類及區塊。

站內切換由共用外框保留最多三份頁面 DOM，非目前頁面離開 document 並暫停事件／訂閱／量測；草稿與其原鎖保留。尚未儲存的資料／外觀仍可能阻擋維護，需要先返回該頁儲存或取消；不偷偷丟棄。真正重載／外部離開才依未保存輸入提示。

AI runtime 同文件常駐，分類、收合及切頁不重建連線、不延長 key 期限或重送生成；離開處理中的頁面取消並失效舊結果。瀏覽器直連保留，Cloudflare 部署暫停。


## Google自動備份（取代跨裝置同步）

連接Google後，成功資料交易（含Undo／Redo）依序上傳未加密快照；純點擊、切頁與歷史清理不備份。同來源其他分頁刷新不重複上傳。最多20份待處理快照，Drive應用備份亦保留最新20筆。離線、草稿或錯誤保留本機及待備份狀態，恢復連線／關閉草稿／手動重試可繼續；關閉文件不保證記憶體佇列全部上傳，重新連接會備份目前資料。

不再有同步輪詢、基準、密碼解鎖、版本圖、衝突合併或背景下載／自動套用。舊同步檔留在Drive，不主動刪；舊加密手動備份仍能下載並用原密碼由本機流程還原。新雲端備份不加密，需理解持有檔案者可讀取內容。認證／AI密鑰不納入備份。

導覽Undo旁改為最新雲端還原；Redo僅在設定歷史。點雲端驗證與還原（或未選本機檔時直接點驗證與還原）選擇真正時間最新的備份，驗證所有資料及圖片，與本機比較。不同時再次確認；確認期間本機或雲端最新版本改變即停止，失敗不清空資料。還原不屬一般Undo／Redo。GoogleAPI為mock驗證，真實授權與裝置仍須另驗收。

## 目前連線版面

AI與Google Drive區塊初次進入預設展開，Google連接、手動雲端備份、清單及授權整組位於一般設定AI下方；共用原連線與備份服務。AI頂部保留單一固定高度通知，新訊息直接取代，移除重複警語及收合狀態摘要。API金鑰／模型標籤與自適應欄位同排；模型診斷不收合，計數在模型列下方以小字呈現。連接AI／重新整理／中斷連線同排等寬，測試連線／短文字測試同排等寬；短文字測試移至保留草稿的原生視窗。僅改呈現，金鑰仍沿既有session與清除規則，不進一般資料、歷史或備份。
