# 閒置導覽預取與帳本篩選（2026-10-31）

初始頁shell／window load就緒後，於idle slot依序預取其餘已啟用功能頁HTML，原prefetchedPages promise與意圖預取、正式導航共用。每份HTML先驗證shell版本，再以modulepreload下載已知頁面entry及瀏覽器支援的靜態相依圖，預取尚未套用的同來源CSS；不evaluate頁面模組、不執行mount、不查完整帳本／圖片／聊天、不發AI或Google請求。沒有背景DOM、隱藏頁面訂閱或新資料來源。

省流量及slow-2g／2g跳過自動預取；離線／document.hidden暫停剩餘佇列，online／visibilitychange恢復；pagehide取消待執行idle callback。沒有高頻輪詢，失敗不背景自動重試，使用者意圖／正式導航仍可重試。每頁一個idle callback，HTML請求低優先序；初始頁不等待這些工作。圖片、字型與需要互動才載入的重型子模組維持原按需規則。預取減少網路等待，正式切頁仍需初始化與呈現，不保證零等待。

錢包UI只過濾cancelled，不刪除任何帳目；monthLedger既有有效合計邏輯不變，Undo取消後紀錄可重新顯示。

驗證：lint／build通過。idle-wallet.cjs於375／1280px驗證六個目的頁HTML／模組下載、沒有背景頁面DOM及外部API、錢包HTML只取一次、取消帳目隱藏／資料保留／Undo恢復、上一頁／下一頁與視窗草稿、導航不新增history。省流量模式不發出目的頁預取（首頁既有data/home-today modulepreload保留）。navigation-prefetch.cjs以2G停用自動預取，獨立驗證原本意圖預取的HTML／module平行下載及快取回訪。

舊tests/app-shell.cjs仍引用已移除的示意[data-habit]控制而中斷；未將其當作本次通過項目。目前導覽與草稿使用上述實際UI測試驗證。公開網站畫面仍受執行環境網路限制，發布工作狀態另核對。
