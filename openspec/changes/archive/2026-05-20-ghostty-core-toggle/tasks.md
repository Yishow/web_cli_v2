# Tasks: ghostty-core-toggle

## Tasks

## Progress

- [x] Task 1: 安裝 @wterm/ghostty 套件
- [x] Task 2: 確認 Ghostty WASM 檔案路徑並複製到 public
- [x] Task 3: 建立 WASM 複製腳本（postinstall hook）
- [x] Task 4: 在 app/page.tsx 新增 core 狀態管理與 localStorage 讀寫
- [x] Task 5: 修改 Terminal 元件使用動態 wasmUrl 與 key
- [x] Task 6: 在 Header 新增 Core 下拉選單 UI
- [x] Task 7: 在 Footer 顯示當前 Core 資訊
- [x] Task 8: 端對端驗證與手動測試
- [x] Task 9:（可選）加入 Tailwind 樣式微調

### Task 1: 安裝 @wterm/ghostty 套件
- **檔案**: `package.json`
- **改動**: 執行 `pnpm add @wterm/ghostty`，在 dependencies 中新增 `"@wterm/ghostty": "^0.3.0"`（版本號與其他 @wterm/* 套件對齊）
- **驗證**: 執行 `pnpm install` 成功，`node_modules/@wterm/ghostty/` 目錄存在

### Task 2: 確認 Ghostty WASM 檔案路徑並複製到 public
- **檔案**: `public/ghostty.wasm`（新增）
- **改動**:
  1. 檢查 `node_modules/@wterm/ghostty/` 目錄結構，找到 `.wasm` 檔案的確切路徑
  2. 將該 `.wasm` 檔案複製為 `public/ghostty.wasm`
- **驗證**: `ls -la public/ghostty.wasm` 確認檔案存在且大小合理（預期 ~400KB）

### Task 3: 建立 WASM 複製腳本（postinstall hook）
- **檔案**: `scripts/copy-ghostty-wasm.sh`（新增）
- **改動**:
  1. 建立 `scripts/copy-ghostty-wasm.sh` 腳本，內容為：
     ```bash
     #!/usr/bin/env bash
     set -euo pipefail
     GHOSTTY_WASM="$(dirname "$0")/../node_modules/@wterm/ghostty/dist/ghostty.wasm"
     PUBLIC_DIR="$(dirname "$0")/../public"
     if [ -f "$GHOSTTY_WASM" ]; then
       cp "$GHOSTTY_WASM" "$PUBLIC_DIR/ghostty.wasm"
       echo "[scripts] Copied ghostty.wasm to public/"
     else
       echo "[scripts] WARNING: ghostty.wasm not found at $GHOSTTY_WASM"
     fi
     ```
     注意：實際的 WASM 路徑需在 Task 2 確認後更新
  2. 執行 `chmod +x scripts/copy-ghostty-wasm.sh`
  3. 在 `package.json` 的 `scripts` 區段新增 `"postinstall": "bash scripts/copy-ghostty-wasm.sh"`
- **驗證**: 執行 `pnpm install` 後 `public/ghostty.wasm` 自動更新

### Task 4: 在 app/page.tsx 新增 core 狀態管理與 localStorage 讀寫
- **檔案**: `app/page.tsx`
- **改動**:
  1. 定義 core type 與設定常數：
     ```typescript
     type CoreType = "builtin" | "ghostty";
     const CORE_PREFERENCE_KEY = "webcli:core-preference";
     const CORE_CONFIG: Record<CoreType, { label: string; wasmUrl: string; size: string }> = {
       builtin: { label: "Built-in", wasmUrl: "/wterm.wasm", size: "~12KB" },
       ghostty: { label: "Ghostty", wasmUrl: "/ghostty.wasm", size: "~400KB" },
     };
     ```
  2. 新增 `loadCorePreference` 函數，從 localStorage 讀取偏好，fallback 到 `"builtin"`：
     ```typescript
     function loadCorePreference(): CoreType {
       if (typeof window === "undefined") return "builtin";
       const saved = localStorage.getItem(CORE_PREFERENCE_KEY);
       if (saved === "builtin" || saved === "ghostty") return saved;
       localStorage.setItem(CORE_PREFERENCE_KEY, "builtin");
       return "builtin";
     }
     ```
  3. 在 `WebCliV2` 元件中加入 state：
     ```typescript
     const [coreType, setCoreType] = useState<CoreType>(loadCorePreference);
     ```
  4. 新增 `handleCoreChange` 處理函數：
     ```typescript
     const handleCoreChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
       const newCore = e.target.value as CoreType;
       localStorage.setItem(CORE_PREFERENCE_KEY, newCore);
       setCoreType(newCore);
     }, []);
     ```
- **驗證**: TypeScript 編譯無錯誤（`pnpm typecheck`）

### Task 5: 修改 Terminal 元件使用動態 wasmUrl 與 key
- **檔案**: `app/page.tsx`
- **改動**:
  1. 在 Terminal 元件上使用動態 `wasmUrl` 和 `key`：
     ```tsx
     <Terminal
       key={`terminal-${coreType}`}
       ref={ref}
       cols={120}
       rows={36}
       autoResize
       debug={false}
       wasmUrl={CORE_CONFIG[coreType].wasmUrl}
       onReady={handleReady}
       onData={handleData}
       onResize={handleResize}
       className="h-full w-full"
     />
     ```
  2. 注意：`key` 值包含 coreType，當 coreType 改變時 React 會完全卸載舊元件並建立新元件
  3. `useTerminal()` hook 回傳的 `ref` 在元件重建時會自動更新，但需注意舊 ref 的 `write` 可能在卸載過程中被呼叫。在 `ws.onmessage` 中加入防禦性檢查：
     ```typescript
     ws.onmessage = (event: MessageEvent) => {
       // 只有當前 WebSocket 才寫入
       if (wsRef.current === ws) {
         write(event.data as string);
       }
     };
     ```
     注意：這是選擇性優化，可防止 core 切換瞬間舊 ws 事件寫入已卸載的 Terminal
- **驗證**: 在瀏覽器中切換 core，確認 Terminal 元件被完整重建（可在 console 中觀察 `[wterm] Connected` 日誌重新出現）

### Task 6: 在 Header 新增 Core 下拉選單 UI
- **檔案**: `app/page.tsx`
- **改動**:
  1. 在 header 的 `<div className="flex items-center gap-2">` 區段（session name input 之前），新增 core 選擇 UI：
     ```tsx
     <div className="flex items-center gap-1.5">
       <label htmlFor="core-select" className="text-white/40 text-xs">Core</label>
       <select
         id="core-select"
         value={coreType}
         onChange={handleCoreChange}
         className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-mono border border-white/20 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
       >
         <option value="builtin">Built-in (~12KB)</option>
         <option value="ghostty">Ghostty (~400KB)</option>
       </select>
     </div>
     ```
  2. 將此區塊放在 session name input 的左側，整體 header 佈局調整為三段式：
     - 左側：專案名稱標示
     - 中間：Core 選擇 + Session name input + Connect button
     - 右側：連線狀態指示
- **驗證**: 頁面載入後 header 可見 Core 下拉選單，切換選項觸發 Terminal 重建

### Task 7: 在 Footer 顯示當前 Core 資訊
- **檔案**: `app/page.tsx`
- **改動**: 在 footer 左側的 Session 資訊旁新增 core 資訊：
  ```tsx
  <footer className="border-t border-white/10 bg-zinc-900/50 px-4 py-1.5 text-[10px] text-white/40 flex justify-between items-center">
    <div className="flex items-center gap-4">
      <div>
        Session: <span className="font-mono text-emerald-400">{sessionName}</span>
      </div>
      <div>
        Core: <span className="font-mono text-emerald-400">{CORE_CONFIG[coreType].label}</span>
        <span className="text-white/30">({CORE_CONFIG[coreType].size})</span>
      </div>
    </div>
    <div>
      Tip: 在終端內輸入 <span className="font-mono text-white/60">tmux new-window</span> 或使用 <span className="font-mono">Ctrl-b c</span>
    </div>
  </footer>
  ```
- **驗證**: Footer 正確顯示當前 core 名稱與大小，切換 core 後資訊即時更新

### Task 8: 端對端驗證與手動測試
- **檔案**: 無（測試任務）
- **改動**: 執行以下驗證步驟：
  1. 執行 `pnpm dev` 啟動開發伺服器
  2. 開啟瀏覽器，確認頁面正常載入，Terminal 使用 built-in core
  3. 在終端中執行基本指令（`ls`、`echo "hello"`、`tmux list-sessions`）
  4. 在 header 下拉選單切換到 Ghostty core
  5. 確認 Terminal 重建、自動重連成功
  6. 在 Ghostty core 下執行相同指令，確認顯示正確
  7. 測試 Unicode 輸出：`echo "🎉🇹🇼👨‍👩‍👧‍👦"` — 在 Ghostty core 下應正確顯示複雜 emoji
  8. 測試 SGR 屬性：`echo -e "\x1b[1;31mBold Red\x1b[0m \x1b[3;4;34mItalic Underline Blue\x1b[0m"`
  9. 切回 Built-in core，確認功能正常
  10. 重新載入頁面，確認 core 偏好被保留
  11. 開啟 DevTools Network tab，切換到 Ghostty core，確認 `ghostty.wasm` 被下載且大小正確
- **驗證**: 所有步驟通過，無 console error

### Task 9:（可選）加入 Tailwind 樣式微調
- **檔案**: `app/globals.css`（視需要修改）
- **改動**: 如果 `<select>` 的下拉箭頭在深色背景下不明顯，可在 `globals.css` 加入自訂下拉箭頭樣式：
  ```css
  select option {
    background-color: #27272a; /* zinc-800 */
    color: white;
  }
  ```
- **驗證**: 下拉選單展開時選項背景為深色，文字清晰可讀
