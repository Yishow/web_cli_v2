# Spec: ssh-terminal

## NEW Requirements

### Requirement: SSH 連線表單支援 password 與 private key

系統必須提供一個 SSH 連線表單，讓使用者手動輸入 host、port、username，並選擇 password 或 private key 驗證。

#### Scenario: 使用 password 驗證
- **WHEN** 使用者選擇 password auth 並輸入 host、port、username、password
- **THEN** 系統以 password 模式建立 SSH 連線

#### Scenario: 使用 private key 驗證
- **WHEN** 使用者選擇 private key auth 並輸入 host、port、username、private key
- **THEN** 系統以 private key 模式建立 SSH 連線

### Requirement: SSH credential 不做持久化

第一版不得把 host、username、password、private key 寫入 localStorage、cookie 或 server-side 持久化儲存。

#### Scenario: 重新整理頁面後 SSH credential 不恢復
- **WHEN** 使用者輸入 SSH credential 後重新整理頁面
- **THEN** 表單中的敏感資料被清空
- **AND** 系統不自動重建 SSH 連線

### Requirement: WebSocket ↔ SSH bridge 支援 shell、input、resize、disconnect

server 端必須提供 SSH bridge，把 browser terminal 與遠端 shell 正確接通。

#### Scenario: 第一次 WebSocket 訊息送出 connect envelope
- **WHEN** browser 在 SSH mode 建立 WebSocket 連線
- **THEN** 第一個訊息包含 host、port、username、auth method 與對應 credential
- **AND** server 以此建立 `ssh2` 連線

#### Scenario: SSH shell output 回送 terminal
- **WHEN** 遠端 shell 送出資料
- **THEN** server 將資料轉送回 browser terminal
- **AND** terminal 正常渲染遠端 shell output

#### Scenario: resize 傳遞給遠端 shell
- **WHEN** terminal cols / rows 改變
- **THEN** browser 將 resize 訊息送給 server
- **AND** server 把 resize 套用到遠端 SSH shell

#### Scenario: disconnect 關閉 SSH lifecycle
- **WHEN** browser 主動斷線或 WebSocket 關閉
- **THEN** server 關閉遠端 shell stream 與 SSH client

### Requirement: SSH 錯誤必須回到 shell UI

SSH 參數錯誤、認證失敗、連線失敗、shell 開啟失敗時，系統必須提供明確的 user-facing 錯誤訊息。

#### Scenario: 無效的 connect envelope
- **WHEN** browser 傳送的 connect payload 無法解析或缺少必要欄位
- **THEN** server 回傳錯誤訊息並關閉 WebSocket

#### Scenario: SSH 認證失敗
- **WHEN** host / username / credential 不正確
- **THEN** UI 顯示 SSH auth failure 類型的錯誤
- **AND** terminal 不進入 connected 狀態
