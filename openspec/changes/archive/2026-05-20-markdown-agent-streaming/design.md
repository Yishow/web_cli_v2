# Design: markdown-agent-streaming

## Context

官方 `examples/markdown-streaming` 採用：

- `@wterm/react`
- `@wterm/markdown`
- 一個 `ChatShell` 類別
- 一條專用 `/api/chat` stream endpoint

這和本專案的 shell transport（tmux / SSH）不同。shell transport 的核心是雙向互動；Markdown stream 的核心是**單向、可中止、可讀性高的內容串流**。

因此這個 change 不應硬塞進現有 local/ssh shell transport，而是應作為一條**專用 agent stream 視圖**。

## Goals / Non-Goals

**Goals**

- 讓 AI / agent Markdown 輸出可在 terminal 中即時閱讀
- 使用專用 API / stream endpoint
- 支援 abort / error feedback
- 不破壞現有 shell 工作流

**Non-Goals**

- 不在第一版做完整 chat product
- 不直接重用 tmux / ssh WebSocket transport
- 不在第一版做 conversation persistence
- 不讓 agent stream 偽裝成一般 shell session

## Decisions

### Decision: agent stream 採專用 endpoint，而非共用 shell transport

新增一條專用 streaming endpoint，例如：

- `/api/agent-stream`

由它負責輸出 Markdown chunk。terminal 端只需要：

- 發起請求
- 消費 stream
- 把 chunk 交給 `MarkdownRenderer`
- 把 ANSI 結果寫回 terminal

這樣可以避免把 tmux / SSH 的 transport contract 混濁掉。

### Decision: agent stream 以專用 terminal 視圖呈現

在 UI 上，它應該是：

- agent / AI output view
- read-mostly terminal
- 可中止、可重試

而不是與一般 shell 完全同義。第一版可以作為：

- 一個獨立視圖
- 或 shell 旁的專用入口

重點是要讓使用者明白：這是 agent output terminal，不是 tmux session。

### Decision: 以 `@wterm/markdown` 做即時 ANSI 轉換

串流 chunk 到來時，前端透過 `MarkdownRenderer.push(chunk)` 持續把 Markdown 轉成 ANSI，再寫入 terminal；stream 結束時 `flush()` 補尾。

這是官方 example 最值得直接沿用的部分，因為它把終端與可讀 Markdown 之間的轉換責任收得很清楚。

### Decision: 第一版支援 abort，但不做 conversation persistence

使用者在 stream 過程中可透過 `Ctrl+C` 或 UI action 中止請求；但第一版不保存對話歷史，也不恢復舊的 agent stream。

這樣能先把「terminal 渲染 + stream lifecycle」做好，不把 scope 擴到完整 AI chat product。

## Risks / Trade-offs

- **產品語意混淆**：若 UI 標示不清楚，使用者可能把它當成一般 shell
- **API 責任界線**：若專用 endpoint 設計太鬆，之後會長成另一套 chat backend
- **串流中止處理**：abort / partial output / retry 的 UX 需清楚

## Migration Plan

1. **Phase 1 — UI 入口與狀態模型**：新增 agent stream terminal 的入口與 state
2. **Phase 2 — 專用 stream endpoint**：建立 API / route 供應 Markdown chunk
3. **Phase 3 — terminal renderer**：以前端 shell/adapter 用 `MarkdownRenderer` 消費 stream
4. **Phase 4 — abort / error handling**：補 Ctrl+C / retry / error UX
5. **Phase 5 — regression verification**：驗證既有 shell 工作流不回歸

## Open Questions

- 第一版的 agent stream 是否需要預設 mock data 模式，方便沒有後端 agent 時開發？
- agent stream 視圖最終是獨立頁籤、同頁切換，還是 shell 旁的附屬面板？
