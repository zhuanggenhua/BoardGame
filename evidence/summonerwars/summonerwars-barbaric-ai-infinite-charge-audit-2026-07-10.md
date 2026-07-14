# 召唤师战争炽原精灵 AI 无限充能专项审计

## 1. 基本信息

- 对象：炽原精灵 AI 回合、阿布亚·石「祖灵羁绊」（`ancestral_bond`）及逐项规则描述明确为移动后触发的能力
- 日期：2026-07-10
- 作者：Codex
- 文档类型：`audit` / `closeout` / `invalidation`
- 关联任务：真人结束回合后，对方炽原精灵 AI 无限触发获取充能并卡死

## 2. 原始症状与范围

- 用户原始症状：真人结束回合后，对方 AI 使用带雌狮的炽原精灵阵营，无限触发获取能量/充能，游戏卡死。
- 数量级保真：这是无限循环，不是“连续几次”或“手牌较多”。
- 本轮覆盖：
  - `src/games/summonerwars/domain/abilities.ts`
  - `src/games/summonerwars/domain/abilities-barbaric.ts`
  - `src/games/summonerwars/domain/abilities-frost.ts`
  - `src/games/summonerwars/__tests__/flow.test.ts`
  - `src/games/summonerwars/__tests__/entity-chain-integrity.test.ts`
  - AI 合法动作生成、真实命令管线、移动后交互链
- 明确不在本轮范围：
  - 不修改手牌、弃牌换魔力或抽牌规则。
  - 不修改雌狮「威势」的攻击后充能规则。
  - 不调整 AI 评分权重，不增加动作次数上限或超时跳过。

## 3. 结论等级

- 结论：`代表性玩法已验证`
- 判定理由：
  - 已有锁定规则合同、静态定义修复、结构完整性测试、领域行为测试和完整本地 AI 回合回放。
  - 本轮没有重新跑浏览器 E2E 或线上生产反馈回放，因此不扩大为“线上已收口”或“召唤师战争全部 AI 已全面审计”。

## 4. 权威来源与合同状态

- 主真相源：`evidence/summonerwars/b3-p2-rule-text-lock-matrix-2026-07-02.md`
  - 「祖灵羁绊」官方原文：`After this unit moves, you may target a friendly unit within 3 spaces. Boost the target and move all boost from this unit to the target.`
  - 合同状态：`locked-规则原文已锁`
  - 原子子句：C1 本单位移动后触发；C2 可选；C3 目标为 3 格内友方单位；C4 目标获得 1 个充能；C5 将本单位全部充能移动到目标。
- 逐项核对的其他合同：
  - `evidence/summonerwars/b2-p1-rule-text-lock-matrix-2026-07-02.md`：凯鲁尊者「启悟」移动后触发。
  - `evidence/summonerwars/b3-p2-rule-text-lock-matrix-2026-07-02.md`：祖灵法师「祖灵交流」、丝瓦拉「结构变换」、寒冰锻造师「冰霜战斧」均为移动后触发。
- 不需要回图面或重新 OCR：上述合同已锁定，问题是实现没有正确消费合同。

## 5. 复现与根因

### 5.1 修复前复现

- 从真人魔力阶段结束开始，通过真实阶段推进切换到炽原精灵 AI。
- AI 完成正常召唤、移动后，从第 6 步开始重复选择同一动作：
  - `activate-ability:barbaric-summoner-1-4:ancestral_bond:3:2`
- 每次动作都给同一边境弓箭手增加 1 充能。
- 回放 100 步仍未结束，目标充能从 0 增长到 95。
- 这条动作不消耗手牌，因此手牌数量有限不能终止循环。

### 5.2 根因判断

- 根因类型：`共享抽象缺陷`
- 现实含义：
  - 「祖灵羁绊」本应只在阿布亚·石移动完成后进入一次移动后交互。
  - 静态能力定义却错误标成普通主动技能（`trigger: activated`）。
  - AI 合法动作生成器会把所有普通主动技能列成可直接执行的候选。
  - 「祖灵羁绊」正常不需要依赖 `usesPerTurn` 防重复，因为它应由移动后入口约束；被错误直推后，同一状态下可反复充能。
- 因此这是“规则触发类型建模错误，被 AI 合法动作生成器正确消费后形成无限决策循环”。
- 不是：
  - 不是手牌无限或弃牌换魔力循环。
  - 不是雌狮「威势」重复触发。
  - 不是单纯 AI 评分过高；降低评分仍会保留非法的无限候选。

## 6. 修复与逐项合同核对

| 对象 | 规则子句 | 修复前静态合同 | 修复后静态合同 | 真实执行入口 | 负向断言 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 阿布亚·石「祖灵羁绊」 | 移动后可选 3 格内友方目标并转移充能 | `activated` | `afterMove` | 移动后目标交互 | AI 不应直接生成 `ancestral_bond` 主动动作 | 已修复 |
| 凯鲁尊者「启悟」 | 移动后自动充能相邻友方 | `activated` | `afterMove` | 移动后自动结算 | AI 不应把它当按钮技能直推 | 已修复 |
| 祖灵法师「祖灵交流」 | 移动后强制二选一 | `activated` | `afterMove` | 移动后二选一交互 | AI 不应绕过移动直接发动 | 已修复 |
| 丝瓦拉「结构变换」 | 移动后可选友方建筑并推移 | `activated` | `afterMove` | 移动后两步交互 | AI 不应在未移动时直接生成目标动作 | 已修复 |
| 寒冰锻造师「冰霜战斧」 | 移动后自充能或附加士兵 | `activated` | `afterMove` | 移动后选择交互 | AI 不应把附加路径当普通主动按钮 | 已修复 |

- 没有修改 `getActivatableAbilities()` 的通用筛选逻辑，因为它对真正的主动按钮技能仍是正确消费点。
- 没有给「祖灵羁绊」补 `usesPerTurn` 作为止血；那会掩盖触发类型仍错误的根因。
- 原有移动后执行器、目标验证、重复响应拒绝逻辑全部保留。

## 7. 验证证据

### L1 结构证据

- `npx eslint src/games/summonerwars/domain/abilities.ts src/games/summonerwars/domain/abilities-barbaric.ts src/games/summonerwars/domain/abilities-frost.ts src/games/summonerwars/__tests__/flow.test.ts src/games/summonerwars/__tests__/entity-chain-integrity.test.ts`
  - 结果：通过，无输出。
- `npm run typecheck`
  - 结果：通过，`tsc --noEmit` 退出码 0。
- `entity-chain-integrity.test.ts`
  - 主动按钮技能登记中的五个过时条目已移除，`CONFIRMED 无过时条目` 通过。

### L2/L4 领域行为与流程收口证据

- 命令：
  - `npx vitest run src/games/summonerwars/__tests__/flow.test.ts src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --reporter=verbose`
  - 结果：5 个测试文件通过，398 个测试通过。
- 原始失败位点单点复验：
  - `npx vitest run src/games/summonerwars/__tests__/flow.test.ts -t "炽原精灵 AI 完整回合不应重复发动祖灵羁绊无限充能" --reporter=verbose`
  - 结果：1 passed，炽原精灵 AI 完整回合在 77ms 内结束并交回玩家 0；动作列表中没有直接发动「祖灵羁绊」。
- 最终权威状态：
  - AI 回合结束，`currentPlayer` 从 AI 玩家 1 返回真人玩家 0。
  - 不存在重复的 `activate-ability:*:ancestral_bond:*` 动作。
  - 没有依赖动作上限、异常吞掉或自动跳过阶段来完成收口。

## 8. 旧结论失效与漏审复盘

- 失效旧结论：
  - `evidence/summonerwars/b2-p1-implementation-diff-matrix-2026-07-02.md` 曾认为「启悟」定义为 `activated` 也不代表玩家主动技能。
  - `evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 曾把「祖灵羁绊」「结构变换」登记为 `match-with-L4-proof`。
  - `evidence/summonerwars/full-leak-reaudit-master-matrix-2026-07-02.md` 曾把五个移动后能力的触发类型登记为 `activated`。
- 失效原因：
  - 旧审计只验证了移动后的运行时入口和最终效果，没有反向检查静态定义是否会被另一个消费者读取。
  - AI 合法动作生成器正是静态 `trigger` 的第二消费者；因此运行时移动链正确并不能证明静态合同正确。
- 本轮回写：
  - 五个对象均改为 `afterMove`。
  - B2、B3 与总矩阵对应正文已原地修订，不让旧错误继续保留为有效结论。
  - 新增完整 AI 回合回归，把“静态定义 -> AI 候选 -> 命令管线 -> 回合交回”串成同一条验证。
- 规范回代：
  - 现有项目规范已经要求“定义层与执行层双向自洽”和“共享消费者扩审”；本次属于执行时漏过既有门禁，不新增新的全局规则。

## 9. 当前边界

- 可以说：本地已修复炽原精灵 AI 因「祖灵羁绊」触发类型错误导致的无限充能卡死；另有四个能力经逐条规则原文核对，同样明确写为移动后触发，因此一并修正。
- 不能说：所有阵营、所有 AI 场景已经全面审计；线上/生产环境已经部署或反馈状态已回写。
