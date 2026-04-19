## ADDED Requirements

### Requirement: Splendor 联机房间开始前禁止玩法操作
系统 SHALL 在 `splendor` 联机房间开始前阻止玩家执行实际玩法命令。

#### Scenario: 房主尚未开始游戏
- **WHEN** 房间已创建但房主尚未点击开始游戏
- **THEN** 玩家 MUST 不能执行拿宝石、保留、购买、选贵族等玩法命令

### Requirement: Splendor 房主开始游戏
系统 SHALL 支持由房主显式开始 `splendor` 对局。

#### Scenario: 房主点击开始
- **WHEN** 房主在等待开始界面点击开始游戏
- **THEN** 系统 MUST 将对局标记为已开始
- **AND** 后续玩法命令 MUST 按正常规则可执行

### Requirement: Splendor 开始前等待覆盖层
系统 SHALL 在 `splendor` 开始前显示等待/开始覆盖层，而不是直接进入可操作棋盘。

#### Scenario: 房主视角
- **WHEN** 房主进入未开始的 `splendor` 房间
- **THEN** 页面 MUST 显示开始游戏按钮

#### Scenario: 非房主视角
- **WHEN** 非房主玩家进入未开始的 `splendor` 房间
- **THEN** 页面 MUST 显示等待房主开始的提示
