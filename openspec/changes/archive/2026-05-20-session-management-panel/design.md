# Design: session-management-panel

## Context

web_cli_v2 的後端架構是自訂的 HTTP server（`server.ts`），使用 Node.js 的 `createServer` 建立 HTTP 伺服器，並在同一個 port 上透過 `upgrade` 事件處理 WebSocket 連線。目前 `server.ts` 的 HTTP request 處理邏輯如下：

```typescript
const server = createServer((req, res) => {
  const parsedUrl = parse(req.url || "/", true);
  handle(req, res, parsedUrl); // 委託給 Next.js 的 request handler
});
```

所有 HTTP request 都直接交給 Next.js 處理，沒有任何自訂 API route。WebSocket 連線則透過 `server.on("upgrade", ...)` 處理，僅支援 `/api/terminal` 路徑。

前端 `app/page.tsx` 是一個 `"use client"` 的 React 元件，使用 wterm 的 `<Terminal>` 元件渲染終端。目前使用者透過一個 `<input>` 手動輸入 session 名稱，點擊「連線」按鈕後建立 WebSocket 連線到 `/api/terminal?session=<name>`。連線建立後，終端透過 `tmux new-session -A -s <name>` 建立（或 attach 到已有的）tmux session。

tmux 本身提供了豐富的命令列工具來查詢和管理 session：
- `tmux list-sessions` — 列出所有 session，輸出格式如 `session-name: 1 windows (created Mon May 20 10:00:00 2026) [120x36] (attached)`
- `tmux kill-session -t <name>` — 刪除指定 session
- `tmux list-windows -t <session>` — 列出指定 session 的所有 window
- `tmux show-option -gv <option>` — 查詢 tmux 選項

## Goals / Non-Goals

**Goals:**

- 提供 `GET /api/sessions` API，回傳所有 tmux session 的結構化資訊（名稱、attached 狀態、建立時間、window 數量）
- 提供 `DELETE /api/sessions/:name` API，安全地刪除指定的 tmux session
- 前端提供側邊欄管理面板，列出所有 session 供使用者查看、點擊切換、刪除
- 每個 session 項目顯示：名稱、狀態指示燈（attached/detached）、建立時間、window 數量
- 面板開啟時自動定期刷新 session 列表
- 刪除操作需二次確認，防止誤刪
- API 輸入驗證防止 command injection
- 側邊欄不遮擋終端操作，可隨時收合

**Non-Goals:**

- 不實作 tmux window 的管理（window 的建立、切換、刪除由 tmux 內部快捷鍵處理）
- 不實作 tmux pane 的管理
- 不實作 session 的重新命名（`tmux rename-session`）
- 不實作 WebSocket 推送 session 變更（僅用輪詢）
- 不實作 session 的建立對話框（保留現有的 input + connect 按鈕作為建立方式）
- 不實作權限控制或認證（目前是單人使用的工具）
- 不使用 Next.js App Router 的 Route Handler（因為 server.ts 是自訂 server，不走 Next.js 的 API route 機制）

## Decisions

### Decision: API routes 直接在 server.ts 中處理，不使用 Next.js Route Handler

由於 `server.ts` 使用自訂的 `createServer` 架構，HTTP request 的路由判斷在 `createServer` 回呼中進行。新增的 API routes 直接在委託給 Next.js 之前攔截匹配的 URL 路徑。

理由：
1. 一致性：WebSocket 的 `/api/terminal` 已在 `server.ts` 中處理，HTTP API 也放在同一層保持一致
2. 效能：不需要經過 Next.js 的路由解析，直接處理更快
3. 控制：可以直接使用 `child_process.execSync` 執行 tmux 命令，不需要 Next.js 的 runtime 環境

**Alternatives considered:**
- **Next.js Route Handler（`app/api/sessions/route.ts`）**：需要 Next.js 處理請求，增加一層間接性。且自訂 server 下 Route Handler 的行為可能有差異
- **獨立的 Express/ Fastify server**：引入額外依賴，且需要處理跨域、多 port 等問題

### Decision: 使用 `child_process.execSync` 執行 tmux 命令

tmux 命令通常是即時完成的（<100ms），使用同步執行可以避免 async/await 的複雜性，且在 HTTP request handler 中同步執行不會阻塞其他請求（Node.js 在 `createServer` 回呼中可以使用同步操作）。

理由：
1. 簡單：不需要處理 async 的錯誤處理和 Promise chain
2. tmux 命令執行快速：`list-sessions` 和 `kill-session` 都是瞬間完成的操作
3. 錯誤處理直覺：try/catch 即可捕獲所有錯誤

**Alternatives considered:**
- **`child_process.exec`（非同步）**：需要 Promise 包裝或 async handler，增加程式碼複雜度
- **node-pty 執行 tmux 命令**：overkill，node-pty 是用來建立互動式終端的，不需要互動的命令不需要它

### Decision: session 名稱驗證使用正則表達式白名單

刪除 session 的 API 接受使用者輸入的 session 名稱。為防止 command injection，只允許包含 `[a-zA-Z0-9_-]` 的 session 名稱。不符合格式的名稱直接回傳 400 Bad Request。

理由：
1. tmux session 名稱的合法字元本身就限定在這個範圍（實際上還允許 `.` 但罕見且增加 injection 風險）
2. 正則白名單比黑名單（過濾危險字元）更安全
3. 清晰的錯誤訊息讓使用者理解命名規則

**Alternatives considered:**
- **參數化執行（`execFileSync` + 陣列參數）**：`execFileSync('tmux', ['kill-session', '-t', name])` 天然防止 injection，但為了雙重保險，仍建議先做白名單驗證
- **輸入 escape**：使用 `shell-quote` 或類似庫跳脫特殊字元，但白名單更簡單直接

### Decision: 使用 `execFileSync` 執行 tmux 命令而非 `execSync` shell 命令

使用 `child_process.execFileSync('tmux', [...args])` 直接執行 tmux 二進位檔案，不經過 shell 解析。這提供了額外的安全層，即使 session 名稱包含意外字元也不會被 shell 解釋為命令。

理由：
1. 安全性：不經過 shell，天然免疫 shell injection
2. 效能：省去 shell 啟動的開銷
3. 搭配正則白名單驗證，形成雙層防護

**Alternatives considered:**
- **`execSync` + shell 字串拼接**：簡單但有 injection 風險，即使做了白名單也不如不經過 shell 安全

### Decision: 前端使用側邊欄（sidebar）而非彈窗（modal）

session 管理面板以側邊欄形式從左側滑入顯示，佔據螢幕左側約 280px 寬度。

理由：
1. 持久性：側邊欄可以保持開啟，使用者可以一邊操作終端一邊查看 session 列表
2. 不遮擋終端：側邊欄推擠終端區域而非覆蓋，終端內容始終可見
3. 視覺一致：與 IDE 的 sidebar（如 VS Code 的 Explorer）使用體驗一致
4. 資訊密度：側邊欄可以顯示更多 session 詳細資訊

**Alternatives considered:**
- **Modal / Dialog**：會遮擋終端內容，需要關閉才能繼續操作。優點是實作簡單
- **Dropdown panel**：類似下拉選單的浮動面板。空間有限，不適合顯示詳細資訊
- **獨立頁面**：離開終端頁面體驗斷裂，不適合頻繁切換

### Decision: 使用輪詢（polling）刷新 session 列表

面板開啟時，每 5 秒呼叫 `GET /api/sessions` 刷新列表。面板關閉時停止輪詢。

理由：
1. 簡單：不需要後端 WebSocket 推送機制
2. 足夠即時：tmux session 的變更頻率很低，5 秒延遲完全可接受
3. 資源友善：面板關閉時不消耗資源

**Alternatives considered:**
- **WebSocket 事件推送**：需要額外的 WebSocket 頻道或協議擴展，複雜度高，收益低
- **Server-Sent Events (SSE)**：需要額外的 HTTP 連線，且 session 變更頻率低不需要即時串流
- **手動刷新**：使用者體驗差，可能忘記刷新

### Decision: 解析 `tmux list-sessions` 的輸出取得 session 資訊

`tmux list-sessions` 的輸出格式為：
```
session-name: N windows (created Mon May 20 10:00:00 2026) [120x36] (attached)
```

使用正則表達式解析這個輸出，提取 session 名稱、window 數量、建立時間、attached 狀態。這是所有資訊一次取得的最高效方式。

理由：
1. 一次命令取得所有資訊
2. 不需要額外的 `tmux list-windows` 命令
3. 輸出格式穩定，tmux 很少改變這個格式

**Alternatives considered:**
- **分別呼叫 `tmux list-sessions` + `tmux list-windows`**：多次命令調用，效能差
- **使用 tmux 的 `-F` 格式化輸出**：`tmux list-sessions -F '#{session_name}:#{session_windows}:#{session_created}:#{session_attached}'` 輸出更結構化、更容易解析，且不受語言環境影響。這是更好的方案，應優先採用

### Decision: 採用 `tmux list-sessions -F` 格式化輸出

使用 `tmux list-sessions -F '#{session_name}\t#{session_windows}\t#{session_created_string}\t#{session_attached}'` 取得結構化輸出，避免解析自由格式的文字。

理由：
1. 格式穩定不受語言環境影響
2. tab 分隔易於解析
3. 欄位明確，不依賴正則推測
4. `#{session_created_string}` 提供人類可讀的建立時間

## Risks / Trade-offs

- **tmux 未安裝或未運行**：如果系統中沒有安裝 tmux 或 tmux server 未運行（無任何 session），`tmux list-sessions` 會回傳非零退出碼。API 應優雅處理此情況，回傳空陣列而非錯誤。緩解：用 try/catch 包裹 execFileSync，捕獲錯誤後判斷是否為「no sessions」情境
- **command injection 風險**：刪除 session 的 API 接受使用者輸入的名稱。緩解：雙層防護——正則白名單驗證 + `execFileSync` 不經 shell
- **刪除正在使用的 session**：使用者可能誤刪自己正在 attached 的 session。緩解：刪除確認對話框中提示該 session 是否為當前連線的 session；刪除當前 session 後前端自動斷線並更新狀態
- **`tmux list-sessions` 的效能**：在高密度 session 環境下（例如 100+ session），每次輪詢都執行 tmux 命令可能有效能影響。緩解：5 秒輪詢間隔已足夠稀疏；tmux list-sessions 在一般使用場景下（<50 session）是毫秒級操作
- **側邊欄對終端尺寸的影響**：側邊欄開啟會壓縮終端區域的寬度，導致 terminal resize。緩解：wterm 的 `autoResize` prop 已啟用，會自動調整 column 數量；tmux 也會透過 RESIZE 訊息收到新尺寸
- **跨瀏覽器 fetch API 行為差異**：需確認所有目標瀏覽器支援 `fetch` + `DELETE` method。緩解：現代瀏覽器（Chrome、Firefox、Safari、Edge）都完整支援
- **tmux `-F` 格式變數的可用性**：需要確認使用的 tmux 版本支援 `#{session_created_string}` 等變數。較舊的 tmux 版本可能只有 `#{session_created}`（Unix timestamp）。緩解：使用 `#{session_created}`（timestamp）加上前端格式化，相容性更好

## Migration Plan

1. **Phase 1 — 後端 API**：在 `server.ts` 中新增 `GET /api/sessions` 和 `DELETE /api/sessions/:name` 兩個 HTTP endpoint。在委託給 Next.js 之前攔截這兩個路徑
2. **Phase 2 — 前端 API 客戶端**：在 `app/page.tsx` 中新增呼叫後端 API 的函數（`fetchSessions`、`deleteSession`）
3. **Phase 3 — 側邊欄 UI**：新增側邊欄元件和 header 上的切換按鈕，渲染 session 列表
4. **Phase 4 — 互動功能**：實作點擊切換、刪除確認、自動刷新
5. **Phase 5 — 整合測試**：端對端驗證所有功能

## Open Questions

- **側邊欄寬度**：280px 是否足夠顯示所有 session 資訊？如果 session 名稱很長（如 `webcli-my-long-running-process-session`）是否需要截斷？建議使用 `truncate` CSS 或 `text-overflow: ellipsis`
- **刪除當前連線的 session 後的行為**：刪除使用者當前正在使用的 session 後，前端應該（a）自動建立新 session 並連線，還是（b）顯示斷線狀態讓使用者手動重新連線？建議（b），保持使用者的控制感
- **session 建立時間的時區**：`#{session_created}` 回傳 Unix timestamp，前端轉換時應使用本地時區還是 UTC？建議使用本地時區（`new Date(timestamp * 1000).toLocaleString()`）
- **側邊欄的動畫**：是否需要滑入/滑出動畫？動畫會影響終端 resize 的時機。建議使用 CSS transition（300ms），在 transition 結束後觸發 terminal resize
- **tmux 版本相容性**：最低支援的 tmux 版本？`#{session_created}` 從 tmux 1.8 開始支援，`-F` 從 tmux 1.5 開始。Ubuntu 26.04 預設安裝的 tmux 版本應遠高於此
- **是否需要「新建 session」按鈕**：側邊欄中是否需要一個「新建 session」的快捷按鈕？目前已有 header 的 input + connect 作為建立方式，側邊欄中再加一個可能造成重複。建議不在側邊欄中新增，保留 header 的 input 作為唯一建立入口
