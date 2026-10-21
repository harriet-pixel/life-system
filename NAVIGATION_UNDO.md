# 導覽與 Undo

## 現況與範圍

原生靜態 HTML／CSS／ES modules，無框架、路由套件、後端或資料庫。真正存在的頁面只有專案根目錄 `index.html`。既有待辦與習慣為明確標示的記憶體示意資料，重新整理會重設；本輪沒有改成持久化或建立其他功能頁。

## 共用導覽

`assets/navigation.mjs` 的 `navigationItems` 集中管理標題、排序、href 與 available。依序為「待辦事項、習慣打卡、陪讀系統、錢包帳本、我的夥伴、我的資料、聊天室、設定」，手機與電腦共用八項。首頁不列入導覽。目前頁以實際 origin/path 判斷，將根目錄與 index.html 視為同頁，忽略 query/hash。沒有內部假選取狀態，也沒有虛構路徑。

八個獨立目的頁尚未建立（首頁示意待辦／打卡不等同獨立功能頁）：設定 href 為 null、available 為 false，顯示「未開放」與 aria-disabled，不可導向不存在的頁面。未來實作頁面後再填入實際 href；原生連結共用同一份設定。popstate/pageshow 會重新計算目前頁；若將來改為 SPA，pushState 後也須觸發其路由更新流程。

電腦（1024px 起）：左右兩欄上方、橫跨整個 dashboard 的單行工具列（下方間隔 24px，再並列左側立繪與右側角色列／待辦區），預設收合。文字區可水平捲動，右側三條槓與 Undo 不縮小、不隨文字滑動。開合偏好存於 sessionStorage，禁止儲存時仍可正常操作。僅桌面有全形分隔符號。

手機：白底固定底部列，左側原生水平捲動、右側獨立固定寬度 Undo。考慮安全區，ResizeObserver 實測列高（包含文字放大）後替內容保留底部空間。選項聚焦及目前路由使用 nearest 捲動，不強制置中。兩版由同一個 1024px CSS 斷點切換，不同時顯示。

## 真正的資料還原

`assets/undo.mjs` 提供 createUndoManager、共用 undoManager 及 createActivityStore。

活動 store 是此示意流程的資料來源。它保存各項目的 checked 與 revision；勾選、打卡及其取消先更新 store，成功後才記錄 Undo，再從 store 渲染 checkbox、計數與打卡文字。Undo 呼叫 store.restore 還原真實的記憶體資料，並重繪介面，不只是修改 DOM、不會呼叫 history.back。

每筆撤銷紀錄包含 id、type、target、before、after、label 及 undo 還原函式；目前僅保留最後一筆成功且安全的操作，不提供 Redo。兩個裝置按鈕訂閱同一個 manager；尺寸切換、頁籤切換與導覽收合不新增或清空紀錄。

還原前驗證目標 revision 與預期狀態，拒絕覆蓋其他修改。非同步還原期間停用兩個 Undo 及資料輸入，避免重複提交；失敗保留紀錄以便重試並顯示錯誤。新操作不能在 Undo pending 期間加入。還原成功才清空該筆紀錄。

現已支援：待辦完成／取消完成、習慣打卡／取消打卡。未實作：新增、刪除、其他功能頁操作、資料庫寫入或跨整頁重新載入的持久化紀錄。這些功能不存在，不接假的撤銷。未來後端 adapter 必須在 undo 函式中等待真實還原寫入成功，使用伺服器版本／交易檢查衝突，再更新本地狀態；失敗必須 throw，不可先清紀錄或只改 checkbox。未來多頁也須選定共用的持久化來源／路由生命週期，不能把同文件的 singleton 當成跨頁儲存。

撤銷不觸發夥伴生成、不修改好感度；同步取消等待中及在途的夥伴生成，丟棄其舊結果，保留原對話。沒有把捲動、聚焦、導覽點擊接成資料操作。

撤銷成功與失敗通知皆位於待辦／打卡共用區域下方，手機與電腦使用同一個 role="status" 公告，不移動焦點。

## 本輪版面

角色列改為 `Lv— ｜ $ —`，移除稱呼，未自設數值。桌面清單項目與計數左右保留 1em，英文副標相對整個面板置中。頁首、日期、左右欄比例、立繪與對話框、手機頁籤皆保留。

## 驗證

```sh
node --test tests/undo.test.mjs tests/companion.test.mjs
PLAYWRIGHT_MODULE=/path/to/playwright BASE_URL=http://127.0.0.1:3000/ node tests/home.cjs
PLAYWRIGHT_MODULE=/path/to/playwright BASE_URL=http://127.0.0.1:3000/ node tests/navigation.cjs
```

測試涵蓋真正資料還原、失敗保留、重複提交、版本衝突、共用按鈕、路由辨識、跨尺寸切換、底部滑動與固定 Undo、200% 文字及內容不被固定列遮擋。所有未開放頁仍不宣稱可用。

- 最新桌面導覽：最左側新增可用的「首頁」連結；收合時工具列左側顯示依實際路由取得的當前頁名，字級與今日待辦頁籤相同（1.375rem），展開時隱藏頁名並顯示導覽。手機與桌面皆為九項，最左側為首頁；首頁連結由模組位置解析，兼容 GitHub Pages 子路徑。

- 桌面收合時當前頁名格式為 `｜{中文頁名} {英文頁名}`，中英文間一個空格，同字級；目前首頁顯示「｜首頁 Home」。導覽項目本身不加英文，展開時仍隱藏當前頁名。
