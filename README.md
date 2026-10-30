# Life system

原生 HTML、CSS 與 JavaScript ES modules 的本機生活系統，沿用既有 GitHub Pages 網站，沒有框架或網站執行套件依賴。使用 npm 腳本檢查及打包靜態成果。

## 現有頁面

- [首頁](https://harriet-pixel.github.io/life-system/)：裝置當地日期、夥伴本機模擬對話、共用數值列、正式今日待辦與示意打卡頁籤；跨日與回前景更新。
- [我的資料](https://harriet-pixel.github.io/life-system/profile.html)：基本資料、能力雷達圖、立繪／頭像裁切、手動最愛及獨立數值重新開始。
- [設定](https://harriet-pixel.github.io/life-system/settings.html)：手動圖片清理、行動紀錄、備份還原及外觀預覽／保存。

三頁使用同一份localStorage文件與IndexedDB圖片，保存後同來源分頁同步。Undo／Redo為24小時／7天、最多最近15次；長期行動紀錄不受復原上限裁切。Google Drive僅於手動按下「上傳雲端」時上傳未加密備份，共保留20筆；不做跨裝置同步；不自動刪圖。Google OAuth已設定公開Client ID，真實授權需實機驗收。

手機與桌面共用資料及DOM，1024px切換主要版面與導覽；兩種版面均使用待辦／打卡頁籤。主題色及四種字型由共用外觀服務套用，非系統字型自託管並保留授權。

## 本機與建置

```sh
npm run lint
npm test
npm run build
python3 -m http.server 3000 --bind 127.0.0.1 --directory work/build
```

開啟 http://127.0.0.1:3000/ 。網站執行不需Node或後端；建置輸出含三頁與完整assets，不含測試、協作文件或環境憑證。發布流程見 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 驗證

`npm run lint` 檢查原生JavaScript語法、HTML重複ID與入口資產，並非ESLint。`npm test` 執行單元測試；需要展開逐項結果時使用 `node --test --test-isolation=none tests/*.test.mjs`。

瀏覽器腳本使用Playwright及Chromium作開發工具，須在環境提供可解析的playwright模組及瀏覽器，不是網站執行依賴。啟動上述伺服器後，例如：

```sh
BASE_URL=http://127.0.0.1:3000/ node tests/home.cjs
BASE_URL=http://127.0.0.1:3000/ node tests/profile-images.cjs
BASE_URL=http://127.0.0.1:3000/ npm run test:browser
BASE_URL=http://127.0.0.1:3000/ node tests/recovery-ui.cjs
BASE_URL=http://127.0.0.1:3000/ node tests/restore-actions.cjs
```

其他回歸腳本位於tests，涵蓋導覽、數據列、復原期限、圖片引用、外觀及mock Google。Google mock不代表真實授權測試，窄／短viewport不等於實體手機鍵盤驗證。每次交付回報當次結果，不沿用歷史筆數。

## 文件

- [AGENTS.md](AGENTS.md)：協作範圍、共用系統與發布規範。
- [design.md](design.md)：目前三頁的視覺、響應式及操作規則。
- [SETTINGS.md](SETTINGS.md)：資料、復原、圖片、備份、字型與Google設定。
- [DATA_AUDIT.md](DATA_AUDIT.md)：相容邏輯及程式整理盤點。
- [COMPANION.md](COMPANION.md)：夥伴事件契約與未接入的正式服務。
- [docs/DELIVERY_HISTORY.md](docs/DELIVERY_HISTORY.md)：歷史交付紀錄，不能當作現行規格或本次測試結果。

## AI 連線（BYOK）

設定頁可明確啟用預設關閉的瀏覽器直連測試，一組金鑰在專用 sessionStorage 不自動到期，由使用者手動中斷／關閉模式清除，同分頁切換首頁／我的資料與重新整理後可從共用開發入口生成短文字。這是有風險的自用測試，不是加密金鑰保管方案；使用者自行在網站輸入測試 key，勿提交或貼到聊天。

正式受驗證後端模式仍未部署，backend/ 不進靜態成果，登入與 endpoint 空白不阻擋已同意的直連測試。夥伴 mock、資料／數值規則不變；不新增登入或雲端資源。詳見 [AI_CONNECTION.md](AI_CONNECTION.md)。

Google備份、最新還原及安全界線見[雲端備份](docs/CLOUD_BACKUP.md)。Cloudflare維持暫停。

夥伴第一階段入口為 `companion.html`，提供多角色設定、固定七階段與出場歷史；詳見 [COMPANION.md](COMPANION.md)。第二階段已接入正式生活事件好感度交易、七日未完成結算與返還；AI及圖片仍未串接。

錢包帳本：`wallet.html`，管理系統貨幣兌換、常用項目、逐筆取消與月份有效花費。資料與復原規範見[docs/WALLET.md](docs/WALLET.md)。
