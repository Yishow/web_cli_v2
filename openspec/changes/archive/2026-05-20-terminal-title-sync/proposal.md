# Change: terminal-title-sync

## Why

許多 CLI 程式（vim、htop、tmux、less 等）會透過 OSC 0（`ESC]0;title BEL`）或 OSC 2（`ESC]2;title BEL`）escape sequence 設定終端標題。在原生終端模擬器（如 iTerm2、Ghostty、Windows Terminal）中，這些標題會自動顯示在視窗標題列或 tab 上。

目前 web_cli_v2 的瀏覽器頁面標題固定為 Next.js 的預設標題（或 HTML 中的 `<title>` 值），不會隨終端內容動態變化。這導致使用者在瀏覽器 tab 上無法辨識當前正在做什麼（例如哪個 tmux window、哪個 vim 檔案），也無法在多個 web_cli_v2 tab 之間快速切換。

tmux 更是多 window 環境的核心場景：tmux 會根據當前活動的 pane 自動設定終端標題，格式通常為 `[session-name] window-title`。同步這個標題對多 tab 使用者體驗至關重要。

## What Changes

1. **監聽 wterm 的 `onTitle` callback**：`@wterm/react` 的 `<Terminal>` 元件已提供 `onTitle?: (title: string) => void` prop，當 wterm core 解析到 OSC 0/2 escape sequence 時會觸發此 callback
2. **將標題同步到瀏覽器 `document.title`**：在 `onTitle` callback 中將收到的標題設定到 `document.title`，讓瀏覽器 tab 顯示終端標題
3. **在 header UI 中顯示終端標題**：在 header 區域新增一個終端標題顯示區塊，即時反映當前標題
4. **支援 tmux window title 格式**：tmux 的標題格式通常包含 session 資訊（如 `[session] window-title`），直接原樣顯示即可，無需額外解析

## Capabilities

### New Capabilities

- `terminal-title-browser-sync`：終端標題（由 OSC 0/2 escape sequence 設定）會即時同步到瀏覽器 `document.title`，使用者在瀏覽器 tab 上可看到當前終端活動
- `terminal-title-header-display`：header 區域新增終端標題顯示區塊，即時顯示當前終端標題（含 tmux window title 格式）

### Modified Capabilities

- `web-terminal-ui`：header 區域新增終端標題文字顯示，預設顯示「終端」，收到標題後動態更新

## Impact

- Affected code:
  - `app/page.tsx` — 新增 `terminalTitle` state、`onTitle` callback、`document.title` 同步邏輯、header 標題顯示 UI
- Affected systems:
  - 前端 UI（header 標題顯示）
  - 瀏覽器 tab 標題（`document.title`）
- Verification impact:
  - 功能驗證：在 tmux 中切換 window、開啟 vim/htop 等程式，確認瀏覽器 tab 標題與 header 顯示正確更新
  - 效能驗證：`onTitle` 觸發頻率合理（tmux 切換 window 時觸發一次），不會造成不必要的 re-render
  - 邊界驗證：未連線時 header 顯示合理的預設標題；標題為空字串時的處理
