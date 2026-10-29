# AI 連線

2026-10-28：依使用者決定，瀏覽器 AI 連接預設開啟，移除各頁開發用跨頁／短文字測試面板及模式確認開關。Cloudflare 維持暫停，後端原碼與獨立認證保留，不部署。

## 瀏覽器保存與連接

設定提供 Gemini、DeepSeek、OpenAI、Claude 官方 HTTPS API，仍沿同一 ai-runtime／client／service／providers；不新增代理或第二套連線。輸入金鑰後可連接、查詢、選擇模型，保留固定短文的「測試連線」；沒有自動生成、逐個測試模型或失敗重試。

一組 provider/key/model 存在專用 localStorage `life-system.ai-test.v1`，保留既有schema與鍵名以相容舊設定；不是一般生活文件。金鑰不自動到期，關閉瀏覽器後保留，直到手動中斷清除金鑰／模型或換服務商。中斷後保留空的預設啟用設定以便重新輸入。有效舊sessionStorage設定只在沒有持久設定時遷移，成功保存後移除舊分頁副本；不復活過期v1或無效紀錄。

首次開站／重整有已保存金鑰時，自動重新取得有效模型清單並恢復已選模型；未設定金鑰不請求API。同文件切頁沿同一連線，不重查或生成。storage事件使其他同來源分頁取消舊連線並載入新設定，不因每次輸入字元自動發送模型查詢；正式使用時再經原驗證流程連接。pagehide取消在途請求，保留持久設定。

金鑰固定password、失焦／連接／切頁清空DOM，不回填或提供檢視按鈕。localStorage不是加密保管庫，同來源程式、擴充功能或開發工具仍可讀；設定頁直接說明此保存方式。勿將金鑰提交到聊天、Git或日誌。

專用AI設定不進 `life-system.data.v1`、IndexedDB、history、Undo／Redo、備份、URL或console。正常雲端／本機備份只讀正式文件白名單，沿原保護；Google及未部署後端認證仍用原sessionStorage，未改成持久登入。儲存失敗安全停用，不把密鑰改存一般資料或其他位置。

## 共用程式

ai-session維持固定schema驗證；ai-runtime決定持久儲存、遷移及跨分頁生命週期；ai-client統一取消與恢復；ai-service負責模型、生成、時間上限、安全錯誤及競態。設定頁移除模式開關與短文字視窗，保留服務商／金鑰／連接／重新整理／中斷／模型／測試連線。ai-page與ai-test-panel已無依賴並移除。

## 全站共用語言規則

`assets/ai-prompts.mjs` 統一提供繁體中文及臺灣常用詞彙規則，由共用 AI service 組裝提示，adapter 在伺服器端也套同一份規則，防止繞過前端。Gemini systemInstruction、OpenAI instructions、Claude／DeepSeek Messages 的 system、DeepSeek Chat 的 system message 均使用同一規則。角色設定不得覆蓋；結構化欄位／固定代碼／數字契約，以及程式碼、URL、模型 ID、必要專有名詞與明確保留原文均豁免。使用者文字保持原樣，不做資料翻譯或保存改寫。

目前涵蓋真實 service 的測試區及未來接入的分析／分點說明／角色對話；未規劃功能仍不新增，首頁 mock 不因語言規則而接入真實生成。mock 測試證明請求正確附帶規則，不代表每個模型真實輸出必然遵循。

## 官方瀏覽器支援與限制（2026-10-23 查核）

| 服務商 | 查核及實作 | 驗收界線 |
| --- | --- | --- |
| Gemini | Google js-genai README 的 Browser 章節明確支援、並警告生產環境避免暴露 key；本實作以 x-goog-api-key 標頭直接呼叫官方 REST | 已實作，仍需使用者以真實帳戶／地區驗收 |
| OpenAI／GPT | 官方 openai-node README：瀏覽器預設禁用，需 dangerouslyAllowBrowser:true 明確承擔風險。本專案不用 SDK、只在同意測試模式後直接呼叫官方 REST | 已實作；沒有全域放寬正式模式或嵌入共用 key |
| Claude | 官方 SDK README／src/client.ts：瀏覽器需 dangerouslyAllowBrowser:true；對應 `anthropic-dangerous-direct-browser-access: true`。僅瀏覽器測試 transport 加此標頭，原正式 backend 不加 | 已實作；仍依官方 CORS、帳戶權限及所在地政策 |
| DeepSeek | 已核對官方 harness／provider metadata；使用者已回報直連連線成功，仍不足以證明所有生成與跨頁情境 | 其他情境仍待驗證。若實際回應不允許 Origin／認證標頭，需服務商允許或未來正式後端；不以公共代理繞過 |

官方來源（實際讀取）：

- https://github.com/googleapis/js-genai/blob/main/README.md （Browser 章節）
- https://github.com/openai/openai-node/blob/master/README.md （Requirements／Web browsers）
- https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md
- https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/client.ts （dangerouslyAllowBrowser／直連標頭）

文件網站 ai.google.dev、api-docs.deepseek.com、developers.openai.com、platform.claude.com 受本執行環境代理 403 限制，不能宣稱已完整核對其最新網站或實際 CORS 回應。未攜金鑰的瀏覽器 SDK 支援聲明亦不代表所有帳戶可用。

直接使用 fetch，沒有第三方 CORS proxy、no-cors 或停用瀏覽器安全性。credentials:omit、redirect:error、referrerPolicy:no-referrer；金鑰只在服務商要求的 HTTPS 認證標頭，不放 URL 或模型提示。可取得的 HTTP 狀態依認證、權限、限流、額度與服務故障分類，即使錯誤 body 非 JSON 也使用已知 HTTP status；fetch 失敗且無 response 時明確「無法判定網路／跨來源／服務問題」，不一律說是 CORS，也不把原始敏感錯誤寫入狀態或 console。

## 官方模型 API 與能力界線

所有可用清單必須由**當次使用者金鑰**向官方列舉取得，不能用相容規則檔當清單。`assets/ai-capabilities.mjs`（後端同一份規則） 是可維護的精確 ID 相容規則，僅用於與動態清單交集，不是 fallback；新／不明模型預設排除，不以字首推測。未知用途排除意味著可能看不到目前已發布的新文字模型，需先核對官方文件再更新規則。

| Provider | 列舉／分頁 | 文字呼叫／篩選 |
| --- | --- | --- |
| Gemini | GET `generativelanguage.googleapis.com/v1beta/models`，pageSize=100、pageToken／nextPageToken | `supportedGenerationMethods` 包含 generateContent（亦兼容 SDK 的 supportedActions）且精確已知文字 ID 或有明確文字生成描述；排除 embedding、未知及圖片專用變體。POST `/v1beta/{官方 resource name}:generateContent`，金鑰僅 x-goog-api-key 標頭 |
| DeepSeek | GET `api.deepseek.com/models`；目前常見格式為 data 清單，若回 has_more／last_id 則接續 after | 優先依官方文字模態及 api_capabilities.anthropic_messages 判斷，呼叫 `/anthropic/v1/messages`；無 metadata 時僅精確官方相容 ID 走 `/chat/completions`。不再限於舊 chat/reasoner 名稱 |
| OpenAI | GET `api.openai.com/v1/models`；官方 SDK 說明目前不真正分頁，仍處理 has_more／last_id 的後續格式 | 清單只含 ID、owner 等不足以判斷用途；以精確文字相容對應規則篩選，排除未確認、圖片、語音、embedding、moderation。POST `/v1/responses`，store:false |
| Claude | GET `api.anthropic.com/v1/models`，limit=100、after_id／last_id／has_more | 官方 Messages 模型目錄中 type=model，排除 retired，deprecated 仍可列舉；不從名稱推測 line／能力。POST `/v1/messages`、anthropic-version:2023-06-01 |

- 20 頁／2,000 個模型為硬上限，循環游標、異常格式或超限整筆失敗，不以截斷或過期清單偽裝完整結果。保留 API ID，顯示名稱只是文字。
- 列舉不是生成授權或餘額保證；不逐一生成測試，也不保證所有列出項目一定能呼叫。各家組織權限、地區、quota、模型 lifecycle 及輸出限制會影響結果。
- 模型不存在／退役／明確 model access denied：移除目前選項、清選取、重新取得清單，直到本次連線重新建立前不讓同一失效項目復活。一般權限錯誤不推論所有模型已下架。限流、額度、網路、逾時及服務故障分開提示，不把它們當永久失效。
- 最小測試的 reasoning 模型可能耗完 output budget 而沒有可見文字；回報空文字，不能宣稱成功，也不自動追加可能計費請求。

介面區分「金鑰已暫存」「模型查詢成功」「模型已選取」「生成成功」。模型診斷顯示取得／保留數量及排除 ID／固定原因；官方空清單與全部被篩除分開提示，不顯示憑證或原始錯誤。

## 模型／能力資料查閱界線

模型介面原已查閱 Google js-genai src/models.ts／src/types.ts、OpenAI SDK src/resources/models.ts／shared.ts、Anthropic SDK src/resources/models.ts／messages、DeepSeek 官方 DeepSeek-V3／awesome-deepseek-integration。2026-10-23 四家更新的來源、端點、能力規則及限制見 [四家相容性查核](docs/AI_PROVIDER_AUDIT.md)。DeepSeek 優先採能力 metadata；Gemini／OpenAI 更新來源支持的文字模型規則；Claude 不再把 deprecated 一律當退役。不能用寫死清單冒充當前可用清單。直連真實 API、CORS 由使用者在網站輸入測試 key；個人後端則於 Cloudflare Secret 設定後登入驗收，測試不要求金鑰出現在聊天或 Git。

## 舊 Node BYOK 後端（保留原始碼，本次不部署）

若未來啟用正式模式才需確認：後端平台／HTTPS 網址、本站登入 IdP、issuer／audience／JWKS、授權範圍及允許使用的使用者／群組、固定出口和日誌政策。以下程式不會自動建立資源。

1. 在支援 Node 22+ 的受控主機執行 `node backend/server.mjs`，預設只綁 127.0.0.1:8787。以 HTTPS reverse proxy 對外提供 `/v1/ai`；範例見 backend/.env.example。未提供必要設定時不開 listener。
2. 使用實際 IdP 簽發的短期 **RS256 access token**（不是 ID token、Drive token、固定前端秘密或使用者自述 ID）。後端固定設定 issuer／audience／HTTPS JWKS，驗證簽章、kid、exp、nbf、iat、最長 1 小時 lifetime，以及 `life:ai` scope 授權。issuer 應只向允許的本站使用者／群組核發此 scope。拒絕 token 自帶 jku／jwk／x5u、錯誤演算法與不相符授權。
3. `AI_ALLOWED_ORIGINS` 只填實際 HTTPS origin，無萬用字元；Origin／Referer **不是認證**。前端以 Authorization 傳登入 token，不使用 Cookie credentials。CORS 只准 POST 及指定標頭；OPTIONS 不觸及 AI。
4. 直接 TLS socket 或明確 `AI_TRUSTED_PROXY_IPS` 的 HTTPS 轉送才接受。proxy 必須覆寫 X-Forwarded-Proto、不能把 client 同名標頭照傳；防火牆不可讓外部直連 Node listener。勿任意信任所有 forwarded headers。
5. 所有 provider 目的地由程式固定，只支援 models／test／generate，redirect:error；不接受 base URL／任意代理地址。限制每人 10 次／分鐘、同時 2 次、最多 10,000 活躍 identity entries；輸入 body 12 KiB、key 4,096 ASCII 字元、文字 4,000 字元、output 1–256 tokens（測試 64）、供應商單次回應 1 MiB、整次處理 20 秒；body 等待最多 10 秒。無重試。
6. 限流／併發目前為單一 Node process 的記憶體。**正式不可直接多 instance／多 worker 使用此限制**；選平台後以共享的原子 rate/concurrency store 實作並壓測，或確實限制單 process。邊緣 proxy 額外設 body／headers／連線／DoS 限制。
7. 程式不記 request／header／body／供應商原始 error；前端僅接受安全 code。回應 Cache-Control:no-store、拒絕原始例外；登入與供應商憑證不進 URL。部署前同時關閉 proxy／平台／APM 的 body/header capture、debug traces、分析及失敗請求樣本，不能只靠這份程式保證外部平台不記錄。驗收後才對外開放。
8. 管理者把**公開** AI_BACKEND_URL（完整 HTTPS `/v1/ai`）交給 build，並實作 `assets/ai-auth.mjs` 的 `getAIAccessToken` 去取本站已登入使用者的記憶體短期 access token；不要在此檔寫固定 token、client secret 或 provider key。登入互動／refresh token 策略尚未選定，未暗中實作。
9. `AI_BACKEND_URL=https://backend.example.invalid/v1/ai npm run build` 只替換公開 endpoint。後端原始碼、env、JWKS、issuer 設定均不複製至 work/build。正式 endpoint 仍保持空值，直連測試模式不受此空值或登入限制。

## 驗證與發布

- npm run lint、npm run build、npm test：既有後端模式及新增直連／session 測試，含原始期限、刷新／恢復、不延長、到期、切換、取消、舊結果、storage 失敗、官方標頭、HTTP／未知網路錯誤、模型能力篩選與分頁。
- tests/ai-browser-mode.cjs：四家 mock 官方 API；設定 → 首頁 → 我的資料 → 重新整理，確實由共用服務發出生成請求，不只測設定連線；驗證安全文字、同一期限、換商競態、關閉／清除／長期保留及舊資料遷移、一般資料及備份無金鑰。沒有真實金鑰、沒有金鑰截圖或 trace。
- tests/ai-settings.cjs：原正式模式未設定／mock backend 流程與 32 組尺寸字型、200% 文字。
- tests/settings-tabs.cjs、tests/settings.cjs、tests/ai-cache.cjs、tests/settings-cache.cjs：既有頁籤定位／鍵盤、資料與備份、Undo／Redo、暖快取回歸。新模式不在狀態更新或資料更新觸發定位。
- main 保存原始碼，gh-pages 僅 work/build 成果，保留發布歷史／設定；Worker 由使用者在控制台設定免費服務後部署，尚未部署不可宣稱完成。公開 Pages workflow 與網站可讀性須分別確認，推送不代表部署已驗證。
- 使用者已回報 DeepSeek 直連連線成功；其他真實 API、生成、跨頁及個人 Worker 部署／OAuth 仍待驗證，mock 通過不能擴大宣稱。

## 共用外框整合

設定改為「一般設定 → AI 連線」展開區塊；收合摘要區分金鑰暫存、模型取得／選取、生成成功、取消及錯誤。控制項不因收合／分類／站內切頁重建。首頁／我的資料共用同一執行中的 service，切頁不重新查模型或生成；離開請求頁面時取消，舊回覆不能寫入新頁面。詳見 [APP_SHELL](docs/APP_SHELL.md)。真正重載仍以原始期限恢復，下一次主動生成前重查模型；不把模擬跨頁驗證當真實生成已通過。

## 正式夥伴聊天室（第五階段）

夥伴聊天室沿唯一getSharedAIConnection與原模式／模型／金鑰規則，不建立新端點或自動切換。無有效連線可讀24小時訊息與保留草稿，不能送出。每使用者回合一次生成POST，同時取得文字、八情緒ID與positive／neutral／negative分類；恢復session時原客戶端可能先GET官方模型清單，這不是額外生成。總prompt不超過既有4000 UTF-16字元、輸入800、output256 tokens；近期24則同角色訊息可按長度預算減少，不送全七階段或全部個人／生活資料。純本機提交故障只恢復本機，不重新呼叫模型。

訊息僅在獨立24小時IndexedDB，不入正式文件、長期history、diagnostics或備份；正式文件只留不可還原原文的結果雜湊及最小計分證據。金鑰／token不進聊天DB。取消／斷線／換角色／離開沿共用service，舊結果失效。沒有新AI連線或Cloudflare服務部署；真實模型驗收須由使用者既有連線測試，mock不能宣稱真實生成通過。詳見docs/COMPANION_STAGE5_VERIFICATION.md。

## 情境AI與手動備援生成（精簡重構）

沿唯一getSharedAIConnection，沒有新增金鑰、模型設定、後端或服務。日常事件提交後一次情境請求，包含必要A/B人格、當前D階段、角色／使用者稱呼與短簡介、最多3個已驗證事項名稱／必要結果與程式選定情緒；不送性別、全部待辦、聊天或帳本。4000 UTF-16字元、output128；失敗／逾時／busy直接備援，不自動重送、不寫庫、不計分。聊天仍用同一人格來源並保留24小時、最多24則上下文及output256。

只有明確手動生成備援可使用purpose:reply-library與output1024，一次JSON dialogues最多10句，支援部分有效結果預覽，不自動補足；已存在先確認取代，保存前仍完整保留原內容。其他provider呼叫維持256上限；descriptor.outputLimit仍可壓低輸出。現有未部署後端／Worker限制不在本次啟用或調整，1024路徑使用現有瀏覽器官方直連；真實模型尚須使用者既有連線驗收。
