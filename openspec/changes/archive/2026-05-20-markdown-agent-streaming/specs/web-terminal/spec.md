# Spec: web-terminal

## MODIFIED Requirements

### Requirement: Web Terminal 可呈現 agent Markdown stream 視圖

系統可以提供一個專用的 agent Markdown stream terminal 視圖，用於閱讀 AI / agent 的串流輸出；此視圖不得與一般 shell session 混淆。

#### Scenario: 開啟 agent stream terminal
- **WHEN** 使用者開啟 agent stream terminal
- **THEN** terminal 顯示為 agent output 視圖
- **AND** UI 清楚區分它與 local tmux / SSH shell
