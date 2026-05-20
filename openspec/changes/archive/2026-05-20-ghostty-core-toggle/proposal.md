# Change: ghostty-core-toggle

## Why

目前 web_cli_v2 使用 wterm 內建的 WASM core（`/public/wterm.wasm`，約 12KB），這是一個以 Zig 撰寫的 VT100/VT220 parser，適合基本終端操作。但在實際使用中，當終端輸出包含複雜的 Unicode（如 grapheme clusters、emoji 組合序列）、完整的 SGR（Select Graphic Rendition）屬性、或進階的 escape sequence 時，built-in core 的解析能力不足，可能導致顯示異常或資料丟失。

官方提供的 `@wterm/ghostty` 套件基於 Ghostty 終端模擬器的 `libghostty` 編譯成 WASM（約 400KB），對上述進階場景有完整支援。兩種 core 在 `@wterm/react` 的 Terminal 元件上是可互換的，只需替換 `wasmUrl` prop 即可切換。

為了讓使用者能依據自身需求選擇合適的 core（預設輕量的 built-in，或功能完整的 Ghostty），需要在前端 UI 加入 core 切換功能，並在切換時重新載入對應的 WASM 模組。

## What Changes

1. **安裝 `@wterm/ghostty` 套件**：新增 `@wterm/ghostty` 為專案依賴，取得 Ghostty WASM core
2. **複製 Ghostty WASM 到 public 目錄**：將 `@wterm/ghostty` 的 WASM 檔案（`ghostty.wasm`）複製到 `public/` 目錄供前端載入
3. **在 `app/page.tsx` 加入 core 選擇 UI**：在 header 區域新增一個下拉選單或 toggle，讓使用者選擇「Built-in Core」或「Ghostty Core」
4. **動態切換 Terminal 元件的 `wasmUrl`**：根據使用者選擇，動態傳入 `/wterm.wasm`（built-in）或 `/ghostty.wasm`（Ghostty）作為 `wasmUrl` prop
5. **切換時重建 Terminal 元件**：因 WASM core 在載入後不可替換，切換 core 時需要卸載並重新掛載整個 Terminal 元件（使用 React `key` 強制重建）
6. **持久化選擇**：將使用者的 core 偏好存入 `localStorage`，下次開啟時自動套用

## Capabilities

### New Capabilities

- `ghostty-core-selection`: 使用者可以在前端 UI 選擇使用 built-in wterm core 或 Ghostty core 作為終端解析引擎
- `ghostty-core-persistence`: 使用者的 core 選擇會透過 localStorage 持久化，頁面重新載入後自動恢復偏好設定

### Modified Capabilities

- `web-terminal-rendering`: Terminal 元件現在接受動態的 `wasmUrl` prop，可根據使用者選擇載入不同的 WASM core；元件透過 React `key` 機制在 core 切換時完整重建，確保 WASM 狀態乾淨初始化
- `web-terminal-ui`: header 區域新增 core 切換控制項，並在 footer 顯示當前使用的 core 名稱與大小資訊

## Impact

- Affected code:
  - `app/page.tsx` — 主要改動檔案，新增 core 選擇 state、localStorage 讀寫、UI 控制項、Terminal 元件 key 機制
  - `package.json` — 新增 `@wterm/ghostty` 依賴
  - `public/ghostty.wasm` — 新增 Ghostty WASM 二進位檔案（需從 `@wterm/ghostty` 套件複製或透過 build script 複製）
- Affected systems:
  - 前端終端渲染系統（wterm core 載入流程）
  - 前端 UI（header / footer 資訊顯示）
  - 建置流程（需確保 Ghostty WASM 檔案可被正確部署到 `public/`）
- Verification impact:
  - 功能驗證：在 UI 切換 core 後，確認 Terminal 元件正確重建並使用新的 WASM
  - 效能驗證：比較 built-in core（~12KB）與 Ghostty core（~400KB）的初始載入時間
  - 相容性驗證：分別使用兩種 core 執行包含複雜 Unicode、SGR 屬性的終端應用，確認顯示正確
  - 持久化驗證：重新載入頁面後確認 core 選擇被保留
