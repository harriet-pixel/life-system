# 錢包、聊天室與Google授權調整驗證

2026-10-31（臺灣時間）。基準遠端main 8cb8f40、gh-pages f68f67a；工作區開始乾淨，正式HTML／assets一致，保留兩分支歷史。

## 修改

- 新增消費改重複性／單次兩頁籤；重複性直接點選常用項目，帶入唯讀名稱及可修改實際花費。兩頁草稿獨立，支援方向鍵／Home／End；可進入常用管理後返回。
- 移除右側「消費紀錄 Wallet Ledger」及其橫線，保留sr-only帳本區名稱；不移除原桌面整體分隔線。新增無備註欄，歷史備註保留。
- 帳本無逐筆取消／刪除按鈕，以原共用Undo撤銷；原取消服務／已取消來源留作資料相容。導覽錢包緊接習慣。
- 聊天Enter送出、Shift＋Enter換行；IME isComposing／229選字不送出，沿原一次請求、忙碌與草稿保護。聊天全文仍僅本機IndexedDB，每則24小時，不進明文／加密／手動Drive備份；只備份text-free好感證據。
- Google有效token改專用localStorage，重開／新分頁沿原有效期繼續，不重新起算。舊sessionStorage保留issuedAt／expiresAt精確遷移後清除。到期／401清除token、保留連結意圖；中斷清兩種暫存並通知其他分頁。仍無refresh token、背景登入、自動備份或同步。頁面與隱私權政策已同步。
- 未更動備份打包、雜湊、上傳、完整回讀驗證與20筆保留流程。說明見docs/CLOUD_BACKUP.md；未量測使用者真實裝置／帳號各階段耗時。

只更新受影響的13個模組／樣式依賴URL與shell版本為wallet-polish-20261031；data.mjs保持既有wallet-20261031身份，沒有第二份store。

## 驗證

- lint／build通過；npm test 359／359（新增2組持久授權／遷移／原期限單元測試）。
- wallet-polish.cjs：320／375／1280，新頁籤／點選／管理往返、獨立草稿、錯誤留稿、無新增備註／逐筆按鈕、導覽順序、200%文字；實際錢包Undo後到設定按Redo，紀錄及目前／累積貨幣一起正確恢復。
- wallet-browser.cjs：更新舊UI測試為頁籤／點選與Undo；兩種桌面／手機行動、8寬度×4字型×100／200%、正式角色／來源、mock AI、真正跨分頁原子競態通過。
- chat-enter.cjs：375／1280，Enter恰一次送出、Shift＋Enter換行、IME不誤送；實際withBackup輸出不含user／assistant文字，但有text-free正式證據。
- chat-browser.cjs：原24項聊天回歸通過，包含手動重試、來源、角色切換、取消及好感。
- drive-remembered.cjs：mock OAuth，重新開頁／新分頁不再要求授權、原到期時間不變、跨分頁中斷、token不入實際備份、無自動Drive寫入。
- google-drive.cjs：mock最小scope／appDataFolder、授權取消、失敗保留、共用還原格式及到期清除通過。
- manual-cloud-retention.cjs：mock手動20筆、回讀後清理、錯誤保留、完整還原及無計時／online／focus API行為通過。

Google與外部AI為mock驗收，未登入／操作使用者真實帳號；手機為Chromium視窗／鍵盤事件測試。公開部署另依實際Pages workflow回報，不把本機或mock當成公開網站已驗收。
