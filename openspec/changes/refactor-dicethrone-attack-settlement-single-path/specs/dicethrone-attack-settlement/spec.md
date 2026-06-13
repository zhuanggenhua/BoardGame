## ADDED Requirements

### Requirement: DiceThrone 攻击主伤害单一路径结算
DiceThrone 系统 SHALL 将同一笔攻击的主伤害结算为单一路径；在该笔攻击生命周期内，主伤害最多只能落地一次。

#### Scenario: 4 人 targetingRoll 后的 postDamage 选择不会重复造成主伤害
- **GIVEN** 4 人 / 2v2 对局中，一笔攻击已经完成 `targetingRoll` 并对目标队伍落地主伤害
- **AND** 该攻击随后进入 `postDamage` 后续选择
- **WHEN** 攻击方完成该后续选择
- **THEN** 系统不得再次为同一笔主攻击发出第二条等价的 `DAMAGE_DEALT`
- **AND** 该笔攻击只会进入收口阶段并最终 `ATTACK_RESOLVED`

#### Scenario: 攻击后续选择只推进阶段，不回到主伤害入口
- **GIVEN** 一笔攻击的主伤害已经落地
- **AND** 该攻击仍挂有技能自己的后续选择
- **WHEN** 玩家完成该选择
- **THEN** 系统只允许推进攻击结算阶段或执行该选择自身副作用
- **AND** 不得重新进入“主伤害落地”入口

### Requirement: DiceThrone 攻击结算阶段必须显式建模
DiceThrone 系统 SHALL 为攻击结算提供显式阶段模型，用于表达目标确认、主伤害落地、攻击后续选择与最终收口，而不是依赖多个布尔位拼接推断。

#### Scenario: 当前攻击等待后续选择时存在明确阶段
- **GIVEN** 一笔攻击的主伤害已经落地
- **AND** 该攻击仍在等待 `postDamage` 或 `withDamage` 内触发的后续选择
- **WHEN** 共享战斗流读取当前攻击状态
- **THEN** 系统能直接判定其处于“等待攻击后续选择”的显式阶段
- **AND** 不需要通过多个布尔位组合反推出该语义

#### Scenario: 奖励骰结算完成与攻击后续选择完成语义分离
- **GIVEN** 一笔攻击包含奖励骰结算
- **AND** 另一笔攻击包含主伤害后的后续选择
- **WHEN** 共享战斗流判断两者是否可直接收口
- **THEN** 系统 MUST 分别识别“奖励骰已结算”和“攻击后续选择已完成”
- **AND** 不得要求两种语义共用同一个字段才能正确推进

### Requirement: DiceThrone autoContinue 不得在待 reduce 的攻击后续选择上重入主伤害
DiceThrone 共享战斗流 SHALL 在当前攻击的后续选择结果尚未 reduce 进权威状态前，阻止 autoContinue 重入主伤害路径。

#### Scenario: 同拍交互响应不会触发第二次主伤害
- **GIVEN** 当前攻击的后续选择刚在同一拍内完成交互响应
- **AND** 该选择对应的 `CHOICE_RESOLVED` 结果尚未 fully reduce 进权威状态
- **WHEN** autoContinue 评估是否继续推进当前 phase
- **THEN** 系统 MUST 等待该结果落地
- **AND** 不得在这一拍再次推进到主伤害入口

#### Scenario: 后续选择结果落地后只允许进入收口阶段
- **GIVEN** 当前攻击的后续选择结果已经 reduce 进权威状态
- **WHEN** autoContinue 再次评估是否继续推进当前攻击
- **THEN** 若该攻击的主伤害已落地，系统只允许进入收口阶段
- **AND** 不得重新发出该笔攻击的主伤害
