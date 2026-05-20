# Spec: web-terminal

## NEW Requirements

### Requirement: wterm 官方整合必須集中於 adapter 邊界

系統必須將 `@wterm/react`、`@wterm/dom`、`@wterm/core`、`@wterm/ghostty` 的直接整合集中於少數專責 adapter/runtime 模組。產品 shell 與一般 UI helper 不得直接依賴 upstream 套件細節。

#### Scenario: page shell 不直接實作 upstream Terminal 生命周期
- **WHEN** `app/page.tsx` 或其他產品 UI 模組需要渲染終端
- **THEN** 它們透過 app-owned contract 使用 terminal runtime
- **AND** 不直接建立 `<Terminal>`、`useTerminal()`、`GhosttyCore.load()` 或 `WTerm` instance 存取

#### Scenario: upstream 套件 import 集中
- **WHEN** 開發者盤點專案中 `@wterm/*` import
- **THEN** 這些 import 僅出現在 adapter/runtime 與必要的型別邊界模組
- **AND** session/theme/sidebar/footer 等產品模組不直接 import `@wterm/*`

### Requirement: core 載入策略遵循官方公開 API

系統必須透過官方公開 API 載入與切換 terminal core，避免將 built-in 與 Ghostty 當作相同的 WASM URL 型別處理。

#### Scenario: built-in core 使用 wasmUrl
- **WHEN** 使用者選擇 built-in core
- **THEN** terminal runtime 以官方支援的 `wasmUrl` 方式建立 built-in terminal

#### Scenario: Ghostty core 使用 GhosttyCore.load
- **WHEN** 使用者選擇 Ghostty core
- **THEN** terminal runtime 透過 `GhosttyCore.load({ wasmPath })` 載入 core
- **AND** 將載入結果以 `core={...}` 傳給 `<Terminal>`

### Requirement: Web Terminal 支援多種連線模式

Web terminal 必須支援至少兩種連線模式：`local`（tmux）與 `ssh`（remote shell）。產品 shell 依 mode 顯示對應控制項，但 terminal runtime 仍透過同一個 app-owned contract 對外提供連線、標題與 diagnostics。

#### Scenario: local mode 顯示現有 tmux controls
- **WHEN** 使用者選擇 `local` mode
- **THEN** header 顯示 session name、Sessions sidebar 與 local tmux 相關 controls
- **AND** terminal runtime 連到 local tmux transport

#### Scenario: ssh mode 顯示 SSH 連線表單
- **WHEN** 使用者選擇 `ssh` mode
- **THEN** shell 顯示 SSH 連線表單
- **AND** tmux session 專屬 controls 被隱藏或停用
- **AND** terminal runtime 連到 SSH transport

### Requirement: 產品功能透過 app-owned contract 組裝 terminal

session switching、reconnect、theme、title、debug panel 等產品功能必須透過 app-owned state/callback contract 與 terminal runtime 互動，而不是直接耦合 upstream instance。

#### Scenario: title sync 透過 contract 往外傳遞
- **WHEN** terminal 產生 title 更新
- **THEN** runtime 將 title 透過 app-owned callback/state 對外輸出
- **AND** header/document title 的呈現邏輯不需要知道 upstream instance 細節

#### Scenario: diagnostics 不直接暴露 upstream internals 給頁面
- **WHEN** debug 功能需要消費 traces 或 hex dump
- **THEN** 產品 shell 只消費整理過的 diagnostics 資料
- **AND** 若需依賴脆弱 upstream 行為，該依賴被限制在 diagnostics adapter 內

#### Scenario: debug 能力可在升版時降級
- **WHEN** upstream 改版導致 debug 相關 internals 無法安全維持
- **THEN** 系統可以暫時降級或停用 debug traces / panel 的部分能力
- **AND** built-in core、Ghostty core、連線、resize、session、title 等核心能力仍必須可正常升版與運作

### Requirement: Web Terminal 可提供 browser-only fallback shell

Web terminal shell 可以提供一個 browser-only 的 demo / fallback shell，但它不得與 local tmux 或 SSH shell 在產品語意上混為一談。

#### Scenario: 使用者開啟 fallback shell
- **WHEN** 使用者從 UI 入口開啟 browser fallback shell
- **THEN** terminal 區域切換到 browser-only shell
- **AND** UI 清楚標示這是 demo / fallback shell

#### Scenario: fallback shell 不等同正式工作模式
- **WHEN** fallback shell 運作中
- **THEN** 與 tmux session 或 SSH 相關的 controls 不應誤導性地顯示為可用
- **AND** 使用者可理解其 no backend / no persistence 性質

### Requirement: Web Terminal 可呈現 agent Markdown stream 視圖

系統可以提供一個專用的 agent Markdown stream terminal 視圖，用於閱讀 AI / agent 的串流輸出；此視圖不得與一般 shell session 混淆。

#### Scenario: 開啟 agent stream terminal
- **WHEN** 使用者開啟 agent stream terminal
- **THEN** terminal 顯示為 agent output 視圖
- **AND** UI 清楚區分它與 local tmux / SSH shell
