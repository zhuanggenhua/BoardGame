# SmashUp longzu 三派系统一审计（2026-06-01）

> 2026-06-01 收口回写：本文件代表 longzu 三派系的统一完成态汇总。对象级逐项证明以 [smashup-longzu-deep-audit-2026-06-01.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup/smashup-longzu-deep-audit-2026-06-01.md) 为准。

## 审计范围

- 本任务新增三派系：龙、超级英雄、极客
- 本任务新增基地：
  - 龙之荒芜（`base_wyrms_desolation`）
  - 龙穴（`base_dragons_lair`）
  - 改造洞穴（`base_converted_cave`）
  - 水晶堡垒（`base_crystal_fortress`）
  - 桌游桌（`base_tabletop`）
  - 展会（`base_the_con`）
- 本任务新增运行时资源：
  - `smashup/cards/longzu`
  - `smashup:base7` 中复用的 6 个基地合同
- 当前结论等级：`仍有残余范围`

## 权威来源

- 主真相源：
  - `public/assets/i18n/zh-CN/smashup/cards/longzu.png`
  - `public/assets/i18n/zh-CN/smashup/base/shayu.png`
- intake / 接入合同：
  - [smashup-longzu-intake-contract-2026-05-31.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup/smashup-longzu-intake-contract-2026-05-31.md)
  - [smashup-longzu-implementation-handoff-2026-06-01.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup/smashup-longzu-implementation-handoff-2026-06-01.md)
- 对象级深审：
  - [smashup-longzu-deep-audit-2026-06-01.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup/smashup-longzu-deep-audit-2026-06-01.md)

## L3/L4 真实入口汇总

- 2026-06-02 复验入口：`BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-longzu-audit.e2e.ts`
- 全量 direct E2E：`15 passed (4.0m)`
- 已覆盖的独立交互族：
  - 龙：侧翼攻击、烧毁它、险地、推倒城墙
  - 超级英雄：心灵女士、温和市民、放射暴露、水晶堡垒
  - 极客：维尔的力量、维尔、控制仆从、无限循环、规则咬定者、妙力一击、桌游桌
- 结论：
  - longzu 本轮新增的独立高风险交互 family 已全部具备真实入口证据。
  - 其余对象已在深审矩阵中登记为“共享链仅配置不同”或“无玩家入口 / 自动结算对象”。
  - 但按当前新增派系 skill，仍缺逐对象 `C1/C2/C3...` 子句核销，因此这层证据还不能直接提升成“全面审计完成”。

## 逐派系结论

| 派系 | 对象范围 | L1/L2 | L3/L4 | 当前结论 |
| --- | --- | --- | --- | --- |
| 龙 | 12 张卡 + 2 基地 | 通过 | 独立交互族已补齐；其余对象为合法共享或无玩家入口 | 仍有残余范围 |
| 超级英雄 | 13 张卡 + 2 基地 | 通过 | 独立交互族已补齐；其余对象为合法共享或无玩家入口 | 仍有残余范围 |
| 极客 | 13 张卡 + 2 基地 | 通过 | 独立交互族已补齐；其余对象为合法共享或无玩家入口 | 仍有残余范围 |

## 新增范围硬门禁

- longzu 领域行为测试：
  - `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts src/games/smashup/__tests__/shayuFactionIntake.test.ts --configLoader native`
  - 2026-06-02 复验结果：`5 files / 93 tests passed`
- 类型检查：
  - `npx tsc --noEmit`
  - 2026-06-02 复验结果：`通过`

## 已跑验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts src/games/smashup/__tests__/shayuFactionIntake.test.ts --configLoader native` | `5 files / 93 tests passed` |
| `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-longzu-audit.e2e.ts` | `15 passed (4.0m)` |
| `npx tsc --noEmit` | `通过` |
| `npm run i18n:check` | `失败`，缺失 key 位于 `src/games/dicethrone/ui/InteractionOverlay.tsx:468`，不属于 longzu 阻塞 |

## 残余与边界

- 当前 longzu 玩法审计残余：
  - 仍缺逐对象规则子句 `C1/C2/C3...` 审计表
  - 仍缺按子句粒度的对象级 effect atom / 流程证据核销
  - 因此当前还不能升级为“新增派系全面审计完成”
- 仍可继续做但不阻塞本轮审计完成的事项：
  - `base/longzu.png` 后续如需换成 longzu 独立基地图集，可另起资源迁移任务；当前 6 个基地已合法复用 `shayu` 合同
  - `npm run i18n:check` 的 DiceThrone 缺 key 需要在对应游戏单独修复

## 当前审计结论

本批 longzu 三派系已经从“实现完成 + 行为验证通过”提升为**对象级矩阵与真实入口证据已补齐**。但按当前新增派系 skill，它还**不是全面审计完成**。现在准确口径应为：

- `longzu 三派系仍有残余范围`
- `longzu 三派系已完成对象级矩阵与真实入口补证，但全面审计未收口`

如需逐对象追溯证据，直接以对象级深审矩阵为准。
