# Tasks: websocket-auto-reconnect

## Tasks

## Progress

- [x] Task 1: 新增重連相關的常數、state 和 ref
- [x] Task 2: 新增 scheduleReconnect 和 attemptReconnect 函數
- [x] Task 3: 修改 connect 函數，加入主動斷線標記和重連狀態重設
- [x] Task 4: 新增 beforeunload 事件處理
- [x] Task 5: 元件卸載時清除重連 timer
- [x] Task 6: 修改 header 狀態指示器支援三態
- [x] Task 7: 修改 header 連線按鈕在重連中的行為
- [x] Task 8: 端對端驗證與手動測試

### Task 1: 新增重連相關的常數、state 和 ref
- **檔案**: `app/page.tsx`
- **改動**:
  1. 在元件頂部（`WebCliV2` 函數內）新增常數：
     ```typescript
     const MAX_RECONNECT_ATTEMPTS = 10;
     const RECONNECT_BASE_DELAY = 1000; // 1s
     const RECONNECT_MAX_DELAY = 30000; // 30s
     ```
  2. 新增 state：
     ```typescript
     const [reconnectAttempt, setReconnectAttempt] = useState(0);
     ```
  3. 新增 ref：
     ```typescript
     const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
     const intentionalCloseRef = useRef(false);
     ```
  4. 新增指數退避延遲計算函數：
     ```typescript
     function getReconnectDelay(attempt: number): number {
       return Math.min(RECONNECT_BASE_DELAY * Math.pow(2, attempt - 1), RECONNECT_MAX_DELAY);
     }
     ```
  5. 新增清除重連 timer 的輔助函數：
     ```typescript
     function clearReconnectTimer() {
       if (reconnectTimerRef.current !== null) {
         clearTimeout(reconnectTimerRef.current);
         reconnectTimerRef.current = null;
       }
     }
     ```
- **驗證**: TypeScript 編譯無錯誤；常數值正確（MAX=10, BASE=1000, CAP=30000）

### Task 2: 新增 scheduleReconnect 和 attemptReconnect 函數
- **檔案**: `app/page.tsx`
- **改動**:
  1. 新增 `attemptReconnect` 函數（使用 `useCallback`）：
     ```typescript
     const attemptReconnect = useCallback(() => {
       const currentUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/terminal?session=${encodeURIComponent(sessionName)}`;

       const ws = new WebSocket(currentUrl);
       wsRef.current = ws;

       ws.onopen = () => {
         setConnected(true);
         setReconnectAttempt(0);
         clearReconnectTimer();
         write("\r\n\x1b[32m[reconnected ✓]\x1b[0m\r\n");
         console.log("[wterm] Reconnected to tmux session:", sessionName);
       };

       ws.onmessage = (event: MessageEvent) => {
         write(event.data as string);
       };

       ws.onclose = () => {
         const nextAttempt = reconnectAttempt + 1;
         setReconnectAttempt(nextAttempt);
         wsRef.current = null;

         if (nextAttempt >= MAX_RECONNECT_ATTEMPTS) {
           write("\r\n\x1b[31m[auto-reconnect failed after 10 attempts. Click \"連線 / 重新連線\" to retry manually]\x1b[0m\r\n");
           console.log("[wterm] Max reconnect attempts reached");
           return;
         }

         // 排程下一次嘗試
         const delay = getReconnectDelay(nextAttempt);
         write(`\r\n\x1b[33m[reconnecting... attempt ${nextAttempt + 1}/${MAX_RECONNECT_ATTEMPTS}, next in ${Math.round(delay / 1000)}s]\x1b[0m\r\n`);

         reconnectTimerRef.current = setTimeout(() => {
           attemptReconnect();
         }, delay);
       };

       ws.onerror = () => {
         // onclose 會在 onerror 之後觸發，重連邏輯在 onclose 中處理
       };
     }, [sessionName, write, reconnectAttempt]);
     ```
     注意：`attemptReconnect` 需要存取最新的 `reconnectAttempt`，但 `useCallback` 的依賴陣列可能導致 stale closure。建議改用 `useRef` 追蹤 `reconnectAttempt` 以避免此問題：
     ```typescript
     const reconnectAttemptRef = useRef(0);
     ```
     並在 `setReconnectAttempt` 時同步更新 `reconnectAttemptRef.current`。

  2. 新增 `scheduleReconnect` 函數（首次重連的入口）：
     ```typescript
     const scheduleReconnect = useCallback(() => {
       const delay = getReconnectDelay(1);
       setReconnectAttempt(1);
       reconnectAttemptRef.current = 1;
       write(`\r\n\x1b[33m[reconnecting... attempt 1/${MAX_RECONNECT_ATTEMPTS}, next in ${Math.round(delay / 1000)}s]\x1b[0m\r\n`);

       reconnectTimerRef.current = setTimeout(() => {
         attemptReconnect();
       }, delay);
     }, [attemptReconnect, write]);
     ```
- **驗證**: TypeScript 編譯無錯誤；手動在 DevTools Console 斷線後確認重連邏輯正確觸發

### Task 3: 修改 connect 函數，加入主動斷線標記和重連狀態重設
- **檔案**: `app/page.tsx`
- **改動**:
  修改現有的 `connect` 函數，在關閉現有 WebSocket 之前加入：
  ```typescript
  const connect = useCallback((targetSession?: string) => {
    // 標記為主動斷線，防止 onclose 觸發自動重連
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    setReconnectAttempt(0);
    reconnectAttemptRef.current = 0;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const sName = targetSession || sessionName;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/api/terminal?session=${encodeURIComponent(sName)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (targetSession) setSessionName(targetSession);
      intentionalCloseRef.current = false;
      console.log("[wterm] Connected to tmux session:", sName);
    };

    ws.onmessage = (event: MessageEvent) => {
      write(event.data as string);
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      if (intentionalCloseRef.current) {
        // 主動斷線：顯示 disconnected，不重連
        write("\r\n\x1b[90m[disconnected]\x1b[0m\r\n");
        intentionalCloseRef.current = false;
      } else {
        // 意外斷線：啟動自動重連
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      setConnected(false);
      // onclose 會隨後觸發，由 onclose 處理重連邏輯
    };
  }, [sessionName, write, scheduleReconnect]);
  ```
- **驗證**:
  - 點擊「連線 / 重新連線」按鈕後不觸發自動重連
  - 正常首次連線行為不變（顯示 `● 已連線`，終端正常運作）
  - 意外斷線時觸發自動重連（可透過 DevTools Network tab 關閉連線模擬）

### Task 4: 新增 beforeunload 事件處理
- **檔案**: `app/page.tsx`
- **改動**:
  1. 確認 `useEffect` 已 import（在 Task 3 之前應已 import）
  2. 新增 `beforeunload` 事件監聽的 `useEffect`：
     ```typescript
     useEffect(() => {
       const handleBeforeUnload = () => {
         intentionalCloseRef.current = true;
         clearReconnectTimer();
       };

       window.addEventListener("beforeunload", handleBeforeUnload);
       return () => {
         window.removeEventListener("beforeunload", handleBeforeUnload);
       };
     }, []);
     ```
- **驗證**: 關閉瀏覽器分頁時，DevTools Console 不顯示重連嘗試的 log

### Task 5: 元件卸載時清除重連 timer
- **檔案**: `app/page.tsx`
- **改動**:
  新增清理 useEffect，確保元件卸載時清除所有重連 timer：
  ```typescript
  useEffect(() => {
    return () => {
      clearReconnectTimer();
    };
  }, []);
  ```
- **驗證**: 元件卸載後 `setTimeout` 回呼不會執行

### Task 6: 修改 header 狀態指示器支援三態
- **檔案**: `app/page.tsx`
- **改動**:
  修改 header 右側的狀態指示器，從二態改為三態：
  ```tsx
  <div className={`text-xs px-2 py-0.5 rounded ${
    connected
      ? "bg-emerald-500/20 text-emerald-400"
      : reconnectAttempt > 0
        ? "bg-yellow-500/20 text-yellow-400 animate-pulse"
        : "bg-white/10 text-white/40"
  }`}>
    {connected
      ? "● 已連線"
      : reconnectAttempt > 0
        ? "◌ 重連中..."
        : "○ 未連線"}
  </div>
  ```
- **驗證**:
  - 正常連線時顯示「● 已連線」（綠色）
  - 重連中顯示「◌ 重連中...」（黃色閃爍）
  - 斷線且非重連中顯示「○ 未連線」（灰色）

### Task 7: 修改 header 連線按鈕在重連中的行為
- **檔案**: `app/page.tsx`
- **改動**:
  修改「連線 / 重新連線」按鈕，確保在重連中仍可點擊：
  ```tsx
  <button
    onClick={connect}
    disabled={connected}
    className="rounded-md bg-emerald-600 px-4 py-1 text-xs font-medium hover:bg-emerald-500 disabled:bg-emerald-800 disabled:text-white/50 transition-colors"
  >
    {connected ? "已連線" : "連線 / 重新連線"}
  </button>
  ```
  注意：原有邏輯 `disabled={connected}` 已正確處理此情境。重連中 `connected` 為 `false`，按鈕保持啟用。點擊按鈕會呼叫 `connect()`，在 Task 3 中已加入 `clearReconnectTimer()` 和 `intentionalCloseRef = true`，等同於取消自動重連並手動重連。
- **驗證**: 重連中點擊按鈕後，自動重連被取消，立即建立新的手動連線

### Task 8: 端對端驗證與手動測試
- **檔案**: 無（測試任務）
- **改動**: 執行以下驗證步驟：
  1. 啟動 server（`pnpm dev` 或 `node server.js`）
  2. 開啟瀏覽器，輸入 session 名稱並連線，確認正常連線和終端操作
  3. **基本重連測試**：在 DevTools Network tab 中找到 WebSocket 連線，手動斷開。確認：
     - 終端顯示 `[reconnecting... attempt 1/10, next in 1s]`
     - header 顯示「◌ 重連中...」（黃色閃爍）
     - 1 秒後自動重連成功
     - 終端顯示 `[reconnected ✓]`
     - tmux session 內容完整保留
  4. **指數退避測試**：停止 server，等待 WebSocket 斷線。確認重連間隔遞增（1s → 2s → 4s → 8s...），每次終端顯示正確的等待時間
  5. **最大次數測試**：保持 server 停止，等待 10 次重連嘗試全部失敗。確認：
     - 終端顯示紅色失敗訊息
     - 自動重連停止
     - header 顯示「○ 未連線」（灰色）
     - 點擊「連線 / 重新連線」按鈕可手動重連
  6. **主動斷線測試**：重新啟動 server 並連線，點擊「連線 / 重新連線」按鈕。確認不觸發自動重連
  7. **頁面關閉測試**：連線狀態下關閉分頁，確認不會在背景產生重連嘗試（重新開啟頁面後無殘留的重連 log）
  8. **重連中手動重連**：在重連過程中（等待下次嘗試期間）點擊「連線 / 重新連線」按鈕。確認：
     - 當前重連 timer 被取消
     - 立即建立新的連線
     - 連線成功後狀態正常
  9. **長時間重連測試**：停止 server 30 秒後重新啟動。確認自動重連最終成功
  10. **tmux session 持久性**：在 tmux session 中執行 `echo "test-persist"`，然後斷線重連。確認重連後終端仍可見 `test-persist`（在 scrollback 中）
- **驗證**: 所有步驟通過，無 console error，終端狀態訊息正確顯示，header 三態指示器正確切換
