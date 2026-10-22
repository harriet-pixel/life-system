# 設定 → AI 連線（BYOK）

## 本次狀態與界線

原生 Life system 三頁的設定分類新增 AI 連線；沒有另建網站或 SPA。四個 adapter、共用前端服務與最小受保護後端原始碼已備妥，**正式後端／本站登入尚未設定**。目前發布的 `AI_BACKEND_URL` 留白、`getAIAccessToken()` 回傳 null；介面顯示「尚未設定」，停用金鑰與連線操作。現有 Google Drive token 不是本站 AI 登入，絕不拿來代用。

未建立雲端資源、帳號或付費服務，未實際呼叫四家供應商。夥伴仍使用原 mock，未接入對話、能力分類或獎勵。沒有執行使用者資料清理／數值重設；既有共用服務的載入與復原政策維持不變。

## 金鑰與資料流

使用者在本頁輸入 → input／`createAIConnection` 的單一記憶體連線 → HTTPS POST `/v1/ai`（API 金鑰在 JSON body，本站短期登入 access token 在 Authorization 標頭）→ 本站後端驗證 JWT／scope／限制 → 官方 HTTPS API（服務商規定的標頭）→ 安全縮減的 JSON 回應。

- 前端及後端都會接觸使用者金鑰。後端只在本次請求處理期間使用，不持久化、不回傳；不承諾 JavaScript 能絕對抹除記憶體。已取消請求的暫時物件須等執行環境釋放，不等於安全擦除。
- 不放 URL、localStorage、sessionStorage、IndexedDB、Cookie、BroadcastChannel、歷史、Undo／Redo、一般備份或日誌。不在背景保存其他供應商的金鑰。
- 切換服務商、變更金鑰會取消舊請求並清空模型快取；供應商切換同時清空金鑰。disconnect／pagehide 清除本頁憑證，bfcache 返回亦清除。請求捕捉自己的 provider／key／signal，舊請求及延遲登入結果不可復活連線。
- 多 HTML 頁面離開／重新整理後須重輸；沒有跨頁明文傳遞或持續連線。未來若需要跨頁免重輸，另設計驗證過的短期後端工作階段，本版未實作。
- 僅 `settings.ai = {provider, model}` 可以走共用資料服務保存。`setAIPreferences` 使用既有寫入鎖、revision，不新增歷史、不清 Redo；外觀 Undo 僅重播外觀，不恢復認證。載入舊設定補安全預設，不覆寫其他資料。AI 設定物件拒絕額外欄位；備份驗證拒絕金鑰／token／連線狀態，舊備份缺 AI 偏好仍可還原。
- 測試請求只有固定的 `Reply only with OK.` 及 64 output-token 上限；可能產生少量帳戶費用，不傳 profile、禁忌、歷史、照片、備份或行動成果。一般生成介面只接受呼叫者明確傳入的文字，沒有預設使用者資料注入。

## 共用服務

`assets/ai-service.mjs`：`createAIConnection({endpoint,getAccessToken,preference,savePreference})`，提供 `setProvider`、`setKey`、`connect`／`refresh`、`selectModel`、`test`、`generate({text,maxOutputTokens})`、`disconnect`、`getState`／`subscribe`。公開 state 不含金鑰或登入 token。預設前端 25 秒逾時；無自動重試。模型清單僅記憶體保存並含取得時間；失敗不展示舊清單，已保存 ID 不在新清單則清除選取並提示，不偷偷換模型。

`assets/ai-settings.mjs` 綁定既有設定分類、四種字型及主題；不在資料訂閱、AI 狀態更新、儲存、Undo／Redo 時呼叫捲動。原設定選取／重複點擊／450px 規則保留，鍵盤以實際分類數計算。輸出只透過文字／Option API，不使用 innerHTML。

## 官方模型 API 與能力界線

所有可用清單必須由**當次使用者金鑰**向官方列舉取得，不能用相容規則檔當清單。`backend/capabilities.mjs` 是可維護的精確 ID 相容規則，僅用於與動態清單交集，不是 fallback；新／不明模型預設排除，不以字首推測。未知用途排除意味著可能看不到目前已發布的新文字模型，需先核對官方文件再更新規則。

| Provider | 列舉／分頁 | 文字呼叫／篩選 |
| --- | --- | --- |
| Gemini | GET `generativelanguage.googleapis.com/v1beta/models`，pageSize=100、pageToken／nextPageToken | `supportedGenerationMethods` 包含 generateContent（亦兼容 SDK 的 supportedActions）且精確已知文字 ID；排除 embedding、未知及圖片專用變體。POST `/v1beta/{官方 resource name}:generateContent`，金鑰僅 x-goog-api-key 標頭 |
| DeepSeek | GET `api.deepseek.com/models`；目前常見格式為 data 清單，若回 has_more／last_id 則接續 after | 僅官方 API 清單內、精確對應已知 chat/reasoner 的 ID；POST `/chat/completions`。官方列舉不提供充分用途 metadata，未知 ID 不開放 |
| OpenAI | GET `api.openai.com/v1/models`；官方 SDK 說明目前不真正分頁，仍處理 has_more／last_id 的後續格式 | 清單只含 ID、owner 等不足以判斷用途；以精確文字相容對應規則篩選，排除未確認、圖片、語音、embedding、moderation。POST `/v1/responses`，store:false |
| Claude | GET `api.anthropic.com/v1/models`，limit=100、after_id／last_id／has_more | 官方 Messages 模型目錄中 type=model，若有 lifecycle 則僅 active；不從名稱推測 line／能力。POST `/v1/messages`、anthropic-version:2023-06-01 |

- 20 頁／2,000 個模型為硬上限，循環游標、異常格式或超限整筆失敗，不以截斷或過期清單偽裝完整結果。保留 API ID，顯示名稱只是文字。
- 列舉不是生成授權或餘額保證；不逐一生成測試，也不保證所有列出項目一定能呼叫。各家組織權限、地區、quota、模型 lifecycle 及輸出限制會影響結果。
- 模型不存在／退役／明確 model access denied：移除目前選項、清選取、重新取得清單，直到本次連線重新建立前不讓同一失效項目復活。一般權限錯誤不推論所有模型已下架。限流、額度、網路、逾時及服務故障分開提示，不把它們當永久失效。
- 最小測試的 reasoning 模型可能耗完 output budget 而沒有可見文字；回報空文字，不能宣稱成功，也不自動追加可能計費請求。

### 文件查閱紀錄（2026-10-23）

已嘗試查閱以下官方最新文件網站，但本環境 HTTPS 代理皆回 403，**未聲稱完整核對最新文件或真實 API**：

- https://ai.google.dev/api/models
- https://api-docs.deepseek.com/api/list-models
- https://developers.openai.com/api/reference/resources/models/methods/list
- https://platform.claude.com/docs/en/api/models/list

實際可讀、已查閱的官方來源（GitHub 官方 repositories，當時預設分支內容）：

- Google `googleapis/js-genai`：src/models.ts、src/types.ts（Model／supportedActions）、README.md：https://github.com/googleapis/js-genai
- OpenAI `openai/openai-node`：src/resources/models.ts（目前無真正分頁、ID／owner）、src/resources/shared.ts（文字模型型別）：https://github.com/openai/openai-node
- Anthropic `anthropics/anthropic-sdk-typescript`：src/resources/models.ts（分頁、lifecycle、Messages 模型目錄）、src/resources/messages/messages.ts：https://github.com/anthropics/anthropic-sdk-typescript
- DeepSeek 官方 DeepSeek-V3 README 的 API 使用說明，以及 awesome-deepseek-integration：https://github.com/deepseek-ai/DeepSeek-V3 、https://github.com/deepseek-ai/awesome-deepseek-integration

DeepSeek 列舉文件未能直接取得；其 list 格式及其他 adapter 都只經 mock，正式部署前需在可讀官方文件的環境再次核對 endpoint、能力規則與權限。這是待驗證項目，不以第三方鏡像假裝最新官方文件。

## 後端部署與身分驗證（管理者待設定）

需確認：後端平台／HTTPS 網址、本站登入 IdP、issuer／audience／JWKS、授權範圍及允許使用的使用者／群組、固定出口和日誌政策。以下程式不會自動建立資源。

1. 在支援 Node 22+ 的受控主機執行 `node backend/server.mjs`，預設只綁 127.0.0.1:8787。以 HTTPS reverse proxy 對外提供 `/v1/ai`；範例見 backend/.env.example。未提供必要設定時不開 listener。
2. 使用實際 IdP 簽發的短期 **RS256 access token**（不是 ID token、Drive token、固定前端秘密或使用者自述 ID）。後端固定設定 issuer／audience／HTTPS JWKS，驗證簽章、kid、exp、nbf、iat、最長 1 小時 lifetime，以及 `life:ai` scope 授權。issuer 應只向允許的本站使用者／群組核發此 scope。拒絕 token 自帶 jku／jwk／x5u、錯誤演算法與不相符授權。
3. `AI_ALLOWED_ORIGINS` 只填實際 HTTPS origin，無萬用字元；Origin／Referer **不是認證**。前端以 Authorization 傳登入 token，不使用 Cookie credentials。CORS 只准 POST 及指定標頭；OPTIONS 不觸及 AI。
4. 直接 TLS socket 或明確 `AI_TRUSTED_PROXY_IPS` 的 HTTPS 轉送才接受。proxy 必須覆寫 X-Forwarded-Proto、不能把 client 同名標頭照傳；防火牆不可讓外部直連 Node listener。勿任意信任所有 forwarded headers。
5. 所有 provider 目的地由程式固定，只支援 models／test／generate，redirect:error；不接受 base URL／任意代理地址。限制每人 10 次／分鐘、同時 2 次、最多 10,000 活躍 identity entries；輸入 body 12 KiB、key 4,096 ASCII 字元、文字 4,000 字元、output 1–256 tokens（測試 64）、供應商單次回應 1 MiB、整次處理 20 秒；body 等待最多 10 秒。無重試。
6. 限流／併發目前為單一 Node process 的記憶體。**正式不可直接多 instance／多 worker 使用此限制**；選平台後以共享的原子 rate/concurrency store 實作並壓測，或確實限制單 process。邊緣 proxy 額外設 body／headers／連線／DoS 限制。
7. 程式不記 request／header／body／供應商原始 error；前端僅接受安全 code。回應 Cache-Control:no-store、拒絕原始例外；登入與供應商憑證不進 URL。部署前同時關閉 proxy／平台／APM 的 body/header capture、debug traces、分析及失敗請求樣本，不能只靠這份程式保證外部平台不記錄。驗收後才對外開放。
8. 管理者把**公開** AI_BACKEND_URL（完整 HTTPS `/v1/ai`）交給 build，並實作 `assets/ai-auth.mjs` 的 `getAIAccessToken` 去取本站已登入使用者的記憶體短期 access token；不要在此檔寫固定 token、client secret 或 provider key。登入互動／refresh token 策略尚未選定，未暗中實作。
9. `AI_BACKEND_URL=https://backend.example.invalid/v1/ai npm run build` 只替換公開 endpoint。後端原始碼、env、JWKS、issuer 設定均不複製至 work/build。正式發布仍保持空 endpoint，直到登入、部署與真實驗收完成。

## 測試

- `npm run lint`：原前端語法、HTML／入口及後端語法檢查。
- `npm test`：既有測試加四家不同格式／完整分頁／用途篩選、產生請求格式、錯誤／大小／迴圈、JWT 簽章授權、HTTPS／CORS／未登入／目的地／限流／併發／逾時、前端舊結果與延遲登入競態、模型失效／暫時故障、偏好與舊備份隔離。
- `BASE_URL=http://127.0.0.1:3013/ node tests/ai-settings.cjs`：32 組字型／尺寸、200% 文字、鍵盤、未設定；受控 mock backend/config/login 測試連接、顯隱、清除、換商競態、測試費用提示、文字 XSS、備份／storage／console 無憑證、離頁／重載與非同步不搶捲動。
- `BASE_URL=http://127.0.0.1:3013/ node tests/settings-tabs.cjs`：原分類與新增後鍵盤、定位回歸。
- `node tests/ai-cache.cjs`：從修改前 main 24d7bdf9b602 的實際檔案暖快取升級，驗證偏好保存、原有資料與 Undo 共用同一 store，不需清除儲存。
- `node tests/settings-cache.cjs`：建置暖快取、歷史 DOM／模組相容；更新的共用模組依賴 URL 一致，避免雙 store 與新舊設定混用。
- 真實四家查詢／生成、實際 IdP、HTTPS／proxy 日誌及分散式部署：**未驗證**，需要上述部署設定與使用者自行在安全介面輸入金鑰。勿將金鑰貼到聊天、GitHub、issue 或提交。
