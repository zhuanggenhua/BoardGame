# SmashUp baokemeng / Big in Japan 统一审计（2026-05-26）

> 2026-05-26 收口回写：本文件现在代表“统一汇总后的完成态”。对象级逐项证明以 `evidence/smashup/baokemeng-big-in-japan-deep-audit-2026-05-26.md` 为准。

## 审计范围

- 本任务新增四派系：`Magical Girls`、`Kaiju`、`Itty Critters`、`Mega Troopers`
- 本任务新增基地：`base_akihabara_high`、`base_q_point`、`base_tokyo`、`base_kaiju_island`、`base_critter_combat_club`、`base_itty_city`、`base_moon_dumpster`、`base_juice_bar`
- 本任务新增运行时资源：`smashup/cards/baokemeng`、`smashup/base/baokemeng`
- 当前结论等级：`对象级全面审计完成`

## 权威来源

- 主真相源：`public/assets/i18n/zh-CN/smashup/cards/baokemeng.png`、`public/assets/i18n/zh-CN/smashup/base/baokemeng.png`
- Intake 合同：`evidence/smashup/baokemeng-big-in-japan-intake-2026-05-25.md`
- 行为证据：
  - `evidence/smashup/baokemeng-itty-critters-l2-2026-05-26.md`
  - `evidence/smashup/baokemeng-kaiju-l2-2026-05-26.md`
  - `evidence/smashup/baokemeng-magical-girls-l2-2026-05-26.md`
  - `evidence/smashup/baokemeng-mega-troopers-l2-2026-05-26.md`
- 对象级深审：
  - `evidence/smashup/baokemeng-big-in-japan-deep-audit-2026-05-26.md`

## L3/L4 真实入口汇总

- 全量 direct E2E：`35 passed (3.9m)`
- 覆盖的独立交互族已包含：
  - Itty Critters：主动基地能力、临时随从回底、牌库/弃牌选择、可选跳过、移动家族、基地 trigger/button
  - Kaiju：基地行动回收、泰坦移动、multi destroy、single destroy、基地临时总力量、ongoing 回手重打
  - Magical Girls：多选回手、单目标消灭、回手+额外行动、generic choice、extra minion 分支、搜索家族、talent 移动、Q Point 计分前保留
  - Mega Troopers：展示+排序、行动摧毁、临时加力、按己方总力量消灭、Megabot 打出、beforeScoring special、afterScoring special、special->extra action、基地按 special 次数加力

## 逐派系结论

| 派系 | 对象范围 | L0/L1 | L2 | L3/L4 | 当前结论 |
| --- | --- | --- | --- | --- | --- |
| Itty Critters | 16 张卡 + 2 基地 | 通过 | 通过 | 独立交互族已补齐；其余对象合法共享 | 对象级完成 |
| Kaiju | 14 张卡 + 2 基地 | 通过 | 通过 | 独立交互族已补齐；其余对象合法共享 | 对象级完成 |
| Magical Girls | 16 张卡 + 2 基地 | 通过 | 通过 | 独立交互族已补齐；其余对象合法共享 | 对象级完成 |
| Mega Troopers | 14 张卡 + 2 基地 | 通过 | 通过 | 独立交互族已补齐；其余对象合法共享 | 对象级完成 |

## 新增范围硬门禁

- `abilityBehaviorAudit.test.ts`：`27 tests passed`
- `interactionTargetTypeAudit.test.ts`：`7 tests passed`
- `baokemengFactionIntake.test.ts`：静态合同通过
- `criticalImageResolver.test.ts`：图集 resolver 覆盖通过

## 已跑验证

| 命令 | 结果 |
| --- | --- |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/magical-girls.test.ts src/games/smashup/__tests__/abilities/itty-critters.test.ts src/games/smashup/__tests__/abilities/kaiju.test.ts src/games/smashup/__tests__/abilities/mega-troopers.test.ts src/games/smashup/__tests__/abilityRegistry.test.ts src/games/smashup/__tests__/abilityInteractionRegistry.test.ts --configLoader native` | `6 files / 82 tests passed` |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native` | `1 file / 27 tests passed` |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native` | `1 file / 7 tests passed` |
| `npm run typecheck` | `通过` |
| `npx eslint e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts` | `0 errors`，仅既有 `no-explicit-any` warnings |
| `npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts` | `35 passed (3.9m)` |

## 残余与边界

- 当前批次玩法审计残余：`无`
- 仍可继续做但**不阻塞本轮审计完成**的事项：
  - legacy ability / interaction 注册迁移
  - 历史 `zombies.ts` runtime 债务

## 当前审计结论

本批 `baokemeng / Big in Japan` 已从“结构接入 + L2 行为覆盖”提升为**对象级全面审计完成**。现在所有对象都满足以下二选一：

1. 已有 direct L3/L4 真实入口证据；
2. 已登记为“同一共享链路且差异仅为配置不同”的合法共享对象。

因此可以对外表述为：`baokemeng 四派系对象级审计完毕`。
