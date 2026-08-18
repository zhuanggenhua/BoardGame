# Change: 规则状态与视图边界收口

## Why
DiceThrone 树精大顺子“显示将要打 18 血，但最终没按该数值扣血”的现象，不应该继续被理解成单纯伤害 bug。伤害只是这次暴露出来的数值类型；真正的问题是：规则状态、视图摘要、AI 估算和临时动画/交互值之间的读写边界不清。

如果换成 `betrayal`（小黑屋 / 山屋惊魂），核心数值可能不是伤害，而是骰子结果、属性检定总值、怪物移动骰、事件牌分支或物品重掷后的最终骰面。同类错误会表现为：动画骰面、提示预估、AI 评分或 UI 摘要污染正式检定结果。

开源游戏框架的常见做法不是给每种数值新建一套重型“生命周期对象”，而是更朴素地划清职责：规则状态只由规则入口修改；view / playerView / 客户端同步 / 动画只读或过滤；AI 估算只参与决策，不进入正式规则结果。本提案改为沿用 BoardGame 现有 DomainCore 模型，把边界补严，而不是新增一套万能数值框架。

## What Changes
- 明确 DomainCore 规则状态写入口：会影响合法性、响应窗口、最终事件或正式玩家读数的值，只能由命令 / 事件 / reducer 或对应游戏 domain helper 写入。
- 明确 view 层职责：UI selector、摘要函数、动画状态、hover 文案、日志格式化、playerView 只能从规则状态读取并格式化；不得补算规则真相、不得写回规则状态。
- 明确 AI 职责：`estimate*`、候选行动评分、预估骰值或预估伤害只能是 AI hint；不得进入玩家正式显示、规则门槛或最终结算。
- 先把 DiceThrone 作为首个审计 / 修复样例：找出当前伤害显示、奖励骰、防御、Token、直接伤害、反伤、最终扣血之间是否存在 view/helper/estimate 反向影响规则的问题。
- 把 `betrayal` 骰子结果写入代表性验收样例：正式骰面 / 检定总值只能来自规则提交的骰子状态或事件结果，不能来自动画、预览、提示文案或 AI 计划。
- 新抽象遵守“两个游戏真实复用后再抽”：本轮不默认新增跨游戏万能 primitive；若 DiceThrone 和 Betrayal 都证明需要同一类 helper，再提取轻量共享 helper。

## Impact
- Affected specs:
  - `domain-core`
  - `engine-primitives`
- Affected code:
  - `src/games/dicethrone/domain/core-types.ts`
  - `src/games/dicethrone/domain/damageSummary.ts`
  - `src/games/dicethrone/domain/utils.ts`
  - `src/games/dicethrone/domain/abilityLookup.ts`
  - `src/games/dicethrone/domain/attack.ts`
  - `src/games/dicethrone/domain/effects.ts`
  - `src/games/dicethrone/domain/reducer.ts`
  - `src/games/dicethrone/domain/reduceCombat.ts`
  - `src/games/dicethrone/domain/tokenResponse.ts`
  - `src/games/dicethrone/domain/customActions/*`
  - `src/games/dicethrone/ai*.ts`
  - `src/games/dicethrone/ui/RightSidebar.tsx`
  - `src/games/betrayal/game.ts`（代表性骰子验收样例，不默认迁移全游戏）
  - `src/games/betrayal/Board.tsx`（代表性骰子验收样例，不默认迁移全游戏）
  - 相关 `__tests__/*`
- Non-goals:
  - 不新增跨游戏万能数值框架。
  - 不新增跨游戏通用 UI 状态层。
  - 不让 UI、AI、测试或动画维护第二套规则真相。
  - 不一次性重构所有游戏的全部数值系统。
  - 不改变任何英雄数值、骰面概率、卡牌规则文本、事件牌文本或已实现的商业规则。
