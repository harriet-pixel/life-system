# Google Drive 手動備份與還原

現行原則：只提供手動完整備份與還原，不再使用自動同步。Cloudflare 維持暫停。

## 登入與操作

Google Identity Services 使用 OAuth token client，僅要求 `https://www.googleapis.com/auth/drive.appdata`，直接由瀏覽器存取使用者自己的 Drive `appDataFolder`。公開 Client ID 不是密鑰。token 在專用 localStorage 依 Google 原期限保存，最長一小時並提前一分鐘失效；重整／重開網站與新分頁可恢復未過期授權，過期須由使用者操作時重新授權，不使用 refresh token／背景登入。中斷連接清除持久與舊分頁 token，並通知其他分頁，不刪本機或雲端資料，也不等同撤銷 Google 帳號授權。

設定頁預載 GIS；使用者點登入才要求授權。雲端視窗稱「雲端備份與還原」，保留登入／上傳／還原、一般平台裝置名稱、本地與雲端資料修改時間、備份建立時間及歷史版本。移除同步模式、同步狀態、衝突入口、最後同步時間、文字容量及還原前副本下載按鈕。

新雲端備份為未加密 JSON，持有檔案者可讀。只有手動上傳才建立完整快照。上傳前比較最新版本 dataUpdatedAt 與排除 revision／history／undoHistory 的資料 SHA-256；較舊或時間未知須確認，確認後重查雲端身份及本機 revision，變動則停止。完整快照另有 snapshotHash（含長期 history／undoHistory，排除 revision），與最新快照完全相同時不重複建版本，不因去重順便清理。

上傳採 resumable POST／PUT。PUT 完成後取得檔案 ID，確認已列入版本清單，下載回讀與上傳原文逐字比對，再執行正式 readBackup 的結構、完整性、圖片與回覆資產驗證；全部成功才將新檔從 pending 標記為 verified 並允許清理。失敗的新檔保留但不列為有效完整版本、不計入20筆，避免未完成檔被誤認為可還原備份；不自動刪除這些檔案。回讀不會套用資料。授權／離線／上傳／回讀失敗保留本機、未備份標記及全部舊備份，須手動重試，不背景重試。

## 20 筆完整備份政策

- 計入：`lifeSystemFormat=1` 且沒有 `lifeSystemSyncVersion`、不是新制 `backupStatus=pending` 的完整備份，包含舊明文、舊加密與缺少新 lifeSystemBackup 標記的完整備份。舊加密檔仍可用原密碼還原，資料版本 2／3 沿原相容管線讀取。
- 排序：實際 Drive createdTime 優先，舊檔缺此欄才使用 appProperties.backupTime；時間無效則停止整批清理，不猜測先後。
- 新的第21筆上傳並回讀驗證成功，且確認新版本在保留20筆內後，刪除最舊1筆完整備份。原已超額時，日後一次新的手動上傳成功才按相同規則清到20筆；不在登入、重整、列版本、還原或計時器執行清理。
- 舊同步 checkpoint／operation／asset 等以 lifeSystemSyncVersion 分開識別，不計入20筆，不執行同步圖清理；未知／無完整備份標記檔案也不會被此清單誤刪。這些紀錄仍有復原價值，保留。
- 刪除失敗顯示錯誤，不冒稱已維持20筆；新備份仍在，舊檔可能暫時超額。無背景補刪工作。
- 本次開發不連接使用者 Google 帳號、不執行既有資料批次刪除。視窗列出登入帳號當下的完整備份筆數，超額時說明下次上傳後保留20筆。本次真實帳號筆數未讀取，不能以mock或20筆政策聲稱實際只有20筆。另行立即清理既有超額版本需使用者確認；日後手動上傳成功後依上述已授權政策清理，不新增複雜設定。

## 還原與資料保護

開窗只列 metadata；選擇歷史版本或預設最新，按還原才下載、驗證／解密、比較及明確確認。確認後重查檔案身份與本機 revision；最新模式另檢查最新 ID，指定版本不因新增其他版本失效。草稿鎖及跨分頁維護鎖保護原子取代，不合併兩部裝置資料。

手動還原先在同一維護鎖內逐字保存原 primary 與完整舊 journal 至本機 vault，讀回核對後才提交目標。保護失敗、缺圖、損毀、取消或競態不取代原文件。舊圖片與回覆庫引用持續受保護；關窗不取消已提交上傳，未提交還原以 epoch 失效。還原不自動上傳。

## 儲存與備份範圍

| 位置 | 內容 |
| --- | --- |
| localStorage `life-system.data.v1` | 唯一正式生活文件：個人資料、數值、待辦、習慣、設定、角色／出場／切換／刪除ID、好感度與正式評估證據、長期歷史及有效Undo／Redo；另有備份時間、未備份標記、舊同步設定與journal索引等應用鍵。 |
| IndexedDB `life-system.images.v1` | 使用者與角色圖片、縮圖、收藏、有效復原及草稿使用的Blob，以內容hash引用。 |
| IndexedDB `life-system.replies.v1` | 正式日常回覆庫內容，主文件保留引用。 |
| IndexedDB `life-system.chat.v1` | 24小時短期聊天全文；不進雲端備份。正式無全文評估證據仍隨主文件備份。 |
| IndexedDB `life-system.recovery-vault.v1` | 舊同步journal完整封存及還原前本機保護副本，不清除。localStorage原journal鍵可保留索引以減少配額。 |
| sessionStorage | 舊Google短期授權（有效者以原期限遷入專用localStorage並刪舊暫存）與未部署後端認證，不納入備份。AI金鑰／模型另存專用localStorage（依AI_CONNECTION.md），仍不納入正式文件或備份。 |
| Google Drive appDataFolder | 手動完整備份，以及保留但不再啟動讀寫的舊同步紀錄／資產。 |

完整備份包含正式主文件、全部必要引用圖片與裁切設定、正式角色及回覆庫資產。未提交草稿、無引用閒置圖片、短期聊天、認證及API密鑰不納入。不是整個瀏覽器儲存的鏡像；舊同步journal與vault在本機繼續保留，不塞入正式生活文件。

本地時間由成功資料commit更新雲端備份metadata；重載不改時間，還原使用雲端可靠dataUpdatedAt。雲端資料時間只讀dataUpdatedAt，不以檔案建立時間假裝資料修改時間；未知顯示未記錄。備份建立時間獨立顯示，所有介面時間使用Asia/Taipei。

## 自動執行與驗收界線

網站移除同步runtime啟動入口；AUTO_SYNC_ENABLED固定false，runtime本身也拒絕啟用，backupNow拒絕automatic。舊engine／adapter／schema保留作相容與紀錄保護，不由正式網站啟動。commit訂閱只標記待手動備份，沒有上傳deadline、輪詢、排程、背景下載／套用或背景清理。online／focus／登入不啟動同步。

設定頁恢復有效session時會列metadata，開窗／登入／手動操作也會列metadata；GIS腳本預載是既有登入準備，不是備份同步。新手動上傳多一次必要回讀以確保刪除前可驗證。

Google API／GIS以mock驗證，真實Blob、IndexedDB、鎖、資料服務、加解密與還原實際執行；不代表真實Google登入、Location CORS、帳號筆數或實體雙裝置驗收。發布SHA與本次檢查另依完成報告。

## 上傳耗時說明

手動備份會建立完整資料／有效復原／圖片及備援資產快照，計算canonical資料與圖片雜湊、Base64圖片（約增加三分之一內容量），先比較最新雲端版本，再建立resumable upload並傳送。上傳後另外列版本、下載完整新檔、逐位元組比較及readBackup完整資料／圖片／引用驗證，標記verified後再列版本並按20筆政策清理，設定頁最後刷新版本清單。這是多個順序網路與本機工作，不是單次上傳；圖片量、CPU、網路及授權更新都可能影響時間。此次未更動打包、上傳、回讀與保留政策，也未量測真實帳號各階段耗時。
