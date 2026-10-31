# 錢包首次排版與數據列好感度（2026-10-31）

來源基準347a4c2。根因為閒置預取建立link rel=preload as=style，舊wallet mount以任何href包含wallet.css的link判斷已有樣式，誤將下載提示當成stylesheet而跳過套用。直接重新整理HTML本身含stylesheet，故正常。

現在wallet模組在正式掛載前，以精確URL及rel=stylesheet檢查，等load成功才讓shell切換顯示；preload不算套用。載入失敗移除失敗link並交由既有路由重試／保留原頁機制處理。沒有加入第二列數據或更動帳本資料。閒置預取仍不evaluate模組，故不會在背景套用頁面或呼叫AI。

共用stats-affinity顯示層在既有貨幣後加「｜愛心SVG 好感度」。唯一dataStore的activeCharacter輕量投影新增正式affinity欄位；首頁、daily-header、資料及錢包數據列訂閱該投影，不複製／儲存另一份好感度。無有效未封存出場角色顯示—，完整數值加入aria-label／title；數值變更、切換、取消出場與跨分頁讀取立即更新。單純好感度更新不重播招呼或重設角色立繪（影像簽章排除affinity）。沒有數據列的頁面不額外新增一列。

驗證：lint、build及365項單元測試通過。wallet-style-affinity.cjs於320／375／1280px先阻擋錢包CSS，確認已有preload仍保持原頁，直到真正stylesheet完成才切頁；首次畫面與reload樣式相同，手機僅一列數據，無框名稱／隱藏手機有效合計保持。正式消費+1、切換角色、無角色、五頁既有數據列、跨分頁與200%文字通過。idle-wallet.cjs回歸閒置下載、不掛載背景頁／不呼叫外部API、省流量、快取切頁、取消帳目與Undo、草稿和返回流程。公開網站畫面受環境網路限制，不能以本機測試代替公開實測。
