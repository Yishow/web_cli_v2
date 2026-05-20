# Spec: maintenance

## NEW Requirements

### Requirement: 官方升版必須遵循固定 playbook

系統必須提供一套固定的官方升版流程，使開發者在升版 `@wterm/*` 或比對官方設計時，先比對 upstream，再集中調整 adapter/runtime，最後執行完整回歸。

#### Scenario: 升版前先比對 upstream 來源
- **WHEN** 開發者準備升級 `@wterm/*` 套件或追蹤官方改版
- **THEN** 必須先檢視 `wterm.dev`、GitHub README、`examples/local`
- **AND** 先記錄官方初始化方式、core 載入方式、transport pattern 與新增/移除能力

#### Scenario: 升版調整順序固定
- **WHEN** upstream API 或 example 發生差異
- **THEN** 開發者先修改 terminal adapter/runtime
- **AND** 再檢查產品 shell 是否只需補 contract mapping
- **AND** 不直接從 page shell 開始修補 upstream 差異

### Requirement: 官方升版必須有能力導向的驗證矩陣

每次官方升版或 adapter 重構後，系統必須依固定能力矩陣驗證，而不是只依賴單一路徑 smoke test。

#### Scenario: 升版後驗證核心能力
- **WHEN** 升版完成
- **THEN** 必須驗證 built-in core、Ghostty core、WebSocket 連線、resize、session switching、reconnect、theme persistence、title sync、debug 功能與 hydration-safe initial render

#### Scenario: 驗證結果可供後續維護者重複執行
- **WHEN** 另一位維護者依文件操作
- **THEN** 他可以依 playbook 與驗證矩陣重跑同一套流程
- **AND** 不需要依賴口頭知識猜測哪些地方最容易壞

### Requirement: 非公開 upstream 依賴必須被標示為高風險區

若某些能力不得不依賴非公開或不穩定的 upstream 行為，系統必須在升版文件中標示這些區域，讓維護者在官方改版時優先檢查。

#### Scenario: debug internals 屬於高風險區
- **WHEN** debug 功能依賴 upstream 未明確保證穩定的 instance 行為
- **THEN** playbook 必須將其標記為高風險檢查點
- **AND** 維護者在升版時優先驗證此能力是否仍可用或需降級

#### Scenario: 高風險能力失效時不阻擋核心升版
- **WHEN** 高風險區在升版後失效，但核心 terminal 能力仍可正常運作
- **THEN** 維護者可以先以文件記錄方式接受 debug 類能力降級
- **AND** 不應為了維持高風險 internals 而把 upstream 升版修補散落到 page shell
