# Change: upstream-maintenance-boundary

## Why

目前專案的終端主流程集中在 `app/page.tsx`，同時承擔：

- `@wterm/react` / `@wterm/dom` / `@wterm/ghostty` 的直接整合
- WebSocket 與 PTY 訊息流
- core 切換與 hydration-safe 還原
- debug/title 等終端診斷功能
- session sidebar、theme、footer 等產品 UI

這種結構雖然已可用，但對官方升版的維護成本偏高：只要 upstream 在 `examples/local`、`@wterm/react` 或 `@wterm/ghostty` 的初始化、props、生命周期上有調整，我們就需要修改主頁協調層，而不是只調整一個小邊界。

本變更要把「官方 wterm 整合面」與「產品自訂功能」明確分層，讓未來升級官方版本時，主要落點集中在單一 adapter/runtimes 邊界，而不是整頁大改。

## What Changes

1. **建立 upstream-facing terminal adapter 邊界**：只有少數 runtime/adapter 模組可以直接 import `@wterm/*` 套件，集中處理 Terminal 初始化、core 載入、ready/data/resize/title 等官方接口。
2. **把產品功能移到 adapter 外層組裝**：session 管理、theme、header/footer、sidebar、reconnect、debug panel 等功能透過 app-owned contract 與 terminal runtime 互動，而不是直接依賴 upstream 物件形狀。
3. **收斂自訂診斷能力的風險面**：debug/title 這類與 upstream API 穩定度高度相關的能力，改為集中在單一 diagnostics 邊界；其中 debug 明確列為可降級的高風險能力，避免升版時拖累核心 terminal 能力。
4. **建立官方升版 playbook**：明確定義每次升版要比較的 upstream 來源、調整順序、驗證矩陣與接受風險的準則。

## Capabilities

### New Capabilities

- `upstream-compatible-terminal-adapter`: 專案提供一個集中、可替換的 wterm 官方整合邊界
- `official-upgrade-playbook`: 專案提供一套標準化的官方升版與回歸驗證流程

### Modified Capabilities

- `web-terminal-rendering`: Web terminal 與 upstream 的耦合由頁面層下沉到專責 adapter/runtime 層
- `web-terminal-maintenance`: 官方升版時的主要改動面受限於少數模組與既定驗證步驟

## Impact

- Affected code:
  - `app/page.tsx` — 從「終端整合 + 產品 UI 全包」收斂成產品 shell / orchestration
  - 新增 `app/terminal-runtime/*` 作為 upstream-facing adapter/runtime 邊界
  - 現有 `app/core-preference.ts`、`app/terminal-core.ts`、`app/debug-mode.ts`、`app/terminal-title.ts` 將重新劃分責任
  - 可能新增升版文件或腳本輔助驗證
- Affected systems:
  - 前端 terminal rendering integration
  - WebSocket / PTY client message flow
  - 官方升版流程與回歸驗證流程
- Verification impact:
  - 需要確認 adapter 邊界外不再直接依賴 `@wterm/*`
  - 需要確認 built-in / Ghostty / reconnect / title / debug / session switching 在新邊界下維持現有行為
  - 需要確認升版 playbook 足以支撐未來對照 `wterm.dev`、README、`examples/local` 的差異分析
