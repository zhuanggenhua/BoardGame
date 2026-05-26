# SmashUp baokemeng / Big in Japan - Kaiju L2 行为证据

日期：2026-05-26

## 结论等级

- 当前等级：行为级已验证（L2），并已有代表性 L3/L4 真实入口证据。
- 已验证范围：Kaiju 卡牌主要 onPlay / ongoing power / Titan 移动与基地替换链路；Tokyo / Kaiju Island 两个基地的总力量语义。
- 未达到等级：逐卡全量 L3/L4 浏览器覆盖尚未补；当前 L3/L4 由统一审计覆盖 Tokyo 真实手牌行动入口。

## 规则对象与实现位置

| 对象 | 子句 | 实现位置 | 验证 |
| --- | --- | --- | --- |
| `kaiju_kaiju_conflict` | 额外打出两个行动 | `src/games/smashup/abilities/kaiju.ts` | `Kaiju Conflict 给予两个额外行动额度` |
| `kaiju_kaiju_alliance` | 所有当前基地 breakpoint 本回合 -4 | `src/games/smashup/abilities/kaiju.ts` | `Kaiju Alliance 会让所有当前基地临界点本回合 -4` |
| `kaiju_pick_up_a_bus` | 从弃牌堆回收可打在基地上的行动牌 | `src/games/smashup/abilities/kaiju.ts` | `Pick Up a Bus 会从弃牌堆回收可打在基地上的行动牌` |
| `kaiju_they_say_hes_got_to_go` | 移动一个泰坦到另一个基地 | `src/games/smashup/abilities/kaiju.ts` | `They Say He’s Got to Go 会移动一个泰坦到另一个基地` |
| `kaiju_there_goes_tokyo` | Gorgodzolla 在场时，移动它，清掉原基地并替换 | `src/games/smashup/abilities/kaiju.ts` | `There Goes Tokyo 移动 Gorgodzolla、清掉原基地并正常替换新基地` |
| `kaiju_oh_no` | 打出或移动 Gorgodzolla 到此；持续 +2 总力量 | `src/games/smashup/abilities/kaiju.ts`、`abilities/ongoing_modifiers.ts` | `Oh, No! 可把牌库旁的 Gorgodzolla 打到目标基地`；Stomp 用例覆盖同类 +2 total power 查询 |
| `kaiju_radioactive_breath` | 可选消灭任意数量不由你控制的力量 2 或以下随从 | `src/games/smashup/abilities/kaiju.ts` | `Radioactive Breath 可选消灭任意数量不由你控制的力量 2 或以下随从` |
| `kaiju_tail_smash` | 消灭这里一个不由你控制的力量 3 或以下随从；持续 +4 总力量 | `src/games/smashup/abilities/kaiju.ts`、`abilities/ongoing_modifiers.ts` | `Tail Smash 强制消灭这里一个不由你控制的力量 3 或以下随从` |
| `kaiju_stomp` | 本基地 breakpoint -3；持续 +2 总力量 | `src/games/smashup/abilities/kaiju.ts`、`abilities/ongoing_modifiers.ts` | `Stomp 降低目标基地临界点，持续给拥有者在该基地 +2 总力量` |
| `kaiju_wade_through_the_buildings` | 摧毁这里所有其他玩家行动；持续 +4 总力量 | `src/games/smashup/abilities/kaiju.ts`、`abilities/ongoing_modifiers.ts` | `Wade Through the Buildings 会摧毁这里所有其他玩家行动牌` |
| `kaiju_johnny` | 可选将己方基地持续行动回手，并立刻只把该行动作为额外行动打到 Johnny 所在基地；可跳过 | `src/games/smashup/abilities/kaiju.ts`、`domain/abilityHelpers.ts`、`domain/extraPlay.ts`、`domain/reduce.ts` | `Johnny 可选将己方基地行动回手，并立刻只把该行动额外打到 Johnny 所在基地`；`Johnny 可在有合法行动时跳过，场上行动和额度不变` |
| `kaiju_tiny_priestesses` | 打出或移动 Gorgodzolla 到本基地 | `src/games/smashup/abilities/kaiju.ts` | `Tiny Priestesses 可把已在场的 Gorgodzolla 移到自身基地` |
| `kaiju_kaijookey` | 本基地每有一张你的行动牌 +1 | `src/games/smashup/abilities/ongoing_modifiers.ts` | `Kaijookey 按本基地己方行动牌数量获得持续力量` |
| `base_tokyo` | 在此基地打出行动后，该玩家本基地总力量 +3 直到下回合开始清理 | `src/games/smashup/abilities/kaiju.ts`、`domain/events.ts`、`domain/reduce.ts`、`domain/ongoingModifiers.ts` | `Tokyo 在行动牌打到这里后给该玩家本基地 +3 总力量直到下回合开始` |
| `base_kaiju_island` | 允许多个泰坦；每个泰坦给控制者 +3 总力量 | `data/cards.ts`、`abilities/ongoing_modifiers.ts` | `Kaiju Island 上每个泰坦给控制者 +3 总力量` |

## 裁定记录

- `kaiju_radioactive_breath` 中英 locale 存在差异：英文为“任意数量这里力量≤2随从”，中文图面/locale 为“不由你控制的 2 或更低”。本轮实现按中文图面口径执行，仅允许选择其他玩家控制的力量 2 或以下随从。
- `base_tokyo` 不能复用 ongoing base power 注册表，因为它不是附着行动卡，而是基地 `onActionPlayed` 触发后的本回合临时玩家-基地总力量。已新增 `TEMP_BASE_POWER_MODIFIED` 事件和 `tempBasePowerModifiers` 共享通道，由总力量计算统一消费，并在 `TURN_STARTED` 清空，沿用现有临时力量/临界点生命周期。
- `kaiju_the_folly_of_men` 裁定为 action-only 保护：阻止其他玩家行动牌摧毁己方随从，不阻止非行动来源摧毁。已用 `itty_critters_super_effective` 作为跨派系行动来源回归。
- `kaiju_johnny` 需要“从基地持续行动区回手，而不是脱离后进弃牌堆”，因此 `ONGOING_DETACHED` 增加可选 `destination: 'hand'`；默认仍为 `discard`，保持旧行动摧毁/脱离语义不变。
- `kaiju_johnny` 的“并在本基地将其作为额外打出”不能给泛用行动额度，否则玩家可打其他行动或换基地。本轮给立即额外行动通道增加 `restrictToBase` / `restrictToCardUid` / `restrictToCardDefId`，Johnny 只使用 immediate 分支。

## 已跑命令

- `npx eslint src/games/smashup/abilities/kaiju.ts src/games/smashup/abilities/index.ts src/games/smashup/abilities/ongoing_modifiers.ts src/games/smashup/__tests__/abilities/kaiju.test.ts src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts`
  - 结果：通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/kaiju.test.ts --configLoader native`
  - 结果：1 file / 17 tests passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/kaiju.test.ts src/games/smashup/__tests__/abilityRegistry.test.ts src/games/smashup/__tests__/abilityInteractionRegistry.test.ts --configLoader native`
  - 结果：3 files / 36 tests passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native`
  - 结果：1 file / 7 tests passed。
- `npm run typecheck`
  - 结果：通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native`
  - 结果：1 file / 27 tests passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/magical-girls.test.ts src/games/smashup/__tests__/abilities/itty-critters.test.ts src/games/smashup/__tests__/abilities/kaiju.test.ts src/games/smashup/__tests__/abilities/mega-troopers.test.ts src/games/smashup/__tests__/abilityRegistry.test.ts src/games/smashup/__tests__/abilityInteractionRegistry.test.ts --configLoader native`
  - 结果：6 files / 81 tests passed。
- `npx eslint src/games/smashup/abilities/kaiju.ts src/games/smashup/__tests__/abilities/kaiju.test.ts src/games/smashup/domain/types.ts src/games/smashup/domain/abilityHelpers.ts src/games/smashup/domain/extraPlay.ts src/games/smashup/domain/reduce.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts`
  - 结果：0 errors；仅历史 `any` / unused warning。
- `npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts`
  - 结果：5 tests passed；Kaiju 覆盖 `base_tokyo` 真实手牌持续行动入口与 `tempBasePowerModifiers` finalState。

## 残余范围

- Kaiju 新文件仍使用 legacy ability / interaction 注册风格；当前行为级测试与行为审计已过，但迁移到新 runtime 注册仍是后续架构债。
- Kaiju 仍缺逐卡全量 L3/L4；当前代表性 L3/L4 已覆盖 Tokyo 真实入口，不能用它冒充每张卡全量浏览器证据。
