## ADDED Requirements

> 本 change 只收口 DiceThrone 4 人 / 2v2 “玩家目标交互”第一批高风险能力，不代表所有多人玩家目标效果已被穷举审计。

### Requirement: Batch 1 任意玩家授 token 交互兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确支持 Batch 1 范围内“给任意玩家 token”的技能交互；玩家选择面板、验证层与执行层 MUST 共同按真实候选玩家集工作，不得退化为 2 人 `self/opponent` 假设。

#### Scenario: Vengeance II 在 4 人模式下展示完整候选集并授予队友 Retribution
- **GIVEN** 4 人 / 2v2 对局中，圣骑士触发 `Vengeance II`
- **WHEN** 系统打开玩家选择交互
- **THEN** 面板展示所有合法候选玩家，并能稳定区分 `self / ally / enemy`
- **AND** 当玩家选择合法队友并确认后，系统授予该队友 `Retribution`

#### Scenario: Consecrate 在 4 人模式下授予任意玩家多 token
- **GIVEN** 4 人 / 2v2 对局中，圣骑士打出 `Consecrate`
- **WHEN** 玩家选择一名合法目标并确认
- **THEN** 系统 MUST 一次性授予该目标 `Protect / Retribution / Crit / Accuracy`
- **AND** host 页与目标页都能同步观察到相同的 token 结果

#### Scenario: 非法授 token 目标会被验证层拒绝
- **GIVEN** 当前存在“给任意玩家 token”的交互
- **WHEN** 客户端提交不在 `targetPlayerIds` 内的目标玩家
- **THEN** 验证层 MUST 拒绝该命令
- **AND** 不得仅因“存在 pendingInteraction”就默认放行

### Requirement: Batch 1 任意玩家移除状态交互兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确支持 Batch 1 范围内“移除 1 个状态 / token”与“移除一名玩家全部可移除状态 / token”的交互；合法目标约束与目标页权威态同步 MUST 一致。

#### Scenario: remove-status-1 只允许选择合法状态拥有者并移除目标效果
- **GIVEN** 4 人 / 2v2 对局中触发 `remove-status-1`
- **WHEN** 系统打开状态拥有者与状态效果选择交互
- **THEN** 面板只展示合法候选玩家及其可移除状态 / token
- **AND** 当玩家确认后，目标效果会从权威状态中被移除

#### Scenario: remove-all-status 会拦截空目标并清空可移除效果
- **GIVEN** 4 人 / 2v2 对局中触发 `remove-all-status`
- **WHEN** 玩家尝试选择没有任何可移除状态 / token 的目标
- **THEN** 确认操作 MUST 保持禁用
- **AND** 当玩家改为选择合法目标并确认后，该目标的所有可移除状态 / token 都会被清空

### Requirement: Batch 1 状态与可移除 token 转移交互兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确支持 Batch 1 范围内“从一名玩家转移状态或可移除 token 到另一名玩家”的双阶段交互；共享 UI、验证层与执行层 MUST 一致理解来源玩家、目标玩家与可转移效果。

#### Scenario: Transfer Status 在 4 人模式下以四宫格完成双阶段选择
- **GIVEN** 4 人 / 2v2 对局中触发 `Transfer Status`
- **WHEN** 玩家先完成来源状态 / token 选择，再进入目标玩家选择阶段
- **THEN** 第二阶段仍展示同一组 4 张玩家卡
- **AND** 已选来源玩家卡会以锁定禁用态保留在原位
- **AND** 其余合法目标玩家卡可继续被选择

#### Scenario: Transfer Status 不能把效果转回来源玩家自己
- **GIVEN** 当前存在状态 / token 转移交互
- **WHEN** 客户端把 `toPlayerId` 提交为 `fromPlayerId`
- **THEN** 验证层 MUST 拒绝该命令
- **AND** 不得执行任何状态或 token 转移

#### Scenario: 不可移除 token 不会被 Transfer Status 转移
- **GIVEN** 目标玩家身上同时存在可移除与不可移除 token
- **WHEN** 玩家尝试触发状态 / token 转移
- **THEN** 系统只允许转移可移除状态 / token
- **AND** 不可移除 token 必须被排除在可选与可执行结果之外

### Requirement: Batch 1 无单一敌方目标的无伤害技能流程兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确处理 Batch 1 范围内“无单一敌方目标、但仍会触发玩家交互或 postDamage 效果”的无伤害技能；攻击流程 MUST 按实际效果阻塞与继续，不得误走普通单体攻击分支。

#### Scenario: 无默认 defender 的无伤害技能不会误进 targetingRoll
- **GIVEN** 4 人 / 2v2 对局中触发一个没有默认 defender 的无伤害技能
- **WHEN** 该技能需要进入玩家选择交互
- **THEN** 系统不得因为当前是 4 人模式就强制进入 `targetingRoll`
- **AND** 攻击流程应停在交互前，等待玩家完成选择

#### Scenario: INTERACTION_REQUESTED 会阻塞该类无伤害技能的后续推进
- **GIVEN** 上述技能在 `preDefense` 阶段发出了 `INTERACTION_REQUESTED`
- **WHEN** 交互尚未完成
- **THEN** 攻击流程 MUST 保持阻塞
- **AND** 不得提前推进到后续 phase 或吞掉交互

#### Scenario: 无默认 defender 的无伤害技能仍会执行 postDamage 结果
- **GIVEN** 上述技能交互已完成
- **WHEN** 攻击流程继续结算
- **THEN** 系统仍会执行该技能的 `postDamage` 效果
- **AND** 相关资源或 token 结果会正确写回权威状态
