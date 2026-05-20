# Tasks: just-bash-fallback-mode

## Tasks

## Progress

- [x] Task 1: 定義 browser fallback shell 的入口與 UI 標示
- [x] Task 2: 建立 just-bash shell adapter 與虛擬檔案集
- [x] Task 3: 將 browser shell 接到現有 page shell
- [x] Task 4: 明確區分 browser shell 與 local / ssh 工作流
- [x] Task 5: 驗證 browser shell 可操作且主工作流不回歸

### Task 1: 定義 browser fallback shell 的入口與 UI 標示
- **檔案**: `app/page.tsx`
- **改動**:
  1. 新增 demo / fallback shell 入口
  2. 明確標示 browser-only、no backend、no persistence
  3. 避免把它做成與 local / ssh 等價的主 mode switch
- **驗證**: 使用者能理解這是 demo/fallback shell，而不是正式工作 shell

### Task 2: 建立 just-bash shell adapter 與虛擬檔案集
- **檔案**: `app/browser-shell.ts`, `app/browser-shell-files.ts`（名稱實作時定稿）
- **改動**:
  1. 以 `@wterm/just-bash` 建立 browser shell adapter
  2. 定義 greeting 與預載虛擬檔案
  3. 補齊 shell attach / input handling
- **驗證**: 開啟 browser shell 後可以執行基本指令並讀取預載檔案

### Task 3: 將 browser shell 接到現有 page shell
- **檔案**: `app/page.tsx`，必要時 `app/terminal-runtime/*`
- **改動**:
  1. 將 browser shell 以相鄰 adapter 方式接到現有 shell
  2. 不要求它共用 local / ssh 的 transport state
  3. 保留 themes / terminal 呈現一致性
- **驗證**: browser shell 與既有 UI 能平順共存

### Task 4: 明確區分 browser shell 與 local / ssh 工作流
- **檔案**: shell UI 與說明文字
- **改動**:
  1. 補 banner / label，明確說明 browser shell 性質
  2. 不顯示與它無關的 session / SSH controls
  3. refresh 後回到預設 demo state
- **驗證**: 使用者不會把 browser shell 誤解為 persisted / remote shell

### Task 5: 驗證 browser shell 可操作且主工作流不回歸
- **檔案**: 無（驗證任務）
- **改動**:
  1. 執行 lint / typecheck / build / tests
  2. 驗證 browser shell：greeting、demo files、theme、基本指令
  3. 驗證 local tmux 與 ssh mode 不受影響
- **驗證**: browser shell 可用，且它沒有把主要工作流弄壞

## Notes

- 本 change 明確避免把 just-bash 變成正式第三種 production shell
- 若後續真的要升格為正式 mode，應另開 change，而不是在本 change 內偷偷擴 scope
