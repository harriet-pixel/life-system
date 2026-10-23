# Cloudflare Workers 個人 AI 後端

核對日期：2026-10-23。GitHub Pages 繼續提供網站；不搬移 DNS、不買網域，不部署網站副本。Worker 入口 `backend/worker/index.mjs` 共用現有 provider adapter、模型能力及錯誤分類。

## 現況與驗證界線

**依使用者最新指示，Cloudflare 建置暫停，待所有網頁建置完成後再處理；本次不建立或部署服務。以下設定步驟保留供日後使用。**

程式、Wrangler 部署設定及本機測試已備妥，**Cloudflare 帳號內尚未部署，也未完成真實 GitHub OAuth／Worker AI 驗收**。公開前端 Worker URL 留白，如實顯示尚未設定；現有瀏覽器直連保留。使用者已回報 DeepSeek 直連連線成功，不能推論其餘 provider、生成、跨頁或本 Worker 真實驗收通過。

## 架構及秘密流向

- 個人後端：Pages → GitHub OAuth 彈出視窗 → Worker callback（以 GitHub `/user` 的 numeric ID 比對 `ALLOWED_GITHUB_ID`）→ 本站短期 opaque session → Pages 專用 sessionStorage → Worker 以 session 驗證／授權 → Worker Secret → 官方 AI API。
- AI provider key **只在 Cloudflare runtime Secret 與當次處理記憶體／官方請求標頭**；不回前端、不放 Git、發布檔、一般資料、復原、備份或日誌。Cloudflare 平台與選定的官方 AI 服務會接觸金鑰，不宣稱完全不接觸。
- GitHub OAuth client secret 也只放 Worker Secret。GitHub access token 僅 callback 處理時用於 `/user`，不回前端、不保存。OAuth 只請求公開身分，scope 空白，無 repo／email scope；不建立多人註冊或多人 key 系統。
- 本站 session 是另一種敏感登入憑證，並非 provider key／GitHub access token／Cloudflare 管理 token。隨機 256-bit、最長 1 小時，專用 `life-system.ai-worker-session.v1`，只在同分頁 sessionStorage 與執行記憶體。DO 只保存 SHA-256 session hash 及期限，登出刪除 hash，無自動 refresh。sessionStorage 不是加密保管庫，XSS／擴充功能可能取得本站 session；同來源其他程式必須可信。新分頁可能由瀏覽器複製 opener session，不提供分頁隔離保證。
- 手動備用：明確啟用原瀏覽器直連 → 自行重輸一組 key → 原 `life-system.ai-test.v1`（最長兩小時）→ 官方 AI API。後端不提供 key 下載。切換只取消當前請求，不自動重送或試用另一家；關閉備用清除直連 key。後端的本人登入仍可保留至登出／到期。
- 不保存／搬移 profile、圖片、歷史、待辦或數值。不自動接入角色或分點。只有使用者明確送出的測試文字會傳 AI；生成回應只用安全文字顯示。

## 為何選 GitHub OAuth 而非跨站 Cookie

GitHub Pages 與 workers.dev 是不同來源／站點。登入 popup 先在 Worker 設定 `__Host-life-oauth`（Secure、HttpOnly、SameSite=Lax、Path=/、10 分鐘），GitHub top-level GET 回呼可帶回此 Cookie；這不是第三方 XHR Cookie。隨機 state 與 cookie 必須一致，DO 只允許使用一次；PKCE S256／verifier 由 Worker 保存及交換。GitHub 免費帳號的 OAuth 支援 PKCE，已核對官方 feature 定義。

回呼以固定 Pages origin 的 `postMessage` 傳送本站 session，前端同時驗證 `event.origin`、`event.source`、登入 nonce 及有效期，再呼叫 `/auth/session` 驗證後保存。session 不經 URL／fragment、GitHub token 也不進 Pages。回呼立即清除 code/state 的目前網址，不引入 analytics；Cloudflare request observability 關閉。OAuth code 本身為標準一次性回呼 query，不是 provider key。

後續跨來源 POST 使用 `Authorization: Bearer <本站 session>`、`credentials: omit`；OPTIONS 只回固定 origin／POST／Authorization, Content-Type。CORS 不作為認證：無有效 session（即使 Origin 正確）仍拒絕，非本人 GitHub ID 回 403。不用 Cloudflare 管理 API token 作網站登入。

GitHub popup／Cookie 政策、允許 popup、所在地網路及控制台版本仍需真實驗收。若瀏覽器阻擋彈出視窗，明確提示允許後重試，不改用 URL 傳 token。

## 免費服務核對

依本次實際讀取的 Cloudflare／GitHub 官方文件原始碼；控制台方案仍須確認為 **Workers Free**，不得升級或開按量付費。

| 必要服務 | 官方免費限制 | 本次使用 |
| --- | --- | --- |
| Workers Free | 每日 100,000 inbound requests，10ms CPU／invocation；等網路 I/O 不算 CPU | HTTPS workers.dev，無自訂網域。超額／CPU 限制可能被平台攔截，前端如實報後端不可用，不自動重送。 |
| SQLite Durable Objects Free | 每日 100,000 requests、13,000 GB-s duration、5M rows read、100K rows written；總 SQLite storage 5GB | 單一 `PersonalGate`，只有 session hashes、最多八筆短期 OAuth 嘗試、限額計數與 concurrency leases；不放使用者資料或 key。 |
| Workers Builds Free | 每月 3,000 build minutes、同時 1 build、每次 20 分鐘 | GitHub 匯入部署；不是每次生成都 build。可關閉非 production branch builds。 |
| GitHub OAuth App | 無需付費方案、無 repo scope | 單一 numeric GitHub ID 白名單，不用 Zero Trust／Access、KV、D1、R2、Workers AI 或付費驗證平台。 |

免費超額會失敗，不是無限量；Cloudflare 自有平台限制、GitHub rate limits／故障及 AI 服務商付費額度是不同層。AI API 費用仍由你的服務商帳戶負擔，不包含於 Cloudflare 免費額度。本機測試不是 Free plan CPU／生產容量驗證；部署後要觀察實際限制，若不符先回報，不擅自升級。

官方來源（已讀取其 GitHub 官方文件原始碼）：
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)、[limits](https://developers.cloudflare.com/workers/platform/limits/)
- [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)；官方 repo `src/content/partials/durable-objects/durable-objects-pricing.mdx` 與 `do-plans-note.mdx`
- [Builds pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)、[configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)、[dashboard](https://developers.cloudflare.com/workers/get-started/dashboard/)
- [GitHub OAuth web flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)；`github/docs` 的 `data/features/pkce_support.yml` 明確含 fpt／ghec。
- 上述網站本身未逐頁公開站實測；本環境以 `cloudflare/cloudflare-docs` production 與 `github/docs` main 原始碼核對。

## 安全與請求限制

- 固定 GitHub authorize／token／user 與四家官方 API，不接受任意 base URL。Workers 以 manual redirect 拒絕 3xx，不能使用 Node/browser 的 redirect:error。
- 每分鐘最多 10 次、UTC 每日最多 100 次 AI 操作（查模型也算）、同時最多 2 次，跨 session／isolate 由同一 DO 原子保存，不因登出／重載重設。並發租約 30 秒，正常完成即釋放；請求逾時 20 秒，不自動重試。匿名登入入口另限每分鐘 10 次／最多 8 筆有效嘗試，保護 DO 儲存；公開端點仍可能遭 DoS 耗盡免費額度，不能保證抗無限流量。
- POST body 最多 6 KiB、body 等待最多 10 秒、文字最多 1,000 Unicode code points、輸出最多 256 tokens（最小測試 64）、官方回應最多 1 MiB、可見文字最多 16,000 字元。adapter 原有模型上限及分頁保護不變。
- DO 的 blockConcurrencyWhile 只涵蓋狀態讀寫，不在鎖內等待 AI。預期拒絕先以值回傳，再於鎖外拋錯，避免 workerd 重設物件。
- 前端取消／換模式／登出使舊結果失效。已送至官方的請求可能仍被計費，取消無法保證退款；未自動重送。
- 已設定的 provider Secret 缺少時回 provider_unconfigured；AI quota／rate_limit 和 backend_unavailable／backend_rate_limit 分開，不把公司餘額不足叫 Cloudflare 故障。
- `observability.enabled=false`、無 console／request/error/header/body capture，無分析工具。勿另外開啟 tail debug、Logpush 或外部 APM 收集認證標頭／body；平台內部記錄政策仍由 Cloudflare 控制，不宣稱平台絕對不留記錄。

## 部署流程（分段操作，不在聊天傳秘密）

### 1. 先建立免費 Worker，取得公開 URL

Cloudflare Dashboard → **Workers & Pages → Create application → Import an existing Git repository**（或 Connect GitHub）→ 僅授權 `harriet-pixel/life-system`。

| 欄位 | 值 |
| --- | --- |
| Project／Worker name | `life-system-personal-ai`（與 wrangler name 相同） |
| Production branch | `main` |
| Root directory | 儲存庫根目錄 `/`，不能只匯出 backend 子目錄，adapter 在 assets |
| Build command | `npm ci --prefix backend/worker` |
| Deploy command | `npm run deploy --prefix backend/worker` |

Wrangler 鎖定於 package-lock，原始碼含 SQLite DO migration，Cloudflare deploy 建立必要的單一 namespace。不另建立 KV／D1／網域。不在 build command 跑網站 build，不將 GitHub Pages 改成 Workers assets。

確認 Workers Free 後 Deploy。若介面要求升級／信用卡／付費，先停止並回報文字，不購買。初次尚缺登入設定會安全回 503。取得 `https://life-system-personal-ai.<你的子網域>.workers.dev/`，可把這個**公開 URL**回覆給協作者（不是 secret），再繼續下段。

### 2. 建立只供登入的 GitHub OAuth App

GitHub 個人頭像 → **Settings → Developer settings → OAuth Apps → New OAuth App**。
- Application name：`Life system personal AI`。
- Homepage URL：`https://harriet-pixel.github.io/life-system/`。
- Authorization callback URL：`https://<實際 Worker>/auth/callback`，必須精確相同。
- 不啟用 Device Flow，不要求 repo 等 scope。

記下公開 Client ID。Generate a new client secret 後，只將 secret 貼入下一段 Cloudflare Secret；不要貼聊天／GitHub。本人 numeric ID 可在 `https://api.github.com/users/<你的 GitHub 帳號>` 的 `id` 取得；必須是實際登入帳號，不是 client_id 或登入名稱。

### 3. Cloudflare runtime Variables & Secrets

Worker → **Settings → Variables and Secrets → Add**；這些是 runtime，不是 Builds 的 build variables。

| 名稱 | 類型／內容 |
| --- | --- |
| WORKER_URL | Text，實際 `https://<worker>.workers.dev/`（尾斜線） |
| SITE_URL | Text，`https://harriet-pixel.github.io/life-system/`（程式已預設） |
| GITHUB_CLIENT_ID | Text，OAuth App 公開 Client ID |
| ALLOWED_GITHUB_ID | Text，本人 numeric GitHub ID |
| GITHUB_CLIENT_SECRET | **Secret**，GitHub OAuth App client secret |
| DEEPSEEK_API_KEY | **Secret**，你的 DeepSeek API key |
| GEMINI_API_KEY / OPENAI_API_KEY / CLAUDE_API_KEY | **Secret**，可選；本次不必取得或購買其餘三家 |

儲存／Deploy 後不要截圖 secret 內容。`keep_vars:true` 保留控制台新增 vars；repo 只宣告固定 SITE_URL，不用 placeholder 蓋掉控制台設定。既有 Secret 由平台保留。不要把 Cloudflare 管理 token 填入上述任何欄位。

### 4. 前端公開 URL 與驗收

協作者將公開 Worker URL 設定於 `assets/ai-worker-config.mjs` 的 AI_WORKER_URL，或以同名 build 環境變數注入；只接受 HTTPS workers.dev 根 URL。依既有流程更新 main／gh-pages，無 provider keys 或後端 bundle 進 work/build。

設定 → AI 連線 → 不勾選直連 → **使用 GitHub 登入個人後端** → 本人 GitHub 授權 → 取得模型 → 選模型 → 最小文字測試（會有少量 AI API 費用）。另以短文字測試產生回應，再切首頁／我的資料／重新整理驗證同分頁恢復。預設繁體中文／臺灣用詞；模型遵循程度需真實驗收。

未登入 POST `/v1/ai` 應 401，其他 GitHub ID 應 403；登出後同一 token 應 401。手動勾選直連、重新輸入 key 可測備用；不自動從後端拿 key。驗證備份／一般資料無任何 key 或本站 session。

## 本機驗證

```
npm run lint
npm run build
npm test
npm ci --prefix backend/worker
npm run check --prefix backend/worker
node tests/ai-worker-runtime.cjs
node tests/ai-worker-browser.cjs
```

- 單元測試 mock OAuth／provider：未登入、本人 ID、state／PKCE／cookie、一次性 state、Secret 不回前端／不存 DO、登出、TTL、限額／並發、手動備用、各 provider 原生系統語言提示。
- Wrangler dry-run 是編譯／綁定檢查，**不是部署**。
- Miniflare/workerd＋SQLite DO 本機整合是真正 runtime／storage 行為，官方 AI 仍是 mock。
- Playwright mock 本人登入、模型／文字、首頁／我的資料／重載、登出、quota 和後端故障區分、手動備用；不能當真實 GitHub／Cloudflare／AI 驗收。
- 一般資料、圖片、備份、Undo／Redo、字型與頁籤定位仍用既有腳本回歸。真實部署與帳號驗收由後續控制台步驟完成，不冒稱已通過。

### 本次執行結果

lint、build、102 項單元測試通過。Wrangler 4.152.0 dry-run bundle 通過；本機 workerd＋SQLite DO 驗證未登入拒絕、模型查詢、mock 生成、拒絕 provider 轉址及登出撤銷。375／1280px 本人登入／跨頁／重載／登出／備用的 mock 瀏覽器測試、四家直連 mock 回歸、32 組 AI 字型尺寸／200% 文字、28 組設定頁籤、兩組暖快取升級及原有設定／資料／備份／Undo／Redo 瀏覽器回歸通過。真實 Cloudflare 部署、GitHub OAuth、Worker 生成及語言遵循均待驗證。
