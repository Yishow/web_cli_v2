# Design: just-bash-fallback-mode

## Context

官方 `examples/nextjs` 的重點是：

- `@wterm/react` 渲染 terminal
- `@wterm/just-bash` 在瀏覽器內執行 shell
- 預載虛擬檔案系統
- 不需要後端

這和本專案目前的 local tmux / SSH shell 差很多。`web_cli_v2` 的主要價值仍然是**真的工作 shell**；因此如果直接把 just-bash 做成正式第三種 mode，會讓使用者誤以為它和 tmux / SSH 一樣可用於長時間工作。

所以本 change 採取較保守但更有產品感的定位：**demo / fallback shell**。

## Goals / Non-Goals

**Goals**

- 提供一個 browser-only shell 作為 demo / fallback
- 不依賴後端 transport
- 預載一組有意義的虛擬檔案與 greeting
- 清楚區分它與 local / ssh 的產品語意
- 不讓 just-bash 把主要工作流複雜化

**Non-Goals**

- 不把 just-bash 當正式第三種 production shell
- 不做 browser shell persistence
- 不做 package install / sandbox persistence / 長時工作區
- 不把 local session sidebar / ssh form 套到 browser shell 上

## Decisions

### Decision: just-bash 以 demo / fallback entry 存在，不作為正式 mode switch

UI 上提供一個明確入口，例如：

- disconnected 狀態下的「Try Demo Shell」
- 或 header 內次級 CTA（不是主 mode switch）

進入後 shell 區域可以切換成 browser shell，但 UI 必須持續標示它是：

- browser-only
- no backend
- no persistence

這樣使用者不會誤解它與 tmux / SSH 的地位相同。

### Decision: 預載固定虛擬檔案，而不是接真實檔案系統

沿用官方 example 的思路，預載一組固定檔案，例如：

- `README.md`
- `package.json`
- `hello.sh`
- 與本專案相關的 demo 檔案（例如 `SSH_NOTES.md`、`THEMES.md`）

這能讓 demo shell 一進去就可探索，不需要額外教學。

### Decision: browser shell 不共用 local / ssh transport 狀態

just-bash 沒有 WebSocket / tmux / ssh2，因此不應硬塞進現有連線狀態語義中。它可以與 runtime 邊界相鄰，但不應偽裝成：

- reconnectable remote shell
- deletable session
- persisted workspace

如果實作上需要與 `app/terminal-runtime/*` 共用某些 UI contract，也只共用最外層 shell contract，而不是 transport-specific state。

### Decision: browser shell 資料不持久化

第一版不把 just-bash shell 的檔案內容、歷史或使用者輸入持久化。重新整理頁面後回到預設 demo 狀態。

這和它的 demo / fallback 定位一致，也避免額外維護瀏覽器 storage 格式。

## Risks / Trade-offs

- **語意混淆**：若 UI 標示不夠清楚，使用者可能以為 just-bash 和 tmux/SSH 是同等工作模式
- **runtime 邊界複雜化**：若過度硬塞到同一 transport contract，會讓 runtime 變難懂
- **功能期望落差**：使用者可能期待 persistence 或真實系統工具，需在 UI 上先講清楚

## Migration Plan

1. **Phase 1 — fallback entry 與 UI 標示**：在 page shell 補上 demo/fallback 入口與 banner
2. **Phase 2 — just-bash shell adapter**：建立 browser shell adapter 與虛擬檔案集
3. **Phase 3 — shell 切換**：讓使用者可在 local/ssh 主工作流之外暫時進入 browser shell
4. **Phase 4 — verification**：驗證 browser shell 可操作，且 local / ssh 主工作流不回歸

## Open Questions

- fallback shell 的入口最終應放在 disconnected empty state，還是 header 次級 CTA？
- demo files 要偏官方示範，還是偏本專案教學內容？
