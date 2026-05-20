# Design: websocket-auto-reconnect

## Context

web_cli_v2 的前端 `app/page.tsx` 是一個 `"use client"` 的 React 元件，使用 wterm 的 `<Terminal>` 元件渲染終端介面。WebSocket 連線由 `connect` 函數管理，目前的生命週期如下：

1. 使用者在 header 輸入 session 名稱，點擊「連線」按鈕
2. `connect()` 建立 WebSocket 連線到 `/api/terminal?session=<name>`
3. `ws.onopen` 設定 `connected = true`
4. `ws.onmessage` 將伺服器資料寫入 terminal（`write(event.data)`）
5. `ws.onclose` 設定 `connected = false`，在終端寫入 `[disconnected]`，清除 `wsRef`
6. `ws.onerror` 設定 `connected = false`，寫入 `[connection error]`

後端 `server.ts` 的 `handlePTYConnection` 在收到 WebSocket 連線時，透過 `pty.spawn("tmux", ["new-session", "-A", "-s", sessionName])` 建立 PTY 程序。`-A` 旗標表示「session 存在就 attach，不存在就建立」。這意味著：
- tmux session 在 WebSocket 斷線後繼續存在於伺服器上
- 新的 WebSocket 連線使用相同 session 名稱時，`tmux new-session -A` 會直接 attach 到既有 session
- 終端內容（透過 tmux 維護的 scrollback buffer）會自動恢復

目前的 `connect` 函數簽名為 `connect(targetSession?: string)`，使用 `useCallback` 包裹，依賴 `[sessionName, write]`。`wsRef` 是一個 `useRef<WebSocket | null>(null)`，用來追蹤當前 WebSocket 實例。

## Goals / Non-Goals

**Goals:**

- WebSocket 意外斷線後自動重連，使用者無需手動介入
- 使用指數退避策略避免重連風暴：1s → 2s → 4s → 8s → 16s → 30s（上限），之後每次間隔 30s
- 最大自動重連 10 次，超過後停止並明確提示使用者手動操作
- 重連過程中在終端顯示進度（嘗試次數、下次嘗試倒數）
- 重連成功後自動恢復 tmux session 內容（後端天然支援，不需額外改動）
- 區分「意外斷線」與「主動斷線」，只有前者觸發自動重連
- 使用者可在重連過程中手動取消（點擊「連線 / 重新連線」按鈕等同於取消重連並手動重連）
- header 狀態指示器反映重連中狀態

**Non-Goals:**

- 不修改後端 `server.ts`（後端的 `tmux new-session -A` 已天然支援 re-attach，無需改動）
- 不實作跨分頁的連線狀態同步
- 不實作 WebSocket 斷線原因的精確分類（不區分 network error / server close / abnormal closure，統一視為意外斷線，除非是主動 close）
- 不實作持久化的連線狀態（不使用 localStorage 或其他持久化機制記錄重連狀態）
- 不實作重連時的訊息佇列（斷線期間使用者無法輸入，重連後不重送未傳遞的按鍵）
- 不實作伺服器端的心跳檢測（ping/pong），依賴瀏覽器原生的 WebSocket close/error 事件

## Decisions

### Decision: 重連邏輯全部在前端 React 元件中實作

所有重連狀態（重連次數、timer、主動/被動斷線標記）都在 `app/page.tsx` 的 React 元件中管理，使用 `useState` 和 `useRef`。

理由：
1. 重連是純前端行為——建立新的 WebSocket 連線到既有的 URL，後端不需要知道這是重連
2. 後端已天然支援 re-attach（`tmux new-session -A`），不需要任何改動
3. 前端已擁有所有需要的資訊（session 名稱、WebSocket URL、連線狀態）
4. 避免引入額外的狀態管理庫或 Context

**Alternatives considered:**
- **抽取為獨立的 `useWebSocket` hook**：雖然更模組化，但目前只有一個使用點，過早抽象可能增加不必要的複雜性。如果未來有更多 WebSocket 使用場景，可以再抽取
- **抽取為獨立的 `ReconnectingWebSocket` class**：類似 `reconnecting-websocket` npm 套件的概念。但需要處理與 wterm `write` 的整合，以及 React 生命週期的互動，封裝可能不夠透明

### Decision: 使用 `useRef` 標記主動斷線（intentional close）

在 `wsRef` 之外新增一個 `intentionalCloseRef = useRef(false)`，在以下情境設為 `true`：
- 使用者點擊「連線 / 重新連線」按鈕（`connect()` 被呼叫時，先 close 現有連線）
- 頁面即將 unload（`beforeunload` 事件）

`ws.onclose` 中檢查此標記：若為 `true` 則不觸發自動重連，若為 `false` 則觸發。

理由：
1. 簡單明確：一個 boolean flag 即可區分兩種斷線情境
2. 與 React 生命週期一致：`useRef` 不會因 re-render 而重設
3. 不需要解析 WebSocket close event 的 code/reason（這些在某些瀏覽器中不夠可靠）

**Alternatives considered:**
- **透過 WebSocket close code 區分**：使用自訂 close code（如 4000 = intentional）區分主動/被動斷線。但這需要修改 `connect()` 中 `ws.close()` 的呼叫，且 WebSocket spec 的 close code 範圍限制較多
- **透過 `ws.onclose` event 的 `wasClean` 屬性區分**：`wasClean = true` 表示正常關閉。但主動呼叫 `ws.close()` 和伺服器正常關閉都會產生 clean close，無法區分

### Decision: 指數退避使用 `setTimeout` 而非 `setInterval`

每次重連嘗試時使用 `setTimeout` 設定下一次嘗試的延遲。延遲時間按公式 `min(1000 * 2^(attempt-1), 30000)` 計算：
- attempt 1: 1s
- attempt 2: 2s
- attempt 3: 4s
- attempt 4: 8s
- attempt 5: 16s
- attempt 6+: 30s（上限）

理由：
1. `setTimeout` 可以動態計算每次的延遲，`setInterval` 的間隔固定不適合指數退避
2. `setTimeout` 可以在每次嘗試前取消（`clearTimeout`），停止重連非常乾淨
3. 延遲在 `ws.onclose`（重連失敗）時設定，在 `ws.onopen`（重連成功）時清除，邏輯清晰

**Alternatives considered:**
- **`setInterval` + 手動延遲調整**：不直覺，且清除時機不易控制
- **使用 `requestAnimationFrame` 或 `requestIdleCallback`**：這些是 UI 優先的排程機制，不適合精確的延遲控制

### Decision: 最大重連次數 10 次

設定最大自動重連次數為 10。按照指數退避策略，10 次嘗試的時間跨度為：1 + 2 + 4 + 8 + 16 + 30 + 30 + 30 + 30 + 30 = 181 秒（約 3 分鐘）。

理由：
1. 3 分鐘足以覆蓋大部分暫時性網路問題（Wi-Fi 切換、VPN 重連、短暫斷線）
2. 不會無限期重連消耗資源（電池、網路、伺服器連線）
3. 10 次是一個使用者可以理解的上限，不會感覺「系統已經放棄了」或「系統在無意義地重試」
4. 超過上限後的提示訊息清楚引導使用者手動操作

**Alternatives considered:**
- **無限重連**：可能消耗行動裝置電池和網路資源，且使用者可能不知道系統還在嘗試
- **5 次**：太短，某些網路恢復可能需要超過 31 秒（1+2+4+8+16）
- **20 次**：太長，使用者可能已經離開，浪費資源

### Decision: 重連狀態訊息寫入 wterm terminal

在重連過程中，使用 `write()` 將狀態訊息寫入 wterm terminal 顯示。訊息格式：
- 開始重連：`\r\n\x1b[33m[reconnecting... attempt 1/10, next in 1s]\x1b[0m\r\n`
- 每次失敗遞增：`\r\n\x1b[33m[reconnecting... attempt 3/10, next in 4s]\x1b[0m\r\n`
- 重連成功：`\r\n\x1b[32m[reconnected ✓]\x1b[0m\r\n`
- 超過上限：`\r\n\x1b[31m[auto-reconnect failed after 10 attempts. Click "連線 / 重新連線" to retry manually]\x1b[0m\r\n`

理由：
1. 終端是使用者注視的地方，狀態訊息直接顯示在這裡最顯眼
2. 使用 ANSI escape code 著色（黃色 = 進行中，綠色 = 成功，紅色 = 失敗），視覺清晰
3. 不需要額外的 UI 元件（overlay、toast），實作簡單
4. 訊息存在 terminal scrollback 中，使用者即使暫時離開也能回顧

**Alternatives considered:**
- **Header 狀態列顯示重連進度**：header 已有連線狀態指示器，但空間有限，不適合顯示詳細的重連資訊
- **Toast 通知**：需要引入 toast 元件或自行實作，增加複雜性
- **Overlay 遮罩**：會遮擋終端內容，使用者無法查看斷線前的輸出

### Decision: header 狀態指示器新增「重連中」狀態

header 右側的連線狀態指示器目前只有兩種狀態：「● 已連線」（綠色）和「○ 未連線」（灰色）。新增第三種狀態：「◌ 重連中...」（黃色，帶閃爍動畫）。

理由：
1. 三態指示器讓使用者一眼判斷連線狀態，不需要閱讀 terminal 中的訊息
2. 黃色 + 閃爍暗示「正在處理中」，符合使用者的直覺
3. 實作簡單，只需修改一個條件判斷和新增 CSS class

**Alternatives considered:**
- **只用 terminal 訊息，不改 header**：header 狀態仍然是「未連線」時，使用者可能誤以為系統沒有在處理
- **用獨立的狀態列（status bar）**：過度設計，header 指示器已經夠用

## Risks / Trade-offs

- **重連風險**：在伺服器真正不可用時（部署中、伺服器當機），自動重連會在 3 分鐘內產生 10 次連線請求。緩解：指數退避策略確保請求密度遞減，10 次總量對伺服器的衝擊極小
- **tmux session 衝突**：如果使用者在另一個分頁已經連線到同一個 tmux session，自動重連可能導致 tmux 強制 detach 前一個連線。緩解：這是 tmux 本身的行為，與自動重連無關；且使用者很少同時用多個分頁連線到同一個 session
- **`beforeunload` 事件的可靠性**：某些瀏覽器（特別是行動裝置）可能不會可靠地觸發 `beforeunload`，導致頁面關閉時 `intentionalCloseRef` 未設為 `true`，觸發不必要的重連嘗試。緩解：WebSocket 在頁面 unload 後會被瀏覽器自動銷毀，`setTimeout` 的回呼也不會執行（頁面已卸載），所以實際上不會產生額外連線
- **重連時的 PTY 資源**：每次重連建立新的 WebSocket 時，後端 `handlePTYConnection` 會 spawn 新的 PTY 程序（`tmux new-session -A`）。因為 `-A` 旗標會 attach 到既有 session，所以實際上不會建立新的 tmux session。但每次連線會產生一個 tmux client 程序。緩解：舊的 PTY 程序在 `ws.on("close")` 時已經被 kill，不會累積
- **終端閃爍**：重連過程中 terminal 可能有短暫閃爍（因為 PTY 重新 attach 時 tmux 會重繪畫面）。緩解：這是 tmux 的正常行為，使用者通常可以接受
- **`write` 函數的可用性**：重連狀態訊息依賴 wterm 的 `write` 函數。如果 terminal 尚未初始化完成（`useTerminal` 的 ref 未就緒），`write` 可能不可用。緩解：重連只會在初始連線成功後才可能發生，此時 `write` 一定可用

## Migration Plan

1. **Phase 1 — 重連狀態管理基礎**：在 `app/page.tsx` 中新增重連相關的 state 和 ref（`reconnectAttempt`、`reconnectTimerRef`、`intentionalCloseRef`、`maxReconnectAttempts` 常數）
2. **Phase 2 — 修改 `connect` 函數**：在 `connect` 中設定 `intentionalCloseRef = true`（因為手動呼叫 connect 等同主動斷線）；新增 `reconnectAttempt` 重設邏輯
3. **Phase 3 — 修改 `ws.onclose`**：判斷 `intentionalCloseRef`，若為意外斷線則啟動自動重連（呼叫 `scheduleReconnect`）
4. **Phase 4 — 實作 `scheduleReconnect` 和 `attemptReconnect`**：指數退避計算、`setTimeout` 排程、重連嘗試計數、超限處理
5. **Phase 5 — 狀態顯示**：修改 `ws.onclose` 和 `ws.onopen` 寫入重連狀態訊息，修改 header 狀態指示器支援三態
6. **Phase 6 — `beforeunload` 處理**：新增 `beforeunload` 事件監聽器，標記為主動斷線
7. **Phase 7 — 整合測試**：模擬斷線場景驗證重連行為

## Open Questions

- **重連時是否需要重新發送 RESIZE 訊息**：重連後 wterm 的 `autoResize` 是否會自動觸發？如果會，後端會在收到第一個 RESIZE 訊息時才 spawn PTY（目前 `handlePTYConnection` 的行為是等 RESIZE 才 spawn）。如果 wterm 不會自動觸發，可能需要手動在 `ws.onopen` 後發送一次 RESIZE。建議在實作時測試 wterm 的行為，必要時在重連成功的 `onopen` 中手動觸發 resize
- **重連次數是否需要可配置**：是否允許使用者透過 URL 參數或設定介面調整最大重連次數？建議初期硬編碼為 10，未來如有需求再抽取為配置
- **是否需要「取消重連」按鈕**：重連過程中，header 按鈕是否改為「取消重連」？還是保持原有的「連線 / 重新連線」行為（等同於取消自動重連 + 立即手動重連）？建議後者，因為行為更直覺且實作更簡單
- **重連成功後是否清除 terminal 中的重連狀態訊息**：重連成功時寫入 `[reconnected ✓]`，但之前的 `[reconnecting... attempt N/10]` 訊息仍留在 scrollback 中。是否需要在重連成功後清除這些訊息？建議不清除，保留完整的重連歷史有助於除錯
- **多分頁同時重連**：如果使用者開了多個分頁連線到同一個 session，網路斷線後所有分頁同時嘗試重連。tmux 只允許一個 client attach 到同一個 session，後連線的分頁會失敗。緩解：這是 tmux 的行為限制，建議在重連失敗時檢查是否為 tmux attach 衝突，如果是則提示使用者
