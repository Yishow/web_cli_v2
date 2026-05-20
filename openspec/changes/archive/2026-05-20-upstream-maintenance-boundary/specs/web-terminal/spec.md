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
