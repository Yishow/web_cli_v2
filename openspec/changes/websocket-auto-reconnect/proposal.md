# Change: websocket-auto-reconnect

## Why

目前 web_cli_v2 的 WebSocket 斷線後行為過於消極：`app/page.tsx` 的 `ws.onclose` 回呼只會在終端顯示 `[disconnected]`，然後將 `connected` 狀態設為 `false`。使用者必須手動回到 header 點擊「連線 / 重新連線」按鈕才能恢復連線。

這個體驗在以下場景尤其糟糕：

1. **網路不穩定**：Wi-Fi 切換、VPN 斷線重連、短暫的網路中斷——這些都是暫時性的，WebSocket 理應自動恢復，但使用者被迫手動介入。
2. **長時間執行的任務**：使用者可能在 terminal 中執行長時間的編譯、測試或部署腳本。中間網路閃斷一次，使用者回來後發現已斷線，需要手動重連，卻不確定腳本是否還在跑。
3. **筆電休眠/喚醒**：筆電蓋上再打開，WebSocket 已經斷了。使用者需要手動操作才能回到之前的 session——即使 tmux session 完好無損地還在伺服器上。

關鍵洞察：**tmux session 在伺服器上是持久存在的**。WebSocket 斷線只代表前端與 PTY 之間的通道斷了，tmux session 本身並不受影響。重連只需要重新 attach 到同一個 tmux session，所有工作狀態都會完整保留。因此自動重連不僅合理，而且應該是預設行為。

## What Changes

1. **重連狀態管理**：在 `app/page.tsx` 中新增重連相關的 React state（`reconnectAttempt`、`reconnectTimer`、`intentionalClose` 等），追蹤自動重連的過程和狀態。
2. **指數退避策略**：實作指數退避延遲計算邏輯（1s → 2s → 4s → 8s → 16s → 30s → 30s...），上限 30 秒。每次重連失敗後等待時間加倍，避免在伺服器不可用時產生過多連線請求。
3. **最大重連次數限制**：設定最大自動重連次數（10 次）。超過後停止自動重連，在終端顯示明確提示，告知使用者需手動操作。
4. **主動斷線辨識**：區分「意外斷線」（網路中斷、伺服器重啟）和「主動斷線」（使用者點擊斷線、頁面 unload、主動呼叫 `ws.close()`）。只有意外斷線才觸發自動重連。
5. **重連狀態顯示**：在終端中顯示重連進度訊息（如 `[reconnecting... attempt 3/10, next in 4s]`），讓使用者知道系統正在嘗試恢復連線。
6. **重連成功後自動恢復**：重連成功後，後端透過 `tmux new-session -A -s <name>` 自動重新 attach 到既有的 tmux session，使用者看到的終端內容完整保留。

## Capabilities

### New Capabilities

- `auto-reconnect`: WebSocket 意外斷線後自動重連，使用指數退避策略（1s → 2s → 4s → 8s → 16s → 30s cap），最多嘗試 10 次
- `reconnect-status-display`: 重連過程中在終端顯示狀態訊息（正在重連、第 N 次嘗試、下次嘗試時間），重連成功後顯示恢復提示
- `intentional-close-detection`: 區分主動斷線和意外斷線，只有意外斷線觸發自動重連；使用者點擊「連線 / 重新連線」按鈕、頁面 beforeunload 時不觸發自動重連
- `max-reconnect-limit`: 自動重連達到上限（10 次）後停止，在終端顯示提示訊息並引導使用者手動重連

### Modified Capabilities

- `web-terminal-connection`: `ws.onclose` 行為從「僅顯示 disconnected」改為「判斷是否需自動重連」，重連過程中維護狀態機（connected → reconnecting → connected / failed）
- `web-terminal-ui`: header 的連線狀態指示器新增「重連中」狀態（黃色閃爍），按鈕在重連中顯示「取消重連」選項

## Impact

- Affected code:
  - `app/page.tsx` — 新增重連狀態管理、指數退避邏輯、狀態顯示、主動斷線辨識；修改 `connect`、`ws.onclose`、`ws.onopen`、`ws.onerror` 的行為
- Affected systems:
  - 前端 WebSocket 生命週期管理（從無狀態的「斷了就斷了」變成有狀態的自動重連狀態機）
  - 前端 UI 狀態顯示（header 狀態指示器、終端提示訊息）
  - 後端不受影響（重連就是建立新的 WebSocket 連線，後端 `handlePTYConnection` 使用 `tmux new-session -A` 天然支援 re-attach）
- Verification impact:
  - 基本重連驗證：切斷網路後確認自動重連成功，終端內容完整保留
  - 指數退避驗證：確認重連間隔符合預期（1s, 2s, 4s, 8s, 16s, 30s, 30s...）
  - 最大次數驗證：連續失敗 10 次後確認停止重連並顯示提示
  - 主動斷線驗證：點擊「連線」按鈕或關閉頁面時確認不觸發自動重連
  - 狀態顯示驗證：重連過程中終端和 header 正確顯示重連狀態
