# 共用按壓、頁籤底線與事件分隔

基準：遠端 main `651720fddbb2c3695ff4ecab1d6975f0dbc90892`。不變更事件、數值、AI、完成、復原或備份資料流程；Cloudflare 暫停。

## 共用互動

四個 HTML 最後載入 ui-feedback.css；app-shell 每份 document 只初始化一次 ui-feedback.mjs，涵蓋現有、動態產生及路由返回的頁籤／對話框，不逐頁註冊點擊處理。

- 一般 button 按住時主題色10%淡底、transform scale(.97)，100ms回復；實心主要按鈕沿原 accent 與 on-accent 可讀文字色，brightness(.94)。不改文字、字級、padding、border-box或排版。
- 小型SVG／工具／日期＋等icon按鈕以淡主題色圓形背景回應，不縮圖示；原有無框叉叉平時無框無底色，焦點提示保留。
- checkbox／radio本身及aria-pressed事件多選、色票、月曆日期不套一般縮放，既有選取與停用狀態維持。完成仍立即暫時打勾，正式交易成功後才播原獎勵。
- 原行動瀏覽器 tap highlight 為 rgba(51,181,229,.4)，改透明；另將既有hover限定真實hover／fine pointer，並以最後指標種類抑制觸控殘留。鍵盤focus-visible仍清楚，不全面移除outline。
- 原生觸控:active在Chromium模擬輸入中按住時延後、放開後仍可能短留，故CSS之外使用一組passive、capture的Pointer Events委派，僅觸控／筆維護暫時data-pressed。up／cancel／移出／多指／失焦／移除或停用時清除；不preventDefault、不改capture、不攔點擊或正常捲動，不記錄資料。滑鼠沿原生active，鍵盤Enter／Space保留原操作。沒有獨立touch與mouse重複監聽。
- reduced-motion取消縮放及底線平移，仍有淡底／輕微明暗與直接定位的選取線。

## 單一頁籤底線

每個role=tablist以一個::after畫選取線。原有按鈕邊框保留幾何但透明化，原選取外框／實心底改為主題文字與單一底線；keyboard focus-visible獨立保留。所有tab按住無淡底、無縮放。只根據aria-selected觀察，不攔截內容、鍵盤、450／451px定位、等高或原生水平捲動。

線寬以1px基底scaleX、位置以translate3d；200ms cubic-bezier(.22,1,.36,1)，快速選取直接改最新transform，內容不等待。初次顯示直接定位，隱藏modal／路由返回、ResizeObserver、font loadingdone、尺寸／文字／選取變動、水平scroll均重新核對座標。包含scrollLeft／client border，亦支援換列的tab下方位置。沒有逐幀JavaScript動畫；同目標重查不取消正在進行的CSS transition。observer自訂style變動會去重，卸下的tablist解除ResizeObserver並清除狀態。

## 事件名稱分隔

只改裝飾separator為單一半形空格、全形直線、單一半形空格：` ｜ `。任務看板／懸而未決／常駐任務及兩個安排選取頁籤沿共用task-name-layout服務；column-gap等於separator在當下字型的實測文字寬度，沒有額外48px空間。separator是下一項的absolute前綴，aria-hidden／pointer-events:none，不是按鈕或名稱；行首前綴隱藏，所以不會在行尾留下孤立分隔。resize、分類收合、四種字型、200%文字變更皆重新核對行首。

名稱、簡述和儲存內容不trim或取代；名稱後簡述／分類的1em保留。長名仍省略、title及原操作窗保留全文；不改按鈕既有padding／觸控框。

## 驗證與限制

- ui-feedback.cjs：320、375、390、450、451、768、1024、1280px，讀取多個實際RAF中間transform、快速反向切換、內容立即切換、旋轉、四字型、鍵盤焦點、滑鼠按住、CDP觸控輸入與減少動態。
- ui-tab-pages.cjs：首頁、待辦、我的資料設定／圖片頁籤、設定；四字型、可橫捲tablist、深／淺主題、單例初始化。
- ui-touch-states.cjs：觸控取消／拖動、icon不縮放、停用／calendar／radio／tab排除，未攔截原有操作。
- ui-geometry.cjs：以舊main的唯讀靜態預覽比較四頁及資料對話框，375／1280px按鈕文字、尺寸、位置、padding與font完全相同。需另啟動舊版BASELINE_URL，預設3007；不將baseline檔案放進發布。
- event-separators.cjs：六種寬度、四字型、200%文字、分類收合、長名、同列分隔字串與gap實測，使用者名稱中的全形與連續空格保持。

瀏覽器自動化使用Chromium原生滑鼠／觸控輸入管線及viewport模擬，沒有實體手機或iOS Safari驗收。資料／獎勵沿既有mock與共用交易回歸；沒有真實AI／Drive連線測試。
