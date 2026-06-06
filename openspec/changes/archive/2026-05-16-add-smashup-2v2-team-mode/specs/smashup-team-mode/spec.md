## ADDED Requirements

### Requirement: Smash Up 可选 2v2 开局能力
系统 SHALL 在 Smash Up 的 setupOptions 中提供默认关闭的 `teamMode` 选项；仅 4 人房允许切换到 `2v2`。

#### Scenario: 4 人房显示 2v2 选项
- **WHEN** 房主创建 4 人 Smash Up 对局
- **THEN** 设置区显示 `teamMode` 选项
- **AND** 房主可在 `off` 与 `2v2` 之间切换

#### Scenario: 2/3 人房保持自由混战
- **WHEN** 房主创建 2 人或 3 人 Smash Up 对局
- **THEN** 系统不得启用 2v2 团队规则

### Requirement: 固定座位分队
系统 SHALL 在 `teamMode=2v2` 时按固定座位分队：1&3 为一队，2&4 为一队；该分队关系 MUST 基于固定座位顺序，而不是基于先手轮转后的 turnOrder 位置。

#### Scenario: 先手改变不影响分队
- **GIVEN** 4 人 Smash Up 对局开启了 2v2
- **WHEN** 系统因为先手设置或轮转改动了 turnOrder
- **THEN** 1&3 仍为一队
- **AND** 2&4 仍为一队

### Requirement: 2v2 团队胜利条件
系统 SHALL 在 `teamMode=2v2` 时把胜利条件改为“同队总 VP 达到 25 分”；若只有一队达标，则该队立即获胜。

#### Scenario: 1/3 队先到 25 分
- **GIVEN** 玩家 1 与玩家 3 属于同一队
- **WHEN** 该队总 VP 达到至少 25
- **AND** 另一队总 VP 仍低于 25
- **THEN** 系统判定 1/3 队获胜
- **AND** `gameover.winners` 同时包含该队两名玩家

#### Scenario: 关闭 2v2 时保持原规则
- **WHEN** `teamMode=off`
- **THEN** 系统继续按个人先到 15 VP 的原规则判定胜负

### Requirement: 2v2 团队信息展示
系统 SHALL 在 2v2 模式下向玩家展示当前团队目标与团队总分，避免 UI 仍按个人 15 VP 解释胜负。

#### Scenario: 记分板显示两队总分
- **WHEN** 玩家进入 2v2 对局主界面
- **THEN** 记分板显示 1/3 队与 2/4 队当前总分
- **AND** 显示团队目标为 25 VP

#### Scenario: 结束页高亮获胜队成员
- **WHEN** 2v2 对局结束
- **THEN** 结束页按 `gameover.winners` 高亮获胜队全部成员
