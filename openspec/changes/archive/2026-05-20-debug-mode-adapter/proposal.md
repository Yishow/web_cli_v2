# Change: debug-mode-adapter

## Why

web_cli_v2 使用 wterm 的 Terminal 元件作為終端渲染層，透過 WebSocket 接收 PTY 輸出並交由 WASM core 解析 escape sequence。在實際開發與除錯過程中，終端渲染問題（例如字元顯示異常、游標位置錯誤、顏色解析失敗等）難以定位，因為開發者無法觀察 PTY 輸出的原始資料流與 escape sequence 的解析過程。

wterm 官方提供 `DebugAdapter` 功能：Terminal 元件具有 `debug` prop，啟用後可透過 DebugAdapter 顯示 escape sequence 的解析日誌、PTY 輸出的原始 bytes（hex dump）等除錯資訊。這對於開發者理解和修復終端渲染問題非常有價值。

目前 `app/page.tsx` 中 Terminal 元件的 `debug` prop 被硬編碼為 `false`，需要將其改為可動態切換，並提供完整的 debug UI 體驗。

## What Changes

1. **URL query parameter 控制 debug 狀態**：透過 `?debug=true` 啟用 debug 模式，便於開發者分享帶有 debug 狀態的 URL
2. **Header 加入 debug 模式切換開關**：在 header 區域提供一個 toggle 開關，讓使用者隨時啟用/停用 debug 模式，切換時同步更新 URL query parameter
3. **Terminal 元件 `debug` prop 動態化**：根據 debug 狀態傳入 `true`/`false`，啟用 wterm 的 DebugAdapter
4. **可摺疊的 debug 面板**：在 Terminal 區域下方加入一個可摺疊的面板，顯示 escape sequence 解析日誌，不影響正常終端操作
5. **PTY 輸出原始 bytes hex dump**：在 debug 面板中顯示 WebSocket 接收到的原始 bytes（以 hex dump 格式），幫助開發者查看未經解析的 PTY 輸出
6. **快捷鍵支援**：加入 `Ctrl+Shift+D` 快捷鍵快速切換 debug 模式

## Capabilities

### New Capabilities

- `debug-mode-toggle`: 使用者可以透過 header 開關、URL query parameter（`?debug=true`）或快捷鍵（`Ctrl+Shift+D`）啟用/停用終端 debug 模式
- `debug-panel`: 在 Terminal 下方顯示一個可摺疊的 debug 面板，包含 escape sequence 解析日誌和 PTY 原始 bytes hex dump

### Modified Capabilities

- `web-terminal-rendering`: Terminal 元件的 `debug` prop 改為動態控制，根據 debug 狀態啟用 wterm 的 DebugAdapter
- `web-terminal-ui`: header 區域新增 debug 模式開關，終端區域下方新增可摺疊 debug 面板

## Impact

- Affected code:
  - `app/page.tsx` — 主要改動檔案，新增 debug 狀態管理（URL query parameter 同步）、header toggle、快捷鍵監聽、DebugAdapter 日誌收集、hex dump 顯示、可摺疊面板 UI
  - `app/globals.css` — 可能需要新增 debug 面板的樣式（捲軸、hex dump 等寬字型等）
- Affected systems:
  - 前端終端渲染系統（wterm DebugAdapter 整合）
  - 前端 UI（header toggle、debug 面板）
  - URL routing（query parameter 管理）
- Verification impact:
  - 功能驗證：透過 URL 參數、header 開關、快捷鍵三種方式啟用 debug 模式，確認 Terminal 的 `debug` prop 正確切換
  - UI 驗證：debug 面板可摺疊且不影響終端正常操作、hex dump 正確顯示原始 bytes
  - 效能驗證：debug 模式不應影響非 debug 模式下的終端效能（記憶體、渲染速度）
  - URL 同步驗證：切換 debug 狀態時 URL query parameter 正確更新，頁面重新載入後狀態正確恢復
