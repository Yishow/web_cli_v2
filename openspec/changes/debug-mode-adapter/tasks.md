# Tasks: debug-mode-adapter

## Tasks

### Task 1: 新增 debug 狀態管理與 URL query parameter 同步
- **檔案**: `app/page.tsx`
- **改動**:
  1. 在元件頂層讀取 URL query parameter 判斷初始 debug 狀態：
     ```typescript
     const searchParams = typeof window !== "undefined"
       ? new URLSearchParams(window.location.search)
       : new URLSearchParams();
     const [debugMode, setDebugMode] = useState(() =>
       searchParams.get("debug") === "true"
     );
     ```
  2. 新增 `toggleDebug` 函數，切換 debug 狀態並同步更新 URL：
     ```typescript
     const toggleDebug = useCallback(() => {
       setDebugMode((prev) => {
         const next = !prev;
         const url = new URL(window.location.href);
         if (next) {
           url.searchParams.set("debug", "true");
         } else {
           url.searchParams.delete("debug");
         }
         window.history.replaceState({}, "", url.toString());
         return next;
       });
     }, []);
     ```
  3. 修改 Terminal 元件的 `debug` prop：
     ```tsx
     <Terminal
       ...
       debug={debugMode}
       ...
     />
     ```
- **驗證**: 開啟 `?debug=true` 頁面，console 中可見 wterm DebugAdapter 相關輸出；移除參數重新載入後無 debug 輸出

### Task 2: 在 Header 新增 Debug Toggle 開關
- **檔案**: `app/page.tsx`
- **改動**:
  1. 在 header 的連線狀態指示器左側新增 debug toggle：
     ```tsx
     <button
       onClick={toggleDebug}
       className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors ${
         debugMode
           ? "bg-amber-500/20 text-amber-400"
           : "bg-white/10 text-white/40 hover:bg-white/15 hover:text-white/60"
       }`}
       title="Debug Mode (Ctrl+Shift+D)"
     >
       <span className="text-[10px]">🐛</span>
       <span>{debugMode ? "Debug ON" : "Debug"}</span>
     </button>
     ```
  2. 將此按鈕放在連線狀態指示器（`<div className={...}>`) 之前，形成一個控制項群組：
     ```tsx
     <div className="flex items-center gap-2">
       <button ...>Debug Toggle</button>
       <div className={...}>連線狀態指示器</div>
     </div>
     ```
- **驗證**: header 可見 Debug 按鈕，點擊後狀態切換、URL 同步更新

### Task 3: 加入 Ctrl+Shift+D 快捷鍵
- **檔案**: `app/page.tsx`
- **改動**:
  1. 在 `WebCliV2` 元件中加入 `useEffect` 監聽鍵盤事件：
     ```typescript
     useEffect(() => {
       const handleKeyDown = (e: KeyboardEvent) => {
         if (e.ctrlKey && e.shiftKey && e.key === "D") {
           e.preventDefault();
           toggleDebug();
         }
       };
       window.addEventListener("keydown", handleKeyDown);
       return () => window.removeEventListener("keydown", handleKeyDown);
     }, [toggleDebug]);
     ```
- **驗證**: 在頁面任意位置按下 `Ctrl+Shift+D`，debug 狀態切換

### Task 4: 新增 PTY 輸出 hex dump 資料收集
- **檔案**: `app/page.tsx`
- **改動**:
  1. 定義 hex dump 相關的常數與型別：
     ```typescript
     const MAX_HEX_ENTRIES = 1000;
     interface HexEntry {
       timestamp: number;
       hex: string;
       ascii: string;
       raw: string;
     }
     ```
  2. 新增 hex dump 狀態：
     ```typescript
     const [hexEntries, setHexEntries] = useState<HexEntry[]>([]);
     ```
  3. 建立 hex dump 轉換函數：
     ```typescript
     function toHexDump(data: string): { hex: string; ascii: string } {
       const encoder = new TextEncoder();
       const bytes = encoder.encode(data);
       const lines: string[] = [];
       const asciis: string[] = [];
       for (let i = 0; i < bytes.length; i += 16) {
         const slice = bytes.subarray(i, Math.min(i + 16, bytes.length));
         const hex = Array.from(slice)
           .map((b) => b.toString(16).padStart(2, "0"))
           .join(" ");
         const ascii = Array.from(slice)
           .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : "."))
           .join("");
         lines.push(hex);
         asciis.push(ascii);
       }
       return { hex: lines.join("\n"), ascii: asciis.join("\n") };
     }
     ```
  4. 修改 WebSocket `onmessage` 回呼，在 debug 模式下記錄 hex dump：
     ```typescript
     ws.onmessage = (event: MessageEvent) => {
       const data = event.data as string;
       write(data);
       if (debugMode) {
         const { hex, ascii } = toHexDump(data);
         setHexEntries((prev) => {
           const next = [...prev, { timestamp: Date.now(), hex, ascii, raw: data }];
           return next.length > MAX_HEX_ENTRIES ? next.slice(-MAX_HEX_ENTRIES) : next;
         });
       }
     };
     ```
     注意：`debugMode` 的閉包問題需使用 ref 解決：
     ```typescript
     const debugModeRef = useRef(debugMode);
     debugModeRef.current = debugMode;
     ```
     在 `onmessage` 中使用 `debugModeRef.current` 取得最新值。
- **驗證**: 啟用 debug 模式後，在終端中輸入指令，hexEntries 中可見 hex dump 資料

### Task 5: 新增 Escape Sequence 解析日誌收集
- **檔案**: `app/page.tsx`
- **改動**:
  1. 定義日誌型別與狀態：
     ```typescript
     const MAX_DEBUG_LOGS = 1000;
     interface DebugLog {
       timestamp: number;
       type: string;
       sequence: string;
       description: string;
     }
     const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
     ```
  2. 根據 wterm DebugAdapter 的 API（需確認），加入日誌收集回呼。預期方式之一是透過 `onDebug` prop 或類似回呼：
     ```typescript
     // 假設 wterm 提供 onDebug 回呼
     const handleDebug = useCallback((log: { type: string; sequence: string; description: string }) => {
       setDebugLogs((prev) => {
         const next = [...prev, { timestamp: Date.now(), ...log }];
         return next.length > MAX_DEBUG_LOGS ? next.slice(-MAX_DEBUG_LOGS) : next;
       });
     }, []);
     ```
  3. 在 Terminal 元件上加入回呼（具體 prop 名稱需依 wterm API 確認）：
     ```tsx
     <Terminal
       ...
       debug={debugMode}
       onDebug={debugMode ? handleDebug : undefined}
       ...
     />
     ```
     注意：若 wterm 不提供 `onDebug` 回呼，則需透過其他方式（例如 override `console.log` 或監聽自訂事件）取得 DebugAdapter 的輸出。
- **驗證**: 啟用 debug 模式後，debugLogs 中可見 escape sequence 解析日誌

### Task 6: 建立可摺疊 Debug 面板元件
- **檔案**: `app/page.tsx`
- **改動**:
  1. 新增 debug 面板狀態：
     ```typescript
     const [panelExpanded, setPanelExpanded] = useState(false);
     const [activeTab, setActiveTab] = useState<"escape" | "hex">("escape");
     ```
  2. 在 Terminal 的 `<div className="flex-1 overflow-hidden">` 與 `<footer>` 之間，新增 debug 面板（僅在 debug 模式下渲染）：
     ```tsx
     {debugMode && (
       <div className="border-t border-amber-500/30">
         {/* 面板標題列 */}
         <button
           onClick={() => setPanelExpanded((prev) => !prev)}
           className="flex w-full items-center justify-between bg-zinc-900/80 px-4 py-1.5 text-xs text-amber-400 hover:bg-zinc-800/80 transition-colors"
         >
           <div className="flex items-center gap-2">
             <span>🐛 Debug Panel</span>
             <div className="flex gap-1">
               <button
                 onClick={(e) => { e.stopPropagation(); setActiveTab("escape"); }}
                 className={`px-2 py-0.5 rounded ${activeTab === "escape" ? "bg-amber-500/20" : "text-white/40"}`}
               >
                 Escape Log ({debugLogs.length})
               </button>
               <button
                 onClick={(e) => { e.stopPropagation(); setActiveTab("hex"); }}
                 className={`px-2 py-0.5 rounded ${activeTab === "hex" ? "bg-amber-500/20" : "text-white/40"}`}
               >
                 Hex Dump ({hexEntries.length})
               </button>
             </div>
           </div>
           <span className="text-white/40">{panelExpanded ? "▼" : "▶"}</span>
         </button>

         {/* 面板內容 */}
         {panelExpanded && (
           <div className="h-[200px] overflow-y-auto bg-zinc-950 px-4 py-2 font-mono text-[10px] text-white/60">
             {activeTab === "escape" ? (
               <div className="space-y-0.5">
                 {debugLogs.map((log, i) => (
                   <div key={i} className="flex gap-2">
                     <span className="text-white/30">{new Date(log.timestamp).toISOString().slice(11, 23)}</span>
                     <span className="text-amber-400">[{log.type}]</span>
                     <span className="text-emerald-400">{log.sequence}</span>
                     <span className="text-white/50">{log.description}</span>
                   </div>
                 ))}
                 {debugLogs.length === 0 && <span className="text-white/30">等待終端輸出...</span>}
               </div>
             ) : (
               <div className="space-y-1">
                 {hexEntries.map((entry, i) => (
                   <div key={i}>
                     <div className="text-white/30">
                       --- [{new Date(entry.timestamp).toISOString().slice(11, 23)}] {entry.raw.length} chars ---
                     </div>
                     <pre className="whitespace-pre-wrap text-emerald-400/70">{entry.hex}</pre>
                   </div>
                 ))}
                 {hexEntries.length === 0 && <span className="text-white/30">等待 PTY 輸出...</span>}
               </div>
             )}
           </div>
         )}
       </div>
     )}
     ```
- **驗證**: 啟用 debug 模式後面板可見，點擊可展開/摺疊，tab 切換正常

### Task 7: 調整 Debug 面板樣式
- **檔案**: `app/globals.css`
- **改動**: 新增 debug 面板相關樣式：
  ```css
  /* Debug panel styles */
  .debug-panel-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .debug-panel-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .debug-panel-scroll::-webkit-scrollbar-thumb {
    background-color: rgba(245, 158, 11, 0.3);
    border-radius: 3px;
  }
  .debug-panel-scroll::-webkit-scrollbar-thumb:hover {
    background-color: rgba(245, 158, 11, 0.5);
  }
  ```
  注意：以上樣式也可以純用 Tailwind utility classes 實作（如 `scrollbar-thin scrollbar-thumb-amber-500/30`），視專案是否使用 tailwind-scrollbar 插件而定。若無插件，則放在 `globals.css`。
- **驗證**: Debug 面板的捲軸在深色背景下清晰可見

### Task 8: 端對端驗證與手動測試
- **檔案**: 無（測試任務）
- **改動**: 執行以下驗證步驟：
  1. 執行 `pnpm dev` 啟動開發伺服器
  2. 開啟瀏覽器（不帶 `?debug=true`），確認頁面正常載入、無 debug 面板、header 的 Debug 按鈕為灰色
  3. 點擊 header 的 Debug 按鈕，確認 debug 面板出現、URL 更新為 `?debug=true`
  4. 展開 debug 面板，在終端中輸入 `ls -la`，觀察 Escape Log 和 Hex Dump tab 是否有日誌產生
  5. 按 `Ctrl+Shift+D`，確認 debug 模式關閉、面板消失、URL 中 `debug` 參數被移除
  6. 再按 `Ctrl+Shift+D`，確認 debug 模式重新啟用
  7. 直接在 URL 中加入 `?debug=true` 並重新載入，確認 debug 模式自動啟用
  8. 在 debug 模式下測試高頻輸出：`find /`，確認面板不會卡頓（環形緩衝區正常運作）
  9. 測試摺疊/展開面板不影響終端操作
  10. 確認非 debug 模式下（預設狀態）終端行為與改動前完全一致
- **驗證**: 所有步驟通過，無 console error，非 debug 模式下無效能退化
