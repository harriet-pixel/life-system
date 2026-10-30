# 導覽與 Undo／Redo

現行網站為 index.html、profile.html、settings.html 三頁，共用 assets/navigation.mjs 與持久化資料服務。尚未實作的目的頁維持停用，不建立假路由。首頁連結相容 GitHub Pages 子路徑，手機與桌面以1024px斷點切換；手機固定底列預留實測高度，桌面可收合。

共用復原由 assets/recovery.mjs 與 data.mjs 管理，不是早期單步記憶體 Undo。基本資料、外觀、圖片與最愛期限24小時，待辦、打卡及手動數值7天；全站Undo／Redo合計最多15次。混合操作取較短期限，Undo／Redo不更新原始操作時間，新資料操作淘汰Redo分支。還原前驗證預期狀態，跨分頁寫入使用共用鎖，不安全鏈停止而不覆蓋目前資料。

長期行動中繼紀錄與短期復原快照分開；到期僅移除復原資料，不刪目前資料、有效行動或圖片。整體備份還原及永久刪除未使用圖片不加入一般Undo／Redo。詳細規則與相容策略見 [SETTINGS.md](SETTINGS.md)、[DATA_AUDIT.md](DATA_AUDIT.md)；過去單步示意流程僅供Git歷史追溯。

驗證使用 npm test、tests/navigation.cjs、tests/home.cjs、tests/recovery-ui.cjs 及 tests/recovery-images.cjs。發布與公開網站驗證依 [DEPLOYMENT.md](DEPLOYMENT.md) 分別確認，不以本文件代替實測。

第二階段生活操作附帶小型affinityPlan，Undo／Redo沿原來源與角色套用反向／重播，不快照整個companion或affinity。若獎勵已消耗，Redo只重發確實扣回的部分；不建立負債、不復活永久刪除角色，原生活數值的嚴格相依條件及期限維持。

錢包wallet.html已啟用同風格SVG、Wallet Ledger與aria-current；History／直接網址／子路徑沿app shell。wallet.*操作為七天／最近15筆，單筆stateId patch核對相依，不在快照複製帳本。業務取消不受Undo到期限制；錢包Undo／Redo反向或重播原貨幣／好感來源，不生成消費訊息。見docs/WALLET.md。
