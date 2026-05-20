# Design: upstream-maintenance-boundary

## Context

目前專案在功能上已超過 upstream `examples/local`：

- 後端不是單純 local shell，而是 `tmux` session-aware server
- 前端有 session sidebar、delete API、theme、reconnect、title sync、debug panel
- `app/page.tsx` 同時負責 upstream wterm 整合與產品 UI 組裝

這表示我們不應追求「完全照抄官方 example 的檔案切法」，而是要追求更重要的目標：**把官方 API 接觸面縮到最小，並讓自訂能力以外掛方式圍繞它組裝**。

## Goals / Non-Goals

**Goals**

- 將 `@wterm/react`、`@wterm/dom`、`@wterm/core`、`@wterm/ghostty` 的直接接觸面收斂到單一 adapter/runtime 邊界
- 讓 `app/page.tsx` 主要扮演產品 shell，而不是 upstream integration hub
- 保留現有產品功能：session 管理、theme、reconnect、title sync、Ghostty、debug panel
- 建立一套官方升版流程，使未來改版時先比較 upstream，再局部調整 adapter
- 明確標記哪些能力使用官方公開 API、哪些能力屬於脆弱的 adapter-private 行為

**Non-Goals**

- 不追求把整個 UI 重寫成 upstream example 的版型
- 不移除既有產品功能來換取與 upstream 完全一致
- 不 fork 或修改 `@wterm/*` 套件原始碼
- 不把 tmux/session 邏輯塞回 upstream-like 最小 example

## Decisions

### Decision: 建立明確的 terminal runtime 邊界

實作上建立 `app/terminal-runtime/*` 專責模組，作為「唯一可直接接觸 `@wterm/*` 的區域」。這組模組至少負責：

- Terminal 元件實例化與 `useTerminal()` 綁定
- built-in / Ghostty core 載入
- `onReady` / `onData` / `onResize` / `onTitle` 等 upstream-facing callback
- WebSocket / PTY 客戶端協議的低階橋接
- 可選的 diagnostics 接口（debug/title traces）

頁面與產品 UI 只能依賴 app-owned contract，例如：

- `connect(sessionName)`
- `disconnect()`
- `sendInput(data)`
- `setCorePreference(coreType)`
- `terminalTitle`
- `connectionState`
- `diagnosticsSnapshot`

而不是依賴 `WTerm` instance、`Terminal` props 細節或 `GhosttyCore` 載入細節。

**Alternatives considered**

- **維持目前 page.tsx 集中整合**：短期改動少，但每次 upstream 改版都會擴散到主頁協調層
- **完全比照官方 route 架構重寫**：可讀性可能提升，但會犧牲現有產品需求，不符合本專案

### Decision: 保留產品單頁體驗，但讓 upstream 差異集中在 adapter

官方 `examples/local` 以 route 區分 built-in / ghostty；本專案已經有 session、theme、footer、sidebar 等單頁控制需求，因此不採 route-first 重寫。

改採以下準則：

- **畫面結構可維持現有單頁體驗**
- **terminal 內核與 transport 行為必須貼近官方 contract**
- **任何 upstream API 變更，預期只改 adapter/runtime，而不是 shell UI**

這樣可以兼顧產品需求與維護成本。

### Decision: 將 diagnostics 能力列為受管控的脆弱邊界

title sync 屬於相對正常的終端輸出能力；debug traces 則涉及較脆弱的 `terminal.debug` 行為。未來設計上應將 diagnostics 分成兩類：

- **Public-safe diagnostics**：只依賴公開 callback / props / documented behavior
- **Adapter-private diagnostics**：若必須讀取較不穩定的 instance 資訊，只能集中在單一 diagnostics 模組

其中 **debug 明確定義為可降級能力**：若未來 upstream 調整 internals 導致 traces 無法安全取得，允許先退化為較小功能集或暫時停用 debug，而不阻擋 built-in/Ghostty、連線、resize、session、title 等核心能力升版。

產品層只能消費 `diagnosticsSnapshot` 或 `debugPanelState` 之類的 app-owned 資料，不應直接碰 `ref.current?.instance.debug`。

這能在 upstream 調整 debug internals 時，把衝擊限縮在單點，並把「debug 失效是否阻擋升版」的決策提前說清楚。

### Decision: 將升版流程文件化為固定 playbook

每次官方升版都遵循固定順序：

1. 比較 upstream 三個來源：`wterm.dev`、repo README、`examples/local`
2. 盤點本地 adapter 是否仍符合官方初始化與 core 載入方式
3. 只在 adapter/runtime 內調整 upstream API 差異
4. 再檢查產品 shell 與 diagnostics contract 是否需要補 mapping
5. 依驗證矩陣跑完整回歸

這套流程要先以文件與驗證矩陣形式落地到 OpenSpec 的 maintenance spec，而不是一開始就投入額外自動化工具。

### Decision: 建立升版驗證矩陣，按能力而非檔案驗證

驗證不應依賴「哪些檔案有改」，而應依賴幾個能力面向：

- built-in core 啟動
- Ghostty core 啟動
- WebSocket / resize / session reconnect
- tmux session switching 與刪除
- theme persistence
- title sync
- debug toggle / panel / traces
- hydration-safe initial render

這能讓未來即使檔案結構再調整，升版驗證標準仍穩定。

## Risks / Trade-offs

- **初次重構成本**：為了降低未來升版成本，這次需要先做一次邊界收斂
- **debug 功能可能仍有脆弱區段**：若 upstream 沒有公開 debug callback，仍可能需要保留 adapter-private 實作；本變更接受其為可降級能力
- **抽象過度的風險**：若 contract 設計太大，反而增加維護負擔；因此只抽出真正跨 upstream 變動的邊界
- **單頁 shell 仍比官方 example 複雜**：本專案的產品需求比官方 example 多，完全零差異並不現實

## Migration Plan

1. **Phase 1 — 盤點接觸面**：列出目前所有直接 import / 使用 `@wterm/*` 的檔案與行為
2. **Phase 2 — 抽出 runtime/adapter**：建立 terminal runtime 邊界，把 `<Terminal>`、core loader、transport 低階流程移入
3. **Phase 3 — 產品 shell 轉接**：讓 `app/page.tsx` 與 sidebar/theme/footer/debug panel 改用 app-owned contract
4. **Phase 4 — diagnostics 收斂**：把 title/debug 類能力收斂到專責 diagnostics 模組
5. **Phase 5 — 升版 playbook**：落地官方比對清單、升版步驟、驗證矩陣

## Proposed File Layout

### `app/terminal-runtime/terminal-runtime.tsx`

唯一直接渲染 `<Terminal>` 的 component。負責：

- `useTerminal()` 與 terminal ref 綁定
- `onReady` / `onData` / `onResize` / `onTitle`
- 接收 shell 傳入的 `sessionName`、`coreType`、`debugEnabled`
- 將 connection / title / diagnostics 透過 app-owned callbacks 往外送

### `app/terminal-runtime/transport.ts`

集中處理：

- WebSocket 建立、關閉、重連
- session 切換時的連線處理
- resize 訊息與 PTY input/output bridge
- 目前 `reconnect.ts` 與 `app/page.tsx` 中的 socket/timer/ref 邏輯

### `app/terminal-runtime/core-loader.ts`

集中處理：

- built-in `wasmUrl`
- `GhosttyCore.load({ wasmPath })`
- core props 轉換
- Ghostty 載入中 / 載入失敗狀態

目前 `app/terminal-core.ts` 的 runtime-facing 邏輯應併入此模組；`app/core-preference.ts` 則保留為 shell-side preference helper。

### `app/terminal-runtime/diagnostics.ts`

集中處理：

- terminal title 對外發送
- debug adapter 同步
- trace 收集與高風險 fallback
- 對 shell 提供整理過的 diagnostics snapshot

目前 `app/debug-mode.ts` 中與 upstream instance 互動的部分應移入這裡；純 UI/URL/panel helper 可以保留在 shell-side。

### `app/terminal-runtime/types.ts`

定義 app-owned contract，例如：

```ts
type TerminalRuntimeProps = {
  sessionName: string;
  coreType: CoreType;
  debugEnabled: boolean;
  onConnectionStateChange: (state: ConnectionState) => void;
  onTitleChange: (title: string) => void;
  onDiagnosticsChange: (snapshot: DiagnosticsSnapshot) => void;
};
```

重點是讓 shell 依賴這些型別，而不是依賴 upstream instance。

### `app/page.tsx`

收斂為產品 shell。保留：

- session name / sidebar / delete confirm / theme / footer 等 UI 狀態
- debug panel 展開與 tab 狀態
- 與 `/api/sessions` 互動的產品行為
- 對 runtime props 與 callbacks 的組裝

移出：

- terminal ref 與 `useTerminal()`
- WebSocket lifecycle
- core loading
- upstream diagnostics instance 操作

## Implementation Notes

1. **先搬 transport，再搬 core/diagnostics，最後收 page shell**
   - 先抽 WebSocket 與 reconnect，最容易看到 `page.tsx` 瘦身效果
   - 再抽 core loader，避免 Ghostty/built-in 再次混在頁面邏輯
   - 最後把 debug/title instance 存取收斂到 diagnostics
2. **保留 shell-side preference helpers**
   - `app/core-preference.ts` 繼續負責 localStorage 正規化與初始偏好
   - `app/terminal-title.ts` 繼續負責 document/header 呈現格式
   - `app/debug-mode.ts` 收斂成 URL、快捷鍵、ring buffer、panel formatting 等 UI helper
3. **runtime callback 只送資料，不送 upstream instance**
   - 不把 `WTerm` 或 `terminal.debug` 往外暴露
   - shell 只收 `connected`、`reconnectAttempt`、`title`、`diagnosticsSnapshot`
4. **debug fallback 要在 diagnostics 模組內完成**
   - 若 upstream trace API 失效，diagnostics 模組應回傳明確的 degraded 狀態
   - shell 只負責顯示「debug 已降級/不可用」，不負責判斷 internals
5. **升版時先比對 `app/terminal-runtime/*` 與 upstream example**
   - 這組檔案未來就是與官方 example 對照的主要區域
   - `app/page.tsx` 不再是升版的第一落點

## Open Questions
