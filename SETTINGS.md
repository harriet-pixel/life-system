# 設定頁整合

`settings.html` 沿用既有原生 HTML/CSS/ES modules、1024px 導覽斷點、我的資料頁籤樣式及 `tab-position.mjs` 手機定位。未另建網站、帳號系統或伺服器。來源為 `codex/homepage-preview`（5313d04）。

## 資料及歷史

- 唯一持久資料來源仍為 `life-system.data.v1`，設定位於 `settings`；圖片仍在既有 `life-system.images.v1/images`。
- `data.mjs` 維持同份原子文件與 before/after journal，新增設定欄位及跨分頁寫入鎖。首頁待辦／習慣、個人資料、數值、立繪、頭像、收藏與裁切保存，以及外觀與歷史設定，都使用同一份 Undo／Redo。
- 所有持久資料變更會丟棄 Redo 分支；Undo／Redo 直接重播快照，不重複記錄。仍保留最近 50 筆。來源版本沒有歷史設定選項，因此保留原預設，新增共用「記錄所有動作」開關；關閉後，新的一般資料變更不記錄，設定變更仍記錄。舊紀錄保留；若資料已衝突則安全拒絕撤銷。
- 圖片永久清理、整體還原、下載、雲端上傳、授權及純介面操作不加入一般 Undo／Redo。未儲存草稿不是持久化歷史。未開放模組（角色服務、正式任務等）不宣稱已支援。
- 「我的夥伴」及正式角色資料源尚未實作；既有使用者立繪／頭像、我的最愛及歷史引用均已保護。未來圖片來源可向 `registerImageReferenceSource` 註冊；持久文件任何巢狀 `asset:` 引用都會納入。

## 同步與外觀

- 外觀寫入一次設定交易，所有頁面訂閱同份 store；其他分頁透過 storage event 更新。同步範圍是同來源、同瀏覽器的已保存資料，不是雲端同步。
- `appearance-core.js` 在 head 同步讀取同份文件，盡早套用 CSS 變數；沒有第二份外觀快取。預覽僅作用於預覽區，保存前不寫入資料或歷史。
- `--color-accent` 保留使用者選色；`--color-primary` 為衍生的可讀控制項／文字用色。表面文字依亮度選黑／白，文字對比至少 4.5:1；focus、hover 與淡色背景集中管理。錯誤等語意色不變。
- 裝置字體：system-ui、-apple-system、Segoe UI、sans-serif。
- 明體：既有 Noto Serif TC Variable 5.3.1；黑體：Noto Sans TC Variable 5.3.1；圓體：Huninn 5.3.1。來源皆為 Fontsource npm 套件（上游 Noto／justfont Huninn），SIL OFL 1.1。各目錄保存 LICENSE、SOURCE.md 與已驗證的封裝 SHA-512。
- 皆自託管 WOFF2、font-display:swap；選到字型才建立對應 stylesheet，unicode-range 依字元載入。fallback 為 Noto／系統 sans 或 serif；未涵蓋的罕見字與載入失敗仍回退，不保證每個系統都具備所有 Unicode 字形。

## 圖片安全與鎖

- 固定 ID 為 `asset:` + 圖片 SHA-256；保留原有 ID、Blob、資料與引用。新圖片才補建立時間，舊資料不捏造檔名或時間。
- 取消自動 GC。`image-references.mjs` 集中掃描已保存文件、所有歷史 before/after（含 Undo/Redo）及註冊來源，圖片檔缺失、未知引用、來源失敗時停止。
- 儲存管理只計算 Blob.size，不宣稱是全站磁碟容量。原有 staged asset 保護期限仍生效（不是自動刪除期限）。
- `coordination.mjs` 用 origin-wide Web Locks：寫入共用 exclusive lock；個人資料編輯（含所有圖片／裁切）及未保存外觀各持 shared draft lock。清理、備份、還原必須取得所有 draft exclusive locks 與 write exclusive lock。
- 有草稿時具體指出「我的資料 → 使用者設定」或「設定 → 外觀設定」，要求先儲存或取消。鎖由瀏覽器管理，分頁關閉或程序退出會釋放，不使用永久 localStorage 鎖。瀏覽器不支援 Web Locks 時安全停止維護操作。
- 刪除在確認後重新 refresh／掃描，持有寫入鎖到 IndexedDB transaction 完成，僅刪仍未使用的選取項目；新引用或暫時保護的圖片跳過。
- 此協調適用載入這版共用服務的頁面；部署更新後請重新載入先前開啟的舊版頁面。舊版程式無法被新版遠端強制升級，亦不能宣稱能協調任意第三方或 DevTools 直接寫入儲存的程式。
- 清理縮圖 URL 在切換頁籤、重載清單、pagehide 時釋放；共用圖片 URL 在刪除或 pagehide 釋放。bfcache 返回時 refresh 重新解析圖片，不刪圖片 Blob。

## 備份與原子還原

- `backup.mjs` 的同一版本化格式同時用於本機與 Google。包含資料、設定、收藏、完整保留歷史與其 before/after、所有被引用的實際圖片；不含未使用圖片、草稿、認證 token、密碼或金鑰。草稿存在即停止，不靜默略過。
- manifest 有格式／資料版本、建立時間、可解釋的資料筆數（profile、stats、settings 各一筆，加收藏、活動、歷史數）、圖片數；每張圖含大小、MIME、ID、SHA-256 及實際 bytes。未加密檔另有 payload SHA-256；SHA-256 是完整性檢查，不是來源簽章。
- 選用加密：Web Crypto AES-256-GCM，PBKDF2-SHA256 600,000 iterations，隨機 16-byte salt、12-byte nonce；Google 一律先在瀏覽器加密。密碼與解密金鑰只在操作記憶體，不保存、不上傳。相同密碼各次備份使用新 salt/nonce。
- 單一 JSON 檔，不解壓／不執行任何內容；單檔 150 MiB、文件 10 MiB、圖片解碼總量 100 MiB、最多 2,000 張、巢狀深度限制。驗證格式、版本、結構、圖片雜湊與 MIME、引用完整性，瀏覽器另驗證圖像可解碼。
- 寫入前完整驗證，顯示時間／筆數／張數，使用者明確確認完整取代；可先下載目前備份。確認期間資料改變則拒絕，避免覆蓋新資料。
- 還原先以內容雜湊 ID 暫存圖片，再用一次 localStorage 原子寫入發布新文件。寫入失敗，原文件及原圖片保留；暫存成功但發布失敗的額外圖片可能留為未引用資產，由使用者之後手動清理。從不先清空資料、不刪原圖，因此失敗不留下部分生效的還原。
- 整體還原不加入一般 Undo／Redo；歷史與備份一致。revision 保持單調，避免重新還原造成跨分頁版本及 redo 排序衝突。下載提示僅說「已觸發」，不宣稱裝置已存檔。

## Google Cloud Console（需管理者手動完成）

目前 `assets/google-config.mjs` 的 client ID 留空；本機功能不受影響，雲端按鈕顯示未設定。未建立任何付費資源。

1. 選用／建立 Google Cloud 專案，啟用 Google Drive API；開發與正式環境分開設定。
2. 設定 Google Auth Platform Branding、Audience、Data Access：名稱、支援聯絡資訊、網站首頁與隱私權政策。Testing 狀態加入實際測試帳號。
3. 建立 OAuth **Web application** client。若沿用目前 GitHub Pages 網址，網站為 `https://harriet-pixel.github.io/life-system/`；Authorized JavaScript origin 填 `https://harriet-pixel.github.io`（不含路徑）。正式改用其他網址時填其實際 HTTPS origin。開發專案可另允許 `http://localhost:3000`、`http://127.0.0.1:3000`，不要混入正式 client。
4. 僅選 `https://www.googleapis.com/auth/drive.appdata`，不選整個 Drive 的 scope。GIS token popup 模式不需要本站後端 callback、client secret、refresh token 或服務帳戶金鑰。
5. 建置時提供公開環境變數 `GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com npm run build`，發布 `work/build/`；若直接發布原始靜態檔，僅填入 `assets/google-config.mjs` 的公開 client ID。不要提交任何 client secret。
6. 這個 scope 官方列為 non-sensitive，通常不因 scope 本身要求敏感／限制範圍驗證；公開 External／Published 的品牌資訊、名稱或 logo 仍須依 Google 當時規範完成品牌／網域驗證。個人、Internal、Testing 的例外依 Console 實際資格處理，不保證公開發布免驗證；確認有權驗證網站所用網域，並提供正式隱私權政策。
7. 只有點擊連接才載入 GIS／要求授權（初次載入後可能需再點一次以符合 popup user gesture）；token 僅在模組記憶體，過期須手動重新連接。直連 Google API，不經開發者伺服器；每次上傳建立新檔案，沒有自動刪除。
8. `appDataFolder` 是專用隱藏空間，非使用者 Drive UI 可直接瀏覽的備份資料夾；隱藏不等於加密。中斷本頁連接／撤銷授權不會刪除備份。

實作前查閱的 Google 官方文件（2026-10-22）：
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/drive/api/guides/appdata
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
- https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance

## 驗證指令

- `npm run lint`：原生 JS 語法、HTML 重複 ID、entry 本機資產檢查（沒有加入 ESLint／框架）。
- `npm run build`：拷貝可發布的三頁與 assets 至 `work/build`；不包含測試、草稿、Git 或認證。
- `npm test`：資料／Undo／Redo、備份格式／加密／失敗、引用與對比、夥伴回應單元測試。
- 在本機靜態伺服器啟動後：`npm run test:browser`、`node tests/home-summary.cjs`。Playwright 及 Chromium 僅為驗證工具，不是網站執行依賴。
- Google 真實授權與雲端往返須在 Console 設定及正式來源就緒後再驗；mock 不能替代真實 Google 驗證。

### 交付驗證補充

- `tests/profile-images.cjs` 額外驗證真實上傳、立繪裁切、自動頭像、收藏刪除／Undo、重開圖片，以及 data URL 遷移與 Object URL 釋放；圖片 Blob 保留。
- 以 FontTools 解析實際 WOFF2 的 family 與 cmap（不是只看副檔名）：明體 family 為 Noto Serif TC ExtraLight（variable 基礎名稱）、黑體為 Noto Sans TC Thin（variable 基礎名稱）、圓體為 Huninn。三者均涵蓋「繁體中文臺灣設定歷史紀錄儲存空間備份還原頭像立繪收藏」測試字串。
- Git 連線原因及修復方式見 `NETWORK_DIAGNOSIS.md`。

### 與既有發布版的數值規則整合

為保留 gh-pages 已發布的 Lv1／經驗值修正，現在備份 `dataVersion=2`、文件包含 `statsRulesVersion=2`。使用現行規則的資料、設定與歷史保持不變。資料版本不相符的舊備份在驗證階段拒絕；不在還原時重新計算數值或清除歷史。舊數值規則的一次性重新開始是原已發布行為，僅在明確舊規則資料升級時執行，並保留使用者文字、圖片、收藏、活動與外觀設定；現行v2不重複執行。

## 2026-10-22 介面及資料規則更新（取代上方相衝突內容）

- 個人資料主畫面不顯示年齡，表單、資料與備份仍保留。個人頁只呈現能力值，歷史清單及設定統一移到設定頁。
- 立繪／頭像的上傳、裁切及保存不再新增或改寫最愛。使用「添加到最愛」或最愛內明確的新增／更換／刪除才修改最愛草稿；最多6張、重複內容雜湊不占位、不自動覆蓋。全部隨使用者設定一次保存／取消；既有最愛不刪除，繼續使用原 journal、圖片引用及備份。
- 能力定義已完整存在於 abilities.mjs（體魄、智慧、魅力、韌性、感知）。最新 main 及本機執行均能繪圖；「尚未定義」是 HTML 預設可見的舊佔位，原條件只檢查陣列長度，須等 JS 成功執行才隱藏，不能據此認定缺少定義。現在初始不顯示該舊文案，依實際定義、ID、名稱及數值檢查；雷達圖使用較大彈性容器。公開網站的先前實際執行問題仍須以可存取網站的瀏覽器確認。
- 「記錄操作歷史」排除歷史偏好自身、純瀏覽、分頁及視窗操作。關閉後一般資料變更不新增紀錄；外觀確認保存仍依需求一次記錄。歷史偏好保存／跨分頁同步，但不形成一般 Undo 項目，也不切斷 Redo；外觀 Undo／Redo 只重播外觀，不覆蓋現行歷史偏好。保留50筆及原先歷史，後續未記錄資料與舊快照衝突時拒絕覆蓋。
- 本機下載密碼留白不加密；新密碼採8–64個 ASCII 可列印字元（英文、數字、符號，可含空格），不 trim 或截斷，非法密碼停止下載。Google上傳另開密碼視窗，強制相同規則及加密。OAuth未設定狀態不變。
- 還原先做受限外層解析；開啟還原視窗後，僅加密檔顯示獨立還原密碼。舊格式 v1／資料 v2 的原有密碼允許 Unicode、短密碼及最多1,024個 UTF-16 碼元；不套新備份密碼規則。仍拒絕不支援的格式／數值規則版本，不擅自重新計算舊玩法資料。未加密完整性SHA-256及加密AES-GCM驗證均保留。完整驗證摘要前不能確認；確認期間版本、鎖與原子發布保護不變。取消、關閉、完成及頁面隱藏清除操作密碼／還原暫存。已移除還原視窗內重複的安全備份下載區，保留一般本機下載。
- 外觀只保留預覽、儲存與取消變更，取消回到最近保存值。預設色票移除金色，但已保存／自訂該色不重設。預覽區明確使用局部字型變數，避免繼承已計算的全站字型；按需載入及錯誤備援不阻擋操作。

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
| 待辦／打卡／歷史開關 | boolean，首頁示意文字非可編輯輸入 |
| 裁切縮放 | 有限數字、1至目前裁切器允許上限（通常4，既有裁切可保留更大倍率）；沿用圖片邊界約束 |
| 圖片檔 | JPEG／PNG／WebP，原始20MB上限；立繪處理後1MiB、頭像上傳處理400KiB／最終裁切200KiB；既有解碼／縮放限制保留 |
| 備份及還原 | 新密碼與舊密碼規則如上；檔案150MiB、圖片總量100MiB／2,000張、文件10MiB、結構深度<40 |

已存在的超長文字在讀取、遷移、備份及還原時完整保留；修改其他欄位不強迫截短。只有實際更改該超長欄位才須符合新上限。匯入以相同結構、數值、資源限制驗證及舊文字相容模式處理，不靜默刪除。永久刪圖、整體還原、備份與授權仍不納入一般 Undo／Redo。

驗證：`npm run lint`、`npm run build`、`npm test` 通過，展開共32項單元測試。以work/build子路徑執行home、navigation、home-summary、profile-images、settings、revisions與google-drive瀏覽器測試；Google為mock，未設定真實OAuth。對話框縮短viewport模擬可用高度，不宣稱已在實體手機鍵盤測試。
