## ADDED Requirements

### Requirement: 在场泰坦必须可以声明主动 ongoing 能力入口
系统 MUST 允许在场泰坦显式声明“由玩家主动触发的 ongoing 能力”，并将该入口与 `special`、`talent` 分离。

#### Scenario: 只有显式声明了主动 ongoing 的泰坦才会出现点击入口
- **GIVEN** 一个在场泰坦具有被动 `ongoing`
- **AND** 它没有声明主动 ongoing 激活入口
- **WHEN** 玩家查看该基地
- **THEN** UI 不能仅因 `abilityTags` 包含 `ongoing` 就把该泰坦高亮成可点击

#### Scenario: 满足条件时控制者可以激活在场泰坦的 ongoing 能力
- **GIVEN** 一个在场泰坦声明了主动 ongoing 激活入口
- **AND** 当前轮到该泰坦控制者行动
- **AND** 该能力自身前置条件满足
- **WHEN** 控制者查看该基地
- **THEN** UI 必须把该泰坦显示为可激活状态
- **AND** 点击后必须走独立于 `USE_TALENT` / `ACTIVATE_SPECIAL` 的命令链

#### Scenario: 不满足条件时不能误走 talent 或 special 入口
- **GIVEN** 一个在场泰坦声明了主动 ongoing 激活入口
- **AND** 当前不是它控制者的回合，或该能力前置条件不满足
- **WHEN** 玩家查看该基地
- **THEN** UI 不能把该能力伪装成可用的 talent 或 special
- **AND** 也不能消耗 `talentUsed`、special 限次或计分阶段 special 入口

### Requirement: Emperor Penguin 必须通过该入口替代常规随从打出
系统 MUST 支持 `penguins_emperor_penguin` 通过在场主动 ongoing 入口，从牌库顶把合法随从打到自身所在基地，并代替一次常规随从打出。

#### Scenario: 企鹅帝皇可用牌库顶随从替代本回合常规随从打出
- **GIVEN** `penguins_emperor_penguin` 当前在某基地上
- **AND** 轮到其控制者的 `playCards` 阶段
- **AND** 控制者仍有常规随从打出额度
- **AND** 控制者牌库顶是一张可合法打到该基地的随从
- **WHEN** 控制者激活该泰坦的主动 ongoing 能力
- **THEN** 系统必须把该随从从牌库顶打到该基地
- **AND** 消耗一次常规随从打出额度
- **AND** 不能把这次结算记为天赋使用

#### Scenario: 牌库顶不是合法随从时企鹅帝皇不能激活
- **GIVEN** `penguins_emperor_penguin` 当前在某基地上
- **AND** 轮到其控制者的 `playCards` 阶段
- **AND** 控制者牌库顶不是可合法打到该基地的随从
- **WHEN** 玩家查看该泰坦
- **THEN** UI 不能把该主动 ongoing 入口显示为可用
