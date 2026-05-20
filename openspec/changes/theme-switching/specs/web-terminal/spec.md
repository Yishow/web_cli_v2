# Spec: web-terminal

## NEW Requirements

### Requirement: 終端主題系統

系統必須提供一套基於 CSS custom properties 的主題架構，讓終端的視覺外觀可以透過切換 CSS class 即時變更。主題涵蓋的 CSS 變數至少包含：背景色、前景色、游標色、游標強調色、選取背景色、選取前景色、ANSI 16 色（color-0 到 color-15）。

#### Scenario: CSS custom properties 被正確定義
- **WHEN** `app/globals.css` 被瀏覽器載入
- **THEN** 存在 `.theme-default`、`.theme-solarized-dark`、`.theme-monokai`、`.theme-light` 四個 CSS class
- **AND** 每個 class 內定義了 `--wterm-background`、`--wterm-foreground`、`--wterm-cursor`、`--wterm-cursor-accent`、`--wterm-selection-background`、`--wterm-selection-foreground`、`--wterm-color-0` 至 `--wterm-color-15` 等 CSS custom properties
- **AND** 每個主題的色彩值各不相同

#### Scenario: 主題 class 套用後終端顏色立即變更
- **WHEN** 終端容器的父 `<div>` 被加上 `.theme-monokai` class
- **THEN** Terminal 元件的背景色變為 Monokai 主題定義的 `--wterm-background` 值
- **AND** Terminal 元件的文字色變為 Monokai 主題定義的 `--wterm-foreground` 值
- **AND** 所有 ANSI 色彩輸出使用 Monokai 主題定義的 `--wterm-color-0` 至 `--wterm-color-15`

#### Scenario: 主題切換不需要重建 Terminal 元件
- **WHEN** 使用者切換主題
- **THEN** CSS class 在終端容器上被替換（如從 `.theme-default` 變為 `.theme-solarized-dark`）
- **AND** Terminal 元件不被卸載或重建
- **AND** WebSocket 連線保持不斷
- **AND** 終端內容（文字、游標位置、捲動位置）保持不變

### Requirement: 主題中繼資料管理

系統必須在 `app/themes.ts` 中集中管理所有主題的中繼資料，包含主題 ID、顯示名稱、對應的 CSS class name。

#### Scenario: 主題中繼資料結構正確
- **WHEN** `app/themes.ts` 被其他模組 import
- **THEN** 匯出 `ThemeId` type，為所有合法主題 ID 的聯合型別（`"default" | "solarized-dark" | "monokai" | "light"`）
- **AND** 匯出 `ThemeMeta` interface，包含 `id: ThemeId`、`label: string`、`cssClass: string`
- **AND** 匯出 `THEMES` 常數，為 `ThemeMeta[]` 型別，包含 4 個主題項目
- **AND** 匯出 `DEFAULT_THEME` 常數，值為 `"default"`
- **AND** 匯出 `THEME_STORAGE_KEY` 常數，值為 `"webcli:theme-preference"`

### Requirement: 主題持久化

系統必須將使用者的主題偏好持久化到 localStorage，頁面重新載入後自動恢復。

#### Scenario: 首次載入使用預設主題
- **WHEN** 使用者首次開啟 web_cli_v2 頁面（localStorage 中無 `webcli:theme-preference` 值）
- **THEN** 系統使用 Default 主題
- **AND** 終端容器帶有 `.theme-default` class
- **AND** header 的主題下拉選單顯示「Default」為已選取狀態
- **AND** footer 顯示「Theme: Default」

#### Scenario: 頁面載入時恢復已儲存的主題偏好
- **WHEN** 使用者開啟頁面且 localStorage 的 `webcli:theme-preference` 值為 `"solarized-dark"`
- **THEN** 系統使用 Solarized Dark 主題
- **AND** 終端容器帶有 `.theme-solarized-dark` class
- **AND** header 的主題下拉選單顯示「Solarized Dark」為已選取狀態
- **AND** footer 顯示「Theme: Solarized Dark」

#### Scenario: 切換主題後寫入 localStorage
- **WHEN** 使用者在 header 的主題下拉選單中選擇「Monokai」
- **THEN** 系統將 `"monokai"` 寫入 localStorage（key: `webcli:theme-preference`）
- **AND** 終端容器的 CSS class 從當前主題切換為 `.theme-monokai`
- **AND** 終端顏色即時變更為 Monokai 配色

#### Scenario: localStorage 中存有無效的主題偏好值
- **WHEN** localStorage 的 `webcli:theme-preference` 值不是 `"default"`、`"solarized-dark"`、`"monokai"` 或 `"light"`
- **THEN** 系統忽略該值，fallback 使用 Default 主題
- **AND** 將 localStorage 的值修正為 `"default"`

#### Scenario: 頁面重載後無 FOUC
- **WHEN** 使用者已選擇 Light 主題並重新載入頁面
- **THEN** 頁面渲染的首次 paint 即使用 Light 主題的色彩
- **AND** 不出現先顯示 Default 暗色再閃切為 Light 亮色的現象

## MODIFIED Requirements

### Requirement: Header 包含主題切換控制項

Header 區域必須提供一個下拉選單（`<select>`），讓使用者即時切換終端主題。控制項位於現有 UI 元件附近。

#### Scenario: 主題下拉選單包含正確選項
- **WHEN** 頁面載入完成
- **THEN** header 中存在一個 `<select>` 元素
- **AND** 該 `<select>` 包含 4 個 `<option>`：「Default」、「Solarized Dark」、「Monokai」、「Light」
- **AND** 當前選中的選項與實際使用的主題一致

#### Scenario: 切換主題選項觸發即時變更
- **WHEN** 使用者在主題下拉選單中選擇「Light」
- **THEN** 終端背景立即變為 Light 主題定義的背景色
- **AND** 終端文字色立即變為 Light 主題定義的前景色
- **AND** header 的主題選單保持顯示「Light」為已選取

#### Scenario: 下拉選單的視覺風格
- **WHEN** 主題下拉選單在 header 中渲染
- **THEN** 使用與 session name input 一致的深色主題樣式（bg-zinc-800、圓角、小字體）
- **AND** 左側有「Theme」標籤文字

### Requirement: Footer 顯示當前主題資訊

Footer 必須顯示當前使用的主題名稱，讓使用者隨時了解目前的終端主題。

#### Scenario: Footer 顯示主題名稱
- **WHEN** 終端使用 Default 主題
- **THEN** footer 顯示「Theme: Default」
- **WHEN** 終端使用 Monokai 主題
- **THEN** footer 顯示「Theme: Monokai」
