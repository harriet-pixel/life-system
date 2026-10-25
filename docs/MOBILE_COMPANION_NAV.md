# 手機頁籤、首頁迷你夥伴與圖示導覽

基準main `19ff71f`。Cloudflare維持暫停，任務交易、AI直連及夥伴mock生成不更動。

- 首頁／待辦內容頁籤傳入`scrollPage:false`：不呼叫垂直scrollTo，不加入為自動定位預留的region class；內容立即切換，保留滑動底線、選取語意、鍵盤、必要的頁籤內水平顯示與現有高度協調。設定頁仍採原預設定位。
- 手機資料頁移除52px獨立設定列預留，名稱與44px設定icon採flex置中同排；名稱22px粗體、頭像與數據列不變，桌面不變。
- 四個已開放導覽入口（首頁／待辦事項／我的資料／設定）在手機與桌面均為線性SVG；保留原href、名稱、title、sr-only、aria-current與鍵盤焦點，未開放文字與水平捲輪／觸控導覽不改。圖示連結position:relative以限制隱藏標籤的定位，避免200%放大後造成頁面橫向溢出。

## 首頁手機夥伴

重用原夥伴DOM與mock對話／情緒，`<1024px`改為fixed浮動、移除原區塊正常排版高度。頭像以clamp(44px,14vw,72px)依裝置寬度縮放，為原生button，預設展開，點擊收合／展開，無4秒自動消失；展開／收合皆有44px無框叉叉，可關閉整組浮動元件。原正式素材尚未提供，沿用頭像佔位，不捏造角色。

僅頭像是拖曳把手，Pointer Events＋pointer capture支援滑鼠／觸控；超過6px才判定拖移，拖完不誤觸收合。頭像可用方向鍵每次移12px、Space／Enter切換，aria-expanded／controls／description保持正確。泡泡依左右餘寬換側，夥伴限制在可見viewport內且避開固定導覽／安全區；長文字換行及泡泡內捲動，不鎖頁面捲動、不主動搶焦點。

位置、收合與關閉狀態只留該文件的cached home view記憶體，站內離開／返回保留，不寫入正式資料或Undo；真正重新載入恢復顯示與預設展開位置，不將關閉旗標寫入sessionStorage或正式資料。開啟dialog或虛擬鍵盤暫時隱藏，關閉後還原，鍵盤縮小viewport期間不改拖移位置。旋轉／字型／縮放後重新限界，尊重既有reduced-motion；不新增拖移動畫、漸層或厚重陰影。

桌面恢復原portrait DOM位置及對話列，移除手機toggle wrapper，不改桌面立繪外觀。待辦頁既有完成後4秒浮動回應不改。

## 驗證

`tests/mobile-navigation-companion.cjs`涵蓋320／375／390／430／450／451／768／1024／1280px：原生滑鼠／觸控拖移不誤收合、鍵盤移動、常駐超過4秒、視窗／模擬鍵盤避讓與位置恢復、四字型及200%縮放、主頁籤無程式垂直捲動、名稱同排設定、四個圖示路由與目前頁狀態、cached view還原。另回歸settings-tabs32種寬度／字型、app-shell、頁籤底線與待辦浮動防護。

虛擬鍵盤為visualViewport模擬，未以實體手機／iOS驗收。夥伴維持mock，沒有新增正式AI／角色串接。

泡泡依左右餘寬及viewport比例設定彈性上限，頭像縮放後仍至少44px，關閉在泡泡內或收合頭像旁，44px觸控範圍不縮。tests/key-privacy-home-close.cjs驗證金鑰介面不可回看、正常認證、彈性尺寸、兩種狀態關閉、cached route維持關閉及重整顯示、桌面隔離與200%縮放。
