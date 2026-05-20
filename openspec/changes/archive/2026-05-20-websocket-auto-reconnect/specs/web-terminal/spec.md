# Spec: web-terminal

## NEW Requirements

### Requirement: WebSocket 自動重連

WebSocket 意外斷線後，系統必須自動嘗試重新建立連線，使用指數退避策略控制重連間隔，最多嘗試 10 次。

#### Scenario: 意外斷線後自動開始重連
- **GIVEN** 使用者已連線到 tmux session `webcli-main`，WebSocket 狀態為 OPEN
- **AND** `intentionalCloseRef` 為 `false`
- **WHEN** WebSocket 連線意外斷開（網路中斷、伺服器暫時不可用）
- **THEN** 系統在終端顯示 `\r\n\x1b[33m[reconnecting... attempt 1/10, next in 1s]\x1b[0m\r\n`
- **AND** 1 秒後自動嘗試建立新的 WebSocket 連線到 `/api/terminal?session=webcli-main`
- **AND** header 狀態指示器顯示「◌ 重連中...」（黃色）

#### Scenario: 重連成功恢復 tmux session
- **GIVEN** 系統正在進行第 N 次重連嘗試
- **WHEN** WebSocket 連線成功建立（`ws.onopen` 觸發）
- **THEN** 重連計數器歸零
- **AND** 系統在終端顯示 `\r\n\x1b[32m[reconnected ✓]\x1b[0m\r\n`
- **AND** header 狀態指示器恢復為「● 已連線」（綠色）
- **AND** 終端顯示 tmux session 的完整內容（透過 `tmux new-session -A` 自動 re-attach）

#### Scenario: 重連失敗後按指數退避等待下一次嘗試
- **GIVEN** 第 3 次重連嘗試失敗（WebSocket 連線被拒絕或立即斷開）
- **WHEN** `ws.onclose` 觸發
- **THEN** 系統在終端顯示 `\r\n\x1b[33m[reconnecting... attempt 4/10, next in 8s]\x1b[0m\r\n`
- **AND** 8 秒後進行第 4 次重連嘗試

#### Scenario: 指數退避延遲計算
- **GIVEN** 重連延遲公式為 `min(1000 * 2^(attempt-1), 30000)` 毫秒
- **WHEN** 計算各次嘗試的延遲
- **THEN** attempt 1 → 1000ms（1s）
- **AND** attempt 2 → 2000ms（2s）
- **AND** attempt 3 → 4000ms（4s）
- **AND** attempt 4 → 8000ms（8s）
- **AND** attempt 5 → 16000ms（16s）
- **AND** attempt 6 → 30000ms（30s，達到上限）
- **AND** attempt 7 → 30000ms（30s，維持上限）
- **AND** attempt 8 → 30000ms（30s）
- **AND** attempt 9 → 30000ms（30s）
- **AND** attempt 10 → 30000ms（30s）

#### Scenario: 達到最大重連次數後停止
- **GIVEN** 系統已完成 10 次自動重連嘗試，全部失敗
- **WHEN** 第 10 次重連失敗（`ws.onclose` 觸發）
- **THEN** 系統停止自動重連，不再排程下一次嘗試
- **AND** 系統在終端顯示 `\r\n\x1b[31m[auto-reconnect failed after 10 attempts. Click "連線 / 重新連線" to retry manually]\x1b[0m\r\n`
- **AND** header 狀態指示器顯示「○ 未連線」（灰色）
- **AND** 清除所有重連相關的 timer

### Requirement: 主動斷線辨識

系統必須區分「意外斷線」和「主動斷線」，只有意外斷線才觸發自動重連。

#### Scenario: 使用者點擊「連線 / 重新連線」按鈕不觸發自動重連
- **GIVEN** 使用者已連線到 tmux session
- **WHEN** 使用者點擊 header 的「連線 / 重新連線」按鈕
- **THEN** `connect()` 被呼叫，先關閉現有 WebSocket（`intentionalCloseRef` 設為 `true`）
- **AND** 現有 WebSocket 的 `onclose` 觸發時不啟動自動重連
- **AND** 新的 WebSocket 連線立即建立

#### Scenario: 頁面關閉/導航不觸發自動重連
- **GIVEN** 使用者已連線到 tmux session
- **WHEN** 使用者關閉瀏覽器分頁或導航到其他頁面（`beforeunload` 事件觸發）
- **THEN** `intentionalCloseRef` 設為 `true`
- **AND** WebSocket 的 `onclose` 觸發時不啟動自動重連

#### Scenario: 意外斷線觸發自動重連
- **GIVEN** 使用者已連線到 tmux session
- **AND** `intentionalCloseRef` 為 `false`
- **WHEN** WebSocket 因網路中斷、伺服器重啟等非使用者主動操作而斷開
- **THEN** 自動重連機制啟動

#### Scenario: 自動重連過程中使用者手動重連
- **GIVEN** 系統正在自動重連中（第 3 次嘗試等待中）
- **WHEN** 使用者點擊「連線 / 重新連線」按鈕
- **THEN** 當前的重連 timer 被清除
- **AND** 重連計數器歸零
- **AND** 立即建立新的 WebSocket 連線（等同於手動重連）

### Requirement: 重連狀態顯示

重連過程中必須在終端和 header 中顯示明確的狀態資訊。

#### Scenario: 終端顯示重連進度
- **GIVEN** 系統正在自動重連中
- **WHEN** 每次重連嘗試開始前
- **THEN** 終端顯示黃色訊息 `[reconnecting... attempt N/10, next in Xs]`
- **AND** N 為當前嘗試次數
- **AND** X 為下次嘗試的等待秒數

#### Scenario: 終端顯示重連成功
- **GIVEN** 自動重連成功
- **WHEN** 新的 WebSocket `onopen` 觸發
- **THEN** 終端顯示綠色訊息 `[reconnected ✓]`

#### Scenario: 終端顯示重連失敗
- **GIVEN** 10 次自動重連全部失敗
- **WHEN** 最後一次嘗試結束
- **THEN** 終端顯示紅色訊息 `[auto-reconnect failed after 10 attempts. Click "連線 / 重新連線" to retry manually]`

#### Scenario: header 狀態指示器三態顯示
- **GIVEN** header 右側有連線狀態指示器
- **WHEN** 連線狀態為「已連線」
- **THEN** 顯示「● 已連線」（綠色，`bg-emerald-500/20 text-emerald-400`）
- **WHEN** 連線狀態為「重連中」
- **THEN** 顯示「◌ 重連中...」（黃色，`bg-yellow-500/20 text-yellow-400`，帶閃爍動畫）
- **WHEN** 連線狀態為「未連線」
- **THEN** 顯示「○ 未連線」（灰色，`bg-white/10 text-white/40`）

#### Scenario: header 連線按鈕在重連中的行為
- **GIVEN** 系統正在自動重連中
- **WHEN** header 的連線按鈕渲染
- **THEN** 按鈕顯示「連線 / 重新連線」（保持啟用狀態，`disabled={false}`）
- **AND** 點擊按鈕取消自動重連並立即手動重連

## MODIFIED Requirements

### Requirement: WebSocket onclose 行為變更

`ws.onclose` 回呼的行為從「僅顯示 disconnected」變更為「判斷是否需自動重連」。

#### Scenario: 意外斷線時啟動重連流程
- **GIVEN** WebSocket 連線意外斷開
- **AND** `intentionalCloseRef` 為 `false`
- **WHEN** `ws.onclose` 觸發
- **THEN** 不顯示 `[disconnected]`（改為顯示重連進度訊息）
- **AND** `connected` 設為 `false`
- **AND** 呼叫 `scheduleReconnect()` 啟動自動重連

#### Scenario: 主動斷線時不啟動重連
- **GIVEN** 使用者主動關閉連線
- **AND** `intentionalCloseRef` 為 `true`
- **WHEN** `ws.onclose` 觸發
- **THEN** 顯示 `\r\n\x1b[90m[disconnected]\x1b[0m\r\n`（保持原有行為）
- **AND** `connected` 設為 `false`
- **AND** `wsRef.current` 設為 `null`
- **AND** 不啟動自動重連
- **AND** `intentionalCloseRef` 重設為 `false`（為下次連線做準備）

### Requirement: WebSocket onopen 行為變更

`ws.onopen` 回呼新增重連成功的處理邏輯。

#### Scenario: 正常首次連線
- **GIVEN** 這是首次連線（非重連）
- **WHEN** `ws.onopen` 觸發
- **THEN** `connected` 設為 `true`
- **AND** console.log 連線成功訊息（保持原有行為）

#### Scenario: 重連成功
- **GIVEN** 這是自動重連的連線（`reconnectAttempt > 0`）
- **WHEN** `ws.onopen` 觸發
- **THEN** `connected` 設為 `true`
- **AND** `reconnectAttempt` 歸零
- **AND** 清除重連 timer
- **AND** 終端顯示 `[reconnected ✓]`（綠色）
- **AND** `intentionalCloseRef` 重設為 `false`

### Requirement: connect 函數行為變更

`connect` 函數新增主動斷線標記和重連狀態重設邏輯。

#### Scenario: 手動呼叫 connect 時標記為主動斷線
- **GIVEN** 存在一個活躍的 WebSocket 連線
- **WHEN** `connect()` 被手動呼叫
- **THEN** `intentionalCloseRef` 設為 `true`
- **AND** 清除所有正在進行的重連 timer
- **AND** `reconnectAttempt` 歸零
- **AND** 關閉現有 WebSocket 連線
- **AND** 建立新的 WebSocket 連線
