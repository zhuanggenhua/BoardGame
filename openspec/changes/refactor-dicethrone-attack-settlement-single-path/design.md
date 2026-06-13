## Context
DiceThrone 当前攻击结算并不是单一路径模型，而是：

- `offensiveRoll` / `targetingRoll` / `defensiveRoll` 三段 phase exit 都可能继续推进同一笔攻击；
- `postDamage` 内的玩家选择、Token 响应关闭、奖励骰结算，都会让同一笔 `pendingAttack` 再次进入 autoContinue 判定；
- 共享结算语义依赖多个布尔位拼接，例如：
  - `damageResolved`
  - `bonusDiceResolved`
  - `offensiveRollEndTokenResolved`
  - `targetingSelectionPending/Resolved`

这种模型缺少一个明确的、单一权威的“当前攻击已经走到哪一步”。结果是：

- 同一笔攻击的主伤害没有被结构性约束为“最多一次”；
- 新增技能很容易借错字段，靠“看起来能收口”的布尔位把共享战斗流骗过去；
- autoContinue 只能不断补“本拍别继续”的门禁，而不是依据明确阶段推进。

## Goals / Non-Goals
- Goals:
  - 把 DiceThrone 攻击结算收敛为显式阶段模型。
  - 把“主伤害只能落地一次”固化为共享攻击流不变量。
  - 让 `postDamage` 后续选择与奖励骰、Token 响应的语义边界清晰可检验。
- Non-Goals:
  - 不在本提案里重写整个 FlowSystem 通用框架。
  - 不顺带做 UI 栈、动画层或非 DiceThrone 游戏的统一重构。
  - 不调整任何英雄数值和平衡。

## Decisions

### 1. 用显式攻击结算阶段取代布尔位拼接
- 为 `PendingAttack` 定义单一阶段字段，例如：
  - `targeting`
  - `preDefense`
  - `damageApplied`
  - `postDamageChoicePending`
  - `readyToResolve`
  - `resolved`
- 共享结算逻辑按阶段推进，而不是再靠多个布尔位组合推断。

### 2. 主伤害只允许从单一入口落地一次
- `DAMAGE_DEALT` 对应的主攻击伤害只能在“主伤害结算入口”发出。
- `postDamage` / `withDamage` 内的后续选择，只允许改变阶段或补发该选择自身的副作用。
- 除非效果文本明确写着“额外造成 X 伤害”，否则后续选择不得再回到主伤害入口。

### 3. 奖励骰结算与攻击后续选择必须语义拆分
- `bonusDiceResolved` 仅表达奖励骰收口，不再承担“攻击后续选择完成”的共享含义。
- 若攻击在主伤害后仍挂起后续选择，必须使用独立阶段或独立状态字段承载。

### 4. autoContinue 只看显式阶段，不看技能特判
- 当前问题的根因不是某个海盗技能特殊，而是 autoContinue 在错误时点重入。
- 新模型下，autoContinue 只能依据：
  - 当前阶段
  - 当前是否仍有阻塞交互 / 响应窗口 / 待 reduce 结果
  - 当前攻击是否已进入可收口阶段
- 禁止再通过“如果 sourceAbilityId 是某技能就别继续”这类特判收口。

## Risks / Trade-offs
- 风险：DiceThrone 现有 custom action 数量多，很多技能默认依赖当前 `PendingAttack` 布尔位。
  - Mitigation: 先列出所有写入点与消费点，分批迁移到新阶段字段。
- 风险：`targetingRoll`、Token 响应、奖励骰三条链都在用 autoContinue，容易迁一处坏一片。
  - Mitigation: 先补“单次主伤害”总约束测试，再分路径回归。

## Migration Plan
1. 盘点当前 `PendingAttack` 结算相关字段与写入/消费点。
2. 增加显式阶段字段，并让共享流优先按新阶段推进。
3. 迁移 `targetingRoll` + `postDamage` 选择这类已知重复结算路径。
4. 迁移奖励骰与 Token 响应相关路径。
5. 删除已被新阶段替代的旧布尔位分支或收窄其语义。

## Open Questions
- 新阶段字段是字符串枚举，还是最小枚举 + 少量补充字段更稳。
- 是否需要把 `resolvePostDamageEffects()` 也拆成“发副作用事件”和“请求后续选择”两个显式阶段入口。
