# 隱私權政策與 Google OAuth 正式發佈盤點

盤點日期：2026-10-28（臺灣）。原始碼基準：遠端 main `7cbe9d46d1504812d310413c7b1cb89d7c74de2c`。

本次只新增公開政策、首頁文字連結及建置／檢查清單，不修改業務邏輯、資料結構、OAuth Scopes 或登入流程，不部署後端。政策頁不載入 app-shell、dataStore、Google 或 AI 模組；只沿用外觀讀取與自託管字型。

## 版本與發布核對

- 初始工作區乾淨，work 位於 f544e4c，比最新遠端 main 少三個提交，無本機獨有來源變更。
- 命令列 git fetch 因環境代理無法連線；改由 GitHub 連接器比較並取得來源差異，200 個異動檔案逐一核對 Git blob SHA 全部相符，再以最新遠端 main 為提交父節點發布。
- gh-pages `ab10a42e72651df251aa9a64d113ba13774472d8` 的同名發布檔案全部與 main 相符，沒有尚待回整的功能修正；另有 `.nojekyll`，發布時保留。沒有 CNAME。
- main 保留完整來源，gh-pages 只更新建置成果並保留歷史；使用預期分支 SHA 核對及 fast-forward，禁止 force。

## 程式證據與資料用途

| 項目 | 核對結果 | 主要程式 |
| --- | --- | --- |
| Google Scope | 僅 `https://www.googleapis.com/auth/drive.appdata`；用於本應用隱藏資料夾的備份清單、上傳與下載；保留刪除實作 | assets/google-drive.mjs |
| Google 帳號資料 | 不要求 openid/email/profile，不呼叫 userinfo 或 Drive about；只接收授權 Token、期限及結果，不取得姓名、電子郵件、頭像、帳號 ID | assets/google-drive.mjs、assets/drive-auth-session.mjs |
| 授權保存 | sessionStorage `life-system.drive-auth.v1`，回傳期限減一分鐘且最高一小時；無 Refresh Token；中斷清除目前分頁 | assets/drive-auth-session.mjs |
| 雲端現況 | AUTO_SYNC_ENABLED=false；手動上傳／還原，管理時列版本；新備份未加密，預設 preserveExisting=true，不執行20筆清理 | assets/cloud-sync-status.mjs、assets/cloud-backup.mjs、assets/cloud-restore.mjs、assets/settings.mjs |
| Drive CRUD | POST 建立 appDataFolder 檔案及 PUT 寫入內容；GET 清單／中繼資料／下載；DELETE 備份函式存在，現行公開介面無逐筆刪除；停用的同步模組另有上傳資產／增量與驗證後清理增量 | assets/google-drive.mjs、assets/cloud-sync-drive.mjs |
| 備份內容 | 共用文件、所需圖片、replyAssets；時間、一般裝置標籤及雜湊；排除短期聊天DB與憑證 | assets/backup.mjs、assets/cloud-backup-display.mjs |
| localStorage | life-system.data.v1：生活、個人資料、角色設定／好感度、操作與復原、外觀偏好；其他 cloud-backup、cloud-sync 與舊 drive-sync 鍵保存時間、狀態、日誌或索引 | assets/data.mjs、assets/settings-model.mjs、assets/cloud-backup.mjs、assets/cloud-sync-*.mjs |
| 圖片DB | life-system.images.v1/images，Blob及縮圖、引用保護及手動清理 | assets/image-store.mjs、assets/image-references.mjs |
| 角色聊天DB | life-system.chat.v1/turns，訊息各24小時有效、分批清理，無網站執行不保證準時抹除；不備份全文，主文件保存無全文計分證據 | assets/chat-store.mjs、assets/chat-model.mjs、assets/chat-affinity.mjs |
| 日常回覆DB | life-system.replies.v1/categories、events，回覆內容／歷史／去重；主文件保存引用；內容納入備份 | assets/reply-store.mjs、assets/reply-manifest.mjs |
| 保護副本DB | life-system.recovery-vault.v1/archives，同步日誌與還原前副本；無自動到期及逐筆刪除介面 | assets/storage-vault.mjs |
| AI 保存 | 四家官方 API；明確啟用直連後 sessionStorage life-system.ai-test.v1 保存單一供應商／Key／模型，無自動到期，中斷或關閉清除；不備份金鑰 | assets/ai-session.mjs、assets/ai-client.mjs、assets/ai-providers.mjs |
| AI 傳輸 | 測試文字；待辦名稱／分類／簡述／點數；習慣名稱／目標／程度及加分內容；聊天當次訊息、最多24則24小時上下文節錄、角色基本／人格／禁忌及當前階段；日常回覆為角色設定節錄、階段／事件類型／情緒，不含任務專名或私人聊天全文 | assets/task-completion.mjs、assets/tasks-model.mjs、assets/habit-actions.mjs、assets/habits.mjs、assets/chat-model.mjs、assets/reply-model.mjs、assets/reply-runtime.mjs |
| AI 自動觸發界線 | 已有有效連線時，部分待辦完成與符合條件的日常回覆庫生成會發請求，不能說「只有按AI按鈕才傳送」 | assets/task-completion.mjs、assets/reply-runtime.mjs |
| 後端 | AI_BACKEND_URL 與 AI_WORKER_URL 皆空白；GitHub Pages 不執行儲存庫中的 Node/Worker 後端，Cloudflare仍暫停 | assets/ai-config.mjs、assets/ai-worker-config.mjs、scripts/build.mjs |
| 其他服務 | GitHub Pages網頁及同站字型；Google GIS與Drive；選用四家官方AI；未發現前端分析／廣告追蹤、第三方字型CDN；本機BroadcastChannel不外傳 | HTML/CSS與assets中網路呼叫盤點 |

## 停止、撤銷、刪除

- Google「中斷連接」只清本分頁 session，不撤銷帳號授權或刪除備份；其他分頁獨立處理。
- `revokeDrive()` 有實作，但現行UI沒有撤銷按鈕。使用者應至 https://myaccount.google.com/connections 移除應用存取權。
- 雲端隱藏資料由 Drive「設定 → 管理應用程式」依Google介面刪除；不把撤銷授權寫成自動刪除資料。
- 完整本機清除需用瀏覽器清除此來源 localStorage、IndexedDB、sessionStorage；可能影響同一 harriet-pixel.github.io 來源的其他專案。單項刪除不代表歷史或保護副本抹除。
- AI中斷／關閉模式清金鑰暫存，必要時另在供應商撤銷金鑰；已送出內容依服務商管道處理。下載檔案需自行刪除。

## 權限驗證判斷（官方文件於盤點日查核）

Google目前將 drive.appdata 列為 **non-sensitive**，不是敏感或受限Scope；僅依現有程式權限沒有發現需要敏感／受限權限審查或相關安全評估的權限。不因此保證免除品牌驗證；正式 External 應用若要呈現應用名稱／標誌，仍依Google品牌驗證及實際Console要求處理。

官方來源：

- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/guides/appdata
- https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
- https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid

## Google Cloud Console 手動下一步

1. 確認目前公開 client ID 所屬的正確專案，並確認 Google Drive API 已啟用；本次不建立或替換 client ID。
2. Google Auth Platform → Branding：應用名稱 Life system，設定可實際收信的使用者支援電子郵件及開發者聯絡電子郵件（不可從Git提交作者推定）。
3. Branding 首頁填 `https://harriet-pixel.github.io/life-system/`，隱私權政策填 `https://harriet-pixel.github.io/life-system/privacy.html`。網站目前用公開GitHub Issues作聯絡管道；Google Console仍需有效聯絡電子郵件。
4. 依Google實際介面確認 Authorized domains、驗證要求及 Search Console 擁有權。網頁來源為 harriet-pixel.github.io；不要填入不屬於自己的 github.io 主網域或聲稱已完成驗證。若託管子網域遭拒，應依Google回覆處理；本次不擅自購買網域、變更DNS或啟用Cloudflare。
5. Data Access：核對僅有 drive.appdata；若Console另列敏感／受限Scope，先核對其用途與其他用戶端，不能僅憑本站程式斷定Console無多餘設定，也不能為跳過審查任意刪除功能所需權限。
6. Clients → 現有 Web client：確認 Authorized JavaScript origins 含 `https://harriet-pixel.github.io`（只有來源，不能含 `/life-system/`）。現行為GIS popup token流程，沒有本站redirect callback；勿為本次加上虛構redirect URI或改流程，瀏覽器不得放Client Secret。
7. Audience：若對外正式發佈，依實際專案由Testing切至In production，並依Verification Center完成品牌審核、Verify Branding／Publish branding等要求。切正式與品牌通過不是同一件事。
8. 在公開頁面部署生效後，以非測試帳號人工驗證登入、授權文字、備份、還原、到期與撤銷；瀏覽器自動化只用mock，未代替本人實際Google授權。

## 無法由原始碼確認的事項

- Google Cloud Console 真實Audience、發布／審核狀態、申報Scope、已授權來源、支援信箱及網域擁有權。
- GitHub、Google及AI供應商伺服器端實際日誌保存、帳號方案、訓練／跨境處理設定與刪除完成時間。
- 各使用者既有本機／雲端資料內容、舊版同步資料是否存在，以及不同瀏覽器關閉／還原分頁後的實體暫存抹除時間。
- 真實Google登入及Drive操作不使用使用者憑證代測，需由使用者完成。

## 本次驗證

- `npm run lint`、`npm run build` 通過；check清單與build清單皆納入privacy.html。
- `npm test`：304項通過、0失敗。首次受限沙箱不允許本機伺服器，後以允許本機通訊埠的執行環境完成。
- 政策頁瀏覽器：320、375、390、450、451、768、1024、1280px；200%文字無整頁橫向溢出；直接開啟／重新整理200、標題、鍵盤skip link、首頁往返、無額外外站請求及儲存寫入通過。
- 既有 `tests/google-drive.cjs` 模擬回歸通過：取消、最小Scope、appDataFolder、上傳失敗、本機資料保護、還原、授權到期及憑證不持久化。
- 真實帳號登入與供應商API不以mock結果宣稱通過。
- `npm run test:browser` 通過：設定／圖片保護／備份還原／跨頁與跨分頁／Undo與Redo／多字型與手機排版。
- `BASE_URL=http://127.0.0.1:3000/ node tests/chat-browser.cjs`：24項聊天與AI模擬檢查通過。
