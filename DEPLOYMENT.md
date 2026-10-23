# GitHub Pages 發布

`main` 是完整原始碼，`gh-pages` 是建置成果。網站採原生靜態檔案、相對路徑，可在 `/life-system/` 子目錄執行；建置使用 `npm run build`，網站執行不需Node。

## 既有設定與網址

GitHub儲存庫Settings → Pages → Build and deployment，使用 **Deploy from a branch → gh-pages → / (root)**。未要求時不更換託管、網域或儲存庫公開狀態。

- https://harriet-pixel.github.io/life-system/
- https://harriet-pixel.github.io/life-system/profile.html
- https://harriet-pixel.github.io/life-system/settings.html

## 每次發布

1. 保護工作區修改，取得最新main與gh-pages。此checkout可能只設定抓main，另明確執行：

   ```sh
   git fetch origin
   git fetch origin refs/heads/gh-pages:refs/remotes/origin/gh-pages
   git ls-remote origin refs/heads/main refs/heads/gh-pages
   ```

2. 比較三頁與所有assets的實際內容；發布分支有獨有功能修正時先保留並安全整合回來源，不直接用較舊main覆蓋。
3. 若HTML結構與模組配套變更，必須同步更新HTML入口、相關樣式及變更子模組的URL版本；只更新入口不會使未版本化的import失效。以 tests/settings-cache.cjs 驗證暖快取升級，不要求使用者清除儲存。
4. 在最新來源執行lint、單元與變更相關瀏覽器測試。從乾淨的work/build執行 `npm run build`，避免殘留已移除資產；對建置後的子路徑再次驗證。
5. 將來源更新提交並安全推送main。發布commit必須以最新gh-pages為parent，tree為work/build中的index.html、profile.html、settings.html與完整assets，另保留.nojekyll、CNAME及既有必要發布設定。三種自託管字型、LICENSE、SOURCE.md均包含，不沿用舊單頁白名單。不發布Git、測試、文件、截圖、中繼檔或環境憑證。
6. 逐檔確認產物與發布tree一致，推送前核對遠端是否新增提交。使用非強制的fast-forward推送；需要同時更新兩分支時可用atomic push。不可直接將gh-pages指向原始碼commit，也不改寫歷史。
7. 查明對應發布SHA的 **pages build and deployment** workflow成功；再檢查公開三頁、互相導覽、必要JS／CSS與字型資源。推送、部署與公開網站實測是三個不同結果。

OAuth未設定時維持空的公開client ID；若管理者完成Console設定，建置可提供公開 `GOOGLE_OAUTH_CLIENT_ID`。不把secret、token或私鑰放入前端；細節見 [SETTINGS.md](SETTINGS.md)。

## AI 後端與靜態成果隔離

設定頁正式後端模式預設未設定；明確啟用的瀏覽器直連測試不需登入或後端，一組 key 僅在該分頁專用 sessionStorage 最長兩小時，不包含於發布檔。`backend/`、env 與後端認證設定不得進 work/build／gh-pages；建置只接受公開 AI_BACKEND_URL，並驗證完整 HTTPS `/v1/ai`。未完成實際後端與登入驗收時保持空值。平台、JWT／scope、proxy 日誌政策與單 process 限制見 [AI_CONNECTION.md](AI_CONNECTION.md)。不把 Pages 發布成功當成後端已可用。

## 驗證及阻礙回報

本機驗證三頁布局、保存／重開、跨分頁、Undo／Redo、圖片與備份，涵蓋375px、450／451px、1024px及桌面等相關邊界。公開網站須另外確認實際部署內容與資源可讀。

環境網路受限時保留平台代理，不要求使用者修改自己電腦。分別回報程式／測試、main推送、gh-pages推送、Pages部署及公開網站實測；403或無法存取不能當成網站通過，也不能以本機預覽代替公開網址實測。過去連線或測試結果僅記於 [歷史交付紀錄](docs/DELIVERY_HISTORY.md)。
