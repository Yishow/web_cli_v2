# Spec: web-terminal

## MODIFIED Requirements

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
