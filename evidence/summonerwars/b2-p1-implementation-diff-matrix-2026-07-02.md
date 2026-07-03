# 召唤师战争 B2 P1 充能准备实现对照（2026-07-02）

## 目的

- 承接 `b2-p1-rule-text-lock-matrix-2026-07-02.md` 的已锁录入合同：`prepare`、`inspire`。
- 本文件只做实现对照和差异分流；不重新读图、不 OCR、不重录规则原文。
- 规则真相源以 B2 locked 合同为准；若实现审计发现合同缺字段或对象归属错误，先回写合同状态，不在实现阶段猜规则。

## 已锁规则基线

| 对象 | 中文承载卡 | 官方原文摘要 | 原子子句基线 |
| --- | --- | --- | --- |
| `prepare` | 梅肯达·露、边境弓箭手 | Instead of moving this unit, you may boost it. | 代替本单位移动；可选；给本单位 1 个充能；卡面未写每回合一次 |
| `inspire` | 凯鲁尊者 | After this unit moves, boost each friendly adjacent unit. | 本单位移动后；每个相邻友方单位；每个目标 1 充能；强制触发；卡面未写每回合一次 |

## 实现对照矩阵

| 对象 | 当前实现入口 | 对齐项 | 疑点/缺口 | 分流状态 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| `prepare` | `src/games/summonerwars/domain/abilities-barbaric.ts:109-138` | `trigger: activated`、`requiredPhase: move`、`costsMoveAction: true`、未移动校验、给自身 1 充能，能表达“代替本单位移动并给自己充能” | 已补 L4 验证：完整管线执行准备后无交互残留，自身 +1 充能且 `hasMoved=true`；准备后移动命令被拒绝且不二次充能。`usesPerTurn: 1` 仍记录为实现保护，不作为卡面原文子句 | `match-with-L4-proof` | 已完成真实管线行动经济补证；后续只在 UI 行动入口与该行动经济不一致时追加专项 |
| `inspire` | 定义入口：`src/games/summonerwars/domain/abilities-barbaric.ts:165-184`；实际自动结算入口：`src/games/summonerwars/domain/execute.ts:271-290` | 移动后自动遍历四向相邻格；只给同玩家单位加 1 充能；`requiresButton: false`，符合强制/自动结算方向 | 已补 L4 验证：完整管线移动后不生成交互，只给移动后相邻友方单位各 +1；不作用于自身、敌方相邻单位、只在移动前相邻但移动后非相邻的友方单位 | `match-with-L4-proof` | 已完成真实移动入口与目标全集边界补证；后续只在 UI 回放层重复展示自动充能时追加专项 |

## 分流边界

- 当前没有把 B2 判为 bug；两项完整管线 L4 验证均通过，首轮实现对照从 `proof-needed` 回写为 `match-with-L4-proof`。
- `prepare` 的每回合一次字段不能倒推成卡面规则；本轮只证明当前行动经济与“代替移动”一致，不删除字段。
- `inspire` 的定义层 `activated` 不直接等于玩家主动技能；当前事实是移动执行链里有自动结算入口，最小验证证明移动后状态对齐。
- 后续若 UI 入口、刷新/回放或展示层发现冲突，再追加 UI 层专项；不再把 B2 已 locked 对象回录入层。

## 最小验证

- 测试文件：`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts`。
- 新增验证：`[prepare] 准备后应等价消耗移动并给自身1个充能`、`[prepare] 完整管线中应直接充能并消耗本次移动`、`[inspire] 凯鲁尊者移动后应强制充能每个相邻友方单位`、`[inspire] 完整管线中应只充能移动后相邻友方且不作用自身`。
- 命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "prepare|inspire|准备|鼓舞|启悟"`。
- 结果：1 个测试文件通过；9 passed、125 skipped。
