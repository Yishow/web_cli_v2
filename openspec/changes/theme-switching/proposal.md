# Change: theme-switching

## Why

目前 web_cli_v2 的終端使用 wterm 預設的外觀呈現，背景色與文字色固定為單一配色。然而，不同使用者有不同的視覺偏好——有人習慣暗色主題（如 Solarized Dark、Monokai），有人需要亮色主題（Light）以配合白天環境，也有使用者希望維持預設暗色但微調對比度。

wterm 的渲染層基於 DOM，所有終端顏色（前景色、背景色、ANSI 16 色、游標色、選取色等）皆透過 CSS custom properties 控制。這意味著主題切換可以純 CSS 層面實現，不需要修改 wterm 的 JavaScript/WASM 邏輯。

為了讓使用者能依據個人偏好與使用環境選擇適合的終端配色，需要在前端加入主題切換 UI，並提供至少 4 組預設主題（Default 暗色、Solarized Dark、Monokai、Light），同時將選擇持久化以確保跨頁面載入的一致性。

## What Changes

1. **定義主題系統（CSS custom properties）**：在 `app/globals.css` 中定義一組完整的 CSS custom properties，涵蓋終端的所有視覺元素（背景色、前景色、ANSI 0-15 色、游標色、選取背景/前景色、粗體色等）。每個主題透過 CSS class（如 `.theme-default`、`.theme-solarized-dark`）提供一組值。
2. **建立主題定義檔**：建立 `app/themes.ts`（或 `.json`），集中管理所有主題的中繼資料（名稱、label、CSS class name），供 UI 元件使用。
3. **在 Header 加入主題切換 UI**：在 `app/page.tsx` 的 header 區域新增主題選擇下拉選單，讓使用者即時切換主題。
4. **透過 CSS class 切換主題**：切換主題時，將對應的 CSS class 套用到終端容器的父元素上，wterm 的 CSS custom properties 即自動生效。
5. **用 localStorage 持久化選擇**：將使用者的主題偏好存入 `localStorage`，下次載入頁面時自動套用，包含初始渲染（避免 FOUC）。
6. **提供 4 個預設主題**：
   - **Default**：暗色基底，wterm 的預設配色
   - **Solarized Dark**：經典 Solarized Dark 配色，低對比度護眼
   - **Monokai**：高對比度暗色主題，適合程式開發
   - **Light**：亮色背景主題，適合白天環境

## Capabilities

### New Capabilities

- `theme-switching`: 使用者可以在前端 UI 即時切換終端主題，變更立即生效，無需重新載入頁面或重建 Terminal 元件
- `theme-persistence`: 使用者的主題偏好透過 localStorage 持久化，頁面重新載入後自動恢復為上次選擇的主題
- `theme-system`: 一套基於 CSS custom properties 的主題架構，定義終端所有視覾相關的 CSS 變數，新增主題只需新增一組 CSS class 和對應的中繼資料

### Modified Capabilities

- `web-terminal-ui`: header 區域新增主題切換下拉選單，footer 顯示當前主題名稱
- `web-terminal-rendering`: Terminal 元件的容器會根據當前主題套用對應的 CSS class，wterm 透過 CSS custom properties 繼承正確的顏色值

## Impact

- Affected code:
  - `app/globals.css` — 新增 CSS custom properties 定義與 4 組主題的 CSS class
  - `app/page.tsx` — 新增主題 state、localStorage 讀寫、header 主題切換 UI、footer 主題資訊、容器 class 動態切換
  - `app/themes.ts`（新增）— 主題中繼資料定義（名稱、label、CSS class）
- Affected systems:
  - 前端終端渲染的視覺層（CSS custom properties → wterm DOM rendering）
  - 前端 UI（header 主題選單、footer 主題資訊）
- Verification impact:
  - 功能驗證：切換每個主題後，確認終端顏色（前景、背景、ANSI 色、游標）正確變更
  - 持久化驗證：重新載入頁面後確認主題被保留，且無 FOUC（Flash of Unstyled Content）
  - 相容性驗證：在不同瀏覽器中確認 CSS custom properties 正確繼承
  - ANSI 色彩驗證：在終端中執行包含完整 ANSI 16 色的輸出，確認每種主題下的色彩正確
