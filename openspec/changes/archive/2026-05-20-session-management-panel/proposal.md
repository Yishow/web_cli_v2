# Change: session-management-panel

## Why

目前 web_cli_v2 的使用者只能透過 header 的文字輸入框手動鍵入 tmux session 名稱，然後點擊「連線」按鈕建立或連接到該 session。這個流程存在幾個問題：

1. **看不見現有 session**：使用者無法得知伺服器上目前存在哪些 tmux session，只能憑記憶輸入名稱。如果忘記 session 名稱，就無法重新連接，等於丟失了該 session 中的所有工作狀態。
2. **無法切換 session**：使用者想要從一個 session 切換到另一個 session 時，需要手動清空輸入框、輸入新名稱、重新連線，操作繁瑣且不直覺。
3. **無法刪除 session**：不再需要的 tmux session 會持續佔用系統資源（記憶體、程序），使用者必須另外開一個終端執行 `tmux kill-session` 才能清理，嚴重破壞使用體驗的完整性。
4. **缺乏 session 資訊**：使用者無法得知每個 session 的狀態（是否正在 attached）、建立時間、包含多少 window 等基本資訊，難以做出管理決策。

tmux session 是 web_cli_v2 持久化終端的核心抽象。一個好的 session 管理體驗應該讓使用者輕鬆查看、切換、管理所有 session，就像瀏覽器管理分頁一樣自然。目前的手動輸入方式只適合進階使用者且需要記憶 session 名稱，不符合「開箱即用」的產品目標。

## What Changes

1. **後端 API — 列出 sessions**：在 `server.ts` 新增 `GET /api/sessions` HTTP endpoint，執行 `tmux list-sessions` 並回傳結構化的 JSON 陣列。每個 session 物件包含名稱、狀態（attached/detached）、建立時間（透過 `tmux show-option -g` 或 session 的建立時間戳）、window 數量（透過 `tmux list-windows -t <session>` 計算）。
2. **後端 API — 刪除 session**：在 `server.ts` 新增 `DELETE /api/sessions/:name` HTTP endpoint，執行 `tmux kill-session -t <name>`。需加入輸入驗證防止 command injection（session 名稱只允許 `[a-zA-Z0-9_-]`）。
3. **前端 UI — Session 管理面板**：在 `app/page.tsx` 新增一個可展開的側邊欄或彈窗（建議使用側邊欄從左側滑入），顯示所有 tmux session 的列表。每個 session 項目顯示名稱、狀態指示燈（綠色 attached / 灰色 detached）、建立時間、window 數量。
4. **前端互動 — 點擊切換**：在 session 列表中點擊某個 session 即切換連線（關閉當前 WebSocket → 以新 session 名稱重新連線）。
5. **前端互動 — 刪除**：每個 session 項目旁有刪除按鈕（垃圾桶圖示），點擊後彈出確認對話框，確認後呼叫 DELETE API 並刷新列表。
6. **自動刷新**：面板開啟時定期輪詢（每 5 秒）或手動刷新 session 列表，保持資訊即時。

## Capabilities

### New Capabilities

- `session-listing`: 透過後端 HTTP API（`GET /api/sessions`）查詢伺服器上所有 tmux session 的列表及詳細資訊（名稱、狀態、建立時間、window 數量）
- `session-deletion`: 透過後端 HTTP API（`DELETE /api/sessions/:name`）刪除指定的 tmux session，釋放系統資源
- `session-management-ui`: 前端提供可展開的側邊欄面板，以列表形式展示所有 tmux session，支援點擊切換、刪除、手動刷新
- `session-auto-refresh`: 面板開啟時自動定期輪詢 session 列表，保持資訊即時更新

### Modified Capabilities

- `web-terminal-ui`: header 區域新增「Sessions」按鈕（帶 session 數量 badge）用於開啟管理面板；現有的 session name input 保留作為快速建立新 session 的入口
- `web-terminal-connection`: 支援從 session 列表快速切換連線（斷開當前連線 → 以新 session 名稱重新連線），無需手動輸入名稱

## Impact

- Affected code:
  - `server.ts` — 新增 HTTP API route handler（`GET /api/sessions`、`DELETE /api/sessions/:name`），在 `createServer` 回呼中加入 URL 路徑判斷
  - `app/page.tsx` — 新增 session 管理面板 UI（側邊欄）、API 呼叫邏輯、自動刷新、切換/刪除互動
  - `app/globals.css` — 新增側邊欄相關樣式（若使用 Tailwind 則不需要額外 CSS）
- Affected systems:
  - 後端 HTTP API 層（server.ts 的 route handling，需與 Next.js request handler 共存）
  - 前端終端連線管理（WebSocket 連線的斷開與重連流程）
  - 前端 UI（header 新增按鈕、側邊欄面板）
- Verification impact:
  - 功能驗證：建立多個 tmux session 後確認列表正確顯示
  - 刪除驗證：刪除 session 後確認 tmux session 確實被清除
  - 切換驗證：點擊 session 列表項目後確認終端正確切換到目標 session
  - 安全驗證：嘗試傳入惡意的 session 名稱（含特殊字元），確認 API 拒絕處理
  - 即時性驗證：在其他終端建立/刪除 session 後，確認面板列表在輪詢週期內更新
