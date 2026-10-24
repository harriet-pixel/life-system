# 待辦儲存與鍵盤查核（2026-10-24）

基準來源 `9fb72be652a464ca2f2da11d2aa5a9375c736c8c`。Linux Chromium、同一主機、Asia/Taipei、375／1280×900，預設相同主題／字型。每個入口新 context，完全相同的原始 JSON（200事件、8分類、15筆有效Undo，1,459,310字元），無真實AI或外部網路。這是單次受控比較，不是所有裝置的效能保證；桌面獨有延遲未重現，兩種寬度原本皆慢。

原生 pointerdown 至 dialog 關閉（ms；四捨五入）：

|寬度|入口|修正前|修正後|
|---|---|---:|---:|
|375|create|1953|227|
|375|edit|1793|207|
|375|category-create|1664|212|
|375|category-edit|1677|199|
|1280|create|1854|224|
|1280|edit|1813|217|
|1280|category-create|1658|197|
|1280|category-edit|1608|208|

首次 pointerdown 到 submit 均約1–2ms，第一次點擊即提交。沒有 debounce／人為等待或必須先失焦再點一次。原先一次儲存呼叫約1,011–1,106次 structuredClone、三輪 schedule／pool／calendar重畫；修正後62–63次、單輪。主要成本是重複深複製含Undo快照的文件，以及每次讀取／每位訂閱者重算相同復原鏈；不是AI、localStorage寫入或CSS動畫。唯讀結果按state身份與復原期限快取，busy狀態不觸發資料重畫，正式寫入安全檢查保留。

修正後1280px新增事件的內部階段（ms；巢狀階段不可直接加總）：

|階段|耗時|
|---|---:|
|form-validation|0.1|
|prepare-validate|7.1|
|service-validate|1.0|
|lock-wait|2.9|
|transaction-validate|16.8|
|storage-read-check|29.2|
|recovery-write-check|29.5|
|serialize|2.0|
|storage-write|5.2|
|render|1.7|
|subscribers|74.8|
|lock-held|176.9|
|close|0.0|
|notice|0.0|

修正前同入口鎖等候約 12.3ms；儲存寫入本身約3.8ms。通知與關窗沒有等待非必要工作。20筆小資料的初步同環境比較約235–349ms降至41–46ms。

## 鍵盤與留白

以注入 visualViewport EventTarget 模擬height／offsetTop，並非只縮小layout viewport。375×800、可視高度240／offset80，原本表單捲動區僅61px、sticky底部列69px，名稱欄落在320–365px（可視內窗已結束），底下頁面額外捲113px。修正後內層可用約93px，名稱欄248–293px、標籤207–234px可見，底部按鈕隨表單捲動，底下頁面捲動保持0。

`tests/tasks-keyboard.cjs` 覆蓋320、375、390、450／451、768、1024、1280px、三種height／offsetTop、切欄位、分類子窗、草稿、首擊送出、鍵盤收回及200%文字。手機空通知無高度，短通知僅當下行高，夥伴到頁籤維持24px正常區塊距離；桌面三行通知及立繪未改。

沒有實體手機／作業系統虛擬鍵盤，**真機鍵盤驗收尚未確認**，模擬通過不代表真機通過。真實AI與Google Drive亦未連線，本次AI失敗／延遲及獎勵測試使用mock。

重現儲存量測：先啟動靜態server，執行 `COUNTS=200 FIXTURE_FILE=/tmp/save-fixtures.json OUT=/tmp/save-after.json node tests/tasks-save-performance.cjs`；基準checkout以其server網址與 `BEFORE=1 VERSION=task-fixed-10 BASE_URL=...` 執行同腳本、同fixture。所有額外量測hook只在測試頁啟用。
