# Spec: web-terminal

## MODIFIED Requirements

### Requirement: Web Terminal Core 可切換

Web Terminal 元件必須支援在 built-in wterm core 與 Ghostty core 之間切換。使用者可透過 UI 控制項選擇偏好的 core，系統會卸載舊的 Terminal 元件實例並以新的 WASM core 重建。

#### Scenario: 頁面初次載入使用預設 core
- **WHEN** 使用者首次開啟 web_cli_v2 頁面（localStorage 中無 core 偏好）
- **THEN** Terminal 元件使用 built-in core（`wasmUrl="/wterm.wasm"`）
- **AND** header 的 core 下拉選單顯示「Built-in」為已選取狀態
- **AND** footer 顯示「Core: Built-in (~12KB)」

#### Scenario: 頁面載入時恢復已儲存的 core 偏好
- **WHEN** 使用者開啟頁面且 localStorage 的 `webcli:core-preference` 值為 `"ghostty"`
- **THEN** Terminal 元件使用 Ghostty core（`wasmUrl="/ghostty.wasm"`）
- **AND** header 的 core 下拉選單顯示「Ghostty」為已選取狀態
- **AND** footer 顯示「Core: Ghostty (~400KB)」

#### Scenario: 從 Built-in 切換到 Ghostty core
- **WHEN** 使用者在 header 的 core 下拉選單中選擇「Ghostty」
- **THEN** 系統將 `"ghostty"` 寫入 localStorage（key: `webcli:core-preference`）
- **AND** 舊的 Terminal 元件實例被卸載（觸發 WebSocket 斷線）
- **AND** 系統建立新的 Terminal 元件實例，傳入 `wasmUrl="/ghostty.wasm"` 與新的 React `key`
- **AND** 新的 Terminal 元件透過 `onReady` 回呼觸發自動重連
- **AND** footer 更新為「Core: Ghostty (~400KB)」

#### Scenario: 從 Ghostty 切換回 Built-in core
- **WHEN** 使用者在 header 的 core 下拉選單中選擇「Built-in」
- **THEN** 系統將 `"builtin"` 寫入 localStorage（key: `webcli:core-preference`）
- **AND** 舊的 Terminal 元件實例被卸載
- **AND** 系統建立新的 Terminal 元件實例，傳入 `wasmUrl="/wterm.wasm"` 與新的 React `key`
- **AND** 新 Terminal 元件自動重連到 tmux session
- **AND** footer 更新為「Core: Built-in (~12KB)」

#### Scenario: Core 切換期間短暫斷線
- **WHEN** core 切換觸發 Terminal 元件重建
- **THEN** 舊元件卸載時 WebSocket 連線中斷，連線狀態指示器短暫變為「未連線」
- **AND** 新元件的 `onReady` 觸發後自動重新建立 WebSocket 連線
- **AND** 連線狀態指示器恢復為「已連線」
- **AND** 整個切換過程在 1 秒內完成（不含 Ghostty WASM 首次下載時間）

#### Scenario: localStorage 中存有無效的 core 偏好值
- **WHEN** localStorage 的 `webcli:core-preference` 值不是 `"builtin"` 也不是 `"ghostty"`
- **THEN** 系統忽略該值，fallback 使用 built-in core
- **AND** 將 localStorage 的值修正為 `"builtin"`

## NEW Requirements

### Requirement: Ghostty Core WASM 檔案部署

Ghostty core 的 WASM 檔案（`ghostty.wasm`）必須作為靜態資源部署在 `public/` 目錄下，可透過 `/ghostty.wasm` URL 直接存取。

#### Scenario: 安裝套件後 Ghostty WASM 可供存取
- **WHEN** 執行 `pnpm install` 且 `@wterm/ghostty` 套件已安裝
- **THEN** `public/ghostty.wasm` 檔案存在且可透過 HTTP GET `/ghostty.wasm` 存取
- **AND** 檔案的 Content-Type 為 `application/wasm`

#### Scenario: 執行 build 後 Ghostty WASM 被正確複製
- **WHEN** 執行 `pnpm build` 或 `pnpm dev`
- **THEN** Ghostty WASM 檔案從 `node_modules/@wterm/ghostty/` 複製到 `public/ghostty.wasm`

### Requirement: Core 資訊顯示於 Footer

Footer 必須顯示當前使用的 core 名稱與 WASM 大小資訊，讓使用者隨時了解目前的終端核心。

#### Scenario: Footer 顯示當前 core 資訊
- **WHEN** Terminal 使用 built-in core
- **THEN** footer 顯示「Core: Built-in (~12KB)」
- **WHEN** Terminal 使用 Ghostty core
- **THEN** footer 顯示「Core: Ghostty (~400KB)」

### Requirement: Core 選擇控制項位於 Header

Header 區域必須提供一個下拉選單（`<select>`），讓使用者切換終端 core。控制項位於 session name input 的左側。

#### Scenario: Core 下拉選單包含正確選項
- **WHEN** 頁面載入完成
- **THEN** header 中存在一個 `<select>` 元素，包含兩個選項：「Built-in」和「Ghostty」
- **AND** 當前選中的選項與實際使用的 core 一致
- **AND** 選項的文字包含 core 大小提示，如「Built-in (~12KB)」和「Ghostty (~400KB)」

#### Scenario: 下拉選單的視覺風格
- **WHEN** core 下拉選單在 header 中渲染
- **THEN** 使用與 session name input 一致的深色主題樣式（bg-zinc-800、圓角、小字體）
- **AND** 左側有「Core」標籤文字
