# 夥伴系統第一階段驗證

來源：遠端 main d76f3f75968320990fd63a3eec56eb98fbac0edd；開始時工作區乾淨。gh-pages ae3767081438c4847fbeb5d16f12995b173d8d3e 的五頁與全部 assets 和該 main 完全一致，無獨有功能。

## 已完成驗證

- npm run lint、npm run build、npm test：193 項單元測試通過，其中新增角色核心7項（測試內含全部關係門檻、同毫秒切換、日期截止、匿名刪除參照、跨分頁revision、舊資料／備份、設定隔離及加密往返）。
- tests/characters.cjs：42 項瀏覽器檢查，375／1280px各驗角色CRUD、預覽不切換、正式出場與重載、跨分頁同步、草稿切頁保留、同角色跨分頁衝突不覆寫、封存／解除、二次刪除、聊天室未開放、八寬度及200%文字。既有導覽 ResizeObserver 調整後再判斷放大版面。
- tests/characters-backup.cjs：9 項檢查，登入／11分鐘／online／focus不觸發上傳，手動雲端快照保留角色，實際明文／加密備份及原子還原、還原不雲端上傳、draft lock阻止備份。Drive授權與API為mock。
- tests/settings.cjs：外觀跨頁跨分頁與Undo／Redo、圖片清理與草稿／引用保護、損毀／缺圖／錯誤密碼、失敗rollback、完整本機下載及明確還原，另有五寬度、四字型、200%、鍵盤與reduced-motion。
- tests/tasks.cjs：320／375／390／450／451／768／1024／1280px，建立、完成、獎勵、取消、首頁／跨頁、Undo／Redo、日期、200%、焦點；雙分頁並行完成只入帳一次。
- tests/habits.cjs：同八寬度，設定草稿、首頁共用、Mini／Plus及加分獎勵、年度圖、無水平溢出。
- tests/home-first-paint.cjs：375／1280px × 四字型，早期共用清單、hydration、完成／Undo、跨分頁、四路由、遷移鎖等待及損毀保留。
- tests/settings-cache.cjs：375／1280px暖快取升級、資料保留與路由；另以本次main為baseline驗證通過。

兩個既有瀏覽器測試在未修改main也會失敗：settings尋找已移除的「立即打卡」，habits假定年度圖只有12個text（現有數值標籤已增加）。本次改用現行加分打卡選擇窗與排除數值標籤的月份計數，並更新測試載入URL，重跑通過。

## 效能與界線

首頁不載入characters-page／characters-service，僅共用資料層載入7.4KB輕量模型。無新套件、AI、聊天室、圖片、回覆庫或輪詢。現有共用文件仍一次原子保存；角色管理頁暫停時解除資料訂閱。切換歷史僅正式改變ID才新增，不做逐幀掃描或每次render寫入。

home-load-timing診斷（同環境單次樣本，非效能保證）：原main冷／暖／限速為1094／215／7395ms；本次最終樣本856／342／2866ms，首次測試979／221／2832ms。存在環境變異，沒有用單次數字宣稱加速；主頁未等待角色UI，新增兩項輕量資源。正式低階手機仍需實機確認。

本次無真實Google帳號授權／上傳、實體手機鍵盤／Safari驗收；所有Google操作用mock。未建立或啟用Cloudflare。角色變更本階段不進Undo／Redo（防止回溯出場時間／復活永久刪除），既有資料Undo／Redo保留。

發布、Pages workflow與公開網址驗收另於交付回報列出，不以本機測試視為公開網站已部署。
