# Spec: web-terminal

## NEW Requirements

### Requirement: tmux session 列表 API

系統必須提供 `GET /api/sessions` HTTP endpoint，回傳伺服器上所有 tmux session 的結構化 JSON 陣列。每個 session 物件包含名稱、attached 狀態、建立時間（Unix timestamp）、window 數量。

#### Scenario: 有 tmux sessions 存在時回傳列表
- **GIVEN** 伺服器上存在兩個 tmux session：`webcli-main`（attached，2 windows，建立於 timestamp 1716163200）和 `webcli-dev`（detached，1 window，建立於 timestamp 1716166800）
- **WHEN** 前端發送 `GET /api/sessions` 請求
- **THEN** 回傳 HTTP 200，Content-Type 為 `application/json`
- **AND** 回應 body 為 JSON 陣列，包含 2 個物件
- **AND** 第一個物件包含 `name: "webcli-main"`、`attached: true`、`created: 1716163200`、`windows: 2`
- **AND** 第二個物件包含 `name: "webcli-dev"`、`attached: false`、`created: 1716166800`、`windows: 1`

#### Scenario: 沒有任何 tmux session 時回傳空陣列
- **GIVEN** 伺服器上沒有任何 tmux session（tmux server 未運行或全部 session 已被刪除）
- **WHEN** 前端發送 `GET /api/sessions` 請求
- **THEN** 回傳 HTTP 200
- **AND** 回應 body 為空 JSON 陣列 `[]`

#### Scenario: tmux 命令執行失敗時的錯誤處理
- **GIVEN** tmux 二進位檔案不存在或沒有執行權限
- **WHEN** 前端發送 `GET /api/sessions` 請求
- **THEN** 回傳 HTTP 500，Content-Type 為 `application/json`
- **AND** 回應 body 包含 `error` 欄位描述錯誤原因

#### Scenario: API 不受 Next.js 路由影響
- **GIVEN** server.ts 同時處理自訂 API 和 Next.js 頁面請求
- **WHEN** 請求的 URL 為 `/api/sessions`
- **THEN** server.ts 直接處理該請求，不轉發給 Next.js request handler
- **WHEN** 請求的 URL 為 `/api/sessions/unknown-method` 或其他路徑
- **THEN** 請求被轉發給 Next.js request handler

### Requirement: tmux session 刪除 API

系統必須提供 `DELETE /api/sessions/:name` HTTP endpoint，安全地刪除指定的 tmux session。

#### Scenario: 成功刪除存在的 session
- **GIVEN** 伺服器上存在名為 `webcli-old` 的 tmux session
- **WHEN** 前端發送 `DELETE /api/sessions/webcli-old` 請求
- **THEN** 回傳 HTTP 200，Content-Type 為 `application/json`
- **AND** 回應 body 包含 `success: true` 和 `name: "webcli-old"`
- **AND** 該 tmux session 已被刪除（`tmux list-sessions` 不再列出）

#### Scenario: 刪除不存在的 session
- **GIVEN** 伺服器上不存在名為 `webcli-nonexistent` 的 tmux session
- **WHEN** 前端發送 `DELETE /api/sessions/webcli-nonexistent` 請求
- **THEN** 回傳 HTTP 404，Content-Type 為 `application/json`
- **AND** 回應 body 包含 `error` 欄位描述「session not found」

#### Scenario: 拒絕含有非法字元的 session 名稱
- **GIVEN** 使用者嘗試刪除名為 `test; rm -rf /` 的 session
- **WHEN** 前端發送 `DELETE /api/sessions/test;%20rm%20-rf%20/` 請求
- **THEN** 回傳 HTTP 400，Content-Type 為 `application/json`
- **AND** 回應 body 包含 `error` 欄位描述「invalid session name」
- **AND** 不執行任何 tmux 命令

#### Scenario: 拒絕含有路徑遍歷字元的 session 名稱
- **GIVEN** 使用者嘗試刪除名為 `../etc/passwd` 的 session
- **WHEN** 前端發送 `DELETE /api/sessions/..%2Fetc%2Fpasswd` 請求
- **THEN** 回傳 HTTP 400
- **AND** 回應 body 包含 `error` 欄位描述「invalid session name」

#### Scenario: session 名稱格式白名單
- **GIVEN** 一組 session 名稱測試案例
- **WHEN** 測試 `webcli-main` — 接受（僅含英數和連字號）
- **WHEN** 測試 `session_123` — 接受（含底線）
- **WHEN** 測試 `my.session` — 拒絕（含句號，HTTP 400）
- **WHEN** 測試 `session name` — 拒絕（含空格，HTTP 400）
- **WHEN** 測試 `` — 拒絕（空字串，HTTP 400）
- **WHEN** 測試 `a` — 接受（單字元）

### Requirement: session 管理側邊欄 UI

系統必須在前端提供可展開的側邊欄面板，顯示所有 tmux session 的列表，支援查看、切換、刪除操作。

#### Scenario: header 顯示 session 管理按鈕
- **WHEN** 頁面載入完成
- **THEN** header 左側 logo 區域附近存在一個「Sessions」按鈕
- **AND** 按鈕上顯示當前 session 總數 badge（如「3」）
- **AND** 點擊按鈕後側邊欄滑入顯示

#### Scenario: 側邊欄顯示 session 列表
- **GIVEN** 伺服器上存在 3 個 tmux session
- **WHEN** 使用者點擊「Sessions」按鈕開啟側邊欄
- **THEN** 側邊欄從左側滑入，寬度約 280px
- **AND** 側邊欄標題顯示「Sessions」
- **AND** 標題右側有手動刷新按鈕（↻ 圖示）
- **AND** 列表中顯示 3 個 session 項目，按名稱排列

#### Scenario: session 項目顯示完整資訊
- **GIVEN** 存在一個名為 `webcli-main` 的 session，狀態為 attached，有 2 個 window
- **WHEN** 側邊欄渲染該 session 項目
- **THEN** 項目顯示 session 名稱「webcli-main」（等寬字體）
- **AND** 名稱左側有綠色圓點指示燈（●）表示 attached 狀態
- **AND** 顯示建立時間（如「2026/05/20 10:00」）
- **AND** 顯示 window 數量（如「2 windows」）
- **AND** 項目右側有刪除按鈕（垃圾桶圖示）

#### Scenario: detached session 的狀態指示
- **GIVEN** 存在一個 detached 的 session
- **WHEN** 側邊欄渲染該 session 項目
- **THEN** 名稱左側有灰色圓點指示燈（●）表示 detached 狀態

#### Scenario: 當前連線的 session 視覺標記
- **GIVEN** 使用者當前連線到 `webcli-main` session
- **WHEN** 側邊欄渲染 session 列表
- **THEN** `webcli-main` 項目有特殊的背景色（如 `bg-zinc-800`）或左側邊框強調
- **AND** 其他 session 項目無特殊標記

#### Scenario: 點擊 session 項目切換連線
- **GIVEN** 使用者當前連線到 `webcli-main`，側邊欄顯示另一個 session `webcli-dev`
- **WHEN** 使用者點擊 `webcli-dev` 項目
- **THEN** 當前 WebSocket 連線被關閉
- **AND** 系統自動以 session 名稱 `webcli-dev` 建立新的 WebSocket 連線
- **AND** session name input 更新為 `webcli-dev`
- **AND** 連線成功後終端顯示 `webcli-dev` session 的內容
- **AND** 側邊欄刷新，`webcli-dev` 項目標記為當前連線

#### Scenario: 點擊刪除按鈕彈出確認
- **GIVEN** 側邊欄顯示一個 session `webcli-old`
- **WHEN** 使用者點擊 `webcli-old` 項目的刪除按鈕
- **THEN** 彈出確認對話框，顯示「確定要刪除 session "webcli-old"？此操作無法復原」
- **AND** 對話框有「取消」和「刪除」兩個按鈕
- **AND** 「刪除」按鈕為紅色（危險操作視覺提示）

#### Scenario: 確認刪除後移除 session
- **GIVEN** 使用者已點擊刪除按鈕並看到確認對話框
- **WHEN** 使用者點擊「刪除」按鈕確認
- **THEN** 前端發送 `DELETE /api/sessions/webcli-old` 請求
- **AND** 請求成功後 session 從列表中移除
- **AND** badge 數量減 1

#### Scenario: 刪除當前連線的 session
- **GIVEN** 使用者當前連線到 `webcli-main` session
- **WHEN** 使用者在側邊欄中刪除 `webcli-main` session
- **THEN** 確認對話框額外提示「此為當前連線的 session，刪除後將斷線」
- **AND** 確認刪除後 WebSocket 連線關閉
- **AND** 連線狀態變為「未連線」
- **AND** 終端顯示斷線訊息

#### Scenario: 空列表提示
- **GIVEN** 伺服器上沒有任何 tmux session
- **WHEN** 使用者開啟側邊欄
- **THEN** 側邊欄顯示「尚無 session」的空狀態提示
- **AND** 提示使用者透過 header 的輸入框建立新 session

### Requirement: session 列表自動刷新

面板開啟時必須定期輪詢 session 列表，保持資訊即時。面板關閉時停止輪詢。

#### Scenario: 面板開啟時啟動輪詢
- **WHEN** 使用者開啟側邊欄面板
- **THEN** 系統立即發送 `GET /api/sessions` 請求取得列表
- **AND** 此後每 5 秒自動發送一次請求刷新列表

#### Scenario: 面板關閉時停止輪詢
- **WHEN** 使用者關閉側邊欄面板
- **THEN** 自動輪詢停止，不再發送請求
- **AND** 清除相關的 timer

#### Scenario: 手動刷新
- **WHEN** 使用者點擊側邊欄標題旁的刷新按鈕（↻）
- **THEN** 立即發送 `GET /api/sessions` 請求刷新列表
- **AND** 重置輪詢計時器（下一次自動刷新為 5 秒後）

#### Scenario: 網路錯誤時不停止輪詢
- **WHEN** 輪詢請求因網路錯誤失敗
- **THEN** 不顯示錯誤彈窗
- **AND** 列表保持顯示上次成功取得的資料
- **AND** 輪詢繼續，5 秒後重試

## MODIFIED Requirements

### Requirement: Header 包含 session 管理入口按鈕

Header 左側必須提供一個「Sessions」按鈕，用於開啟 session 管理側邊欄。按鈕顯示當前 session 總數。

#### Scenario: Sessions 按鈕的位置與樣式
- **WHEN** header 渲染完成
- **THEN** 「Sessions」按鈕位於左側 logo 區域（`web_cli_v2` 文字）之後
- **AND** 按鈕樣式與 header 其他控制項一致（深色背景、小字體）
- **AND** 按鈕右側有一個小 badge 顯示 session 總數

#### Scenario: Sessions 按鈕的 toggle 行為
- **WHEN** 側邊欄未開啟時，使用者點擊「Sessions」按鈕
- **THEN** 側邊欄從左側滑入開啟
- **AND** 按鈕呈現啟用狀態（如背景色加深）
- **WHEN** 側邊欄已開啟時，使用者點擊「Sessions」按鈕
- **THEN** 側邊欄滑出關閉
- **AND** 按鈕恢復為未啟用狀態

### Requirement: 側邊欄影響終端佈局

側邊欄開啟時，終端區域的可用寬度減少。wterm 的 `autoResize` 機制應自動處理此變化。

#### Scenario: 側邊欄開啟時終端自動調整尺寸
- **WHEN** 側邊欄開啟（佔用 280px）
- **THEN** 終端區域寬度減少 280px
- **AND** wterm 的 `autoResize` 觸發，重新計算 cols
- **AND** 新的 cols 值透過 WebSocket RESIZE 訊息發送給後端
- **AND** tmux session 的寬度相應調整

#### Scenario: 側邊欄關閉時終端恢復尺寸
- **WHEN** 側邊欄關閉
- **THEN** 終端區域寬度恢復為完整寬度
- **AND** wterm 自動 resize 回原始 cols 數
