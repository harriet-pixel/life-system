# 錢包帳本

錢包管理系統貨幣的兌換支出，不是現實金錢記帳。正式入口為 `wallet.html`，沿用既有 app shell、History 路由、子路徑及 page lifecycle。

## 畫面與操作

桌面沿習慣頁的標題、分隔線、390×520（3:4／cover）出場角色及通知區；右側直接為數據、月份與逐筆帳本，不顯示「消費紀錄 Wallet Ledger」及其橫線，不加入圖表或兩個主頁籤。手機沿共用 daily-header 日期、月份有效花費／通知、數據及底部導覽；不放大型立繪。既有浮窗處理拖曳、方向鍵、收合、44px關閉、10秒、dialog／鍵盤／visualViewport／安全區與離頁，沒有另一套導覽或浮窗。

頁首＋開新增消費，提供重複性／單次兩個可鍵盤操作的頁籤，各自保留草稿。重複性直接列常用項目供點選，帶入唯讀名稱及選填預設花費，每次皆可改實際金額；可從此處進管理再返回草稿。單次直接輸入名稱及花費。新增消費不提供備註欄，舊紀錄備註與底層資料相容保留。名稱1–100 Unicode字元，花費為大於0的安全整數。失敗保留輸入；原生dialog、Escape／遮罩、捨棄草稿確認及焦點返回沿既有規則。站內離頁暫停訂閱，重新返回保留月份與視窗草稿。

紀錄按當地提交時間及穩定ID由新到舊排序，預設當地目前月份。顯示負花費、備註、可讀當地日期時間；已取消顯示取消時間，月份合計排除已取消。帳本不提供逐筆刪除或取消按鈕；使用者以全站Undo撤銷，受原期限／15筆／相依鏈規則保護，不改寫已入帳數字。既有長期取消服務與已取消資料保留相容，不另開UI入口。常用項目編輯／刪除不改舊紀錄，也不扣款、加好感或生成回應。

## 唯一資料與交易

`assets/wallet-model.mjs` 負責驗證／月份投影；`wallet-service.mjs` 負責業務交易；`wallet.mjs` 負責UI。唯一 `life-system.data.v1` 新增 `wallet`：

- version=1、stateId、lastChange；items／records 為穩定ID索引。
- item：id、version、name、defaultCost、createdAt、updatedAt。
- record：id=debitId、time、name、cost、note、sourceId（null為單次）、status、cancelledAt、refundId。
- 貨幣仍只存 stats.currency；沒有錢包專用餘額。

每次確認使用獨立submission ID。同一ID已存在長期history即不再扣款，包括先Undo後重送；真正再次消費使用新ID。跨分頁沿共用寫鎖／revision驗證；過期快照或餘額不足整筆失敗。提交一次保存stats、receipt、history及正式affinity來源；不等待AI。取消核對原扣款／好感度證據，退款只用原cost，保存取消與退款來源。相同紀錄不能再次退款；超出安全整數完整阻擋。

好感度來源為 `wallet:<receiptId>`、origin為debitId。新增成功時按提交當下有效正式角色+1；無角色仍保存quantity=1／actual=0證據，不補給未來角色。取消透過既有setSource撤回原角色，保留最低0、實扣credit及ceiling；Undo／Redo只重播原來源，不發新收入或新好感。永久刪除角色仍保留來源證據，不轉給新角色。

## 累積取得貨幣

stats.currencyEarned為非負安全整數。缺欄位時由該文件stats.currency初始化；合法0不重設。首次共用啟動沿原鎖與revision維護保存，不新增使用者history或角色回應。不推估舊歷史。舊stats快照同樣以各快照餘額補欄位，先補再驗證復原鏈，因此遷移前的有效Undo／Redo與獎勵取消仍可用。

共用transact集中處理：正式獎勵／撤回及手動校正按實際currency淨差同步累積量；wallet.*支出／退款不改累積量；stats.restart兩者歸零。不是把所有正向delta當新收入。Undo／Redo直接套原stats快照，restore由備份自身初始化，不採還原前裝置餘額。所有數值驗證失敗／溢位整筆停止。

首頁、待辦、習慣、錢包與使用共用summary的資料頁一致顯示 `$目前/累積`，0明確顯示。例：200/200 → 消費30為170/200 → 獎勵5為175/205 → 退款30為205/205 → 撤回獎勵5為200/200。

## 復原、備份與效能

wallet操作沿七天／全站最近15筆政策。wallet-recovery只保存單筆before／after與stateId，不在Undo或好感度plan複製整份帳本；相依鏈逐筆核對身份和內容，不放寬原有保護。取消業務操作不依賴短期Undo，原receipt與history永久保留。

主文件讀取僅做錢包容器檢查；錢包UI按頁載入，首頁不建立帳本投影或逐筆掃描。錢包來源訊息以 `getFields(['walletRecord:<id>'])` 取得單筆，不複製帳本供AI。完整結構與扣款／退款／好感度交叉證據在錢包寫入及備份驗證。原本主文件JSON解析／共用復原仍屬唯一dataStore既有工作，不新增第二份儲存或高頻輪詢。

明文／加密／Google Drive手動備份使用相同完整document驗證，包含wallet、累積量與來源證據。舊備份缺wallet補空容器、缺累積量用備份內餘額；先補舊復原快照再證明鏈。圖片、replyAssets、聊天保留政策、還原前vault、5筆手動雲端政策不變。Cloudflare維持暫停，沒有登入、後端、付費或自動同步。

## 消費情境AI

只有正式本機wallet.spent交易才推導一則wallet.spent事件；逐次處理，不合併成待辦完成。沿shared AI connection、共用繁體中文提示、正式人格與當前階段、指定情緒及持久claim去重。提示只帶本次名稱／實際cost及當前角色必要人格，不送備註、帳本、其他角色或聊天。最多一次生成，無連線／busy／失敗使用專屬neutral備援，不抽取完成待辦恭喜句，不搶占聊天、不自動重試。

角色身份、configVersion、階段、switchHistory、還原epoch與receipt active／debitId皆須仍有效。取消、Undo、換人、封存／刪除、人格變更、還原、離頁使遲到結果失效。純讀取、同步、管理常用項目、取消及錢包Undo／Redo不生成消費回應，也不補發好感。

帳本名稱可點選人工更正，金額不可改寫；新增wallet.edited沿原鎖／revision及單筆Undo證據，不生成消費AI或計分。常用項目修改仍不回推舊帳。日期僅顯示當地日期且與名稱同列，原時間仍保存；手機月份下花費摘要隱藏，頁首摘要保留。管理窗返回時即時重繪，新增為標題右側44px加號。詳見docs/WALLET_LAYOUT_POLISH.md。
