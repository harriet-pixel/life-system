# Git 連線診斷

診斷範圍：此任務的受管理執行環境，目標 `harriet-pixel/life-system`、來源 `codex/homepage-preview`。沒有要求使用者修改自己電腦的 proxy。

- 大小寫 `HTTP_PROXY`、`HTTPS_PROXY` 均為 `http://proxy:8080`；`ALL_PROXY`／`all_proxy` 未設定；`NO_PROXY`／`no_proxy` 為 `localhost,127.0.0.1,::1`。
- `git config --show-origin --show-scope --get-regexp ...` 查無 Git proxy 設定；對儲存庫 URL 的 `git config --get-urlmatch http.proxy ...` 亦無匹配（exit 1）。沒有清除或修改系統、全域、local Git proxy。
- `/etc/codex/network-policy.json` 明確指定相同 HTTP sidecar proxy；環境是 restricted 模式，`github.com` 在允許清單。此代理由執行環境管理，必須保留。
- 未帶額外網路權限的命令中：proxy DNS 可解析；連 proxy:8080 與 :8088 的 socket 回報 `Operation not permitted`；Git `ls-remote` exit 128、curl exit 7，均停在代理連線之前。這些錯誤不能當作 GitHub 拒絕認證，也不能證明代理服務本身故障。
- 對單次 `exec_command` 使用受支援的 `with_additional_permissions`、`network.enabled=true`，保留原代理與 TLS 驗證後，`git ls-remote --exit-code origin refs/heads/codex/homepage-preview` 成功，取得 `5313d04d3c93f86712c955f3f101138e016b2a29`。後續 Git fetch 成功取得完整 Git objects、來源分支及實際 WOFF2，不是只透過 GitHub 工具讀取文字。
- 結論：本次阻礙是命令沙箱的網路權限，並非過期 Git proxy；無須刪 proxy、繞過 sidecar、重建環境或要求使用者重新連接 GitHub。讀取成功本身不等同推送權限，推送以實際 Git 結果為準。
- 環境診斷工具當時沒有保留的網路 log bundle；其缺少紀錄不作為網路健康證據。

另外，預覽伺服器最初使用 `0.0.0.0` 被自動審查拒絕，理由是會對外暴露專案檔案；已改為受支援且僅綁 `127.0.0.1:3000` 的本機測試服務，沒有繞過審查或公開工作目錄。
