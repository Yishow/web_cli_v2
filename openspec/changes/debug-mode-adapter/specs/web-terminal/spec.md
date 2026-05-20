# Spec: web-terminal

## MODIFIED Requirements

### Requirement: Web Terminal Debug 模式可切換

Web Terminal 元件必須支援透過 URL query parameter、header UI 開關和快捷鍵三種方式啟用/停用 debug 模式。debug 模式啟用時，Terminal 元件的 `debug` prop 設為 `true`，啟用 wterm 的 DebugAdapter。

#### Scenario: 透過 URL query parameter 啟用 debug 模式
- **WHEN** 使用者開啟頁面且 URL 包含 `?debug=true`
- **THEN** Terminal 元件的 `debug` prop 設為 `true`
- **AND** header 的 debug toggle 顯示為開啟狀態
- **AND** debug 面板可見（預設摺疊狀態）

#### Scenario: 透過 URL query parameter 停用 debug 模式
- **WHEN** 使用者開啟頁面且 URL 不包含 `?debug=true`（或值非 `true`）
- **THEN** Terminal 元件的 `debug` prop 設為 `false`
- **AND** header 的 debug toggle 顯示為關閉狀態
- **AND** debug 面板隱藏

#### Scenario: 透過 header toggle 切換 debug 模式
- **WHEN** 使用者點擊 header 中的 debug toggle 開關
- **THEN** debug 狀態切換（開→關 或 關→開）
- **AND** URL query parameter 同步更新（加入或移除 `?debug=true`），不觸發頁面重新載入
- **AND** Terminal 元件的 `debug` prop 即時更新

#### Scenario: 透過快捷鍵切換 debug 模式
- **WHEN** 使用者按下 `Ctrl+Shift+D`
- **THEN** debug 狀態切換，效果與點擊 header toggle 相同
- **AND** URL query parameter 同步更新

#### Scenario: debug 模式切換不影響 Terminal 連線
- **WHEN** debug 模式在已連線狀態下切換
- **THEN** Terminal 元件不重建（不使用 React key 變更）
- **AND** WebSocket 連線不中斷
- **AND** 終端內容保持不變

## NEW Requirements

### Requirement: Debug 模式開關位於 Header

Header 區域必須提供一個 debug toggle 開關，讓使用者隨時切換 debug 模式。開關位於連線狀態指示器的左側。

#### Scenario: Debug toggle 開關的視覺風格
- **WHEN** header 渲染完成
- **THEN** header 中存在一個 toggle 開關，標示為「Debug」或帶有除錯圖示
- **AND** 開關的視覺狀態與當前 debug 模式一致（開啟/關閉）
- **AND** 使用與 header 其他控制項一致的深色主題樣式

#### Scenario: Debug 模式啟用時的視覺提示
- **WHEN** debug 模式啟用
- **THEN** header 的 debug 開關顯示為啟用狀態（例如綠色高亮）
- **AND** Terminal 區域周圍可能有微妙的邊框提示，表示 debug 模式運作中

### Requirement: 可摺疊的 Debug 面板

在 Terminal 與 footer 之間必須有一個可摺疊的 debug 面板，僅在 debug 模式啟用時可見。面板預設為摺疊狀態，展開後顯示 debug 日誌。

#### Scenario: Debug 面板僅在 debug 模式下可見
- **WHEN** debug 模式停用
- **THEN** debug 面板完全隱藏，不佔用任何空間
- **WHEN** debug 模式啟用
- **THEN** debug 面板顯示（預設摺疊狀態），僅標題列可見（約 32px 高度）

#### Scenario: 展開 debug 面板
- **WHEN** 使用者點擊 debug 面板的標題列或展開按鈕
- **THEN** 面板展開，顯示 debug 日誌內容區域（約 200px 高度）
- **AND** 面板具有獨立的捲軸
- **AND** Terminal 區域自動縮小以騰出空間（flex 佈局自動分配）

#### Scenario: 摺疊 debug 面板
- **WHEN** 使用者再次點擊面板標題列或摺疊按鈕
- **THEN** 面板摺疊回標題列狀態
- **AND** Terminal 區域自動恢復原始大小

### Requirement: Escape Sequence 解析日誌

Debug 面板必須提供一個「Escape Log」tab，顯示 wterm DebugAdapter 產生的 escape sequence 解析日誌。

#### Scenario: Escape sequence 解析日誌格式
- **WHEN** debug 模式啟用且 DebugAdapter 產生日誌
- **THEN** 每條日誌包含以下資訊：
  - 時間戳記（毫秒級）
  - Escape sequence 類型（CSI、OSC、SGR 等）
  - 原始序列（可讀格式，例如 `ESC[1;31m`）
  - 解析結果描述（例如「Set foreground color to red, bold」）

#### Scenario: 日誌量限制
- **WHEN** Debug 日誌超過 1000 筆
- **THEN** 系統自動丟棄最舊的日誌（環形緩衝區策略）
- **AND** 最新日誌始終可見（自動捲動到底部）

### Requirement: PTY 輸出原始 Bytes Hex Dump

Debug 面板必須提供一個「Hex Dump」tab，顯示 WebSocket 接收到的 PTY 輸出原始 bytes。

#### Scenario: Hex dump 格式
- **WHEN** debug 模式啟用且收到 PTY 資料
- **THEN** 資料以傳統 hex dump 格式顯示：
  - 每行 16 bytes
  - 左側為 offset（十六進位）
  - 中間為 hex bytes（以空格分隔）
  - 右側為 ASCII 表示（不可見字元顯示為 `.`）
- **AND** 每筆新資料附加在上一筆之後

#### Scenario: 多位元組字元處理
- **WHEN** PTY 輸出包含多位元組 UTF-8 字元
- **THEN** hex dump 正確顯示各 byte 的十六進位值
- **AND** ASCII 欄位中的多位元組字元顯示為對應的可見字元或 `.`

#### Scenario: Hex dump 量限制
- **WHEN** hex dump 資料超過環形緩衝區上限
- **THEN** 系統自動丟棄最舊的資料
- **AND** 最新資料始終可見

### Requirement: URL Query Parameter 同步

Debug 狀態必須與 URL query parameter `?debug=true` 保持雙向同步。

#### Scenario: URL 變更反映到 debug 狀態
- **WHEN** 使用者直接修改 URL 加入 `?debug=true` 並重新載入
- **THEN** debug 模式啟用
- **WHEN** 使用者從 URL 移除 `debug` 參數並重新載入
- **THEN** debug 模式停用

#### Scenario: debug 狀態變更同步到 URL
- **WHEN** 使用者透過 toggle 或快捷鍵啟用 debug 模式
- **THEN** URL 更新為包含 `?debug=true`（使用 `replaceState`，不重新載入頁面）
- **WHEN** 使用者停用 debug 模式
- **THEN** URL 中的 `debug` 參數被移除（使用 `replaceState`）
