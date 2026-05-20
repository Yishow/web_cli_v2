# Tasks: upstream-maintenance-boundary

## Tasks

## Progress

- [x] Task 1: 盤點並收斂 `@wterm/*` 接觸面
- [x] Task 2: 建立 terminal runtime / adapter 邊界
- [x] Task 3: 將產品 shell 改成依賴 app-owned contract
- [x] Task 4: 收斂 diagnostics（title/debug）邊界
- [x] Task 5: 建立官方升版 playbook 與驗證矩陣
- [x] Task 6: 回歸驗證並確認未來升版落點縮小

### Task 1: 盤點並收斂 `@wterm/*` 接觸面
- **檔案**: `app/page.tsx`, `app/terminal-core.ts`, `app/debug-mode.ts`, 以及所有直接 import `@wterm/*` 的檔案
- **改動**:
  1. 列出所有直接依賴 `@wterm/react`、`@wterm/dom`、`@wterm/core`、`@wterm/ghostty` 的模組
  2. 標記每個依賴屬於哪一類：Terminal render、core loading、transport bridge、title、debug
  3. 決定哪些邏輯保留在 adapter/runtime，哪些留在產品 shell
- **驗證**: 有一份明確的依賴清單，可作為後續重構切分依據

### Task 2: 建立 terminal runtime / adapter 邊界
- **檔案**: `app/terminal-runtime/*`
- **改動**:
  1. 建立 `app/terminal-runtime/terminal-runtime.tsx`，成為唯一負責 `<Terminal>`、`useTerminal()`、官方 callback 的 adapter component
  2. 建立 `app/terminal-runtime/transport.ts`，集中 WebSocket / resize / reconnect / PTY message bridge
  3. 建立 `app/terminal-runtime/core-loader.ts`，統一管理 built-in / Ghostty 的官方載入方式
  4. 建立 `app/terminal-runtime/types.ts`，定義 shell 與 runtime 之間的 app-owned contract
- **驗證**: adapter 外部不再需要直接組裝 `Terminal` 官方 props 細節

### Task 3: 將產品 shell 改成依賴 app-owned contract
- **檔案**: `app/page.tsx` 與相關 UI helper
- **改動**:
  1. 將 `app/page.tsx` 降階為產品 shell，主要負責 session/theme/sidebar/footer/debug panel UI
  2. 移除 page 中的 `useTerminal()`、socket refs、reconnect timers、Ghostty load state
  3. 改以 `TerminalRuntimeProps` 與 callbacks 和 `app/terminal-runtime/*` 互動
  4. 保留既有單頁體驗與目前功能行為
- **驗證**: `app/page.tsx` 中不再出現大部分 upstream lifecycle 與 low-level core/transport 細節

### Task 4: 收斂 diagnostics（title/debug）邊界
- **檔案**: `app/terminal-runtime/diagnostics.ts`, `app/debug-mode.ts`, `app/terminal-title.ts`
- **改動**:
  1. 在 `app/terminal-runtime/diagnostics.ts` 中處理 title event、debug adapter 同步、trace 收集與 degraded fallback
  2. `app/debug-mode.ts` 只保留 URL、快捷鍵、ring buffer、panel formatting 等 UI helper
  3. `app/terminal-title.ts` 只保留 document/header 呈現格式
  4. 明確標記哪些能力是 public-safe、哪些是 adapter-private，並為 debug 定義可降級 fallback
- **驗證**: debug/title 的 upstream 風險只集中在 diagnostics 模組

### Task 5: 建立官方升版 playbook 與驗證矩陣
- **檔案**: maintenance spec 對應文件，必要時補充腳本或 README 片段
- **改動**:
  1. 定義每次升版要對照的 upstream 來源：`wterm.dev`、README、`examples/local`
  2. 定義升版順序：比對 → 調整 adapter → 補 shell mapping → 回歸驗證
  3. 定義驗證矩陣：built-in、Ghostty、resize、reconnect、session switching、theme、title、debug、hydration
- **驗證**: 升版流程可被另一位開發者依文件獨立執行

### Task 6: 回歸驗證並確認未來升版落點縮小
- **檔案**: 無（驗證任務）
- **改動**:
  1. 執行既有單元測試、lint、typecheck、build
  2. 手動驗證核心使用情境與 diagnostics
  3. 再次盤點 `@wterm/*` import 分布，確認主要集中在 adapter/runtime
- **驗證**: 官方升版預期只需優先修改 adapter/runtime 與 playbook，而不是整頁大改

## Notes

- 本 change 的核心不是「UI 改成更像官方」，而是「把官方改版衝擊集中到有限邊界」
- 若 debug 仍需使用非公開行為，必須被隔離在單點，且在 playbook 中被標示為高風險區
- 由於此環境沒有 OpenSpec CLI，本 change 以既有 repo 結構手動起草
- Audit finding: 目前 Next/App Router 主路徑的 `@wterm/*` 直接 import 已收斂到 `app/terminal-runtime/*`；`src/client/App.tsx` 仍是 legacy Vite demo 路徑，且已被 `tsconfig.json` 排除在現行 app build 之外
