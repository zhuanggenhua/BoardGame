## MODIFIED Requirements

### Requirement: FantasyRealms foundation 必须维持单一实体牌桌方向并留存证据
系统 SHALL 让 `fantasyrealms` 的设计文档、Board 原型和 evidence 共同服务于单一“奇幻实体牌桌”方向，而不是并行保留多套互相冲突的风格稿或多套都自称“当前完成态”的正式桌面壳层。

#### Scenario: 桌面端与紧凑横屏视口共同服务当前正式实现
- **WHEN** 团队交付 `fantasyrealms` 的桌面端、紧凑横屏视口、Board 原型或截图证据
- **THEN** 这些产物 MUST 一眼可辨为同一套牌桌对象层级与视觉家族
- **AND** 系统 MUST 不允许 `1440` 桌面像一套 UI、`1024` 紧凑横屏又像另一套游戏
- **AND** 若存在历史候选实现，必须显式标注为历史，不得与当前完成态混写

### Requirement: FantasyRealms foundation 完成判定必须基于当前工作区真实页面
系统 SHALL 只在当前执行工作区的 `fantasyrealms` 真实页面主路径已经端到端通过，且没有仍阻塞完成口径的已知 UI bug 时，才把 foundation UI 判为完成。

#### Scenario: 只有历史 worktree 截图达标，但当前工作区真实页面未达标
- **WHEN** 历史 worktree、旧分支或旧 preview 的截图显示 `fantasyrealms` 已完成
- **AND** 当前执行工作区真实运行时页面仍未达到同样的 foundation 口径
- **THEN** 系统 MUST 不把当前工作区 `fantasyrealms` 表述为已完成
- **AND** 历史截图只能作为候选参考，不得冒充当前工作区验收证据
