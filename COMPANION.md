# 夥伴回應開發介面

目前是瀏覽器內模擬，無 AI 請求。角色、好感度來源、情緒立繪及正式角色備援皆未設定；不新增人格與數值規則。

## 成功事件

既有示意勾選先更新計數或打卡文字，成功後才發出事件。取消勾選、首次載入、捲動、滑鼠與聚焦不發出事件。未來資料層必須等資料儲存成功才發出：

```js
document.dispatchEvent(new CustomEvent('life-system:action-succeeded', {
  detail: {
    type: 'task.completed', // 或 habit.checked-in
    actionId: '實際操作對象的穩定識別碼',
    label: '剛完成的行動名稱',
  },
}));
```

目前 actionId 是示意清單的項目位置。控制器只接受兩種成功事件；事件本身不是授權或資料持久化證明。450ms 內連續操作會合併，同批同一對象去重。新事件到達立即遞增版本並取消在途請求；舊結果即使忽略取消，也不能更新畫面。已開始生成的批次不再與後來批次合併。

## 生成介面

`createCompanionController` 接受 `generate(request, { signal })`，回傳 Promise：

```js
// request
{
  requestId: 1,
  actions: [{ type: 'task.completed', actionId: '…', label: '…' }],
  context: { character: null, affinity: null }
}
// response：同一則生成結果
{ dialogue: '回應文字', emotion: 'neutral' }
```

目前只接受非空且至多 1000 個 UTF-16 code units 的 dialogue，以及 `neutral`、`pleased`、`calm` 這三個開發情緒槽。正式情緒清單需隨角色素材另行確認，並同步更新驗證與素材對應表。`assets/home.js` 的 `emotionPortraits` 保留每種情緒的 `src` 槽；無素材或圖片載入失敗均顯示對應的文字佔位。文字透過 textContent 寫入，不解讀生成內容為 HTML。

生成期間只更新狀態說明，保留原 dialogue 與 emotion。生成失敗、回傳格式錯誤或超過 8 秒時，顯示中性開發備援短句，不影響已成功的首頁操作。正式角色就緒時以 `fallback(context)` 注入經確認的角色短句。

## 正式串接前必須補齊

- 經確認的角色設定、授權情緒素材及角色備援短句。
- 好感度的權威資料來源與另外定義的變動規則；生成程序不寫入或自動修改好感度。
- 具備適當存取控制的伺服器端 AI 端點。伺服器應取得可信的角色與好感度資料，勿信任客戶端傳來的數值。金鑰只放伺服器端安全設定，不能交給前端或 GitHub Pages。
- 正式首頁資料持久化成功事件。現階段只有記憶體示意成功，重新整理會重設。

GitHub Pages 只能發布靜態前端；目前沒有 AI 端點，不需要也不應在 Pages 中設定 AI 金鑰。

## 目前首頁呈現

歡迎文字與原示意日期最上方，其次為夥伴橫幅、貨幣／等級摘要，再接待辦與習慣；不再將夥伴放在所有主內容之前。移除夥伴標題與聊天室入口；畫面只留一行模擬提示，詳細生成狀態使用 sr-only 公告。新對話採 180ms 透明度動畫，不動畫化高度，減少動態時停用。所有角色／好感度／素材未串接狀態仍如本文件所述，精簡提示不代表已完成串接。
