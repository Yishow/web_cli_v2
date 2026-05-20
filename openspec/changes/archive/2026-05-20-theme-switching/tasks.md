# Tasks: theme-switching

## Tasks

## Progress

- [x] Task 1: 確認 wterm CSS 變數名稱
- [x] Task 2: 在 globals.css 定義主題 CSS custom properties 與 4 組主題 class
- [x] Task 3: 建立主題中繼資料檔案 themes.ts
- [x] Task 4: 在 page.tsx 新增主題狀態管理與 localStorage 讀寫
- [x] Task 5: 修改終端容器使用動態主題 CSS class
- [x] Task 6: 在 Header 新增主題切換下拉選單 UI
- [x] Task 7: 在 Footer 顯示當前主題資訊
- [x] Task 8: 下拉選單樣式微調
- [x] Task 9: 端對端驗證與手動測試
- [x] Task 10:（可選）合併 ghostty-core-toggle 與 theme-switching 的 UI 佈局

### Task 1: 確認 wterm CSS 變數名稱
- **檔案**: 無（調查任務）
- **改動**:
  1. 檢查 `node_modules/@wterm/react/css` 或 `node_modules/@wterm/dom/css` 的原始碼，確認 wterm 使用哪些 CSS custom properties 名稱
  2. 確認變數命名慣例（例如 `--wterm-background` 或 `--terminal-bg` 或其他）
  3. 確認是否已有官方主題檔案可供 import
  4. 記錄完整的變數清單，供 Task 2 使用
- **驗證**: 列出所有 wterm 使用的 CSS custom properties 名稱和預設值

### Task 2: 在 globals.css 定義主題 CSS custom properties 與 4 組主題 class
- **檔案**: `app/globals.css`
- **改動**:
  1. 在 `@import "@wterm/react/css";` 之後，新增 `.theme-default` CSS class（可為空，使用 wterm 預設值）：
     ```css
     .theme-default {
       /* 使用 wterm 預設值，不需覆寫 */
       --wterm-background: #1a1b26;
       --wterm-foreground: #c0caf5;
       --wterm-cursor: #c0caf5;
       --wterm-cursor-accent: #1a1b26;
       --wterm-selection-background: #33467c;
       --wterm-selection-foreground: #c0caf5;
       /* ANSI 16 色 */
       --wterm-color-0: #15161e;
       --wterm-color-1: #f7768e;
       --wterm-color-2: #9ece6a;
       --wterm-color-3: #e0af68;
       --wterm-color-4: #7aa2f7;
       --wterm-color-5: #bb9af7;
       --wterm-color-6: #7dcfff;
       --wterm-color-7: #a9b1d6;
       --wterm-color-8: #414868;
       --wterm-color-9: #f7768e;
       --wterm-color-10: #9ece6a;
       --wterm-color-11: #e0af68;
       --wterm-color-12: #7aa2f7;
       --wterm-color-13: #bb9af7;
       --wterm-color-14: #7dcfff;
       --wterm-color-15: #c0caf5;
     }
     ```
     注意：以上色彩值為預估值，需在 Task 1 確認 wterm 預設值後調整
  2. 新增 `.theme-solarized-dark` class（Solarized Dark 配色）：
     ```css
     .theme-solarized-dark {
       --wterm-background: #002b36;
       --wterm-foreground: #839496;
       --wterm-cursor: #93a1a1;
       --wterm-cursor-accent: #002b36;
       --wterm-selection-background: #073642;
       --wterm-selection-foreground: #93a1a1;
       --wterm-color-0: #073642;
       --wterm-color-1: #dc322f;
       --wterm-color-2: #859900;
       --wterm-color-3: #b58900;
       --wterm-color-4: #268bd2;
       --wterm-color-5: #d33682;
       --wterm-color-6: #2aa198;
       --wterm-color-7: #eee8d5;
       --wterm-color-8: #002b36;
       --wterm-color-9: #cb4b16;
       --wterm-color-10: #586e75;
       --wterm-color-11: #657b83;
       --wterm-color-12: #839496;
       --wterm-color-13: #6c71c4;
       --wterm-color-14: #93a1a1;
       --wterm-color-15: #fdf6e3;
     }
     ```
  3. 新增 `.theme-monokai` class（Monokai 配色）：
     ```css
     .theme-monokai {
       --wterm-background: #272822;
       --wterm-foreground: #f8f8f2;
       --wterm-cursor: #f8f8f0;
       --wterm-cursor-accent: #272822;
       --wterm-selection-background: #49483e;
       --wterm-selection-foreground: #f8f8f2;
       --wterm-color-0: #272822;
       --wterm-color-1: #f92672;
       --wterm-color-2: #a6e22e;
       --wterm-color-3: #f4bf75;
       --wterm-color-4: #66d9ef;
       --wterm-color-5: #ae81ff;
       --wterm-color-6: #a1efe4;
       --wterm-color-7: #f8f8f2;
       --wterm-color-8: #75715e;
       --wterm-color-9: #f92672;
       --wterm-color-10: #a6e22e;
       --wterm-color-11: #f4bf75;
       --wterm-color-12: #66d9ef;
       --wterm-color-13: #ae81ff;
       --wterm-color-14: #a1efe4;
       --wterm-color-15: #f8f8f2;
     }
     ```
  4. 新增 `.theme-light` class（亮色配色）：
     ```css
     .theme-light {
       --wterm-background: #fafafa;
       --wterm-foreground: #383a42;
       --wterm-cursor: #526fff;
       --wterm-cursor-accent: #fafafa;
       --wterm-selection-background: #bfceff;
       --wterm-selection-foreground: #383a42;
       --wterm-color-0: #fafafa;
       --wterm-color-1: #e45649;
       --wterm-color-2: #50a14f;
       --wterm-color-3: #c18401;
       --wterm-color-4: #4078f2;
       --wterm-color-5: #a626a4;
       --wterm-color-6: #0184bc;
       --wterm-color-7: #383a42;
       --wterm-color-8: #9e9e9e;
       --wterm-color-9: #e06c75;
       --wterm-color-10: #98c379;
       --wterm-color-11: #e5c07b;
       --wterm-color-12: #61afef;
       --wterm-color-13: #c678dd;
       --wterm-color-14: #56b6c2;
       --wterm-color-15: #202227;
     }
     ```
- **驗證**: 在瀏覽器 DevTools 中手動為終端容器加上各主題 class，確認 Terminal 元件的顏色正確變更；TypeScript 編譯無錯誤

### Task 3: 建立主題中繼資料檔案 themes.ts
- **檔案**: `app/themes.ts`（新增）
- **改動**:
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
- **驗證**: TypeScript 編譯無錯誤（`pnpm typecheck` 或 `npx tsc --noEmit`）

### Task 4: 在 page.tsx 新增主題狀態管理與 localStorage 讀寫
- **檔案**: `app/page.tsx`
- **改動**:
  1. 在檔案頂部新增 import：
     ```typescript
     import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY } from "./themes";
  import type { ThemeId, ThemeMeta } from "./themes";
     ```
  2. 新增 `loadThemePreference` 函數：
     ```typescript
     function loadThemePreference(): ThemeId {
       if (typeof window === "undefined") return DEFAULT_THEME;
       const saved = localStorage.getItem(THEME_STORAGE_KEY);
       if (saved && THEMES.some((t) => t.id === saved)) return saved as ThemeId;
       localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME);
       return DEFAULT_THEME;
     }
     ```
  3. 新增輔助函數 `getThemeMeta`：
     ```typescript
     function getThemeMeta(id: ThemeId): ThemeMeta {
       return THEMES.find((t) => t.id === id) ?? THEMES[0];
     }
     ```
  4. 在 `WebCliV2` 元件中加入 state：
     ```typescript
     const [themeId, setThemeId] = useState<ThemeId>(loadThemePreference);
     ```
  5. 新增 `handleThemeChange` 處理函數：
     ```typescript
     const handleThemeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
       const newTheme = e.target.value as ThemeId;
       localStorage.setItem(THEME_STORAGE_KEY, newTheme);
       setThemeId(newTheme);
     }, []);
     ```
  6. 取得當前主題中繼資料：
     ```typescript
     const currentTheme = getThemeMeta(themeId);
     ```
- **驗證**: TypeScript 編譯無錯誤

### Task 5: 修改終端容器使用動態主題 CSS class
- **檔案**: `app/page.tsx`
- **改動**: 修改包住 Terminal 元件的 `<div>` 容器，加入動態 CSS class：
  ```tsx
  {/* Terminal */}
  <div className={`flex-1 overflow-hidden ${currentTheme.cssClass}`}>
    <Terminal
      ref={ref}
      cols={120}
      rows={36}
      autoResize
      debug={false}
      wasmUrl="/wterm.wasm"
      onReady={handleReady}
      onData={handleData}
      onResize={handleResize}
      className="h-full w-full"
    />
  </div>
  ```
  注意：`wasmUrl` 可能已因 ghostty-core-toggle 變更為動態值，請與該 change 合併時注意一致性。
- **驗證**: 在瀏覽器中切換主題後，DevTools 確認終端容器的 class 正確變更，Terminal 元件未被重建

### Task 6: 在 Header 新增主題切換下拉選單 UI
- **檔案**: `app/page.tsx`
- **改動**:
  1. 在 header 的控制項區域新增主題選擇 UI。建議放在 session name input 與 connect button 之間：
     ```tsx
     <div className="flex items-center gap-1.5">
       <label htmlFor="theme-select" className="text-white/40 text-xs">Theme</label>
       <select
         id="theme-select"
         value={themeId}
         onChange={handleThemeChange}
         className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-mono border border-white/20 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
       >
         {THEMES.map((theme) => (
           <option key={theme.id} value={theme.id}>
             {theme.label}
           </option>
         ))}
       </select>
     </div>
     ```
  2. 調整 header 中間區段的佈局，確保所有控制項（Core select + Theme select + Session input + Connect button）和諧排列
- **驗證**: 頁面載入後 header 可見 Theme 下拉選單，切換選項觸發主題即時變更

### Task 7: 在 Footer 顯示當前主題資訊
- **檔案**: `app/page.tsx`
- **改動**: 在 footer 左側的 Session 資訊旁新增主題資訊：
  ```tsx
  <footer className="border-t border-white/10 bg-zinc-900/50 px-4 py-1.5 text-[10px] text-white/40 flex justify-between items-center">
    <div className="flex items-center gap-4">
      <div>
        Session: <span className="font-mono text-emerald-400">{sessionName}</span>
      </div>
      <div>
        Theme: <span className="font-mono text-emerald-400">{currentTheme.label}</span>
      </div>
    </div>
    <div>
      Tip: 在終端內輸入 <span className="font-mono text-white/60">tmux new-window</span> 或使用 <span className="font-mono">Ctrl-b c</span>
    </div>
  </footer>
  ```
  注意：如果已有 Core 資訊（來自 ghostty-core-toggle），則一併調整為 Session + Core + Theme 三項資訊。
- **驗證**: Footer 正確顯示當前主題名稱，切換主題後資訊即時更新

### Task 8: 下拉選單樣式微調
- **檔案**: `app/globals.css`
- **改動**: 確保 `<select>` 的 `<option>` 在深色背景下文字清晰可讀。如果瀏覽器預設的 option 背景（通常為白色）與深色 header 不協調，加入：
  ```css
  select option {
    background-color: #27272a; /* zinc-800 */
    color: white;
  }
  ```
  注意：如果 ghostty-core-toggle 已加入此樣式則不需重複。
- **驗證**: 下拉選單展開時選項背景為深色，文字清晰可讀

### Task 9: 端對端驗證與手動測試
- **檔案**: 無（測試任務）
- **改動**: 執行以下驗證步驟：
  1. 執行 `pnpm dev` 啟動開發伺服器
  2. 開啟瀏覽器，確認頁面正常載入，Terminal 使用 Default 主題
  3. 逐一在 header 下拉選單切換到 Solarized Dark → Monokai → Light → Default
  4. 每次切換後確認：
     - 終端背景色正確變更
     - 終端文字色正確變更
     - 連線狀態保持「已連線」
     - Terminal 元件未被重建（Console 無 `[wterm] Connected` 重複日誌）
  5. 測試 ANSI 16 色輸出：
     ```bash
     echo -e "\x1b[30mBlack\x1b[0m \x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m \x1b[33mYellow\x1b[0m \x1b[34mBlue\x1b[0m \x1b[35mMagenta\x1b[0m \x1b[36mCyan\x1b[0m \x1b[37mWhite\x1b[0m"
     echo -e "\x1b[1;30mBright Black\x1b[0m \x1b[1;31mBright Red\x1b[0m \x1b[1;32mBright Green\x1b[0m \x1b[1;33mBright Yellow\x1b[0m \x1b[1;34mBright Blue\x1b[0m \x1b[1;35mBright Magenta\x1b[0m \x1b[1;36mBright Cyan\x1b[0m \x1b[1;37mBright White\x1b[0m"
     ```
     確認在每個主題下 16 色都正確顯示
  6. 測試游標可見性：在每個主題下輸入文字，確認游標清晰可見（特別是 Light 主題）
  7. 測試選取：用滑鼠選取終端文字，確認選取背景色在每個主題下都可辨識
  8. 測試持久化：切換到 Monokai → 重新載入頁面 → 確認 Monokai 主題被保留且無 FOUC
  9. 測試無效 localStorage：在 DevTools 中將 `webcli:theme-preference` 設為 `"invalid"` → 重新載入 → 確認 fallback 到 Default
  10. 開啟 DevTools Elements tab，確認終端容器的 class 正確反映當前主題
- **驗證**: 所有步驟通過，無 console error

### Task 10:（可選）合併 ghostty-core-toggle 與 theme-switching 的 UI 佈局
- **檔案**: `app/page.tsx`
- **改動**: 如果 ghostty-core-toggle 已實作，需確保兩個功能的 UI 控制項在 header 中和諧排列。建議的 header 中間區段順序：Core → Theme → Session Input → Connect Button。Footer 則依序顯示 Session、Core、Theme 資訊。
- **驗證**: Header 中所有控制項對齊且不擁擠，Footer 資訊排列整齊
