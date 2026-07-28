# DiceThrone 战术家 / 咒缚海盗接入进度证据（2026-05-30）

> 状态提示（2026-06-05）：这是战术家 / 咒缚海盗 intake 的阶段性进度证据，不是当前对话的默认长期任务入口。若后续继续该专项，应以对象级审计和当轮验证目标重新收口。
>
> 2026-06-06 当前有效口径：本文保留的是 2026-05-30 起这轮 intake 的历史阶段证据；当前权威结论已经推进到“规则实现已落地、human 面板已接入、不需要整套重录、审计 closeout 已完成”。若要判断这两名英雄的现行状态，应优先以对象级审计主文档与最新 closeout 测试为准。

## 2026-06-06 失效旧口径

- “整文件最近一次全量回归仍为 4 passed” 已失效。当前权威整跑结果是 `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts -> 80 passed (20.3m)`，旧的 `2/3/4 passed` 只代表当时的阶段快照。
- “L1/L2 部分接入” 已不适合作为这两名英雄的现状摘要。当前更真实的口径是：L1 已完成，多个面板对象、手牌、状态与防御/奖励骰链已提升到对象级或状态对象级 `L3`，但 `L4` 合法复用登记与最终 completion audit 仍未收口。
- “normal/human 面未接入” 或 “human 面只录了名称与槽位” 已失效。当前 human 面 `9 / 9` 对象都已有独立 direct E2E 或对象级真实入口证据。
- 本文后续“未覆盖风险”表里凡写到“真实入口/E2E 仍未覆盖”的条目，若与对象级审计主文档或最新回写冲突，一律以后者为准，不得把本页历史快照当作当前 blocker。

## 结论

本页原始结论只代表 2026-05-30 起的阶段快照；当前权威结论已经更新为：两名新英雄的规则实现、资源链、状态链、真实入口 E2E 与目录 closeout 均已完成，`closeout + status + intake + mechanics` 最新为 `4 files / 97 passed`，full-file E2E 权威整跑为 `80 passed (20.3m)`。因此本文下文若仍出现“不是完整交付 / 仍未逐项 L3/L4 / completion audit 未收口”等说法，都只按历史流水理解，不再代表当前 blocker。

## 批次矩阵

| heroId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `zhanshujia` | `passed` | `passed` | `passed` | `passed` | `passed` | closeout 已完成；规则实现已落地，不需要整套重录 |
| `cursed_pirate` | `passed` | `passed` | `passed` | `passed` | `passed` | closeout 已完成；human 面板已接入正式运行时，审计不再 hold |

## 已完成证据

| 类别 | 证据 |
| --- | --- |
| 规则文档 | `src/games/dicethrone/rule/战术家真相源表.md`、`战术家录入核对.md`、`战术家卡牌录入核对.md`、`咒缚海盗真相源表.md`、`咒缚海盗录入核对.md`、`咒缚海盗卡牌录入核对.md` |
| 资源本地生成 | `public/assets/i18n/zh-CN/dicethrone/images/zhanshujia/compressed/*.webp`、`public/assets/i18n/zh-CN/dicethrone/images/cursed/compressed/*.webp` |
| 状态图集 | `status-icons-atlas.json/png/webp`，战术家 frame `tactical_advantage/bind`；咒缚海盗 frame `wither/parley/powder_keg/cursed_coin` |
| 静态代码 | `heroes/zhanshujia/*`、`heroes/cursed_pirate/*`、`domain/statusEvents.ts`、`domain/ids.ts`、`domain/core-types.ts`、`domain/characters.ts`、`domain/index.ts`、`heroes/index.ts`、`ui/cardAtlas.ts`、`ui/assets.ts`、`criticalImageResolver.ts` |
| 手牌 L1 录入 | `src/games/dicethrone/heroes/zhanshujia/cards.ts` 录入战术家 slot 17-31；`src/games/dicethrone/heroes/cursed_pirate/cards.ts` 录入咒缚海盗 slot 17-32；临时单卡裁图位于 `temp/dicethrone-intake/*/hand-cards/` |
| 测试 | `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts`，当前 7 tests passed；`src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`，当前 45 tests passed；组合验证 2 files / 52 tests passed |
| manifest | `node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id dicethrone` 已执行；`--validate --root public/assets/i18n/zh-CN --id dicethrone` 通过 |
| 真实入口 E2E | `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 当前已进一步覆盖选角、开局玩家板/提示板/HUD、手牌 atlas、战术优势双阶段转移、紧缚 phase-exit 清理、战略转移 / 摇鼓运动 / 开拓战场 / 包夹侧翼基础版、军刀突刺 / 军刀突刺 II、地毯式轰炸 II、战略转移 II、摇鼓运动 II、开拓战场 II、两条防御响应链、human 面 `9 / 9`、咒缚面 `灵魂突刺 / 灵魂指令 / 死亡吐息`、多张手牌与多条奖励骰/状态链；最新整文件权威整跑已是 `60 passed / 0 failed`。本页其余较早的 `1 passed / 2 passed / 4 passed` 记录仅保留为阶段流水，不再代表当前总状态 |
| 远端资源 | `npm run assets:upload` 已上传 24 个本轮 DiceThrone 新资源；战术家与咒缚海盗 10 个代表 URL 及 Common 2 个依赖 URL HEAD 均为 200 |

## 验证命令

| 命令 | 结果 |
| --- | --- |
| JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json` | 通过 |
| `npx eslint <本轮 TS 文件>` | 0 errors；`characters.ts` 保留既有 2 warnings |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts --configLoader native` | 1 file / 5 tests passed |
| `npm run i18n:check` | 无 missing key；保留 3 条既有 warning |
| `npx tsc --noEmit --pretty false` | 通过 |
| `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id dicethrone` | 通过 |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 22 tests passed |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 27 tests passed |
| `npx eslint src/games/dicethrone/domain/customActions/zhanshujia.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/zhanshujia/abilities.ts src/games/dicethrone/heroes/cursed_pirate/abilities.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| `npx eslint src/games/dicethrone/domain/statusEvents.ts src/games/dicethrone/domain/effects.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/domain/execute.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/cursed_pirate/abilities.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 22 tests passed |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 27 tests passed |
| `npx eslint src/games/dicethrone/domain/statusEvents.ts src/games/dicethrone/domain/flowHooks.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors；`flowHooks.ts` 保留既有 warnings |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts` | 1 file / 6 tests passed |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 28 tests passed |
| `npx eslint src/games/dicethrone/heroes/zhanshujia/cards.ts src/games/dicethrone/heroes/cursed_pirate/cards.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts` | 0 errors |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 09:23） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 26 tests passed |
| JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json` | 通过（2026-05-31 09:27） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 09:28） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 32 tests passed |
| `npm run i18n:check` | 通过，仅保留既有 3 条 warning |
| `npx eslint src/games/dicethrone/heroes/zhanshujia/abilities.ts src/games/dicethrone/heroes/zhanshujia/cards.ts src/games/dicethrone/domain/customActions/zhanshujia.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| `npx vitest run --config vitest.config.audit.ts src/games/dicethrone/__tests__/ability-customaction-audit.test.ts` | 29 passed / 1 failed；失败为既有 customAction 孤立列表审计，包含大量既有非本轮对象，不能作为本轮通过证据 |
| JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json` | 通过（2026-05-31 09:37） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 30 tests passed |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 36 tests passed |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 09:37） |
| `npx eslint src/games/dicethrone/heroes/zhanshujia/cards.ts src/games/dicethrone/domain/customActions/zhanshujia.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| `npm run i18n:check` | 通过，仅保留既有 3 条 warning |
| JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json` | 通过（2026-05-31 09:49） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 31 tests passed |
| `npx vitest run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx` | 1 file / 29 tests passed |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 09:49） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 37 tests passed |
| `npm run i18n:check` | 通过，仅保留既有 3 条 warning |
| `npx eslint src/games/dicethrone/domain/core-types.ts src/games/dicethrone/hooks/useInteractionState.ts src/games/dicethrone/ui/InteractionOverlay.tsx src/games/dicethrone/domain/commandValidation.ts src/games/dicethrone/domain/execute.ts src/games/dicethrone/heroes/zhanshujia/abilities.ts src/games/dicethrone/domain/customActions/zhanshujia.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json` | 通过（2026-05-31 10:02） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 37 tests passed |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 10:03） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 43 tests passed |
| `npm run i18n:check` | 通过，仅保留既有 3 条 warning |
| `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/cursed_pirate/cards.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 38 tests passed |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 10:11） |
| JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json` | 通过（2026-05-31 10:34） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 40 tests passed |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 10:34） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 46 tests passed（2026-05-31 10:38） |
| `npm run i18n:check` | 通过，仅保留既有 3 条 warning（2026-05-31 10:39） |
| `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/cursed_pirate/cards.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors（2026-05-31 10:39） |
| JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json` | 通过（2026-05-31 10:39） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 10:40） |
| `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 12:44） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 2 passed（2026-05-31 12:44） |
| `npm run assets:check` | 上传前发现 24 个 DiceThrone 新资源缺远端（2026-05-31 12:37） |
| `npm run assets:upload` | 上传 25，跳过 2025，失败 0；其中 24 个为本轮 DiceThrone 新资源，另 1 个为既有 SmashUp `pretty_pretty.webp` 远端差异（2026-05-31 12:39） |
| 代表 URL HEAD 回查 | 战术家/咒缚海盗 `player-board.webp`、`tip.webp`、`ability-cards.webp`、`dice.webp`、`status-icons-atlas.webp` 均为 200；Common `background.webp`、`character-portraits.webp` 均为 200（2026-05-31 12:40） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 48 tests passed（2026-05-31 13:15） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 13:15） |
| `npm run i18n:check` | 通过，仅保留既有 3 条 warning（2026-05-31 13:15） |
| `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts src/games/dicethrone/domain/core-types.ts src/games/dicethrone/domain/characters.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors / 2 warnings（`characters.ts` 既有 `any`，2026-05-31 13:15） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 13:38） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 3 passed（2026-05-31 13:38） |
| `npx eslint src/games/dicethrone/ui/InteractionOverlay.tsx e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 14:07） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 14:07） |
| `npx vitest run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx` | 1 file / 29 tests passed（2026-05-31 14:17；保留既有 missing_sfx stderr） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 3 passed（2026-05-31 14:12；截图 11 已复核为中文“作战室！”而非 raw i18n key） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 42 tests passed（2026-05-31 14:29） |
| `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/ui/ChoiceModal.tsx e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 14:29） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 14:31） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 3 passed（2026-05-31 14:36；截图 13 已复核为中文“作战室！、战略防御！”而非 raw `card-*` ID） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 15:32） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 15:32） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 3 passed（2026-05-31 15:32；截图 15-17 覆盖瞭望台战利品/骷髅真实入口） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 15:55） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 15:55） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 3 passed（2026-05-31 15:55；截图 18-19 覆盖作战室奖励骰展示与战术优势落点） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 16:41） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 16:41） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应展示并结算反制措施与你还嫩了点"` | 1 passed（2026-05-31 16:31，截图 20-23 覆盖两条防御响应链） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 4 passed（2026-05-31 16:41，整文件回归） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "深海潜行"` | 通过（2026-06-01 07:57） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 43 tests passed（2026-06-01 07:57） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts` | 1 file / 7 tests passed（2026-06-01 07:57） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 50 tests passed（2026-06-01 07:57）；2 files / 52 tests passed（2026-06-01 11:35） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 07:57） |
| `npx eslint src/games/dicethrone/domain/systems.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors / 5 warnings（`systems.ts` 既有 `any`，2026-06-01 07:57） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实进攻阶段入口应通过面板槽位选择并结算深海潜行前置链"` | 1 passed（2026-06-01 07:57，截图 24-26 覆盖深海潜行真实攻击入口） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 08:37） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算干票大的奖励骰分支"` | 1 passed（2026-06-01 08:37，截图 27-28 覆盖干票大的奖励骰代表链） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-01 09:49） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 09:49） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算战争贩子 II 的奖励骰分支"` | 1 passed（2026-06-01 09:49，截图 29-30 覆盖战争贩子 II 奖励骰代表链） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并保留战争贩子 II 勋章专门链的额外进攻阶段"` | 1 passed（2026-06-01 11:35，截图 35 覆盖战争贩子 II 勋章专门链） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-01 10:17） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 10:17） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算抽筋剥皮的奖励骰分支"` | 1 passed（2026-06-01 10:17，截图 31-32 覆盖抽筋剥皮奖励骰代表链） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算死亡印记的奖励骰分支"` | 1 passed（2026-06-01 10:56，截图 33-34 覆盖死亡印记奖励骰代表链） |

## 未覆盖风险

| 对象 | 风险 |
| --- | --- |
| 战术优势 | L2 已覆盖获得 CP、重掷、抽牌、施加锁定、获得守护、转移状态入口；真实 UI/E2E 仍未覆盖 |
| 紧缚 | L2 已覆盖额外投掷 1CP 门禁、CP 不足拒绝、进攻投掷阶段结束移除；真实 UI/E2E 仍未覆盖 |
| 战术家防御 | L2 已覆盖反制措施：每组 2 军刀造成 1 反击伤害、每个旗帜防止 1 伤害、每个勋章获得 1 战术优势；真实防御阶段入口已补反制措施代表 L3 |
| 战术家升级牌 | L2 已覆盖 9 张升级牌的 `replaceAbility` 映射、能力等级与 `upgradeCardByAbilityId` 记录；代表分支覆盖反制措施 III、军刀突刺 II、战争贩子 II、地毯式轰炸 II 2v2 精确两名不同对手选择 |
| 战术家专属行动牌 | L2 已覆盖脱战三分支、伴装撤退紧缚+防伤、作战室按骰值授予战术优势、战略防御任意玩家守护选择；战略防御与作战室奖励骰展示已补真实入口截图链，其余真实入口/E2E 仍未覆盖 |
| 战争贩子 | 2026-07-23 回图后修订：旧“攻击收口后全分支额外进攻投掷阶段”口径失效；当前 L2 覆盖军刀分支先进入可防御攻击伤害、旗帜分支只获得战术优势、勋章分支抽牌并立即进入额外进攻投掷阶段。战争贩子 II 奖励骰代表链与勋章专门链均已补真实入口截图，但战争贩子家族仍未穷尽所有复杂交互 UI 组合，暂不能按逐对象 L3/L4 全收口 |
| 制胜高地 | L2 已覆盖锁定、紧缚、战术优势上限提升 1、补至新上限与 12 伤害；真实入口/E2E 仍未覆盖 |
| 诅咒金币 | L2 已覆盖自身/他人差异上限、维持伤害、不可移动/移除、海盗可选择获得/不获得；真实入口/E2E 仍未覆盖 |
| 咒缚 | L2 已覆盖自己维持阶段受到 4 点不可防止伤害、对手进攻投掷阶段未发起攻击则施加火药桶；真实入口/E2E 仍未覆盖 |
| 灵魂突刺 | L2 已覆盖 5/7/9 伤害与三同值施加火药桶；若目标已有火药桶，会触发原桶爆炸并保留新桶 |
| 火药桶 | L2 已覆盖维持投骰、1-2 爆炸移除并造成 3 点独立不可防御伤害、3-5 无事发生、6 转交、重复获得时原桶立即爆炸并保留新桶；真实入口/E2E 仍未覆盖 |
| 凋零 | L2 已覆盖来源侧攻击伤害 -1/层；真实入口/E2E 仍未覆盖 |
| 休战 | L2 已覆盖阻止攻击伤害、直接伤害不受影响、阶段结束移除；真实入口/E2E 仍未覆盖 |
| 深海潜行 | L2 已覆盖偷取 1CP、对手自选弃 1 张手牌、施加凋零与 8 伤害；真实攻击入口截图 24-26 已证明通过面板槽位触发后，偷 CP、施加凋零、对手弃牌与弃牌落点整链成立 |
| 死亡印记 | L2 已覆盖先获得 2CP、弯刀不可防御伤害、战利品抽牌、骷髅施加诅咒金币；真实入口奖励骰代表链已覆盖，且已修复多颗奖励骰同批累计 bug |
| 亡灵之爪 | L2 已覆盖 8 点不可防御主伤害和按所有对手诅咒金币层数造成直接伤害；真实入口/E2E 仍未覆盖 |
| 咒缚海盗防御 | L2 已覆盖你还嫩了点：每个弯刀反击 1、每个战利品获得 1CP、每个骷髅防止 2 伤害、弯刀+骷髅施加诅咒金币；真实防御阶段入口已补代表 L3 |
| 无情诅咒 | L2 已覆盖可跳过的至多两名对手火药桶选择、4 人 2v2 不列队友、选择两名对手后分别施加火药桶；真实入口/E2E 仍未覆盖 |
| 英雄专属手牌 | L1 已完成逐卡录入与索引测试；战术家升级牌替换链、地毯式轰炸 II 两名不同对手交互与 4 张专属行动牌已推进到 L2；咒缚海盗诅咒卡牌、封舱、抽筋剥皮、赎金、瞭望台、干票大的、送你们去喂鱼、啜呼已推进到 L2；送你们去喂鱼、瞭望台三分支、干票大的奖励骰代表链、抽筋剥皮奖励骰代表链与死亡印记奖励骰代表链已补真实入口截图；海盗的一生已按当前咒缚面素材合同治疗 3，普通面获得诅咒金币分支保留测试 |
| E2E / 上传 | 真实入口双玩家 E2E、资源上传和远端 HEAD 回查已完成；战略防御、送你们去喂鱼、手牌选择、瞭望台三分支、作战室奖励骰展示、赎金跨玩家双步选择链、啜呼目标选择与奖励骰分支、干票大的奖励骰、战争贩子 II 奖励骰代表链、战争贩子 II 勋章专门链、抽筋剥皮奖励骰代表链、死亡印记奖励骰代表链、两条防御响应链与深海潜行完整攻击入口已有真实交互截图；其余复杂交互 UI 仍未逐项 L3/L4 |

## 手牌 L1 录入证据

| heroId | 专属 slot | 空白 slot | 通用牌特殊索引 | 证据 |
| --- | --- | --- | --- | --- |
| `zhanshujia` | 17-31，共 15 张 | 33-34 | `card-unexpected` = 32 | `src/games/dicethrone/rule/战术家卡牌录入核对.md`、`cards.ts`、intake test |
| `cursed_pirate` | 17-32，共 16 张 | 34 | `card-unexpected` = 33 | `src/games/dicethrone/rule/咒缚海盗卡牌录入核对.md`、`cards.ts`、intake test |

## 当前阅读说明

- 本文是战术家 / 咒缚海盗 intake 的历史阶段进度证据，不是当前这两名英雄的总审计出口。
- 文中的 `passed / in_progress / L1/L2 部分接入` 只代表该阶段快照；当前若判断对象级残余或整批 completion audit，应回到对象级审计主文档与后续补审回写。
