# 首頁預覽部署

目前網站是無建置步驟的靜態網站，適用 GitHub Pages。所有 CSS、JavaScript 都使用相對路徑，可部署在 `/life-system/` 子目錄。

## 發布範圍

`gh-pages` 分支只發布 `index.html`、`assets/styles.css`、`assets/home.js`、`assets/companion.mjs` 與 `.nojekyll`。不發布協作文件、設計文件或截圖。Pages 網站通常公開可讀，即使原始儲存庫為私人；訪客可取得所有已發布的前端程式碼與示意內容。沒有真實個資、登入、資料庫或外部聊天服務。不要為了部署擅自把私人儲存庫改成公開。

## GitHub 設定

具管理權限者進入儲存庫 Settings → Pages → Build and deployment：

1. Source 選擇 **Deploy from a branch**。
2. Branch 選擇 **gh-pages**，資料夾選擇 **/ (root)**，按 **Save**。
3. 等候 GitHub 的 **pages build and deployment** 成功。
4. 使用 Pages 設定頁顯示的 **Visit site** 開啟網站。

若使用預設網域，預期網址是 `https://harriet-pixel.github.io/life-system/`。只有成功部署並實際開啟後才能視為可用預覽；本文件不代表網站已上線。若 Pages 頁面提示目前私人儲存庫的方案不支援，需要帳號擁有者決定升級方案或採用其他託管服務；不應逕自公開儲存庫。

## 驗證

檢查首頁及三個資產均為 HTTP 200、顯示「把日子，慢慢理好。」、置頂夥伴橫幅在手機與電腦皆左頭像右泡泡、其餘區塊順序與桌面左右欄正確、示意勾選可操作且重新整理重設。編輯、新增待辦及聊天入口應保持未啟用。

先前雲端網路代理曾拒絕 `api.github.com` 與 `harriet-pixel.github.io`。本輪開始時公開首頁已回傳 HTTP 200；後續仍須針對每次發布驗證，不能以 Git 推送成功取代部署確認。若再次受阻，在雲端環境網路設定允許這兩個網域後重試。GitHub 驗證使用平台既有認證，不要把 token 放進文件或對話。
