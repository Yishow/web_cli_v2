# Design: theme-switching

## Context

web_cli_v2 使用 `@wterm/react` 的 `<Terminal>` 元件作為瀏覽器終端渲染層。wterm 採用 DOM-based 渲染，終端的外觀由 CSS 控制。具體來說，wterm 使用 CSS custom properties（又稱 CSS 變數）來定義所有終端顏色，包括：

- `--wterm-background` — 終端背景色
- `--wterm-foreground` — 終端前景色（預設文字顏色）
- `--wterm-cursor` — 游標顏色
- `--wterm-cursor-accent` — 游標內文字顏色
- `--wterm-selection-background` — 選取區塊背景色
- `--wterm-selection-foreground` — 選取區塊前景色
- `--wterm-color-0` 到 `--wterm-color-15` — ANSI 16 色（黑、紅、綠、黃、藍、洋紅、青、白 × 標準/亮色）

目前的 `app/globals.css` 僅包含 Tailwind import 和基本的 `:root` 字型設定，沒有覆寫任何 wterm 的 CSS custom properties。因此 Terminal 元件使用 wterm 的預設暗色外觀。

由於 CSS custom properties 具有繼承特性，只需要在 Terminal 元件的祖先元素上設定這些變數，就能覆蓋 wterm 的預設值。這意味著主題切換可以完全在 CSS 層面實現，不需要修改 wterm 元件庫本身，也不需要重建 Terminal 元件實例。

目前的 UI 架構是三段式：header（工具列）→ terminal（終端）→ footer（狀態列）。主題切換 UI 適合放在 header，與現有的 session name input、connect button 等控制項並列。

## Goals / Non-Goals

**Goals:**
- 提供至少 4 組預設主題：Default（暗色）、Solarized Dark、Monokai、Light
- 主題切換即時生效，無需重新載入頁面或重建 Terminal 元件
- 在 header 提供直覺的主題選擇下拉選單
- 將使用者的主題偏好持久化到 localStorage，頁面重載後自動恢復
- 避免頁面初次載入時的 FOUC（Flash of Unstyled Content）
- 在 footer 顯示當前使用的主題名稱
- 主題架構易於擴展，新增主題只需新增 CSS class 和中繼資料

**Non-Goals:**
- 不實作自訂主題編輯器（使用者自訂顏色值）
- 不實作主題的匯入/匯出功能
- 不實作「跟隨系統」的 auto 主題（matchMedia prefers-color-scheme）
- 不修改後端 `server.ts`（主題純前端事務）
- 不修改 wterm 元件庫本身的 API 或行為
- 不處理主題相關的 Service Worker 快取策略

## Decisions

### Decision: 使用 CSS custom properties + CSS class 切換

主題透過在終端容器的父元素上切換 CSS class 來實現。每個主題定義為一個 CSS class（如 `.theme-solarized-dark`），在該 class 內覆寫所有 wterm 使用的 CSS custom properties。

這種方式的優勢：
1. 即時生效：CSS class 變更會立即觸發瀏覽器重新計算樣式，不需要重建 DOM
2. 效能極佳：CSS custom properties 的繼承是瀏覽器原生優化的路徑
3. 不需要重建 Terminal 元件：與 core 切換不同，主題切換完全不影響 wterm 的 WASM 運行狀態
4. 擴展性：新增主題只需新增 CSS class 和對應的中繼資料，不需修改 React 元件邏輯

**Alternatives considered:**
- **Inline style 動態注入**：透過 React state 動態設定 inline style。可行但分散了顏色定義（從 CSS 移到 JS），維護性差，且無法利用 CSS 的級聯和繼承
- **CSS-in-JS（styled-jsx / emotion）**：可以在 JS 中定義主題，但引入額外依賴，且目前專案只用 Tailwind CSS，不需要額外的 CSS-in-JS 方案
- **CSS @layer + media query**：可搭配 `prefers-color-scheme` 實現系統主題跟隨，但本階段目標是手動切換，且 `@layer` 對主題管理的靈活度不如 class-based

### Decision: 主題 class 套用於終端容器的父 `<div>`

將主題 class（如 `.theme-monokai`）套用到包住 Terminal 元件的 `<div>` 容器上，而非 `<html>` 或 `<body>`。理由：

1. 作用域隔離：主題只影響終端區域的顏色，不影響 header/footer 的 Tailwind 樣式（header/footer 使用固定的 zinc/emerald 色系）
2. 語意清晰：容器元素的 class 明確表達「這個區域使用該主題」
3. 避免衝突：不會與 Tailwind 的 dark mode 或其他全域色彩系統衝突

**Alternatives considered:**
- **套用到 `<html>` 元素**：全域影響，header/footer 的 Tailwind 顏色類（如 `bg-zinc-950`、`text-emerald-400`）可能被覆蓋
- **套用到 `<body>` 元素**：同上問題
- **套用到 Terminal 元件本身**：Terminal 元件的內部 DOM 結構由 wterm 控制，無法可靠地在外部設定 class

### Decision: 主題中繼資料集中在 themes.ts

建立 `app/themes.ts` 檔案，集中定義所有主題的中繼資料：

```typescript
export type ThemeId = "default" | "solarized-dark" | "monokai" | "light";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  cssClass: string;
}

export const THEMES: ThemeMeta[] = [
  { id: "default", label: "Default", cssClass: "theme-default" },
  { id: "solarized-dark", label: "Solarized Dark", cssClass: "theme-solarized-dark" },
  { id: "monokai", label: "Monokai", cssClass: "theme-monokai" },
  { id: "light", label: "Light", cssClass: "theme-light" },
];

export const DEFAULT_THEME: ThemeId = "default";
export const THEME_STORAGE_KEY = "webcli:theme-preference";
```

這樣做的好處是主題列表在單一位置管理，UI 和邏輯都引用同一份資料。

**Alternatives considered:**
- **直接在 CSS 中用 `:root` 的 data attribute**：`[data-theme="monokai"]`。可行，但 data attribute 與 CSS class 的差異微小，CSS class 更符合 Tailwind 生態的慣例
- **JSON 設定檔**：需要額外的 build step 來 import JSON，TypeScript 的 `as const` 可以達成類似效果但更直接

### Decision: 使用 localStorage 存取主題偏好

使用 `localStorage` 以 key `webcli:theme-preference` 存取使用者的主題選擇。值為主題 ID 字串（如 `"monokai"`）。若 localStorage 中無值或值不合法，fallback 到 `"default"`。

為了避免 FOUC，在 `<html>` 的 `<head>` 中注入一段內聯 script（inline script），在頁面渲染前讀取 localStorage 並將對應的 CSS class 套用到終端容器。但由於終端容器在 `<body>` 內而非 `<html>` 上，且 React 需要 hydration，實際做法是在 React 元件的初始 state 直接使用 localStorage 值（透過 `useState` 的 lazy initializer），並在首次渲染時就帶上正確的 class。

**Alternatives considered:**
- **URL query parameter**：可分享帶主題的連結，但會與 session 參數混淆，且不如 localStorage 方便
- **Cookie**：可在 SSR 時讀取避免 FOUC，但增加伺服器端複雜度
- **後端使用者設定 API**：需要認證系統，overkill
- **sessionStorage**：僅在當前分頁生命週期內持久化，關閉分頁後丟失，不符合「下次開啟自動恢復」的需求

### Decision: 主題切換 UI 使用 `<select>` 下拉選單

主題選項放在 header 區域的一個 `<select>` 下拉選單中，標示為「Theme」。使用 `<select>` 而非其他控制項的理由：

1. 擴展性：未來可輕鬆加入更多主題
2. 一致性：與 ghostty-core-toggle 的 Core 下拉選單風格統一
3. 簡潔：不佔用過多 header 空間

**Alternatives considered:**
- **色票按鈕組（swatch buttons）**：視覺直覺但佔空間，且主題數量增加時會擁擠
- **Radio button group**：佔用空間較多
- **設定面板 / Modal**：過度設計，主題切換是頻繁操作應隨時可見
- **循環按鈕（click to cycle）**：不直覺，使用者無法一眼看到所有選項

### Decision: Header/footer 的 UI 顏色不跟隨主題變化

Header 和 footer 使用固定的 Tailwind 色系（zinc 深色背景 + emerald 強調色），不受終端主題影響。理由：

1. header/footer 是應用框架 UI，與終端內容的視覺語言不同
2. 固定的框架色確保控制項（按鈕、輸入框）在所有主題下都有穩定、可預期的外觀
3. 避免主題切換時 header/footer 的文字對比度問題（如 Light 主題下可能需要反轉框架色）

**Alternatives considered:**
- **框架也跟隨主題變化**：需要為每個主題定義額外的框架色彩變數，增加維護成本，且可能導致控制項在部分主題下難以辨識

## Risks / Trade-offs

- **wterm CSS 變數名稱的穩定性**：wterm 的 CSS custom properties 名稱（如 `--wterm-background`）可能隨版本更新而變更。緩解：在升級 wterm 時應檢查 CSS 變數名稱是否變動，並在 tasks 中加入對應的驗證步驟
- **ANSI 16 色的準確性**：Solarized Dark 和 Monokai 的 ANSI 16 色有多種版本（原始定義 vs 終端模擬器常用變體），選擇哪一種可能引起使用者爭議。緩解：使用各主題最廣泛接受的色彩值，並在文件中註明參考來源
- **FOUC（Flash of Unstyled Content）**：如果 React hydration 延遲，頁面可能在短暫瞬間顯示預設主題後才切換到使用者偏好。緩解：`useState` 的 lazy initializer 在同步執行時幾乎無延遲，且 Tailwind 的 `suppressHydrationWarning` 已在 layout.tsx 中設定
- **亮色主題與暗色框架的視覺衝突**：Light 主題的白色終端背景與 zinc-950 的應用框架之間會有強烈的明暗對比。緩解：在 Light 主題下可考慮微調終端容器周圍的邊界樣式（如加 border 過渡），但本階段暫不處理
- **未來主題數量增長**：如果主題數量超過 10 個，下拉選單的使用者體驗會下降。緩解：屆時可改為 grid picker 或帶搜尋的 dropdown

## Migration Plan

1. **Phase 1 — CSS 主題定義**：在 `app/globals.css` 中定義所有 CSS custom properties 和 4 組主題的 CSS class
2. **Phase 2 — 主題中繼資料**：建立 `app/themes.ts`，定義主題型別和常數
3. **Phase 3 — 前端 UI 與邏輯**：在 `app/page.tsx` 新增主題 state、localStorage 讀寫、header 主題下拉選單、容器 class 動態切換、footer 主題資訊
4. **Phase 4 — 驗證與調整**：逐一測試 4 個主題的視覺效果，確認 ANSI 16 色正確、游標可見、選取可辨識；測試 localStorage 持久化；測試頁面重載後無 FOUC

## Open Questions

- **wterm CSS 變數的確切名稱**：wterm 實際使用的 CSS custom properties 名稱是否為 `--wterm-background`、`--wterm-foreground` 等？需要查閱 `@wterm/react/css` 的原始碼或文件確認。如果名稱不同，需要調整 CSS 定義
- **wterm 是否已內建主題支援**：wterm 是否已提供官方的主題 CSS 檔案（如 `@wterm/react/themes/solarized-dark.css`）？如果有，可以直接 import 而非自行定義
- **ANSI 亮色變體的處理**：部分終端主題中 ANSI 亮色（color-8 到 color-15）是標準色的加亮版，另一些主題則有完全不同的色彩值。應遵循哪種慣例？
- **Light 主題下的游標可見性**：Light 主題的白色背景上，游標顏色需要特別調整（如改為深色）以維持可見性。具體的游標顏色值需要測試
- **是否需要支援 `prefers-color-scheme` 自動切換**：使用者是否期望首次使用時自動跟隨系統的 light/dark mode？這不在本次 scope 但值得記錄為未來考量
