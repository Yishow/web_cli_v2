# Spec: browser-shell

## NEW Requirements

### Requirement: Browser shell 使用 `@wterm/just-bash`

系統必須提供一個完全在瀏覽器內執行的 shell，且不依賴後端 transport。

#### Scenario: browser shell 可在沒有 WebSocket 的情況下啟動
- **WHEN** 使用者開啟 browser shell
- **THEN** shell 在前端初始化完成
- **AND** 不需要 `/api/terminal` 或 `/api/ssh`

### Requirement: Browser shell 預載虛擬檔案

系統必須預載一組虛擬檔案，讓使用者在 shell 啟動後立刻有可探索內容。

#### Scenario: 使用者可讀取 demo files
- **WHEN** shell 啟動完成
- **THEN** 使用者可透過 `ls`、`cat`、`bash hello.sh` 等指令探索預載檔案

### Requirement: Browser shell 不做持久化

browser shell 的檔案、輸入與狀態不做持久化；刷新頁面後回到初始 demo 狀態。

#### Scenario: 重新整理後回到初始狀態
- **WHEN** 使用者在 browser shell 內修改虛擬檔案後重新整理頁面
- **THEN** shell 回到預設 greeting 與初始 demo files
