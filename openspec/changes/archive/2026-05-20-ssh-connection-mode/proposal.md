# Change: ssh-connection-mode

## Why

目前 `web_cli_v2` 的主能力集中在「本機 tmux session + browser terminal」，這很適合本地長時間工作，但仍缺少一個很實用的官方延伸能力：**直接從瀏覽器連遠端 SSH shell**。

官方 `wterm` 已提供 `examples/ssh`，證明這條路線成熟可行：

- 前端先收集 SSH 連線參數
- 第一個 WebSocket 訊息送出連線設定
- 後端以 `ssh2` 建立連線並把 shell stream 接到 browser terminal
- 支援密碼與 private key 兩種驗證

對本專案來說，SSH 模式最有價值的地方不是取代 tmux，而是補上「遠端主機」這個使用場景，同時維持目前已經整理好的 `app/terminal-runtime/*` 邊界，讓未來升版時仍集中在 runtime/transport，而不是把新 mode 的複雜度灌回 `app/page.tsx`。

## What Changes

1. **新增 SSH 連線模式**：在現有本地 tmux mode 之外，新增一個 SSH mode，讓使用者可以切換到遠端 shell。
2. **新增手動 SSH 連線表單**：支援輸入 host、port、username，並可選擇 password 或 private key 驗證。
3. **不持久化 SSH 憑證**：第一版不把 host、username、password、private key 寫入 localStorage 或後端，只保留當前頁面生命週期內的狀態。
4. **新增 WebSocket ↔ SSH bridge**：server 端新增以 `ssh2` 為基礎的 SSH bridge，與現有 tmux transport 並存。
5. **重用 terminal runtime 邊界**：SSH mode 透過 `app/terminal-runtime/*` 擴充 transport / runtime contract，而不是繞過已建立的 adapter 邊界。

## Capabilities

### New Capabilities

- `ssh-remote-terminal`: 使用者可以從 browser terminal 直接連到遠端 SSH shell
- `ssh-auth-form`: 使用者可以在 UI 中手動輸入 host / port / username / auth method / credential

### Modified Capabilities

- `web-terminal-rendering`: terminal runtime 由單一 local tmux transport 擴充為多 mode（local + ssh）
- `web-terminal-ui`: header / shell UI 需能在 local tmux mode 與 SSH mode 間切換，並顯示對應控制項

## Impact

- Affected code:
  - `app/page.tsx` — 新增 mode switch 與 SSH 連線表單 shell
  - `app/terminal-runtime/*` — 擴充 runtime contract、transport 選擇與 SSH mode 支援
  - `server.ts` — 新增 `/api/ssh` upgrade path 或等價 SSH bridge 路徑
  - 可能新增 `app/ssh-mode.ts` / `src/ssh-*` 等 focused helper
- Affected systems:
  - Browser terminal UI
  - WebSocket transport layer
  - Server-side shell/session bridge
  - Security / credential handling
- Verification impact:
  - 需要驗證 local tmux mode 完全不回歸
  - 需要驗證 SSH password / private key 兩種登入
  - 需要驗證 SSH mode 不持久化 credential
  - 需要驗證 resize、disconnect、error handling 與 debug/title 在 SSH mode 下的相容性
