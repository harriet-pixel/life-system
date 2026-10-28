# 行動版日常頁首、日期安排與 AI 保存

2026-10-28。接續 main cf36cc5，Cloudflare 維持暫停；手動雲端備份與正式數值、獎勵、復原規則不變。

## 共用頁首

`daily-header.mjs` 在小於1024px移動原有日期、通知、控制與頁籤DOM，保留監聽與草稿；桌面透過原位置anchor放回，未另建頁面或資料來源。首頁沿原數據列，待辦／習慣由同一dataStore／profileSummary顯示數據。

四區順序為日期、兩行資訊區、數據列、主頁籤，區間1em。首頁資訊區為兩行通知；待辦為一行任務看板數量及一行通知，右側同排月曆／設定；習慣為半月點數及一行通知，保留設定／新增按鈕。三頁共用捲軸預留，避免不同頁面寬度改變日期換行。

通知依實際寬度／字體計算可容納內容，超出顯示....；全文留title／aria-description，不再使用待辦十字改寫或通知區內捲。ResizeObserver與文字變動觀察在離頁暫停；通知不改布局高度。日曆、表單內詳細錯誤與夥伴對話不套此通知截斷。

目前導航項目採主題色底、白色icon。導航HTML與已知模組平行讀取，hover／focus／touch意圖可預取，訪問後沿原cached view；背景預取不mount頁面、不呼叫Google或AI、不變更資料。原草稿、版本檢查、重試及失敗保留仍在，saveData裝置不做意圖預取。

## 日期安排

任務看板／懸而未決沿用task-multi-schedule的月曆，使用單日模式，選新日會替換選取。懸而未決沿原from日期移動一次安排；常駐任務仍可跨月多選、整批驗證。一次性occurrence ID不含日期，因此顯示月曆時必須另核對record.date，不能把一筆逾期紀錄當成每一天都有安排。提交沿原service，不新增任務或重算獎勵。

## AI

各頁開發AI跨頁面板、短文字視窗與模式開關移除，無依賴的ai-page／ai-test-panel模組刪除。設定仍提供四家官方API、連接／重新整理／中斷、模型與固定測試連線。

瀏覽器AI預設開啟。一組key/provider/model存專用localStorage，重整有金鑰時自動驗證模型並恢復連接；有效舊分頁session遷移，金鑰不自動到期、不中途回填DOM。同來源分頁透過storage事件失效舊連接；不為每個輸入字元發送API請求，生成仍由既有正式操作觸發。手動中斷清除金鑰／模型並保留空啟用狀態。金鑰不寫生活文件、歷史、Undo／Redo或備份。Google與未部署後端的認證維持原sessionStorage。完整保存及風險說明見AI_CONNECTION.md與privacy.html。

## 檢查

針對新行為：mobile-daily-header.cjs、ai-persistent-browser.cjs、navigation-prefetch.cjs。

既有回歸：tasks.cjs、habits.cjs、settings.cjs、navigation-retry.cjs、以cf36cc5為基準的settings-cache.cjs、manual-cloud-retention.cjs，以及npm lint／build／test。Google及AI流量為mock，不宣稱真實服務商或實機鍵盤已驗收。
