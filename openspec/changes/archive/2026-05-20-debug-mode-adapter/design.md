# Design: debug-mode-adapter

## Context

web_cli_v2 使用 `@wterm/react` 的 `<Terminal>` 元件作為瀏覽器終端渲染層。Terminal 元件透過 `debug` prop 控制 DebugAdapter 的啟用。啟用後，DebugAdapter 會攔截並記錄 escape sequence 的解析過程，包括 CSI（Control Sequence Introducer）、OSC（Operating System Command）、SGR（Select Graphic Rendition）等序列的解析結果。

目前 `app/page.tsx` 中 Terminal 的 `debug` prop 固定為 `false`。WebSocket 接收 PTY 輸出後直接呼叫 `write(event.data)`，不記錄原始 bytes。

Debug 模式是開發者工具，主要用於除錯終端渲染問題。一般使用者不需要也不應看到 debug 資訊，因此需要確保：
- 預設為關閉狀態
- 啟用時不影響終端的正常操作體驗
- 可以方便地切換（不需要修改程式碼）

## Goals / Non-Goals

**Goals:**
- 透過 URL query parameter `?debug=true` 控制 debug 模式的初始狀態
- 在 header 提供直覺的 debug toggle 開關
- 支援 `Ctrl+Shift+D` 快捷鍵快速切換
- 在 debug 面板中顯示 escape sequence 解析日誌（來自 wterm DebugAdapter）
- 在 debug 面板中顯示 PTY 輸出的原始 bytes（hex dump 格式）
- Debug 面板可摺疊，不影響正常終端操作
- 切換 debug 狀態時同步更新 URL query parameter（便於分享除錯連結）

**Non-Goals:**
- 不實作 debug 日誌的持久化（不存到 localStorage 或後端）
- 不實作 debug 日誌的匯出功能（下載為檔案）
- 不修改 wterm 元件庫本身的 DebugAdapter API
- 不實作 debug 日誌的過濾或搜尋功能（可於後續迭代加入）
- 不對 debug 面板加入效能監控指標（FPS、渲染時間等）
- 不處理 debug 日誌量大時的記憶體管理（初版使用固定大小的環形緩衝區即可）

## Decisions

### Decision: 使用 URL query parameter 作為 debug 狀態的主要來源

Debug 模式的狀態由 URL query parameter `?debug=true` 控制。這比 localStorage 更適合 debug 場景，因為：
- 開發者可以透過修改 URL 直接啟用 debug 模式
- 可以分享帶有 debug 狀態的 URL 給其他開發者
- 頁面重新載入後 debug 狀態會保留在 URL 中，比 localStorage 更透明
- 不需要額外的 UI 來「清除」debug 狀態（移除 URL 參數即可）

實作上使用 `useSearchParams()` 讀取初始狀態，切換時使用 `window.history.replaceState()` 更新 URL（不觸發頁面重新載入）。

**Alternatives considered:**
- **localStorage**：適合使用者偏好設定，但 debug 是臨時性的開發工具，不需要跨 session 保留
- **僅 UI toggle（無 URL 同步）**：可用但無法分享 debug 狀態的連結
- **Hash fragment（`#debug`）**：與 query parameter 功能重疊，且語意上 query parameter 更適合表示「狀態」

### Decision: Debug 面板使用可摺疊設計，位於 Terminal 下方

Debug 面板放在 Terminal 區域與 footer 之間，預設摺疊（僅顯示標題列）。展開後顯示日誌內容，高度固定（約 200px），帶有獨立捲軸。

摺疊狀態下 debug 面板只佔用約 32px 高度（標題列），不影響終端顯示區域。展開時終端區域會自動縮小（因為使用 flex 佈局，`flex-1` 會自動分配剩餘空間）。

面板分為兩個 tab：「Escape Log」（escape sequence 解析日誌）和「Hex Dump」（PTY 原始 bytes），使用者可切換查看。

**Alternatives considered:**
- **Side panel（側邊面板）**：會佔用終端寬度，影響終端佈局與顯示
- **Overlay（浮動面板）**：可能遮擋終端內容，操作不便
- **獨立視窗/分頁**：需要額外的視窗管理邏輯，且無法同時觀察終端與 debug 資訊
- **底部不可摺疊面板**：永遠佔用空間，非 debug 使用者不需要

### Decision: Hex dump 透過攔截 WebSocket onmessage 實作

在 debug 模式下，攔截 WebSocket 的 `onmessage` 回呼，將收到的 `event.data` 轉換為 hex dump 格式後記錄到 state 中。使用環形緩衝區（最多保留最近 1000 筆記錄）避免記憶體無限增長。

Hex dump 格式為：`<offset>  <hex bytes>  |<ASCII>|`，每行顯示 16 bytes，與傳統 hex dump 工具（如 `xxd`）格式一致。

**Alternatives considered:**
- **從 wterm DebugAdapter 取得原始 bytes**：需確認 DebugAdapter 是否暴露原始 bytes API，若不暴露則需自行攔截
- **在後端記錄並提供 API**：需要修改 server.ts，增加不必要的複雜度
- **使用 base64 編碼而非 hex dump**：hex dump 更直覺，可直接對照 ASCII

### Decision: 使用 Ctrl+Shift+D 快捷鍵切換 debug 模式

快捷鍵使用 `keydown` 事件監聽，檢查 `event.ctrlKey && event.shiftKey && event.key === 'D'`。這個組合鍵不與常見的瀏覽器快捷鍵衝突，且 D 代表 Debug，容易記憶。

監聽器掛在 `useEffect` 中，在元件掛載時加入、卸載時移除。

**Alternatives considered:**
- **F12**：與瀏覽器 DevTools 衝突
- **Ctrl+D**：與終端的 end-of-file（EOF）訊號衝突
- **雙擊 header**：不夠直覺，且不易發現

### Decision: Toggle debug 時不重建 Terminal 元件

與 core 切換不同，`debug` prop 的切換不需要重建整個 Terminal 元件。wterm 的 DebugAdapter 是一個可動態啟用/停用的附加層，`debug` prop 改變時 wterm 內部會處理 DebugAdapter 的掛載/卸載，不需要外部重建。

但需要在 debug 模式下收集 DebugAdapter 的日誌輸出。實作上透過 `onDebug` 回呼（若有提供）或監聽 wterm 的 debug 事件來收集日誌。

**Alternatives considered:**
- **使用 React key 重建 Terminal**：可行但過度，會導致不必要的斷線重連
- **完全在 Terminal 外部實作 debug 功能**：無法取得 wterm 內部的 escape sequence 解析資訊

## Risks / Trade-offs

- **Debug 模式下的效能影響**：啟用 DebugAdapter 和 hex dump 記錄會增加 CPU 和記憶體使用量。在高頻率終端輸出場景下（例如 `cat` 大檔案），debug 日誌可能產生大量資料。緩解：使用環形緩衝區限制日誌大小，並在面板中僅渲染可見範圍
- **URL query parameter 的副作用**：使用 `?debug=true` 可能被搜尋引擎索引，或在分享連結時意外將 debug 狀態帶給非開發者。緩解：在 UI 上清楚標示 debug 模式狀態
- **DebugAdapter API 穩定性**：wterm 的 DebugAdapter 可能隨版本更新改變 API。緩解：將 DebugAdapter 整合邏輯集中封裝，降低耦合
- **Hex dump 字元編碼**：WebSocket 的 `event.data` 是字串（UTF-16），需正確處理多位元組字元到 hex 的轉換。使用 `TextEncoder` 將字串轉為 UTF-8 bytes 後再進行 hex dump

## Migration Plan

1. **Phase 1 — 狀態管理與 URL 同步**：在 `app/page.tsx` 新增 debug 狀態管理（`useSearchParams` 讀取、`replaceState` 更新），修改 Terminal 的 `debug` prop 為動態值
2. **Phase 2 — Header UI 與快捷鍵**：在 header 新增 debug toggle 開關，加入 `Ctrl+Shift+D` 快捷鍵監聽
3. **Phase 3 — Debug 面板與日誌收集**：建立可摺疊 debug 面板元件，整合 DebugAdapter 日誌收集和 hex dump 功能
4. **Phase 4 — 樣式與驗證**：調整 `globals.css` 中的 debug 面板樣式，執行端對端驗證

## Open Questions

- **wterm DebugAdapter 的具體回呼 API**：DebugAdapter 啟用後如何將日誌傳遞給外部？是透過 `onDebug` 回呼 prop、事件監聽、還是 console 輸出？需要查閱 wterm 文件或原始碼確認
- **Debug 日誌的最大保留量**：環形緩衝區的預設大小（1000 筆）是否足夠？是否需要讓使用者調整？
- **Hex dump 是否需要支援雙向顯示**（同時顯示客戶端發送和伺服器端接收的資料）？目前僅計畫顯示 PTY 輸出（伺服器→客戶端），但客戶端→伺服器的資料也可能有除錯價值
