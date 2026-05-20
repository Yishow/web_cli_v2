# Spec: web-terminal

## MODIFIED Requirements

### Requirement: Web Terminal 支援多種連線模式

Web terminal 必須支援至少兩種連線模式：`local`（tmux）與 `ssh`（remote shell）。產品 shell 依 mode 顯示對應控制項，但 terminal runtime 仍透過同一個 app-owned contract 對外提供連線、標題與 diagnostics。

#### Scenario: local mode 顯示現有 tmux controls
- **WHEN** 使用者選擇 `local` mode
- **THEN** header 顯示 session name、Sessions sidebar 與 local tmux 相關 controls
- **AND** terminal runtime 連到 local tmux transport

#### Scenario: ssh mode 顯示 SSH 連線表單
- **WHEN** 使用者選擇 `ssh` mode
- **THEN** shell 顯示 SSH 連線表單
- **AND** tmux session 專屬 controls 被隱藏或停用
- **AND** terminal runtime 連到 SSH transport

### Requirement: Web Terminal runtime contract 可擴充 transport mode

`app/terminal-runtime/*` 的 contract 必須能描述不同 transport mode，而不讓 page 直接依賴 transport 細節。

#### Scenario: page shell 只透過 app-owned contract 操作 SSH mode
- **WHEN** page shell 需要啟用 SSH mode
- **THEN** 它只把 mode-specific config 傳給 runtime
- **AND** 不直接建立 SSH WebSocket 或處理 ssh2 payload 細節
