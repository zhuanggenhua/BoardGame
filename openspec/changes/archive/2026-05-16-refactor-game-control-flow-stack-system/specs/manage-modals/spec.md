## ADDED Requirements
### Requirement: 阻塞式游戏弹窗前台 SHALL 由 modal stack 单点管理
系统 SHALL 使用 modal stack 作为阻塞式游戏弹窗的唯一前台 ownership。任意时刻只能有一个 blocking modal 处于前台可交互状态；当更高优先级的阻塞 UI 打开时，旧前台 MUST 退到下一层，待顶层关闭后再恢复。

#### Scenario: token 响应与目标选择不并列抢前台
- **GIVEN** 当前已有一个 token response blocking modal
- **AND** 同一条业务链稍后又出现目标选择或 simple-choice blocking modal
- **WHEN** 新的 blocking modal 打开
- **THEN** modal stack MUST 让新的 blocking modal 成为唯一前台
- **AND** 旧 modal MUST 留在栈中等待恢复，而不是与新 modal 并列可交互

#### Scenario: 顶层关闭后恢复下层前台
- **GIVEN** 一个低层 blocking modal 正在等待恢复
- **WHEN** 当前栈顶 blocking modal 被解决或关闭
- **THEN** modal stack MUST 恢复下层 modal 为新的前台
- **AND** 恢复顺序 MUST 与入栈顺序一致

### Requirement: modal stack SHALL 只管理前台 ownership，不拥有业务续链
modal stack SHALL 只负责视觉前台与交互层级，不得承担业务结算是否完成、interaction 是否应自动 resolve、response window 是否应自动关闭等主链决策。

#### Scenario: 关闭弹窗不等于业务已结算
- **GIVEN** 一个 blocking modal 对应某个 interaction 或 response window
- **WHEN** 该 modal 因栈切换、路由恢复或用户关闭而离开前台
- **THEN** modal stack MAY 更新前台 ownership
- **BUT** 系统 MUST 仍以所属 interaction / response window / resolution frame 的状态判断业务是否完成
