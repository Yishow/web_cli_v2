# Tasks: ssh-connection-mode

## Tasks

## Progress

- [x] Task 1: 新增 local / SSH mode shell 狀態與 UI 切換
- [x] Task 2: 建立 SSH 連線表單與不持久化 credential 的狀態管理
- [x] Task 3: 擴充 terminal runtime contract 支援 SSH transport
- [x] Task 4: 在 server 端新增 WebSocket ↔ SSH bridge
- [x] Task 5: 完成 password / private key 驗證流程與錯誤處理
- [x] Task 6: 驗證 local mode 不回歸且 SSH mode 可正常使用

### Task 1: 新增 local / SSH mode shell 狀態與 UI 切換
- **檔案**: `app/page.tsx` 與相關 shell helper
- **改動**:
  1. 新增 `TerminalMode = "local" | "ssh"` shell state
  2. 在 header 中加入 mode switch
  3. local mode 顯示現有 tmux/session controls
  4. ssh mode 顯示 SSH 連線表單入口，並隱藏/停用與 tmux session 專屬的 controls
- **驗證**: 使用者可在 local 與 ssh mode 間切換，畫面控制項符合 mode

### Task 2: 建立 SSH 連線表單與不持久化 credential 的狀態管理
- **檔案**: `app/page.tsx`，必要時新增 `app/ssh-mode.ts`
- **改動**:
  1. 新增 host / port / username / authMethod / password / privateKey state
  2. 支援 password 與 private key 兩種輸入模式
  3. 明確不把任何 SSH credential 寫入 localStorage 或後端
  4. disconnect / refresh 後清除 SSH credential state
- **驗證**: credential 僅存在頁面生命週期內；重新整理後不恢復

### Task 3: 擴充 terminal runtime contract 支援 SSH transport
- **檔案**: `app/terminal-runtime/types.ts`, `app/terminal-runtime/terminal-runtime.tsx`, `app/terminal-runtime/transport.ts`
- **改動**:
  1. 將 runtime props 擴充為可接收 local / ssh mode configuration
  2. runtime 根據 mode 選擇 `/api/terminal` 或 `/api/ssh`
  3. 保持 `connect()` / `disconnect()` / diagnostics / title callback contract 穩定
  4. 若現有 transport helper 不足，抽出更中性的 terminal client message helper
- **驗證**: page 不需直接碰 transport 細節，仍只吃 app-owned contract

### Task 4: 在 server 端新增 WebSocket ↔ SSH bridge
- **檔案**: `server.ts`，必要時新增 `src/ssh-bridge.ts`
- **改動**:
  1. 新增 `/api/ssh` upgrade path
  2. 解析第一個 connect envelope 訊息
  3. 以 `ssh2` 建立遠端 shell stream
  4. 將 shell output 回送給 browser terminal
  5. 支援 resize 與 disconnect lifecycle
- **驗證**: SSH 連線成功後可在 terminal 中操作遠端 shell，關閉 WebSocket 時 SSH 連線同步關閉

### Task 5: 完成 password / private key 驗證流程與錯誤處理
- **檔案**: `app/page.tsx`, `server.ts`, 相關 helper
- **改動**:
  1. 將 authMethod 明確編碼到 connect envelope
  2. password 模式傳 password；private key 模式傳 privateKey
  3. 補齊 invalid params、SSH auth failure、shell open failure 的錯誤訊息
  4. 在 shell UI 呈現連線中 / 失敗 / 已連線狀態
- **驗證**: auth failure 與 server error 都有明確 user-facing feedback

### Task 6: 驗證 local mode 不回歸且 SSH mode 可正常使用
- **檔案**: 無（驗證任務）
- **改動**:
  1. 執行既有 lint / typecheck / build / tests
  2. 驗證 local tmux mode：session switching、delete、reconnect、themes、debug、Ghostty
  3. 驗證 ssh mode：password login、private key login、resize、disconnect、no credential persistence
  4. 驗證切回 local mode 後行為與改動前一致
- **驗證**: 兩種 mode 都可正常工作，且 local mode 不回歸

## Notes

- 第一版明確排除 credential persistence、SSH profile、agent forwarding、SFTP
- 若現有 runtime contract 不足以同時描述 local 與 ssh mode，優先擴 contract，不要讓 page 重新直接碰 transport 細節
- 官方 `examples/ssh` 採「第一個 WebSocket 訊息送 connect params」模式；本 change 在此基礎上進一步要求與現有 resize / diagnostics 邊界共存
