# Life System

首頁第一版視覺提案。使用原生 HTML、CSS 與 JavaScript，無套件依賴或建置步驟，後續頁面可共用 `assets/styles.css` 的設計 token。

## 本機啟動

在專案根目錄執行：

```sh
python3 -m http.server 3000 --bind 0.0.0.0
```

開啟本機的 3000 埠，結束時按 Ctrl+C。也可使用其他靜態檔案伺服器。

## 範圍

- 歡迎文字與完整日期 → 夥伴橫幅（左頭像、右對話）→ 貨幣／等級摘要 → 待辦 → 習慣。
- 1024px 以上：歡迎文字在左、日期在右，待辦與習慣並排，移除資料卡側欄。
- 所有內容明確標示為示意資料；日期為固定示意日期。
- 勾選為瀏覽器記憶體內的示意互動，不儲存資料，重新整理重設。
- 移除編輯資料與聊天室入口；新增待辦仍使用原生停用按鈕。貨幣與等級沒有資料源，顯示「—」。
- 無其他頁面、登入、資料庫、聊天服務、等級、經驗值或獎勵系統。
- 無外部圖片、字體或網路服務。商業字體未載入，依設計規範使用系統備援字型。

開始介面工作前閱讀 `AGENTS.md` 與 `design.md`。

## 夥伴開發介面與測試

`assets/companion.mjs` 提供事件合併、過期結果防護、逾時與備援；目前不連線 AI。介面、待串接項目及部署限制見 `COMPANION.md`。

```sh
node --test tests/companion.test.mjs
node --check assets/home.js
```

瀏覽器驗證腳本 `tests/home.cjs` 使用既有 Playwright 與 Chromium（可由 `PLAYWRIGHT_MODULE`、`CHROMIUM_PATH` 指定），不作為網站執行依賴。先啟動靜態伺服器，再執行：

```sh
BASE_URL=http://127.0.0.1:3000 node tests/home.cjs
```
