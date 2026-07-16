## ADDED Requirements
### Requirement: Summoner Wars AI SHALL 使用统一局面价值函数
Summoner Wars 本地 AI SHALL 使用统一局面价值函数评估当前玩家视角下的战术局面，并将召唤师安全、击杀价值、魔力经济、位置控制、城门/前线和阶段节奏纳入同一评分口径。

#### Scenario: 召唤师安全进入局面价值
- **GIVEN** AI 召唤师在下一对手回合存在明显击杀风险
- **WHEN** AI 评估当前局面
- **THEN** 局面价值 MUST 对该风险施加显著惩罚
- **AND** 可保护、撤退或阻挡的候选动作 MUST 能通过后续差值评估获得收益

#### Scenario: 经济与击杀在同一口径比较
- **GIVEN** AI 同时拥有击杀机会和弃牌换魔力机会
- **WHEN** AI 评估这些动作带来的局面变化
- **THEN** 系统 MUST 能在同一局面价值口径中比较即时击杀收益与长期魔力收益
- **AND** 不得仅按动作类型固定顺序决定

### Requirement: Summoner Wars AI SHALL 使用动作后局面差值
Summoner Wars 本地 AI SHALL 将候选动作投影升级为动作后局面差值，使同一个移动、召唤、攻击或建造动作在不同局势下可获得不同价值。

#### Scenario: 回防动作在高威胁局面获得更高价值
- **GIVEN** AI 召唤师正受到敌方单位直接威胁
- **WHEN** 某个移动或召唤动作能降低该威胁
- **THEN** 该动作的投影分数 MUST 反映威胁降低后的局面价值提升

#### Scenario: 进攻动作在可斩杀局面获得更高价值
- **GIVEN** AI 拥有能击杀敌方召唤师、冠军或关键单位的合法动作
- **WHEN** 该动作被投影评估
- **THEN** 动作后局面差值 MUST 显著高于普通无击杀动作
- **AND** trace MUST 显示击杀或目标价值贡献

### Requirement: Summoner Wars AI SHALL 搜索阶段内短线组合
Summoner Wars 本地 AI SHALL 在预算允许时搜索同一阶段内最多 2-3 步的候选动作序列，用于识别单步评分难以捕捉的短线组合。

#### Scenario: 移动后攻击组合
- **GIVEN** 某单位当前攻击不到高价值目标，但移动后可以攻击
- **WHEN** AI 处于可移动或可攻击相关阶段并启用序列搜索
- **THEN** 系统 MUST 能评估移动后产生的后续攻击机会
- **AND** 不得把第一步移动误判为无收益动作

#### Scenario: 技能或事件牌后续收益
- **GIVEN** 某技能或事件牌本身收益依赖后续攻击、召唤或位置选择
- **WHEN** AI 搜索阶段内动作序列
- **THEN** 系统 MUST 能把后续合法动作收益折算回第一步动作
- **AND** 搜索仍须在预算内停止

### Requirement: Summoner Wars AI SHALL 支持派系策略权重
Summoner Wars 本地 AI SHALL 为不同阵营提供策略 profile，使亡灵、冰霜、哥布林、圣骑、蛮族和诡术能在同一公共评估框架下体现不同打法偏好。

#### Scenario: 阵营 profile 改变候选排序
- **GIVEN** 同一局面中存在多个价值接近的合法动作
- **WHEN** 当前 AI 阵营具有明确策略 profile
- **THEN** profile SHOULD 影响候选动作排序
- **AND** 该影响 MUST 在 trace 中以派系策略贡献呈现

#### Scenario: 派系策略不覆盖安全底线
- **GIVEN** AI 召唤师面临明显击杀风险
- **WHEN** 当前阵营 profile 偏向进攻或经济
- **THEN** 召唤师安全底线 MUST 仍能压过普通进攻或经济偏好
- **AND** AI 不得因 profile 加权稳定忽视可防守动作
