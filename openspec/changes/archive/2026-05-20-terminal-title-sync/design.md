# Design: terminal-title-sync

## Context

web_cli_v2 使用 `@wterm/react` 的 `<Terminal>` 元件作為瀏覽器終端渲染層。Terminal 元件透過 `onData`、`onResize`、`onReady` 等 callback 與外部互動。此外，Terminal 元件也提供 `onTitle?: (title: string) => void` prop——當底層 wterm core 解析到 OSC 0/2 escape sequence 時，會透過此 callback 將標題字串傳出。

在 wterm 內部，`WTerm` 類別（`@wterm/dom`）有一個 `onTitle` 屬性（型別為 `((title: string) => void) | null`），`@wterm/react` 的 Terminal 元件會將 `TerminalProps.onTitle` 直接綁定到這個屬性上。因此只需在 React 元件層級提供 callback 即可。

後端方面，tmux 會在以下情境設定終端標題：
- 切換 window 時：設定為當前 window 名稱（通常包含 session 資訊）
- 執行 vim 時：設定為檔案名稱（如 `VIM - filename.py`）
- 執行 htop 時：設定為 `htop`
- 其他程式：視程式而定

tmux 的標題格式通常是 `[session-name] window-title`，例如 `[webcli-main] vim` 或 `[webcli-main] zsh`。

## Goals / Non-Goals

**Goals:**
- 透過 `onTitle` callback 即時接收終端標題變更
- 將標題同步到 `document.title`，讓瀏覽器 tab 顯示終端標題
- 在 header UI 中顯示終端標題，提供視覺回饋
- 保持實作簡潔（只需在 `app/page.tsx` 中新增 state 與 callback）
- 預設顯示合理的標題（未連線或無標題時顯示「web_cli_v2」或「終端」）

**Non-Goals:**
- 不解析或轉換標題格式（tmux 的 `[session] title` 格式直接原樣顯示）
- 不持久化標題（標題是即時狀態，不需要 localStorage）
- 不支援多 session 的標題歷史記錄
- 不修改 wterm 元件庫的 API 或行為
- 不處理標題中的特殊字元清理（wterm 已處理 OSC parsing）
- 不實作 favicon 或其他視覺指示器的動態變更

## Decisions

### Decision: 使用 React state 管理 terminalTitle

在 `WebCliV2` 元件中加入 `const [terminalTitle, setTerminalTitle] = useState<string>("")` state，並在 `onTitle` callback 中更新此 state。這是最直覺且符合 React 範式的做法。

state 變更會觸發 header 的 re-render（顯示新標題），同時在 `useEffect` 中同步更新 `document.title`。由於 `onTitle` 的觸發頻率不高（通常只在 tmux window 切換或程式啟動/退出時），不會有效能問題。

**Alternatives considered:**
- **直接在 onTitle callback 中操作 DOM**：跳過 React state，直接在 callback 中 `document.title = title` 並 `document.getElementById(...).textContent = title`。可行但違反 React 範式，且無法觸發 UI 的宣告式更新
- **使用 useRef 儲存標題 + 手動 DOM 操作**：避免 re-render，但增加了命令式 DOM 操作的複雜度。header 顯示也需要更新，仍需觸發渲染

### Decision: 預設標題使用 "web_cli_v2"，收到空標題時恢復預設

當 `onTitle` 傳入空字串時（例如某些程式退出後恢復預設），`document.title` 應恢復為 `"web_cli_v2"`。header 中的標題顯示在收到空字串時顯示為較淡的預設文字（如「終端」）。

`document.title` 的完整格式為：收到標題時使用 `"title — web_cli_v2"`，無標題時使用 `"web_cli_v2"`。這樣在瀏覽器 tab 上既能看到終端標題，也能辨識是 web_cli_v2 的頁面。

**Alternatives considered:**
- **直接使用終端標題作為 document.title**：無後綴。當多個 tab 都叫 "vim" 時難以區分
- **使用 localStorage 記住最後標題**：overkill，標題是即時狀態

### Decision: Header 標題顯示位置在左側專案名稱區塊

在 header 的左側區塊（`web_cli_v2 • wterm + tmux` 旁），新增終端標題顯示。使用與現有元素一致的深色主題樣式，標題以 `font-mono` 顯示，未收到標題時顯示較淡的「終端」文字。

選擇左側是因為標題是全局資訊（與整個頁面相關），與專案名稱放在一起最自然。不放在中間（session input 區域）是因為那裡是操作控制區，不適合放唯讀資訊。

**Alternatives considered:**
- **放在 header 中間區域**：與操作控制項（session input、connect button）混在一起，視覺上不清晰
- **放在 footer**：footer 已有 session 資訊和 tip，加入標題會讓 footer 過於擁擠
- **作為 browser tab 專屬功能（只改 document.title）**：不夠明顯，頁面內也需要可見的標題回饋

### Decision: 使用 useEffect 同步 document.title

建立一個 `useEffect` 監聽 `terminalTitle` 變化，在 effect 中更新 `document.title`。這是 React 中處理 side effect 的標準模式，確保 document.title 與 state 一致。

```typescript
useEffect(() => {
  document.title = terminalTitle
    ? `${terminalTitle} — web_cli_v2`
    : "web_cli_v2";
}, [terminalTitle]);
```

**Alternatives considered:**
- **在 onTitle callback 中直接設定 document.title**：可行但將 side effect 混入 event handler，不如 useEffect 清晰。且如果未來有其他邏輯需要依賴標題變更，useEffect 更容易擴展
- **使用自訂 hook（useDocumentTitle）**：對這個小功能來說過度抽象

## Risks / Trade-offs

- **標題更新頻率**：某些程式可能頻繁更新標題（例如進度條）。但 OSC title 設定在實務上極少被用於高頻更新，風險很低。若有問題可加入 debounce（但目前不需要）
- **標題長度**：某些程式可能設定非常長的標題。`document.title` 和 header UI 不需要截斷，瀏覽器 tab 會自動截斷，header 可用 CSS `truncate` 處理
- **XSS 安全性**：標題來自終端 escape sequence，由 wterm core 解析後傳出，為純字串。React 的 JSX 會自動跳脫，`document.title` 賦值也是安全的（不會執行 HTML）。無安全風險

## Migration Plan

1. **Phase 1 — 新增 state 與 callback**：在 `app/page.tsx` 新增 `terminalTitle` state 與 `handleTitle` callback
2. **Phase 2 — 同步 document.title**：新增 `useEffect` 將標題同步到 `document.title`
3. **Phase 3 — Header UI**：在 header 新增標題顯示區塊
4. **Phase 4 — 驗證**：在 tmux 環境中測試各種標題變更場景

## Open Questions

- **是否需要處理多個 tmux window 的標題歷史**：目前只顯示最新的標題，切換 window 後舊標題消失。是否需要保留某種歷史？——傾向不需要，保持簡潔
- **document.title 的分隔符號**：使用 `—`（em dash）還是 `|` 或 `-`？——傾向 `—`，視覺上較清晰
