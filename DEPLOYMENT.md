# 首頁預覽部署

目前網站是無建置步驟的靜態網站，適用 GitHub Pages。所有 CSS、JavaScript 都使用相對路徑，可部署在 `/life-system/` 子目錄。

## 發布範圍

`gh-pages` 分支只發布 `index.html`、`assets/styles.css`、`assets/home.js`、`assets/companion.mjs`、`assets/navigation.mjs`、`assets/undo.mjs`、`assets/fonts/noto-serif-tc/` 與 `.nojekyll`。不發布協作文件、設計文件或截圖。Pages 網站通常公開可讀，即使原始儲存庫為私人；訪客可取得所有已發布的前端程式碼與示意內容。沒有真實個資、登入、資料庫或外部聊天服務。不要為了部署擅自把私人儲存庫改成公開。

## GitHub 設定

具管理權限者進入儲存庫 Settings → Pages → Build and deployment：

1. Source 選擇 **Deploy from a branch**。
2. Branch 選擇 **gh-pages**，資料夾選擇 **/ (root)**，按 **Save**。
3. 等候 GitHub 的 **pages build and deployment** 成功。
4. 使用 Pages 設定頁顯示的 **Visit site** 開啟網站。

若使用預設網域，預期網址是 `https://harriet-pixel.github.io/life-system/`。只有成功部署並實際開啟後才能視為可用預覽；本文件不代表網站已上線。若 Pages 頁面提示目前私人儲存庫的方案不支援，需要帳號擁有者決定升級方案或採用其他託管服務；不應逕自公開儲存庫。

## 驗證

檢查首頁、五個程式／樣式資產、字型 CSS 及實際用到的 WOFF2 均為 HTTP 200、顯示「慢慢成長，慢慢變好」、歡迎區 → 左頭像右泡泡夥伴橫幅 → 稱呼／貨幣／等級摘要 → 待辦與習慣順序正確，桌面待辦與習慣並排、示意勾選可操作且重新整理重設。新增待辦保持未啟用；編輯與聊天入口已移除。

先前雲端網路代理曾拒絕 `api.github.com` 與 `harriet-pixel.github.io`。本輪開始時公開首頁已回傳 HTTP 200；後續仍須針對每次發布驗證，不能以 Git 推送成功取代部署確認。若再次受阻，在雲端環境網路設定允許這兩個網域後重試。GitHub 驗證使用平台既有認證，不要把 token 放進文件或對話。

發布時一併保留 assets/fonts/noto-serif-tc/ 的 font.css、files/ WOFF2 字型檔與 LICENSE；SOURCE.md 記錄來源。字型由本站提供，不需訪客連線第三方字型服務。

## 設定頁整合後的發布範圍

現在使用 `npm run build` 將三頁（`index.html`、`profile.html`、`settings.html`）及整個 `assets/` 輸出至 `work/build/`。這是可選的靜態檔案打包／公開 OAuth client ID 注入步驟，網站執行仍不需要 Node 或後端。完整資產（含三種字型及 LICENSE）不可再沿用前述舊版單頁資產白名單。`work/build/` 不包含 Git、測試、開發文件或環境憑證。

`main` 與 `gh-pages` 是不同分支；推送 `main` 不表示 GitHub Pages 已更新。發布至既有 gh-pages 必須另檢查其最新版本及部署設定，不應以 main 推送成功宣稱網站已上線。設定格式、字型、Google Console 與驗證細節見 `SETTINGS.md`。
