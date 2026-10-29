# 日常操作調整驗收（2026-10-29）

以遠端 main eea3384 為基準，保留精簡人格、情境回覆、角色卡、手動雲端備份及既有資料保護。沒有啟用自動同步或Cloudflare。

- 逾期：isOverdue統一為pending且日期早於當地今天。昨天起納入懸而未決／數量／批次；日清單不再重複顯示逾期pending，完成歷史仍顯示。原訂日期、ID、安排及獎勵不重寫，不自動略過。
- 手機主頁籤：原生Touch Events與Pointer Events共用方向／距離判斷，至少48px且橫向大於縱向1.6倍，900ms內；兩端夾限、不環繞。只點擊原有tab，ARIA／草稿沿既有流程。dialog、表單控制、一般按鈕／連結、選字與內層原生橫向區域不截取，垂直捲動不阻擋。桌面仍點擊／鍵盤。
- 導覽：｜為獨立aria-hidden span，桌面色塊只在圖示連結，手機隱藏分隔符。
- 打卡：正式habit.check／habit.bonus／habit.bonus-cancel交易的實際delta送入待辦同一全域動畫queue。貨幣／經驗／五能力均只顯示非零值，使用+與−，不從預估點數計算；頁面自己的重複動畫移除。相同operation ID去重，切頁清除；刷新與同步不重播。通知沿既有daily-header與正式交易來源，緊接交易的關窗不覆蓋成功通知。
- 隱私權：入口從首頁移至設定，公開privacy.html保留並補述Google連結狀態保存方式。
- Google：Token仍保持原有sessionStorage短期期限，不保存Refresh Token。新增life-system.drive-link.v1，只有version／公開clientId／linked，不含憑證、email或帳號資料。已登入舊分頁沿用有效Token並記住連結。過期／401只清短期Token，連結仍在；新分頁／重開可辨識已連結，在使用者雲端操作手勢內以既有prompt空字串更新授權。SDK可因既有連結而預載，無背景Drive資料讀寫或新scope。明確中斷才將連結標記設為false，透過storage事件使其他分頁失效；保留false標記以防舊分頁Token復活，延遲授權回應也不可覆寫中斷。

## 測試

- npm run lint、npm test（330項，0失敗）、npm run build。
- tests/daily-polish.cjs：CDP原生手機觸控左右／縱向、嵌入橫向區域、昨天待辦入池、首頁與習慣頁正負數動畫／加分取消／不重播、通知、桌面分隔符、設定隱私入口；Google重整／新分頁／過期／401保留、使用者操作時更新與跨分頁手動中斷。
- tests/mobile-daily-header.cjs：320／375／390／450／451／768／1024／1280頁首、通知與SPA，原日曆安排規則。
- tests/manual-cloud-retention.cjs、tests/google-drive.cjs：既有手動備份／20筆政策／回讀驗證／範圍／取消／失敗保護；fixture先完成好感度初始化，避免把背景結算當成登入改動。
- 最新角色回歸tests/replies-browser.cjs（83項）與tests/replies-events.cjs（18項）。舊companion-ui.cjs仍含v1 settings.traits斷言，與遠端v2人格規格不符，本次不以它代替最新角色回歸。

Google GIS與Drive API皆mock，未以真實帳號驗證。沒有後端的Token模式不能承諾Google永不到期；Google撤銷、重新驗證、登入cookie或快顯限制可能要求再操作。網站保留連結意圖，不把無效Token顯示成有效授權，也不自動反覆彈窗。未在實體Android／Windows驗收，原生觸控為Chromium mobile context。
