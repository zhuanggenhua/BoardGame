## Context
- 项目已有跨游戏 AI 框架，游戏层通过 `legalActions` 与 scorer 组合决策。
- 当前问题集中在“准备阶段选择”：SmashUp 之前把第一选写成了弱风格评分，Summoner Wars 与 DiceThrone 则仍有按打法/对局风格偏置的倾向。
- 桌游选角/选派系的口径需要区分两类场景：单次选择应随机，只有同一玩家的后续组合选择才允许引入适配判断。

## Goals / Non-Goals
- Goals:
  - 删除或降级会主导结果的固定优先级表。
  - 单选角色/阵营阶段只保留受控随机，不再按打法或对局做倾向判断。
  - SmashUp 的第二派系可以继续使用组合 profile。
  - 测试覆盖“单选池随机分散”和“SmashUp 第二选按组合变化”。
- Non-Goals:
  - 不引入外部实时联网决策；攻略资料只用于沉淀本地启发式。
  - 不把社区 tier list 直接硬编码为全局强度表。
  - 不改变玩家端手动选择规则。

## Decisions
- Decision: 静态强度只能作为弱 tie-break
  - 固定偏好权重单项不得超过组合/对局/风格评分的最小主维度。
  - 禁止出现 `80 - priority * 8`、`40 - priority` 这类足以压过组合判断的公式。
- Decision: 每个候选必须有 strategy tags/profile
  - SmashUp 的后续组合选择可用 profile；单次选择阶段不需要 profile。
  - 单选角色/阵营阶段不应再引入 profile 倾向。
- Decision: 选择算法使用候选池而不是固定序列
  - 先生成合法候选池，排除已占用对象。
  - 单选阶段只使用可复现随机扰动。
  - SmashUp 第二选可在 top band 内按组合 profile 做受控随机。
- Decision: 外部攻略只落为 SmashUp 后续组合 profile
  - 攻略资料不得直接变成“某阵营分数最高”。
  - 只允许用于 SmashUp 第二派系及后续组合判断。
- Decision: SmashUp 首选不使用攻略 profile 排序
  - SmashUp 的第一个派系没有组合上下文，必须只从合法派系身份池中做可复现随机。
  - SmashUp 的攻略/profile 只允许在同一玩家选择第二个派系时参与组合适配，不能回流成第一选的“开局路线弱评分”。
- Decision: AI setup 不选择施工中内容
  - 准备阶段 AI 候选池必须从“已完整可玩/可选”的本地目录生成。
  - SmashUp 过滤领域层标记为实施中的派系；DiceThrone 过滤带 `implementation_in_progress` badge 的角色；Summoner Wars 使用 `FACTION_CATALOG.selectable` 作为阵营池。
  - 负分降权不能替代候选池过滤；施工中对象默认不应进入 AI 的可选 action 列表。

## Game-Specific Direction
- SmashUp:
  - 第一选应在合法派系身份池中随机分散，避免在没有搭配对象时伪造“开局路线强弱”。
  - 第二选才参考攻略/profile 沉淀出的组合适配，重点补足第一选短板，例如铺场配额外行动、爆发配引擎、控制配计分能力。
  - `robots` / `wizards` 可以因为“铺场 + 行动连锁”在某些组合中合理出现，但不能作为默认首选固定出现。
- Summoner Wars:
  - 单选阵营保持随机，不引入打法或对手克制倾向。
- DiceThrone:
  - 单选角色保持随机，不引入对手/队友/风格倾向。
  - 已标记未完成或 under construction 的角色默认不进入 AI 候选池，除非用户显式启用。

## Risks / Trade-offs
- 攻略资料存在版本差异或主观倾向。
  - Mitigation: 只抽象为风格标签，不硬编码 tier。
- 分布测试可能因随机扰动不稳定。
  - Mitigation: 使用固定 matchId/seed 的可复现样本集合，测试统计边界而不是单次结果。
- 选角策略过复杂会增加维护成本。
  - Mitigation: profile 数据独立于行动决策 scorer，避免污染回合内 AI。

## Verification
- 单元测试：
  - SmashUp：首个派系由合法身份池的可复现随机决定；已有一个派系后，第二选能解释为组合适配。
  - Summoner Wars：多 seed 下在 `selectable` 阵营池内随机分散。
  - DiceThrone：在已完成角色池内随机分散，不包含施工中角色。
- OpenSpec:
  - `openspec validate refactor-game-ai-setup-composition-selection --strict --no-interactive`
