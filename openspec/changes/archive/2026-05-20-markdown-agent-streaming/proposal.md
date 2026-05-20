# Change: markdown-agent-streaming

## Why

官方 `examples/markdown-streaming` 展示了另一條很有價值的 terminal 用法：**不是把 terminal 當 shell，而是把 AI / agent 的串流 Markdown 輸出即時渲染成 ANSI terminal**。

這對 `web_cli_v2` 很有吸引力，因為它天然適合：

- 顯示 agent 執行過程
- 顯示 AI 產出的可讀 Markdown
- 保持 terminal 式閱讀體驗

但它和現有 local tmux / SSH shell 不完全一樣，因此第一版最合理的落點是：**新增一條專用 API / stream endpoint，將 AI / agent Markdown 輸出送進一個專用 terminal 視圖**。

## What Changes

1. **新增 AI / agent Markdown 串流 terminal**：用 `@wterm/markdown` 把串流 Markdown 轉成 ANSI 終端輸出。
2. **新增專用 API / stream endpoint**：由 server 或 route 專門提供 agent/AI output stream，而不是重用現有 tmux / SSH transport。
3. **將其定位為專用 agent stream 視圖**：避免和一般 shell mode 混成同一種互動模型。
4. **支援串流中止與錯誤顯示**：類似官方 example 的 `Ctrl+C` abort 與 request failure feedback。

## Capabilities

### New Capabilities

- `agent-markdown-terminal`: 系統可把 AI / agent Markdown 串流渲染到 terminal
- `agent-stream-endpoint`: 系統提供一條專用 stream endpoint 傳送 Markdown chunk

### Modified Capabilities

- `web-terminal-ui`: UI 能提供 agent stream terminal 的入口與狀態顯示
- `web-terminal-rendering`: terminal 不只支援 shell output，也支援 read-only / stream-style Markdown output

## Impact

- Affected code:
  - `app/page.tsx` — 新增 agent stream 視圖入口或切換
  - 可能新增 `app/agent-stream.ts` / `app/agent-shell.ts`
  - server 或 route 層新增 `/api/agent-stream`（名稱實作時定稿）
  - `package.json` 需引入 `@wterm/markdown`（若尚未存在）
- Affected systems:
  - Browser terminal UI
  - AI / agent streaming API
  - Terminal rendering path
- Verification impact:
  - 需要驗證 Markdown chunk 可即時渲染
  - 需要驗證 abort / error handling
  - 需要驗證 local tmux / ssh / browser fallback 等既有工作流不回歸
