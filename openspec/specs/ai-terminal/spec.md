# Spec: ai-terminal

## NEW Requirements

### Requirement: Agent Markdown stream 經由專用 endpoint 傳送

系統必須透過一條專用 API / stream endpoint 傳送 AI / agent Markdown chunk，而不是共用 tmux / SSH transport。

#### Scenario: 專用 endpoint 回傳 Markdown chunk
- **WHEN** 前端發起 agent stream 請求
- **THEN** endpoint 逐步回傳 Markdown chunk
- **AND** 前端可持續消費該 stream

### Requirement: Markdown chunk 需即時渲染為 terminal ANSI

前端必須使用 `@wterm/markdown` 把 Markdown chunk 即時轉成 ANSI 並寫入 terminal。

#### Scenario: stream 中即時渲染
- **WHEN** 前端收到新的 Markdown chunk
- **THEN** chunk 被送入 `MarkdownRenderer.push()`
- **AND** terminal 立即顯示新內容

#### Scenario: stream 結束時 flush 剩餘內容
- **WHEN** stream 結束
- **THEN** 前端呼叫 `MarkdownRenderer.flush()`
- **AND** terminal 顯示剩餘尚未輸出的內容

### Requirement: Agent stream 支援 abort 與錯誤回饋

使用者在 stream 過程中必須可以中止請求，且 request failure 需有明確的終端或 UI 錯誤訊息。

#### Scenario: 使用者中止 stream
- **WHEN** 使用者在 streaming 過程中觸發 abort
- **THEN** 請求被取消
- **AND** UI 回到可重新開始的狀態

#### Scenario: stream request 失敗
- **WHEN** endpoint 回傳非成功狀態或串流失敗
- **THEN** 使用者看到明確錯誤訊息
- **AND** 系統不把失敗狀態偽裝成正常 shell output
