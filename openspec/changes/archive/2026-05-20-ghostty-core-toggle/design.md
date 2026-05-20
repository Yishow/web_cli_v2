# Design: ghostty-core-toggle

## Context

web_cli_v2 使用 `@wterm/react` 的 `<Terminal>` 元件作為瀏覽器終端渲染層。Terminal 元件透過 `wasmUrl` prop 載入 WASM 核心，目前指向 `/wterm.wasm`（built-in core，~12KB）。

wterm 生態系提供兩種 WASM core：
- **Built-in core**（`@wterm/core`）：Zig 寫的 VT100/VT220 parser，體積小（~12KB），載入快，支援基本終端序列
- **Ghostty core**（`@wterm/ghostty`）：基於 Ghostty 的 libghostty 編譯成 WASM，體積較大（~400KB），但完整支援 Unicode grapheme clusters、複雜 emoji 序列、完整 SGR 屬性、進階 escape sequence（如 DECSWL/DECDWL/DECDHL 雙高度行、Sixel 圖形等）

兩種 core 在 `@wterm/react` 的 Terminal 元件上透過 `wasmUrl` prop 切換，API 完全相容，不需要修改 `onData`、`onResize` 等回呼介面。但 WASM 模組一旦載入後不可替換，因此切換 core 時必須卸載並重新建立 Terminal 元件實例。

後端（`server.ts`）使用 node-pty + tmux，PTY 層與前端 core 選擇無關，不需要任何修改。

## Goals / Non-Goals

**Goals:**
- 在前端 header 提供直覺的 core 切換 UI（下拉選單或 toggle switch）
- 切換 core 時正確重建 Terminal 元件，確保 WASM 狀態乾淨初始化
- 將使用者的 core 偏好持久化到 localStorage，頁面重載後自動恢復
- 在 footer 顯示當前使用的 core 資訊（名稱與 WASM 大小）
- 預設使用 built-in core（保持向後相容，首次使用不影響現有使用者）
- Ghostty core WASM 檔案（~400KB）採按需載入策略，僅在使用者選擇時才下載

**Non-Goals:**
- 不修改後端 `server.ts`（PTY 層與前端 core 無關）
- 不實作自動偵測機制（例如偵測輸出內容自動切換 core）
- 不實作 WASM core 的 CDN 或版本管理策略
- 不實作 core 效能監控或基準測試工具
- 不修改 wterm 元件庫本身的 API 或行為
- 不處理離線場景（Service Worker 快取等）

## Decisions

### Decision: Core 切換使用 React key 強制重建 Terminal 元件

Terminal 元件的 WASM core 在初始化後不可替換（生命週期綁定在元件內部）。因此切換 core 時，必須卸載並重新建立整個 Terminal 元件實例。

使用 React 的 `key` prop 是最簡潔的方式：當 `key` 值改變時，React 會卸載舊元件並建立新元件。將 core 名稱作為 key 的一部分（例如 `key={\`terminal-${coreType}\`}`），即可在 core 切換時觸發完整重建。

重建過程中會短暫失去 WebSocket 連線狀態（舊 Terminal 卸載時），新 Terminal 透過 `onReady` 回呼重新觸發 `connect()` 自動重連，這與現有的自動連線邏輯一致。

**Alternatives considered:**
- **使用 state 強制卸載（條件渲染 + setTimeout）**：先設 `showTerminal = false`，等一個 tick 後再設為 `true`。可行但比 `key` 更 hacky，且需要額外的 state 管理
- **在 Terminal 元件內部暴露 core 替換 API**：需要修改 `@wterm/react` 元件庫，超出本專案範圍
- **使用兩個 Terminal 元件實例，切換顯示/隱藏**：會同時持有兩個 WASM 實例，記憶體浪費，且 WebSocket 事件處理複雜

### Decision: 預設使用 built-in core，Ghostty WASM 按需載入

考慮到大部分使用者的基本終端操作不需要 Ghostty core，且 Ghostty WASM（~400KB）比 built-in（~12KB）大約 33 倍，預設使用 built-in core 可維持現有的快速載入體驗。Ghostty WASM 僅在使用者明確選擇時才由瀏覽器下載。

WASM 檔案放在 `public/` 目錄，由 Next.js 靜態檔案服務直接提供。瀏覽器的 HTTP 快取會在首次下載後快取 WASM 檔案，後續切換不會重複下載。

**Alternatives considered:**
- **預設使用 Ghostty core**：功能最完整，但增加所有使用者的初始載入時間
- **動態 import + Code splitting**：使用 `fetch()` 動態下載 WASM 並傳入 Terminal。但 `@wterm/react` 的 `wasmUrl` prop 已經處理了 WASM 的載入邏輯，不需要額外的動態載入機制

### Decision: 使用 localStorage 存取 core 偏好

使用 `localStorage` 以 key `webcli:core-preference` 存取使用者的 core 選擇。這是最簡單且無需後端支援的持久化方案。

值為 `"builtin"` 或 `"ghostty"` 字串。若 localStorage 中無值或值不合法，fallback 到 `"builtin"`。

**Alternatives considered:**
- **URL query parameter**：可以分享連結帶上 core 選擇，但會與現有的 session 參數混淆，且不如 localStorage 方便
- **後端使用者設定 API**：需要使用者認證系統，目前專案沒有，overkill
- **Cookie**：可行但 localStorage 更適合純客戶端偏好設定

### Decision: UI 使用下拉選單（select）而非 toggle switch

Core 選擇是一個「二選一」的設定，但未來可能支援更多 core 選項。使用 `<select>` 下拉選單比 toggle switch 更具擴展性，且視覺上與 header 的其他控制項（session name input、connect button）風格更一致。

下拉選單放在 header 的 session name input 左側，標示為「Core」，選項顯示 core 名稱與大小提示。

**Alternatives considered:**
- **Toggle switch（開關）**：二元切換很直覺，但未來擴展性差
- **Radio button group**：二元選擇時佔用空間較多
- **放在設定面板 / Modal**：過度設計，core 切換是低頻操作但需要隨時可見

## Risks / Trade-offs

- **Ghostty WASM 載入延遲**：首次選擇 Ghostty core 時需下載 ~400KB WASM，在慢速網路下可能有明顯延遲。緩解：可在 UI 上顯示載入狀態（Terminal 元件的 `onReady` 回呼可用於偵測載入完成）
- **切換時短暫斷線**：Core 切換會重建 Terminal 元件，導致短暫的 WebSocket 斷線與重連。這是無法避免的，但影響時間極短（通常 < 500ms）
- **Ghostty WASM 記憶體用量**：Ghostty core 的 WASM 比較大，記憶體佔用可能較高。在記憶體受限的裝置（如舊手機）上可能有影響。緩解：提供 UI 提示讓使用者了解差異
- **WASM 檔案版本同步**：`public/ghostty.wasm` 的版本需與 `@wterm/ghostty` 套件版本一致。如果手動複製可能出現版本不一致問題。緩解：在 tasks 中加入 build script 或 postinstall script 自動複製
- **雙核心測試負擔**：未來每次修改終端相關功能都需要在兩種 core 上驗證。緩解：將 core 選擇作為測試參數之一

## Migration Plan

1. **Phase 1 — 安裝與檔案準備**：安裝 `@wterm/ghostty`，將 Ghostty WASM 複製到 `public/`，確認靜態檔案可被正確提供
2. **Phase 2 — 前端 UI 與邏輯**：在 `app/page.tsx` 新增 core state、localStorage 讀寫、header UI 控制項、Terminal key 機制
3. **Phase 3 — 驗證與調整**：分別用兩種 core 測試基本操作（連線、輸入、resize、tmux 指令），確認功能正常；測試複雜 Unicode 場景確認 Ghostty core 的優勢可見
4. **Phase 4 —（可選）自動化複製腳本**：建立 `scripts/copy-ghostty-wasm.sh` 或 postinstall hook，在 `npm install` 後自動複製 WASM 到 `public/`

## Open Questions

- **Ghostty WASM 的確切檔案路徑**：`@wterm/ghostty` 套件安裝後，WASM 檔案在 `node_modules/@wterm/ghostty/` 下的確切路徑為何？需要在安裝後確認，才能撰寫複製腳本。可能的路徑：`node_modules/@wterm/ghostty/dist/ghostty.wasm` 或 `node_modules/@wterm/ghostty/ghostty.wasm`
- **Ghostty core 的 WASM 大小**：使用者描述約 400KB，但實際大小需在安裝後確認。這會影響 UI 上的大小提示文字
- **Core 切換時是否需要清除 tmux session 的替代畫面緩衝區**：切換 core 重建 Terminal 後，tmux 的替代畫面狀態可能需要重新繪製。是否需要發送特殊的 escape sequence 來觸發重繪？
- **未來是否需要支援更多 core**：如果 wterm 生態系未來提供更多 WASM core 選項，目前的 select UI 是否足夠？是否需要改為更通用的 core 管理機制？
