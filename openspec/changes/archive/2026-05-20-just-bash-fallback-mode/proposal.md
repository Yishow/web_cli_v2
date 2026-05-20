# Change: just-bash-fallback-mode

## Why

官方 `wterm` 的 `examples/nextjs` 展示了一個很實用但和本專案目前不同的能力：**完全在瀏覽器內執行 shell，不需要任何後端**。這是 `@wterm/just-bash` 的價值所在。

對 `web_cli_v2` 而言，這條路線最適合的定位不是「正式第三種工作模式」，而是：

- demo shell
- onboarding shell
- 當 local / ssh 尚未連上時的 fallback terminal

這樣既能借到官方 capability，又不會把產品語意從「本機 tmux / 遠端 SSH」拉得太散。

## What Changes

1. **新增 browser-only demo / fallback shell**：提供一個以 `@wterm/just-bash` 驅動的純前端 shell。
2. **不把它當正式第三種工作模式**：UI 上明確標示為 demo / fallback shell，而不是與 local / ssh 完全等價的工作模式。
3. **預載虛擬檔案與 greeting**：讓使用者進去後立即有可探索內容。
4. **不需要後端 transport**：此模式不依賴 WebSocket / tmux / ssh2。
5. **維持現有主工作流**：local tmux 與 ssh 仍是正式 shell；just-bash 只作為補充體驗。

## Capabilities

### New Capabilities

- `browser-fallback-shell`: 使用者可以開啟一個完全在瀏覽器內執行的 demo/fallback shell
- `browser-shell-filesystem`: 系統預載一組虛擬檔案，讓使用者可立即探索與操作

### Modified Capabilities

- `web-terminal-ui`: 在 disconnected / onboarding / fallback 情境下，UI 能提供 browser-only shell 入口
- `web-terminal-rendering`: terminal runtime 或相鄰 shell 邊界需能支援「無後端 transport」的 terminal source

## Impact

- Affected code:
  - `app/page.tsx` — 新增 demo/fallback shell 入口與對應 UI
  - `app/terminal-runtime/*` 或相鄰 shell adapter — 視設計決定是否共用 runtime 邊界
  - 可能新增 `app/browser-shell.ts` / `app/browser-shell-files.ts`
  - `package.json` — 新增 `@wterm/just-bash` 依賴（若尚未存在）
- Affected systems:
  - Browser terminal UI
  - 前端 shell initialization
  - onboarding / fallback user flow
- Verification impact:
  - 需要驗證 local / ssh 主工作流不受影響
  - 需要驗證 just-bash shell 可離線啟動、可操作、可顯示預載檔案
  - 需要驗證 UI 清楚標示其 demo / fallback 性質
