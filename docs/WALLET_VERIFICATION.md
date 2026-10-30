# 錢包帳本驗證（2026-10-31，臺灣時間）

## 基準與發布保護

開發前工作區乾淨，遠端為harriet-pixel/life-system。GitHub連接器與實際Git fetch確認最新main為a2048f6cf340cddcb21379a5b16ae40024e2ae18，與工作區HEAD相同；原gh-pages為caa9786557b863e92b109bb43a4baa818319c13d。既有HTML／assets內容一致，發布分支只有.nojekyll及原始碼／測試／文件排除差異，沒有未回收的獨有功能修改。原分支與發布歷史均保留。

命令沙箱需network.enabled權限才能使用既有proxy。沒有移除proxy、改TLS或重建網站；Cloudflare未部署，後端僅共用模組URL版本對齊，無設定或服務變更。

## 程式驗證

- npm run lint：JS語法、正式HTML ID與本機入口資源。
- npm run build：乾淨work/build，包含wallet.html與完整資產，不含backend／測試／文件／憑證。
- npm test：357項通過（含18組錢包測試）。原本本機HTTP後端測試需上述網路權限，並非外部服務連線。
- wallet.test.mjs：200/200驗收鏈、單次／常用不同金額與快照、重送／陳舊store／儲存失敗原子性、月份與取消、防退款重複、0／初始化／校正／restart、舊待辦／加分獎勵及已Undo鏈遷移、明文／加密／舊備份、原角色credit防刷、無角色／刪除／溢位、七天與15筆、單筆復原快照、扣款／退款／好感證據篡改阻擋、人格／階段／出場／epoch失效。

## Chromium瀏覽器驗證

所有瀏覽器測試以建置成果的子路徑執行，使用真正的共用dataStore、localStorage、IndexedDB、Web Locks及app shell；沒有把UI替換成假頁。

| 測試 | 結果與範圍 |
| --- | --- |
| tests/wallet-browser.cjs | 桌面1280／手機375的新增、錯誤留稿、常用不同花費、重複提交、有效合計、退款、跨頁視窗草稿；8寬度320／375／390／450／451／768／1024／1280 × 四字型 × 100／200%；與習慣標題位置／分隔線／立繪實測對齊；真正雙分頁同時扣款只一筆成功 |
| tests/wallet-float.cjs | 320／375，共用收合／方向鍵／Pointer拖曳、10秒、44px關閉、安全範圍、modal、鍵盤狀態與360px短視窗 |
| tests/wallet-ai.cjs | 無連線、無角色、人格修改與離頁取消，遲到結果無效、不重試 |
| tests/wallet-boundaries.cjs | 320／375／1024，MAX_SAFE_INTEGER貨幣、90字名稱／900字備註、200%文字、首頁共用摘要與Back／Forward |
| tests/wallet-cache.cjs | 原main a2048f6真正舊模組暖快取升級至新schema，375／1280保留原來源資料、舊獎勵Undo／Redo與單一store |
| tests/settings.cjs（npm run test:browser） | 外觀、跨頁／分頁／重載、資料／歷史、圖片引用、明文／加密備份、錯誤與還原保護、五寬度／四字型／200%／鍵盤／減少動態 |
| tests/tasks.cjs | 八寬度正式待辦、pool／手動／取消／獎勵／首頁／Undo／Redo、月曆／焦點／200%，真正雙分頁完成一次 |
| tests/habits.cjs | 八寬度正式習慣視窗、首頁共用獎勵、年度圖與欄寬；正常打卡測試固定10月15日，避免31日專用流程干擾 |
| tests/companion-actions.cjs | 375／1280招呼草稿／保存、圖片crop、待辦／習慣正反向與Undo／Redo、中性備援；固定普通日期 |
| tests/page-alignment.cjs | 1024／1280／1600 × 四字型 × 正常／200%，原三頁標題／分隔線／立繪；另八寬度月份／週期／31日控制 |
| tests/characters-backup.cjs | 15項角色／圖片crop／聊天無文字證據備份、明文／加密還原與草稿維護保護（mock Drive） |
| tests/manual-cloud-retention.cjs | 僅手動、20筆、回讀後清理、錯誤保留、完整版本還原與無計時／online／focus呼叫（mock Drive） |

## 真實／模擬界線

AI成功／失敗／忙碌／遲到使用注入的mock provider；正式共用連線、提示組裝、來源claim、UI回應與資料交易是真實實作。沒有使用私人API金鑰呼叫外部模型，不能宣稱本次完成真實AI供應商驗收。

Drive遠端以mock驗證，沒有登入或操作使用者真實Google備份。保留原20筆政策、vault、圖片／回覆資產與聊天政策，不啟用同步。磁碟寫入失敗與數值溢位以可控fixture驗證原子性，不宣稱填滿實體裝置磁碟。

手機以Chromium viewport／Pointer／鍵盤狀態測試，未操作實體iOS／Android或真正螢幕鍵盤；實體裝置安全區仍沿既有共用元件。公開Pages部署與公開網站另依本次實際SHA／workflow／網址檢查回報，不以本機測試代替。
