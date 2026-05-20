# Tasks: session-management-panel

## Tasks

## Progress

- [x] Task 1: 在 server.ts 新增 GET /api/sessions endpoint
- [x] Task 2: 在 server.ts 新增 DELETE /api/sessions/:name endpoint
- [x] Task 3: 在 page.tsx 新增 session 列表 API 呼叫函數
- [x] Task 4: 在 page.tsx 新增側邊欄狀態管理
- [x] Task 5: 重構 connect 函數以支援外部 session 名稱
- [x] Task 6: 在 header 新增 Sessions 按鈕
- [x] Task 7: 實作側邊欄面板 UI
- [x] Task 8: 實作刪除確認對話框
- [x] Task 9: 元件初始化時背景載入 session 數量
- [x] Task 10: 端對端驗證與手動測試

### Task 1: 在 server.ts 新增 GET /api/sessions endpoint
- **檔案**: `server.ts`
- **改動**:
  1. 在檔案頂部新增 import：
     ```typescript
     import { execFileSync } from "child_process";
     ```
  2. 新增 `TmuxSession` 介面和 `listSessions` 函數：
     ```typescript
     interface TmuxSession {
       name: string;
       attached: boolean;
       created: number; // Unix timestamp
       windows: number;
     }

     function listSessions(): TmuxSession[] {
       try {
         const output = execFileSync("tmux", [
           "list-sessions",
           "-F", "#{session_name}\t#{session_windows}\t#{session_created}\t#{session_attached}",
         ], { encoding: "utf-8", timeout: 5000 }).trim();

         if (!output) return [];

         return output.split("\n").map((line) => {
           const [name, windows, created, attached] = line.split("\t");
           return {
             name,
             windows: parseInt(windows, 10),
             created: parseInt(created, 10),
             attached: attached === "1",
           };
         });
       } catch (err: any) {
         // tmux 回傳 exit code 1 表示「no sessions」
         if (err?.status === 1) return [];
         throw err;
       }
     }
     ```
  3. 新增 `sendJson` 輔助函數：
     ```typescript
     function sendJson(res: import("http").ServerResponse, statusCode: number, data: any) {
       res.writeHead(statusCode, { "Content-Type": "application/json" });
       res.end(JSON.stringify(data));
     }
     ```
  4. 在 `createServer` 回呼中，`handle(req, res, parsedUrl)` 之前加入 API route 攔截：
     ```typescript
     const server = createServer((req, res) => {
       const parsedUrl = parse(req.url || "/", true);
       const pathname = parsedUrl.pathname || "/";

       // 自訂 API routes
       if (pathname === "/api/sessions" && req.method === "GET") {
         try {
           const sessions = listSessions();
           sendJson(res, 200, sessions);
         } catch (err) {
           const msg = err instanceof Error ? err.message : String(err);
           console.error("[api/sessions] Error:", msg);
           sendJson(res, 500, { error: "Failed to list tmux sessions" });
         }
         return;
       }

       handle(req, res, parsedUrl);
     });
     ```
- **驗證**: 啟動 server 後用 `curl http://127.0.0.1:3000/api/sessions` 確認回傳 JSON 陣列；建立幾個 tmux session 後再確認列表正確

### Task 2: 在 server.ts 新增 DELETE /api/sessions/:name endpoint
- **檔案**: `server.ts`
- **改動**:
  1. 新增 `SESSION_NAME_REGEX` 常數和 `killSession` 函數：
     ```typescript
     const SESSION_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

     function killSession(name: string): boolean {
       execFileSync("tmux", ["kill-session", "-t", name], {
         encoding: "utf-8",
         timeout: 5000,
       });
       return true;
     }
     ```
  2. 在 `createServer` 回呼中，GET /api/sessions 處理之後加入 DELETE route：
     ```typescript
     // DELETE /api/sessions/:name
     const deleteMatch = pathname.match(/^\/api\/sessions\/([a-zA-Z0-9_-]+)$/);
     if (deleteMatch && req.method === "DELETE") {
       const sessionName = deleteMatch[1];

       if (!SESSION_NAME_REGEX.test(sessionName)) {
         sendJson(res, 400, { error: "Invalid session name" });
         return;
       }

       try {
         killSession(sessionName);
         sendJson(res, 200, { success: true, name: sessionName });
       } catch (err: any) {
         if (err?.status === 1) {
           sendJson(res, 404, { error: `Session "${sessionName}" not found` });
         } else {
           const msg = err instanceof Error ? err.message : String(err);
           console.error(`[api/sessions] Error killing "${sessionName}":`, msg);
           sendJson(res, 500, { error: "Failed to kill tmux session" });
         }
       }
       return;
     }
     ```
- **驗證**: 用 `curl -X DELETE http://127.0.0.1:3000/api/sessions/test-session` 測試正常刪除；用 `curl -X DELETE "http://127.0.0.1:3000/api/sessions/test%3Becho"` 測試非法名稱被拒絕（400）；刪除不存在的 session 回傳 404

### Task 3: 在 page.tsx 新增 session 列表 API 呼叫函數
- **檔案**: `app/page.tsx`
- **改動**:
  1. 新增 `SessionInfo` 介面：
     ```typescript
     interface SessionInfo {
       name: string;
       attached: boolean;
       created: number;
       windows: number;
     }
     ```
  2. 在元件外部新增 API 呼叫函數：
     ```typescript
     async function fetchSessions(): Promise<SessionInfo[]> {
       const res = await fetch("/api/sessions");
       if (!res.ok) return [];
       return res.json();
     }

     async function deleteSessionApi(name: string): Promise<boolean> {
       const res = await fetch(`/api/sessions/${encodeURIComponent(name)}`, {
         method: "DELETE",
       });
       return res.ok;
     }
     ```
- **驗證**: TypeScript 編譯無錯誤

### Task 4: 在 page.tsx 新增側邊欄狀態管理
- **檔案**: `app/page.tsx`
- **改動**:
  1. 新增 import：
     ```typescript
     import { useCallback, useRef, useState, useEffect } from "react";
     ```
  2. 在 `WebCliV2` 元件中新增狀態：
     ```typescript
     const [sidebarOpen, setSidebarOpen] = useState(false);
     const [sessions, setSessions] = useState<SessionInfo[]>([]);
     const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
     const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
     ```
  3. 新增 `loadSessions` 函數：
     ```typescript
     const loadSessions = useCallback(async () => {
       try {
         const list = await fetchSessions();
         setSessions(list);
       } catch {
         // 網路錯誤時保持上次資料
       }
     }, []);
     ```
  4. 新增側邊欄開啟/關閉時的輪詢控制（useEffect）：
     ```typescript
     useEffect(() => {
       if (sidebarOpen) {
         loadSessions();
         pollRef.current = setInterval(loadSessions, 5000);
       } else {
         if (pollRef.current) {
           clearInterval(pollRef.current);
           pollRef.current = null;
         }
       }
       return () => {
         if (pollRef.current) {
           clearInterval(pollRef.current);
           pollRef.current = null;
         }
       };
     }, [sidebarOpen, loadSessions]);
     ```
  5. 新增刪除處理函數：
     ```typescript
     const handleDelete = useCallback(async (name: string) => {
       const success = await deleteSessionApi(name);
       if (success) {
         setSessions((prev) => prev.filter((s) => s.name !== name));
         // 如果刪除的是當前連線的 session，斷線
         if (name === sessionName && wsRef.current) {
           wsRef.current.close();
         }
       }
       setDeleteConfirm(null);
     }, [sessionName]);
     ```
  6. 新增切換 session 處理函數：
     ```typescript
     const handleSwitchSession = useCallback((name: string) => {
       setSessionName(name);
       // 關閉當前連線後重新連線
       if (wsRef.current) {
         wsRef.current.close();
       }
       // 下一個 tick 連線（等 state 更新）
       setTimeout(() => {
         connectWithSession(name);
       }, 100);
     }, []);
     ```
     注意：`connectWithSession` 需要從現有 `connect` 函數重構，接受 session 名稱參數。或者直接設定 `sessionName` state 並觸發 `connect()`。
- **驗證**: TypeScript 編譯無錯誤

### Task 5: 重構 connect 函數以支援外部 session 名稱
- **檔案**: `app/page.tsx`
- **改動**:
  1. 將 `connect` 函數修改為接受可選的 session 名稱參數：
     ```typescript
     const connect = useCallback((targetSession?: string) => {
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
         console.log("[wterm] Connected to tmux session:", sName);
       };

       ws.onmessage = (event: MessageEvent) => {
         write(event.data as string);
       };

       ws.onclose = () => {
         setConnected(false);
         write("\r\n\x1b[90m[disconnected]\x1b[0m\r\n");
         wsRef.current = null;
       };

       ws.onerror = () => {
         setConnected(false);
         write("\r\n\x1b[31m[connection error]\x1b[0m\r\n");
       };
     }, [sessionName, write]);
     ```
  2. 更新 `handleSwitchSession` 使用新的簽名：
     ```typescript
     const handleSwitchSession = useCallback((name: string) => {
       connect(name);
     }, [connect]);
     ```
- **驗證**: 原有的「連線」按鈕行為不變（使用 input 中的 session 名稱）；從側邊欄切換 session 時使用目標 session 名稱

### Task 6: 在 header 新增 Sessions 按鈕
- **檔案**: `app/page.tsx`
- **改動**:
  在 header 左側區域（logo 資訊之後）新增 Sessions toggle 按鈕：
  ```tsx
  <div className="flex items-center gap-3">
    <span className="font-semibold text-emerald-400">web_cli_v2</span>
    <span className="text-white/40">•</span>
    <span className="text-white/60 text-xs">wterm + tmux</span>
    <span className="text-white/40">•</span>
    <button
      onClick={() => setSidebarOpen(!sidebarOpen)}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
        sidebarOpen
          ? "bg-zinc-700 text-white"
          : "bg-zinc-800 text-white/60 hover:text-white hover:bg-zinc-700"
      }`}
    >
      <span>Sessions</span>
      {sessions.length > 0 && (
        <span className="bg-emerald-600 text-white rounded-full px-1.5 py-0.5 text-[10px] leading-none">
          {sessions.length}
        </span>
      )}
    </button>
  </div>
  ```
  注意：badge 數量即使側邊欄未開啟也應顯示。可在元件掛載時首次 fetch 一次 session 數量，或使用 `useEffect` 在元件初始化時背景請求一次。
- **驗證**: header 顯示 Sessions 按鈕，點擊可 toggle 側邊欄

### Task 7: 實作側邊欄面板 UI
- **檔案**: `app/page.tsx`
- **改動**:
  在 return 的最外層 `<div>` 中，terminal 之前插入側邊欄，並使用 flex 佈局讓側邊欄和終端並排：
  ```tsx
  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* Header — 保持不變 */}

      <div className="flex flex-1 overflow-hidden">
        {/* 側邊欄 */}
        <div
          className={`${
            sidebarOpen ? "w-72" : "w-0"
          } transition-all duration-300 overflow-hidden border-r border-white/10 bg-zinc-900/80 flex-shrink-0`}
        >
          {sidebarOpen && (
            <div className="w-72 h-full flex flex-col">
              {/* 側邊欄 header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-sm font-semibold text-white/80">Sessions</span>
                <button
                  onClick={loadSessions}
                  className="text-white/40 hover:text-white/80 text-sm"
                  title="重新整理"
                >
                  ↻
                </button>
              </div>

              {/* Session 列表 */}
              <div className="flex-1 overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="px-3 py-8 text-center text-white/30 text-xs">
                    尚無 session
                    <br />
                    請在上方輸入名稱建立新 session
                  </div>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.name}
                      className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-white/5 hover:bg-zinc-800/50 ${
                        s.name === sessionName && connected
                          ? "bg-zinc-800 border-l-2 border-l-emerald-500"
                          : ""
                      }`}
                      onClick={() => handleSwitchSession(s.name)}
                    >
                      {/* 狀態指示燈 */}
                      <span className={`text-xs ${s.attached ? "text-emerald-400" : "text-zinc-600"}`}>
                        ●
                      </span>

                      {/* Session 資訊 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-white/80 truncate">
                          {s.name}
                        </div>
                        <div className="text-[10px] text-white/30">
                          {new Date(s.created * 1000).toLocaleString()} · {s.windows} window{ s.windows !== 1 ? "s" : ""}
                        </div>
                      </div>

                      {/* 刪除按鈕 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(s.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 text-xs transition-opacity"
                        title="刪除 session"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Terminal — 原有的 terminal div 移到這裡 */}
        <div className="flex-1 overflow-hidden">
          <Terminal ... />
        </div>
      </div>

      {/* Footer — 保持不變 */}
    </div>
  );
  ```
- **驗證**: 側邊欄正確渲染，session 列表顯示完整資訊，點擊項目可切換 session

### Task 8: 實作刪除確認對話框
- **檔案**: `app/page.tsx`
- **改動**:
  在側邊欄之後、terminal 之前加入刪除確認的 overlay：
  ```tsx
  {deleteConfirm && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-white/20 rounded-lg p-4 max-w-sm">
        <p className="text-sm text-white/80 mb-1">
          確定要刪除 session 「{deleteConfirm}」？
        </p>
        <p className="text-xs text-white/40 mb-4">
          此操作無法復原
          {deleteConfirm === sessionName && connected && (
            <span className="text-red-400">（此為當前連線的 session，刪除後將斷線）</span>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="px-3 py-1 text-xs rounded bg-zinc-700 text-white/60 hover:text-white"
          >
            取消
          </button>
          <button
            onClick={() => handleDelete(deleteConfirm)}
            className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-500"
          >
            刪除
          </button>
        </div>
      </div>
    </div>
  )}
  ```
- **驗證**: 點擊刪除按鈕後彈出確認框；取消可關閉；確認刪除後 session 被移除；刪除當前 session 後斷線

### Task 9: 元件初始化時背景載入 session 數量
- **檔案**: `app/page.tsx`
- **改動**:
  新增一個 useEffect 在元件掛載時背景請求一次 session 列表，以便 header badge 在側邊欄未開啟時也能顯示正確數量：
  ```typescript
  useEffect(() => {
    fetchSessions().then(setSessions).catch(() => {});
  }, []);
  ```
- **驗證**: 頁面載入後，即使側邊欄未開啟，header 的 Sessions 按鈕 badge 也顯示正確數量

### Task 10: 端對端驗證與手動測試
- **檔案**: 無（測試任務）
- **改動**: 執行以下驗證步驟：
  1. 啟動 server（`pnpm dev` 或 `node server.js`）
  2. 開啟瀏覽器，確認 header 顯示 Sessions 按鈕和 badge
  3. 確認頁面載入時 badge 顯示 0（無 session）
  4. 在 header 輸入 session 名稱 `test-1` 並連線
  5. 開啟側邊欄，確認列表顯示 `test-1`，狀態為 attached，1 window
  6. 開啟另一個瀏覽器分頁，連線到 `test-2`
  7. 回到第一個分頁，等待輪詢刷新，確認列表同時顯示 `test-1` 和 `test-2`
  8. 點擊 `test-2` 項目，確認終端切換到 `test-2` session
  9. 確認 session name input 自動更新為 `test-2`
  10. 點擊 `test-1` 的刪除按鈕，確認彈出確認對話框
  11. 點擊「取消」，確認 `test-1` 仍在列表中
  12. 再次點擊刪除並確認，確認 `test-1` 從列表移除
  13. 在 server 終端執行 `tmux list-sessions`，確認只剩 `test-2`
  14. 在終端中建立新 tmux window（`Ctrl-b c`），確認側邊欄顯示 window 數量增加
  15. 關閉側邊欄，確認輪詢停止（Network tab 無持續請求）
  16. 測試安全性：在 DevTools Console 執行 `fetch('/api/sessions/test;echo', {method:'DELETE'})` 確認回傳 400
  17. 測試刪除當前 session：刪除 `test-2`（當前連線），確認斷線提示出現
  18. 確認側邊欄開啟/關閉時終端正確 resize
- **驗證**: 所有步驟通過，無 console error，側邊欄動畫流暢
