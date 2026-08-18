## Context
DiceThrone 当前暴露的症状是“显示伤害”和“最终扣血”不一致，但问题不只属于伤害领域。现状中，同一个规则数字可能被多个层面同时表达：

- 规则状态：决定命令是否合法、响应窗口是否开启、最终事件如何归约。
- 视图说明：右侧栏、弹窗、动画、日志或 hover 文案展示给玩家看的读数。
- AI 粗评分：机器人为了选择动作预估收益。
- 临时交互 / 动画状态：骰子动画、bonus dice 展示、确认弹窗等过程数据。
- 测试注入 / debug 状态：为了构造局面或观察问题而存在的辅助数据。

当这些层面的数字长得很像，却没有显式区分“谁能改规则状态、谁只能读、谁只是估算”时，就会出现本轮这类错位：玩家看到的数值来自一条路径，最终结算来自另一条路径，甚至只读 helper 反过来影响真实计算。

## Open-Source Reference Alignment
本提案按开源游戏 / 引擎的共同形态收窄：

- boardgame.io：游戏状态在 `G` / `ctx` 中，`moves` 是改变状态的入口，`playerView` 用于按玩家裁剪状态。
- Colyseus：Room 是权威状态拥有者；客户端发消息请求改变，服务端处理消息并修改 state，客户端监听同步结果。
- OpenRA：玩家输入被建模成 Orders，同步的是输入和确定性模拟；渲染 tick 与世界 tick 分离，并区分 gameplay shared random 与 local visual random。

这些参考都没有要求“每个数值都建一个通用生命周期对象”。它们共同强调的是：规则状态的写入口要少且明确，视图/客户端/渲染/AI 不能抢规则真相。

## Goals / Non-Goals
- Goals:
  - 沿用现有 DomainCore：命令 / 事件 / reducer 是规则状态写入主路径。
  - 让 UI、动画、AI、debug、测试 helper 和规则结算之间的读写方向可审计。
  - 让 DiceThrone 伤害链先按这个边界审计和修复。
  - 让 `betrayal` 骰子链成为非伤害代表样例，证明框架不把问题限定为攻击或伤害。
  - 给新游戏提供最小默认门槛：核心数值必须说明规则写入口，view/AI/animation 只能读或估。
- Non-Goals:
  - 不新增跨游戏万能 primitive。
  - 不要求每个简单瞬时数字都建立持久对象。
  - 不要求所有游戏同轮迁移。
  - 不把 DiceThrone 伤害结构当成其他游戏固定模板。

## Responsibility Ledger
本次迁移必须保留或明确替换以下旧合同：

| 现实能力 | 旧 Interface | 消费者 | 迁移后承载 |
| --- | --- | --- | --- |
| 右侧展示当前伤害 | `getCurrentDamageSummary()` | 真人玩家 UI、UI 测试 | 只读 selector：只从当前规则状态读，不回读 AI estimate 或 UI-only 字段 |
| 结算攻击伤害 | `resolveAttack()` + `DAMAGE_DEALT` | 规则执行、ActionLog、动画、HP reducer | DiceThrone domain/reducer 的单一路径 |
| 奖励骰改变伤害 | bonus dice settlement + `pendingAttack.bonusDamage` | 攻击技能、奖励骰确认、UI、AI | 奖励骰先作为规则结果提交，再由 DiceThrone domain 写入本次攻击状态 |
| Token 响应当前伤害 | `pendingDamage.currentDamage` | 响应窗口、Token 校验、AI 响应 | 响应窗口读取并请求 domain 写入同一笔待结算伤害 |
| 直接伤害 / 反伤 / 维持阶段自伤 | custom action 直接发 `DAMAGE_DEALT` | 规则执行、ActionLog、动画、HP reducer | 保持直接事件路径，但不得污染攻击状态或 UI 摘要 |
| AI 粗估伤害 | `estimateDamage` | AI 选技能与行动评分 | AI-only hint，不进入 UI 正式读数、规则门槛或最终结算 |
| 小黑屋事件 / 属性检定骰子 | roll command / pending roll / action log | 规则执行、事件分支、UI、AI、重掷物品 | 规则提交的 roll/pending 结果；动画骰面和提示预估只读 |
| 小黑屋怪物移动骰 / 攻击骰 | monster movement / attack command | 怪物行动、伤害、UI、AI | 规则提交的骰子结果驱动移动/攻击；视图只展示提交结果 |

## Decisions

### Decision 1: 用现有 DomainCore 边界，不新增万能数值框架
BoardGame 已经有命令、事件、reducer、playerView / UI selector 的分层。正确修法是让 DiceThrone 和后续游戏遵守这个分层，而不是新增一个平行的“权威事实框架”。

### Decision 2: 只读 selector 可以计算，但只能从规则状态计算
UI 摘要、日志、tooltip、playerView 可以做格式化和汇总；它们不能为了“显示完整”去查技能定义补算当前正式值，也不能读取 AI estimate 或动画状态补规则缺口。缺少规则状态时，应暴露为缺数据 / 合同错误，而不是猜一个值。

### Decision 3: AI hint 和视觉状态必须命名隔离
动画骰面、hover 预估、AI 评分、候选行动收益、debug 文案和测试说明都可以存在，但命名和类型要暴露其非权威身份。任何规则校验、响应窗口、最终结算和玩家正式读数都不得从这些值读取。

### Decision 4: 先审计现有写入口，再决定是否抽 helper
如果 DiceThrone 只是某几个 helper 越权回读，就修 helper 和测试；如果多个游戏出现同一种“selector 反向喂规则”缺陷，再抽轻量共享 helper。抽象必须服务至少两个真实接入点，不能为了概念完整而创建。

## Migration Plan
1. 用调用图审计 DiceThrone：找出 UI summary、AI estimate、bonus dice 展示、pending damage、final reducer 之间的读写方向。
2. 先加负向测试：UI summary / AI estimate / animation-local dice 不能作为规则门槛或最终结算输入。
3. 修 DiceThrone 越权读写：`getCurrentDamageSummary()` 只能读规则状态；规则门槛和最终结算不得读 `estimateDamage` 或 UI-only 参数。
4. 保留直接伤害、反伤、维持阶段伤害的直接事件路径，但补测试证明它们不会污染攻击状态。
5. 为 `betrayal` 补代表性骰子验收：正式骰面/检定总值来自规则提交结果；动画骰面、预览文案和 AI 候选行动不得改变事件分支或最终状态。
6. 只有当 DiceThrone 与 `betrayal` 都需要同一类读模型约束时，再提取轻量共享 selector / assertion helper。
7. 更新项目知识库中的状态管线 / 伤害管线 / 骰子系统相关规范，说明新游戏必须声明“规则写入口”和“view/AI/animation 只读边界”。

## Risks / Trade-offs
- 风险：继续把问题命名成“权威事实生命周期”，会过度设计。
  - Mitigation: 改为 DomainCore 边界收口；新增抽象必须有两个真实游戏复用证据。
- 风险：只改 DiceThrone 可能漏掉小黑屋这类骰子型游戏。
  - Mitigation: `betrayal` 只做代表性骰子护栏，不默认扩大到全游戏重构。
- 风险：selector 仍可能悄悄查定义补算规则值。
  - Mitigation: 负向测试 + 命名约束：selector 缺规则状态时失败或显示缺数据，不猜值。

## Open Questions
- DiceThrone 当前是否只需要修 `damageSummary` / `estimateDamage` 越权路径，还是需要收敛更多 pending damage 写入口。
- `betrayal` 当前 pending roll 结构是否已经满足“规则结果提交后只读展示”，还是需要后续单独 proposal。
- 是否需要在新游戏 OpenSpec foundation 模板里加一项轻量检查：“核心数值的规则写入口是什么，view/AI/animation 是否只读”。
