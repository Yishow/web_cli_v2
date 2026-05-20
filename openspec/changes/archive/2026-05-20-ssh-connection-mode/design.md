# Design: ssh-connection-mode

## Context

目前專案已把 wterm 官方接觸面收斂到 `app/terminal-runtime/*`，也把 `app/page.tsx` 收斂成產品 shell。這讓新增「另一種 terminal transport」變得比較合理：不需要把 SSH 細節直接塞回 page，而是擴充 runtime contract 與 server bridge。

官方 `examples/ssh` 已經示範最小閉環：

- 前端收集 host / port / username / auth
- WebSocket 第一次訊息傳送連線參數
- server 端以 `ssh2` 建立 shell stream
- terminal 繼續走 wterm 的輸入/輸出渲染

但本專案比官方 example 多了：

- local tmux mode
- session sidebar / session delete API
- reconnect / diagnostics / Ghostty / themes

所以這個 change 的重點不是照抄 example UI，而是把 SSH 加成**新的 transport mode**，並且不破壞已建立好的 runtime boundary。

## Goals / Non-Goals

**Goals**

- 在現有 local tmux mode 外新增 SSH mode
- 提供手動 SSH 表單，支援 password 與 private key 兩種驗證
- 不持久化任何 SSH credential
- 讓 SSH mode 走 `app/terminal-runtime/*` 的同一條邊界
- server 端新增 focused 的 SSH bridge，不污染現有 tmux API

**Non-Goals**

- 不做 SSH host profile / 最近連線清單
- 不做 credential persistence、secret vault、browser 記住密碼
- 不做 agent forwarding、port forwarding、SFTP、multi-hop
- 不把遠端 SSH session 映射成 tmux sidebar 內的 session 項目
- 不在第一版支援 known_hosts 管理 UI

## Decisions

### Decision: 以「mode switch」區分 local tmux 與 SSH

UI 層新增一個明確的 terminal mode：

- `local`：保留現有 tmux/session 工作流
- `ssh`：顯示 SSH 連線表單與遠端 shell 工作流

這個 mode 應由 `app/page.tsx` 的 shell state 管理，因為它決定哪些控制項要顯示：

- local mode 顯示 session name、Sessions sidebar、delete flow
- ssh mode 顯示 host / port / username / auth form

這樣可以避免把 local session UI 與 SSH form 混在同一組控制項中。

**Alternatives considered**

- **把 SSH 當成 tmux session 的一種特殊 session**：語義混亂，也會污染現有 `/api/sessions`
- **用獨立 route（例如 `/ssh`）**：可行，但第一版先在單頁 mode switch 內完成，重用既有 shell 和 runtime 較省維護成本

### Decision: SSH transport 使用獨立 `/api/ssh` bridge

server 端保留現有 `/api/terminal`（tmux）路徑，新增 `/api/ssh` WebSocket upgrade path。這樣 local 與 SSH 兩條 transport 可以各自維持清楚的責任邊界：

- `/api/terminal`：tmux / session persistence / local shell
- `/api/ssh`：SSH handshake / remote shell / ssh2 lifecycle

這比分別把 tmux 與 SSH 都塞進同一個 endpoint 更容易維護與除錯。

**Alternatives considered**

- **單一 `/api/terminal` 用 mode query 決定 transport**：會讓本來單純的 tmux path 變得更難讀
- **HTTP POST 先建立 SSH session，再用 WebSocket attach**：第一版過重，不符合 MVP

### Decision: 第一次 WebSocket 訊息送出 SSH connect envelope，後續沿用 terminal client framing

SSH transport 的第一個 client message 使用 JSON envelope，例如：

```json
{
  "type": "connect",
  "host": "example.com",
  "port": 22,
  "username": "root",
  "authMethod": "privateKey",
  "password": "...",
  "privateKey": "..."
}
```

連線成功後，後續 input / resize 盡量沿用目前專案的 terminal client framing 與 resize 規則，而不是再發明一套 SSH 專用字串格式。若現有 `src/pty-client-message.ts` 不足以同時服務 tmux 與 SSH，就抽成更中性的 terminal-client-message helper。

這能降低 local / ssh mode 在 runtime 內的差異面。

### Decision: 不持久化任何 SSH credential

SSH form 內的資料只存在於 React state 與當前 WebSocket 生命週期內：

- 不寫 localStorage
- 不寫 server-side cache
- 不寫 session list

連線中斷或頁面刷新後，使用者需重新輸入。這符合使用者指定的 MVP，也避免在第一版就踩進敏感資訊管理問題。

### Decision: SSH mode 與 local mode 共用同一個 runtime contract

`app/terminal-runtime/types.ts` 擴充成可描述 transport mode，例如：

```ts
type TerminalMode = "local" | "ssh";
```

並由 runtime props 接收 mode-specific configuration，例如：

- local mode：`sessionName`
- ssh mode：`sshConfig`

但 shell 對 runtime 仍只依賴 app-owned contract，例如：

- `connect()`
- `disconnect()`
- `onConnectionStateChange`
- `onTitleChange`
- `onDiagnosticsChange`

這表示未來若再加入第三種 transport，仍能沿用同一種結構。

## Risks / Trade-offs

- **安全風險**：SSH credential 進入 browser state 與 WebSocket 傳輸。第一版雖不持久化，但仍需清楚界定只支援受信任環境
- **transport 複雜度上升**：runtime 由單一 local transport 擴充成 multi-mode transport
- **resize / disconnect 行為差異**：SSH shell stream 與 tmux PTY lifecycle 不完全相同，需要額外測試
- **private key handling**：需明確限制為手動貼上字串，不處理 passphrase 管理 UI

## Migration Plan

1. **Phase 1 — shell mode 與表單**：在 `app/page.tsx` 新增 local/ssh mode switch 與 SSH form state
2. **Phase 2 — runtime contract 擴充**：讓 `app/terminal-runtime/*` 能依 mode 選擇 local 或 ssh transport
3. **Phase 3 — server SSH bridge**：在 `server.ts` 新增 `/api/ssh` 與 `ssh2` bridge
4. **Phase 4 — auth / error handling**：補 password/private key flow、錯誤提示與 disconnect handling
5. **Phase 5 — regression verification**：驗證 local tmux mode 未受影響，SSH mode 可正常使用

## Open Questions

- 第一版是否要接受加密 private key（需要 passphrase）還是只接受可直接使用的 key？
- SSH mode 是否需要顯示明確的「受信任環境」警語？
