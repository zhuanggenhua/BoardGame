# Mega Troopers L2 行为证据（baokemeng / Big in Japan）

日期：2026-05-26

## 范围

- 派系：`mega_troopers`
- 能力实现：`src/games/smashup/abilities/mega_troopers.ts`
- 行为测试：`src/games/smashup/__tests__/abilities/mega-troopers.test.ts`
- 注册入口：`src/games/smashup/abilities/index.ts`

## 结论等级

- 当前等级：行为级已验证（L2），并已有代表性 L3/L4 真实入口证据。
- 已验证范围：标准行动、Megabot 天赋入口、beforeScoring / afterScoring special、Black Trooper special 触发加力、Moon Dumpster / Juice Bar 基地能力、`Plan For More!` 剩余牌排序交互。
- 未达到等级：逐卡全量 L3/L4 浏览器覆盖尚未补；当前 L3/L4 为代表性高风险入口覆盖。

## 已覆盖对象

| 对象 | L2 结论 | 证据 |
| --- | --- | --- |
| `mega_troopers_form_megabot` | 通过 | 按牌文本把 Megabot 打到至少有 2 个己方随从的基地，不复用 titan special 的 3 随从限制。 |
| `mega_troopers_red_trooper` | 通过 | 天赋可把已在场 Megabot 移到自身基地。 |
| `mega_troopers_lightning_crystal` | 通过 | 可摧毁基地持续行动或随从附着行动。 |
| `mega_troopers_its_blitzin_time` | 通过 | 己方随从直到回合结束 +3。 |
| `mega_troopers_mega_attack` | 通过 | 消灭力量低于本基地己方随从总力量的随从。 |
| `mega_troopers_plan_for_more` | 通过 | 展示牌库顶三张，拿走任意数量随从，可将其中一张作为额外随从打出；其余牌通过 `mega_troopers_plan_for_more_order` 按玩家选择顺序回到牌库顶。 |
| `mega_troopers_beta_6` / `mega_troopers_blue_trooper` | 通过 | 计分前 special 给自身临时力量，并发出 special 使用事件。 |
| `mega_troopers_green_trooper` | 通过 | 计分前 special 给本基地立即额外随从额度。 |
| `mega_troopers_yellow_trooper` | 通过 | 计分前 special 可把另一个己方随从移到这里。 |
| `mega_troopers_pink_trooper` | 通过 | 计分后 special 可让这里力量 3 或以下己方随从回手。 |
| `mega_troopers_lightning_rescue` | 通过 | 计分前 special 可把一个行动作为额外行动打出。 |
| `mega_troopers_blitzing_sword_attack` | 通过 | 有 Megabot 且自己不是第一名时，消灭这里力量 4 或以下随从。 |
| `mega_troopers_power_pose` | 通过 | 自己是第一名的基地计分后抽两张。 |
| `mega_troopers_black_trooper` | 通过 | 每次本玩家使用 special 后，Black Trooper 本回合 +1。 |
| `base_moon_dumpster` | 通过 | 基地揭示时展示每名玩家牌库顶；若是随从则额外打到这里。 |
| `base_juice_bar` | 通过 | 计分前按本基地已使用 special 次数，给一个随从 +2 倍数力量。 |

## 已跑验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/mega-troopers.test.ts --configLoader native`
  - 结果：1 file / 16 tests passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/magical-girls.test.ts src/games/smashup/__tests__/abilities/itty-critters.test.ts src/games/smashup/__tests__/abilities/kaiju.test.ts src/games/smashup/__tests__/abilities/mega-troopers.test.ts src/games/smashup/__tests__/abilityRegistry.test.ts src/games/smashup/__tests__/abilityInteractionRegistry.test.ts --configLoader native`
  - 结果：6 files / 82 tests passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native`
  - 结果：1 file / 27 tests passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native`
  - 结果：1 file / 7 tests passed。
- `npm run typecheck`
  - 结果：通过。
- `npx eslint src/games/smashup/abilities/mega_troopers.ts src/games/smashup/__tests__/abilities/mega-troopers.test.ts src/games/smashup/abilities/index.ts src/games/smashup/data/factions/mega_troopers.ts src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts`
  - 结果：0 errors。
- `npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts`
  - 结果：5 tests passed；`Plan For More!` 真实手牌行动入口覆盖展示顶三、额外打出与排序回顶。

## 残余范围

- Mega Troopers 新文件仍使用 legacy ability / interaction 注册风格；行为审计已将本批新增文件列入 legacy 迁移边界，后续可迁移到新 runtime 注册方式。
- 尚未补逐卡全量 L3 真实入口 E2E；当前 L3/L4 覆盖 `Plan For More!` 与 `Beta 6` 代表性高风险入口，基地能力由统一 E2E 的 `Juice Bar`/special 计数链间接覆盖。
