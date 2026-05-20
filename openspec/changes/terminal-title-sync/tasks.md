# Tasks: terminal-title-sync

## Tasks

### Task 1: 新增 terminalTitle state 與 handleTitle callback
- **檔案**: `app/page.tsx`
- **改動**:
  1. 在 import 中新增 `useEffect`：
     ```typescript
     import { useCallback, useEffect, useRef, useState } from "react";
     ```
  2. 在 `WebCliV2` 元件中新增 `terminalTitle` state：
     ```typescript
     const [terminalTitle, setTerminalTitle] = useState<string>("");
     ```
  3. 新增 `handleTitle` callback：
     ```typescript
     const handleTitle = useCallback((title: string) => {
       setTerminalTitle(title);
     }, []);
     ```
- **驗證**: TypeScript 編譯無錯誤（`pnpm typecheck`），`handleTitle` 可正確接收字串參數

### Task 2: 新增 document.title 同步 useEffect
- **檔案**: `app/page.tsx`
- **改動**: 在 `WebCliV2` 元件中新增 `useEffect`，監聽 `terminalTitle` 變化並同步到 `document.title`：
     ```typescript
     useEffect(() => {
       document.title = terminalTitle
         ? `${terminalTitle} — web_cli_v2`
         : "web_cli_v2";
     }, [terminalTitle]);
     ```
- **驗證**: 開啟瀏覽器 DevTools，在 Console 中執行 `document.title`，確認預設為 `"web_cli_v2"`。手動呼叫 `handleTitle("test")` 後 `document.title` 變為 `"test — web_cli_v2"`

### Task 3: 將 onTitle callback 傳入 Terminal 元件
- **檔案**: `app/page.tsx`
- **改動**: 在 `<Terminal>` 元件上新增 `onTitle` prop：
     ```tsx
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
       onTitle={handleTitle}
       className="h-full w-full"
     />
     ```
- **驗證**: TypeScript 編譯無錯誤，`onTitle` prop 被型別檢查接受（`TerminalProps.onTitle` 型別為 `(title: string) => void`）

### Task 4: 在 Header 新增終端標題顯示 UI
- **檔案**: `app/page.tsx`
- **改動**: 在 header 左側區塊（`web_cli_v2 • wterm + tmux`）之後，新增終端標題顯示。修改 header 的第一個 `<div>` 區塊：
     ```tsx
     <div className="flex items-center gap-3">
       <span className="font-semibold text-emerald-400">web_cli_v2</span>
       <span className="text-white/40">•</span>
       <span className="text-white/60 text-xs">wterm + tmux</span>
       <span className="text-white/40">•</span>
       {terminalTitle ? (
         <span
           className="font-mono text-xs text-white/70 max-w-48 truncate"
           title={terminalTitle}
         >
           {terminalTitle}
         </span>
       ) : (
         <span className="font-mono text-xs text-white/30">終端</span>
       )}
     </div>
     ```
  - 標題存在時：使用 `text-white/70`（較亮）、`font-mono`、`max-w-48 truncate` 截斷長標題、`title` 屬性供 hover 查看完整標題
  - 標題為空時：顯示「終端」淡色預設文字（`text-white/30`）
- **驗證**: 頁面載入後 header 顯示「web_cli_v2 • wterm + tmux • 終端」，收到標題後「終端」被替換為實際標題

### Task 5: 端對端驗證與手動測試
- **檔案**: 無（測試任務）
- **改動**: 執行以下驗證步驟：
  1. 執行 `pnpm dev` 啟動開發伺服器
  2. 開啟瀏覽器，確認頁面標題為 `"web_cli_v2"`，header 顯示「終端」
  3. 點擊「連線」連接到 tmux session
  4. 連線後確認瀏覽器 tab 標題更新為 tmux 的 window 標題（如 `"[webcli-main] zsh — web_cli_v2"`）
  5. 在終端中執行 `vim /tmp/test.txt`，確認標題變為包含 vim 檔案名的格式
  6. 輸入 `:q` 退出 vim，確認標題恢復
  7. 執行 `htop`，確認標題變為 `"htop — web_cli-m2"`
  8. 按 `q` 退出 htop，確認標題恢復
  9. 執行 `tmux new-window`，確認標題變為新 window 的標題
  10. 按 `Ctrl-b n` / `Ctrl-b p` 切換 window，確認標題隨 window 切換更新
  11. 開啟第二個瀏覽器 tab 連到不同 session，確認兩個 tab 標題不同
  12. 確認 header 中的標題文字與瀏覽器 tab 標題同步
  13. 測試長標題：`printf '\033]0;%s\007' "$(python3 -c 'print("A"*200)')"` ，確認 header 截斷顯示且 hover 可見完整標題
- **驗證**: 所有步驟通過，無 console error
