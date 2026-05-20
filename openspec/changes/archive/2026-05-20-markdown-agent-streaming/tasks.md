# Tasks: markdown-agent-streaming

## Tasks

## Progress

- [x] Task 1: 定義 agent stream terminal 的 UI 入口與狀態
- [x] Task 2: 建立專用 API / stream endpoint
- [x] Task 3: 建立 terminal 端 Markdown stream renderer
- [x] Task 4: 補 abort / error / retry handling
- [x] Task 5: 驗證 agent stream 與既有 shell 工作流共存

### Task 1: 定義 agent stream terminal 的 UI 入口與狀態
- **檔案**: `app/page.tsx`，必要時新增 focused shell helper
- **改動**:
  1. 新增 agent stream terminal 的入口
  2. 定義 loading / streaming / error / idle state
  3. 清楚區分它與一般 shell session 的語意
- **驗證**: 使用者可分辨 agent output terminal 與一般 shell

### Task 2: 建立專用 API / stream endpoint
- **檔案**: route 或 server 層（名稱實作時定稿）
- **改動**:
  1. 新增專用 endpoint 回傳 Markdown chunk stream
  2. 定義 request payload 與 response stream contract
  3. 不重用 tmux / SSH transport
- **驗證**: endpoint 可被前端持續讀取，並逐步回傳 Markdown chunk

### Task 3: 建立 terminal 端 Markdown stream renderer
- **檔案**: `app/agent-shell.ts` / `app/agent-stream.ts`（名稱實作時定稿）
- **改動**:
  1. 以 `@wterm/markdown` 建立 chunk → ANSI renderer
  2. 將 stream chunk 寫入 terminal
  3. stream 結束時 flush 剩餘內容
- **驗證**: Markdown headings / lists / code block 在 terminal 中可讀

### Task 4: 補 abort / error / retry handling
- **檔案**: 前端 shell helper 與 endpoint
- **改動**:
  1. 支援 `Ctrl+C` 或 UI action 中止 stream
  2. 顯示 request failure / partial output / retry UI
  3. 明確處理 aborted stream 的狀態轉移
- **驗證**: 中止與錯誤都有一致且可理解的 UX

### Task 5: 驗證 agent stream 與既有 shell 工作流共存
- **檔案**: 無（驗證任務）
- **改動**:
  1. 執行 lint / typecheck / build / tests
  2. 驗證 agent stream terminal 的流式渲染
  3. 驗證 local tmux / ssh / browser fallback 不回歸
- **驗證**: agent stream 可用，且既有終端工作流維持正常

## Notes

- 第一版明確是「agent / AI output terminal」，不是完整聊天產品
- 若未來需要 conversation persistence、multi-turn history、model selector，應另開 change
