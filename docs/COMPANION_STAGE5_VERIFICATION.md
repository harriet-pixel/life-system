# 夥伴第五階段：正式短期 AI 聊天

執行基準：最新遠端 main `ef39f6d`（含第四階段後的首頁待辦修正），gh-pages `49cdb52`；工作區原先乾淨，以快轉接續，未從舊預覽分支開始。只開發第五階段，未建立新網站、後端、Cloudflare、回覆庫或首頁招呼。

## 資料與一致性

短期資料在同來源獨立 IndexedDB `life-system.chat.v1`，只有 turns object store，roleExpiry 複合索引與 expiry 索引；不升級、不混用既有圖片資料庫。每回合有穩定 chatTurnId、requestId、attempt、角色ID／建立身份、人格版本、當時關係階段及出場切換次數。user／assistant 各自包含messageId、角色／回合ID、文字、建立時間、獨立expiresAt與狀態；AI訊息另有情緒、分類及格式備援標記。時間以毫秒保存，expiresAt嚴格等於createdAt＋86400000。

僅目前查看角色按索引讀取，最多120回合；可見訊息DOM最多120則，上下文最多最近24則已完成、未過期的同角色訊息，另加本次使用者訊息。每次進入／換角色、前景、發送前及必要事件排除過期資料；有可見訊息時只安排一個最近到期的單次計時器，離頁取消。實體清理每次最多256筆已到期回合，不高頻輪詢。回合到期時間取兩則訊息較晚者，較早到期訊息立即從畫面及上下文排除，整列最遲於回合清理時移除。封存可查看但不能發送；刪除／建立身份不符的孤立聊天永不顯示。

主文件只有 affinity 的選填 chatEpoch／chatAssessments，沒有聊天全文、摘要或另一份餘額。正式聊天入口為 dataStore.commitChatAssessment，仍走原 Web Lock、revision、affinityTransaction 與最高階段邏輯，不從UI改分數。不加入一般history或Undo，不重算生活來源／返還／撤銷。receipt只含角色ID、建立時間、epoch、configVersion、請求階段、評估分類、回覆雜湊及交易ID。neutral也建立零分交易及持久去重證據；正向無每日上限，negative遵守原總開關／chat來源／limit／最低0。

跨儲存順序：先存user與chatTurnId → 單次AI → 驗證／存ready結果 → 核對角色／版本／有效請求並提交text-free receipt → 發布complete訊息。ready是可恢復的短期提交日誌，receipt是計分權威；任何純本機失敗都沿同ID恢復，不重新呼叫AI。計分後IDB寫入失敗，重新載入仍可由ready＋receipt發布回覆；同回合不同結果雜湊停止，不重複計分。每角色生成鎖跨分頁持有至提交完成，不持有全站資料寫鎖等待網路；同文件重複送出即停用。

正式還原（dataStore.replace）在目前或備份已啟用聊天時產生新的chatEpoch，原評估證據仍完整保留；舊短期回合與新有效epoch不符便隱藏，不能在還原後再次入帳。這是保守邊界：還原不延續原本的短期聊天室，不嘗試猜測／合併舊訊息。舊版缺companion／affinity的備份安全補空結構。備份完全不開啟或掃描聊天DB，明文／加密／手動Drive均只包含主文件的正式證據。API金鑰沿既有專用session，不寫聊天DB／主文件／日誌／備份。

## 共用 AI 與 Token 預算

唯一 getSharedAIConnection，沿既有provider／model／timeout／cancel與使用者明確開啟的瀏覽器直連模式。沒有新客戶端、模型選單、金鑰機制或後端。無連線可讀舊訊息和編輯有效出場角色的草稿，但不能發送。恢復既有測試session後首次生成可能先查官方模型清單（GET，不是生成），正常每次送出只有一次生成POST；沒有JSON修復重送、第二次好感度AI或背景重試。

沿現有客戶端4000 UTF-16字元／256 output tokens上限；輸入最多800字元。使用穩定預算保留核心人格、界線、必要身份與當前階段8欄，不傳其他6階段、個人資料、待辦、習慣或備份。歷史保留明確user／assistant與每則時間，僅作引述資料；提供Asia/Taipei本次日期時間，與全站繁體中文規則同送。最多24則，超長時由最近向前填入剩餘長度，不建立永久摘要。

回應只讀dialogue／emotion／affinityAssessment。支援純JSON與有限code fence；文字需有效，評估只允許positive／neutral／negative。缺評估的有效回覆以中性0並標「格式備援」；無效分類整回合停止計分，可手動重試。未知情緒正規化neutral；合法情緒即使缺圖也保留，圖片層依第四階段備援。

## 介面與生命週期

仍只有聊天室／角色設定兩頁籤；聊天室模組與DB僅首次開啟聊天室才載入，失敗只提示聊天室，角色設定／首頁／生活頁仍可用。角色選擇只是查看，只有正式未封存角色能新聊天。生成期間取消可用，換預覽／出場、重要人格、封存刪除、連線變更或離開聊天室，使舊請求失效並沿共用AI取消；返回不自動重送。失效的舊待提交結果不能堵住新聊天，明確手動重試才重新生成。

各角色輸入／捲動只留目前文件記憶體，真正重載不恢復未送出草稿。站內返回與頁籤保留；聊天草稿不持角色設定維護鎖，不阻擋正式備份。送出user成功保存後才清除對應輸入，生成期間新打的文字不清掉。接近底部才跟捲；閱讀舊訊息以錨點補償DOM更新，換角色保存捲動。安全textContent呈現AI文字。

桌面沿3:4左立繪與右側獨立訊息捲動；最新有效AI情緒驅動立繪。手機無大圖、頂部固定neutral，各訊息自己的emotionId／小縮圖／獨立裁切。未用URL隨既有圖片顯示器釋放，無原圖逐訊息解碼。四字型、200%文字與8寬度沿共用樣式／導航／visualViewport避讓。

## 驗證

本次功能驗證：

- npm run lint、npm run build、git diff --check通過。建置只含六頁與assets，562個檔案逐位元對應來源（發布另保留.nojekyll）。
- npm test：255／255（最新main原244＋新增chat.test.mjs 11項），含既有生活交易／返還／撤銷／圖片／備份及新分類、零分證據、負向政策／floor、49→50、無日上限、過期、版本失效、還原epoch、上下文預算與臺灣時間。
- chat-browser.cjs：24項，透過共用AI與mock DeepSeek官方接口實際生成、單次POST、prompt角色／時間／階段、正負政策、分類拒絕與neutral備援、安全文字、手動同回合重試、角色隔離、草稿、取消晚回覆、明文／加密無聊天全文、還原不重播。
- chat-safety.cjs：11項，真實IndexedDB／Web Locks與測試用生成stub，注入「AI後正式提交失敗」及「計分後IDB發布失敗」，均本機恢復且AI不重送；原user不重複、晚回覆失效。兩角色600回合（300到期）每次最多清理256、目前角色讀取與投影最多120、沒有過期／其他角色文字，正式receipt保留。最後清理＋讀取診斷234ms（不同負載樣本144–234ms），不是低階實機保證。
- chat-sync-layout.cjs：69項，雙分頁同回合只計一次、重載由ready＋receipt恢復、跨分頁訊息通知、站內草稿、4字型×8寬度×100／200%（64組）。
- characters.cjs 42、affinity.cjs 40、characters-backup.cjs 13、companion-ui.cjs 81、companion-layout.cjs 203、companion-cache.cjs 16；後者使用確切ef39f6d快取升級，保留舊角色／階段且新版圖片驗證可提交。舊角色／UI測試的停用聊天室與假訊息斷言依本階段改成連線／預覽限制與無假訊息；沒有放寬正式資料／交易斷言。
- character-images.cjs 40、character-images-safety.cjs 81、character-images-transactions.cjs 8：三格式、八情緒、獨立裁切、引用／清理／備份、快切、reduced-motion、有界URL、32角色及811304-byte立繪等原圖片流程通過。
- settings.cjs、tasks.cjs、habits.cjs、home-first-paint.cjs：原資料、外觀、個人立繪／最愛／引用、Undo／Redo、還原原子失敗、待辦／習慣八寬度、雙分頁去重、首頁早期正式清單及四字型／兩寬度通過。
- ai-browser-mode.cjs：Gemini／DeepSeek／OpenAI／Claude四家mock官方API，原設定→首頁→我的資料→重載生成、金鑰手動壽命／取消／切換／清除／year-old session、備份隔離與安全文字通過。舊測試原本查找已移除的ai-expiry與不含現行歡迎短句的正則，已改為實際風險提示、session expiresAt=null與既有歡迎文案；沒有改AI安全或連線實作。

共17支功能瀏覽器腳本；明確計數628項（新聊天104＋既有524），另四家AI與既有設定／生活操作矩陣不虛報固定筆數。聊天生成網路是mock，儲存／雜湊／加解密／鎖／revision／還原是真實瀏覽器實作。真正模型生成未驗，沒有實際金鑰或新增後端。

## 效能診斷

同一靜態伺服器，ef39f6d對照目前建置。三輪交錯的首頁今日清單中位數（375px，ms）：

| 模式 | 第四階段基準 | 第五階段 |
| --- | ---: | ---: |
| 冷快取 | 1061 | 1013 |
| 暖快取 | 192 | 329 |
| 150ms延遲／160KiB/s | 3079 | 3132 |

完整18樣本中，第四階段冷快取出現7667ms、第五階段限速出現11902ms，對應首屏前長任務約990／1512ms；不能用單次樣本宣稱加速或把波動都歸因聊天。初次單組為980／225／3076對1530／260／3170ms，故追加交錯測量。三輪暖載入第五階段較慢137ms，另固定device字型交錯五輪的暖載入中位數153→204ms（+51ms）。這項延遲尚未能確定單一原因，實機仍應驗收；沒有宣稱零退化。

資源分析：外框就緒時，普通首頁94→93個資源；量到的未壓縮JavaScript body總量394686→374546 bytes，約少20KiB（統一相依版本，避免原先不同query重複模組）。data／affinity驗證必要增量約1.6KB；所有樣本首頁chatLoaded=false，沒有聊天DOM、聊天IDB或角色圖片解碼。首次較慢樣本並非預載大量聊天／圖片造成，暖延遲也不能在無證據下全歸因字型。實作已採零聊天預載、共用文件不含全文、按索引有界讀取與DOM、小縮圖、有界URL；沒有為不穩定的毫秒數改動生活演算法。

聊天室按鈕到內容可用（單次診斷，含Playwright動作等待；不是API生成時間）：

| 寬度 | 第四階段首次／返回 | 第五階段首次／返回 |
| --- | --- | --- |
| 375px | 67／59ms | 93／58ms |
| 1280px | 66／51ms | 120／63ms |

第五階段首次按需多5個小型聊天模組與一次短期IDB初始化；返回沿同一已掛載介面，只讀目前角色有效範圍。首次增加26–54ms、返回差異-1至+12ms；沒有在首頁支付此成本。診斷用原home-load-timing.cjs、新chat-performance.cjs及保留於忽略work目錄的資源／longtask交錯量測，功能測試不設脆弱的毫秒閾值。真實AI供應商、Google授權、Safari、實體手機／觸控鍵盤及公開網址必須與mock／Chromium分開回報。

## 第六階段界線

回覆庫應使用正式角色ID／configVersion／關係階段與8種emotionId，不能把24小時私人聊天自動灌進日常回覆庫或當永久記憶。不得透過庫回放重新提交chatTurnId評估；新來源需明確去重及權限契約。生活mock及既有回應保持原狀，Cloudflare仍暫停，雲端仍只有手動備份。
