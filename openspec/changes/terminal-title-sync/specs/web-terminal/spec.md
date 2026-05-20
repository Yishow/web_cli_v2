# Spec: web-terminal

## NEW Requirements

### Requirement: 終端標題同步至瀏覽器 document.title

Web Terminal 必須監聽 wterm 的 `onTitle` callback，並將收到的終端標題即時同步到瀏覽器 `document.title`，讓使用者在瀏覽器 tab 上可辨識當前終端活動。

#### Scenario: tmux window 切換觸發標題更新
- **GIVEN** 使用者已連線到 tmux session，且 tmux 處於多 window 狀態
- **WHEN** 使用者在終端內按 `Ctrl-b n`（下一個 window）切換到名為 "vim" 的 window
- **THEN** wterm core 收到 OSC 0/2 escape sequence，觸發 `onTitle` callback
- **AND** `document.title` 更新為 `"[session-name] vim — web_cli_v2"` 格式
- **AND** 瀏覽器 tab 標題即時反映此變更

#### Scenario: 開啟 vim 時標題更新為檔案名
- **GIVEN** 使用者已在終端中
- **WHEN** 使用者執行 `vim config.yaml`
- **THEN** `onTitle` callback 被觸發，傳入包含檔案名稱的標題
- **AND** `document.title` 更新為包含檔案名稱的格式（如 `"config.yaml - VIM — web_cli_v2"`）

#### Scenario: 執行 htop 時標題更新
- **GIVEN** 使用者已在終端中
- **WHEN** 使用者執行 `htop`
- **THEN** `onTitle` callback 被觸發，傳入 `"htop"` 標題
- **AND** `document.title` 更新為 `"htop — web_cli_v2"`

#### Scenario: 程式退出後標題恢復
- **GIVEN** `document.title` 目前為 `"htop — web_cli_v2"`（htop 執行中）
- **WHEN** 使用者按下 `q` 退出 htop，shell 的 `onTitle` 傳入空字串或 shell prompt 標題
- **THEN** `document.title` 恢復為 `"web_cli_v2"`（若收到空字串）或更新為新的標題

#### Scenario: 頁面初次載入時的預設標題
- **GIVEN** 使用者剛開啟 web_cli_v2 頁面
- **WHEN** 頁面渲染完成但尚未收到任何 `onTitle` callback
- **THEN** `document.title` 為 `"web_cli_v2"`

#### Scenario: 頁面未連線時的標題
- **GIVEN** 使用者開啟頁面但尚未點擊「連線」
- **WHEN** 頁面渲染完成
- **THEN** `document.title` 為 `"web_cli_v2"`
- **AND** header 中的終端標題顯示為「終端」（淡色預設文字）

### Requirement: Header UI 顯示終端標題

Header 區域必須包含一個終端標題顯示區塊，即時顯示當前由 OSC escape sequence 設定的終端標題。

#### Scenario: 收到標題時 header 更新顯示
- **GIVEN** header 中有終端標題顯示區塊，目前顯示「終端」（淡色預設文字）
- **WHEN** `onTitle` callback 被觸發，傳入 `"[webcli-main] vim"`
- **THEN** header 中的標題更新為 `"[webcli-main] vim"`，使用 `font-mono` 樣式
- **AND** 文字顏色為較亮的白色（與預設淡色文字區分）

#### Scenario: 收到空字串時恢復預設顯示
- **GIVEN** header 目前顯示終端標題為 `"[webcli-main] zsh"`
- **WHEN** `onTitle` callback 被觸發，傳入空字串 `""`
- **THEN** header 中的標題恢復為「終端」淡色預設文字

#### Scenario: 標題過長時截斷顯示
- **GIVEN** header 中的終端標題區塊有最大寬度限制
- **WHEN** `onTitle` 傳入一個非常長的標題（超過區塊寬度）
- **THEN** 標題文字以 CSS `text-overflow: ellipsis` 截斷顯示
- **AND** 滑鼠懸停時可透過 `title` 屬性看到完整標題

#### Scenario: Header 標題的視覺風格
- **WHEN** 終端標題在 header 中渲染
- **THEN** 使用與 header 其他元素一致的深色主題樣式
- **AND** 標題文字使用 `font-mono` 字體
- **AND** 位於左側專案名稱區塊（`web_cli_v2 • wterm + tmux`）之後
- **AND** 與其他元素以 `•` 分隔符號區隔

## MODIFIED Requirements

### Requirement: Terminal 元件支援 onTitle callback

Terminal 元件必須接收 `onTitle` prop，並在 wterm core 解析到 OSC 0/2 escape sequence 時呼叫此 callback。

#### Scenario: onTitle prop 被正確傳入 Terminal 元件
- **WHEN** `WebCliV2` 元件渲染 Terminal 元件
- **THEN** Terminal 元件的 `onTitle` prop 被設定為 `handleTitle` callback
- **AND** `handleTitle` callback 會更新 `terminalTitle` state 並同步 `document.title`
