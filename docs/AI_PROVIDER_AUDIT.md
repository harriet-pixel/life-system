# 四家模型相容性查核（2026-10-23）

本次查閱官方 GitHub 原始碼與範例；官方文件網站受環境代理 403 限制，未能完整閱讀網站最新版。以下是有來源的實作核對，不是真實帳戶驗證。測試資料依官方 schema／ID 組成，並非真實 API 擷取。

## 來源與規則

| Provider | 官方來源 | 查核結果與限制 |
| --- | --- | --- |
| DeepSeek | [官方 harness](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317/packages/llm)，account/tests/listing.spec.ts、account/src/listing.ts、deepseek/src/config.ts、messages-api.ts、serialize.ts；[文件入口](https://api-docs.deepseek.com/) | 官方 2026-09-24 listing fixture 已含 deepseek-flash、deepseek-v4-pro、input_modalities／output_modalities／api_capabilities。優先依文字模態及 anthropic_messages 能力判斷，不再只認 chat/reasoner。缺能力 metadata 時僅採官方來源支持的精確相容 ID；未知用途不猜測。 |
| Gemini | [官方 cookbook Models](https://github.com/google-gemini/cookbook/blob/550674681574d7aa24304b8fa9b31234e241ed7e/quickstarts/Models.ipynb)、[js-genai models](https://github.com/googleapis/js-genai/blob/main/src/models.ts)、[types](https://github.com/googleapis/js-genai/blob/main/src/types.ts) | 更新包含 Gemini 3.x 新文字模型及 Gemma 4 的精確規則；仍須官方當次清單提供 generateContent 方法。文字生成描述亦可提供能力依據。Interactions-only、影像、TTS、embedding、用途不明者不當成相容；新 ID／描述可能仍需維護。 |
| OpenAI | [models](https://github.com/openai/openai-node/blob/d3426032943f3acdd315f6627d2e459f82fc4e05/src/resources/models.ts)、[shared](https://github.com/openai/openai-node/blob/d3426032943f3acdd315f6627d2e459f82fc4e05/src/resources/shared.ts)、[responses](https://github.com/openai/openai-node/blob/d3426032943f3acdd315f6627d2e459f82fc4e05/src/resources/responses/responses.ts) | list 沒有充分能力資訊；依官方 SDK 精確文字型別更新至 gpt-6.1-sol 等目前 ID。不是以 gpt- 字首放行。到達 shutdown_date 的模型排除。型別不保證個別帳戶的 Responses 權限，未知新模型仍可能需更新規則。 |
| Claude | [models](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/models.ts)、[messages](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/messages/messages.ts) | Messages 目錄 type=model，不依固定名稱；支援 claude-opus-5-5 等新 ID。deprecated 不等於 retired，前者保留、後者排除；明示非文字模態也排除。帳戶授權仍須實際呼叫驗證。 |

## 列舉、生成與解析

| Provider | 列舉與分頁 | 有界限文字生成 |
| --- | --- | --- |
| Gemini | GET /v1beta/models；models、nextPageToken，pageSize=100／pageToken | POST /v1beta/{官方 model resource}:generateContent；contents、generationConfig.maxOutputTokens；解析 candidates.content.parts.text，排除 thought。x-goog-api-key 標頭。 |
| DeepSeek | GET /models；data，目前官方 fixture 不分頁；若未來回 has_more／last_id 則接續 after | 有 anthropic_messages 能力：POST /anthropic/v1/messages，max_tokens、messages、thinking disabled、stream false，解析 content 的 text blocks。精確已知的無 metadata 模型走 /chat/completions，解析 choices.message.content，不顯示 reasoning_content。列舉／Chat 使用 Bearer；Messages 依官方 llm-deepseek-api-key/src/index.ts 使用 x-api-key，加 anthropic-version:2023-06-01；直連 CORS 與真實 Messages 權限仍待驗證。 |
| OpenAI | GET /v1/models；data；SDK 註明目前不真正分頁，保留 has_more／last_id 前向處理 | POST /v1/responses；input、max_output_tokens、store:false；解析 output 中 message.content.output_text，不把 reasoning 當答案。Bearer 認證。 |
| Claude | GET /v1/models；data、has_more／last_id，limit=100／after_id | POST /v1/messages；messages、max_tokens；解析 content 的 text blocks。x-api-key、anthropic-version:2023-06-01；僅明確啟用瀏覽器測試時加入 dangerous direct browser 標頭。 |

所有 provider 上限 20 頁／2,000 模型；循環／超限／異常格式失敗而非截斷成功。輸出預算最多 256 tokens，沒有逐模型試生成或自動重試；reasoning 耗盡預算而無可見文字不算成功。

## 狀態、診斷與驗證界線

- 介面分開顯示金鑰已暫存、模型查詢成功、模型已選取、生成成功。
- 當次診斷只含取得／保留數量、排除的合法模型 ID 與固定原因；不含金鑰、認證標頭、原始錯誤或模型原始 metadata。空清單與全部被篩除是不同狀態，失敗清除舊清單及診斷。
- 動態取得才有選項；精確規則不是清單替代品。列舉成功不代表有生成權限或額度。
- 四家均使用新版 schema／ID fixtures，包含空、全篩除、權限、生成失敗；既有測試補充分頁、取消、競態、限流、額度與逾時。瀏覽器四家 mock 驗證設定 → 首頁 → 我的資料 → 重載後的共用生成。
- 使用者已回報 DeepSeek 瀏覽器直連連線成功，尚未細分為全部生成／跨頁項目。其他三家及本次 Worker 的真實模型查詢、真實生成與真實跨頁生成：**待驗證**。使用者先自行以 DeepSeek 金鑰驗收；不用購買其餘帳戶／額度，也不應在聊天提供金鑰。mock 通過不代表真實 CORS／帳戶可用。
- 直連sessionStorage現行不自動到期、手動清除；備份、一般資料、Undo／Redo仍不保存金鑰；新增個人 Worker 原始碼／OAuth，部署狀態見 CLOUDFLARE_PERSONAL_AI.md；未部署不宣稱可用。

本次執行結果：lint、build、88 項單元測試通過；新版四家 mock 官方 API 的建置成果瀏覽器測試、375px 診斷狀態測試、32 組 AI 介面尺寸／字型與 200% 文字測試、28 組設定頁籤測試、兩組暖快取升級測試通過。此為當次 mock 結果；後續使用者 DeepSeek 直連回報見上文，不能擴大為四家真實驗證。
