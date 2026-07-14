# Smash Up 漫威第一波四派系 PR 收口证据（2026-07-12）

## 当前结论

本轮已把复仇者、神盾局、蜘蛛宇宙、终极战队推进到可提交 PR 的闭环状态：静态牌表、派系元数据、双语 locale、共享 `marvel_wave_one` 图集、关键图片预加载、资源 manifest、54 张唯一卡的规则合同、运行时入口、L2 行为测试、真实派系选择入口和四派系开局代表能力链均已有验证。

本证据声明：当前 54 张唯一卡均已映射到 locked 规则合同、运行时实现入口和至少一处测试/evidence。真实入口 E2E 覆盖派系选择、共享图集加载、真实选秀开局和四派系代表能力链；逐卡完整 E2E 不作为本 PR 的必要完成条件。

四个漫威派系已经从 `factionMeta.ts` 移除 `implementationStatus: 'in_progress'`，派系选择入口不再按“实施中”口径展示。

## 本轮补齐的运行时语义

- `高处不胜寒（spider_verse_view_from_above）`
  - 旧状态：运行时硬编码为声明“角色”，没有玩家声明“角色/法术”的交互入口。
  - 本轮状态：新增真实 prompt，玩家先声明“角色”或“法术”；随后展示牌库顶直到命中该类型，抽取命中牌，并将其余展示牌洗回牌库。
  - L2 覆盖：`src/games/smashup/__tests__/abilities/marvel.test.ts` 中“蜘蛛反应、幽灵蜘蛛侠和高处不胜寒会检查牌库并抽取命中的牌”断言 prompt 选项为“角色/法术”，并分别验证声明角色、声明法术两条分支。
- `蜘蛛侠-平行宇宙（spider_verse_bond）` / `束缚（spider_verse_webbed_up）`
  - 本轮状态：在组合覆盖之外新增独立 L2 行为测试，分别验证蜘蛛侠-平行宇宙按同基地己方其他角色给宿主 +1 力量、束缚让宿主 -2 力量并取消宿主能力，且未装备角色不被压制。
  - L2 覆盖：`src/games/smashup/__tests__/abilities/marvel.test.ts` 中“蜘蛛侠-平行宇宙和束缚分别修正力量并压制敌方卡牌能力”。

## 逐卡实现矩阵

| 派系 | 覆盖结论 |
| --- | --- |
| 复仇者 | 18 张唯一卡均有 locked 规则合同、运行时入口或持续 modifier/protection helper、`avengers.test.ts` L2 覆盖；代表真实入口由 `smashup-marvel-wave-one-four-factions.e2e.ts` 覆盖战术优势链。 |
| 神盾局 | 12 张唯一卡均有 locked 规则合同、运行时入口或持续 modifier/trigger、`marvel.test.ts` L2 覆盖；代表真实入口由 E2E 覆盖并肩作战链。 |
| 蜘蛛宇宙 | 12 张唯一卡均有 locked 规则合同、运行时入口或持续 modifier/protection/suppression、`marvel.test.ts` L2 覆盖；代表真实入口由 E2E 覆盖蜘蛛感应链。 |
| 终极战队 | 12 张唯一卡均有 locked 规则合同、运行时入口或持续 trigger、`marvel.test.ts` L2 覆盖；代表真实入口由 E2E 覆盖力量与速度链。 |

逐卡 spot-check 结论：

- 复仇者：黑寡妇、美国队长、鹰眼、浩克、钢铁侠、索尔、复仇者集结、美队的盾牌、鹰眼箭、浩克冲击、J.A.R.V.I.S.、雷神锤、模块化技术、斥力靴、战略部署、战术优势、雷霆闪电、蜘蛛之吻均为 `OK`。
- 神盾局：尼克-弗瑞、玛丽亚·希尔、菲尔·科尔森、神盾局探员、进入点、任务汇报、试验场、调任、救援任务、强大的火力、空投部队、并肩作战均为 `OK`。
- 蜘蛛宇宙：蜘蛛侠、幽灵蜘蛛侠、迈尔斯·莫拉莱斯、蜘蛛侠2099、…责任越大、蜘蛛反应、蜘蛛感应、蜘蛛侠-平行宇宙、高处不胜寒、束缚、能力越大…、你的好邻居英雄均为 `OK`。
- 终极战队：惊奇队长、光谱、美国小姐、蓝奇、盟国的援助、协同攻击、宇宙知识、最先到达、英雄登场、搬运、力量与速度、争夺均为 `OK`。

## 已通过命令

```powershell
npx eslint src/games/smashup/abilities/marvel.ts src/games/smashup/abilities/avengers.ts src/games/smashup/__tests__/abilities/marvel.test.ts src/games/smashup/__tests__/abilities/avengers.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/marvelResourceContract.test.ts e2e/smashup/smashup-marvel-wave-one-four-factions.e2e.ts
```

结果：0 errors。

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/marvelResourceContract.test.ts src/games/smashup/__tests__/abilities/marvel.test.ts src/games/smashup/__tests__/abilities/avengers.test.ts --configLoader native
```

结果：4 个测试文件通过，45 tests passed。`avengers.test.ts` 仍有既有 `[BASE_REPLACED] newBaseDefId base_moon_dumpster not found in baseDeck` stderr，但测试结果为通过。

```powershell
npx tsc --noEmit --pretty false --incremental false
```

结果：通过。

```powershell
npx openspec validate add-smashup-marvel-avengers-shield-spiderverse-ultimates --strict --no-interactive
```

结果：`Change 'add-smashup-marvel-avengers-shield-spiderverse-ultimates' is valid`。

```powershell
npm run test:e2e:ci:file -- e2e/smashup/smashup-marvel-wave-one-four-factions.e2e.ts
```

结果：2 passed。

## 真实入口 E2E 截图

截图根目录：

```text
D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e
```

关键截图：

- `派系选择页能看到复仇者、神盾局、蜘蛛宇宙、终极战队，并加载共享漫威图集\marvel-wave-one-faction-selection-visible.jpg`
- `四派系真实选秀后可开局并完成代表能力链\01-复仇者-派系预览.jpg`
- `四派系真实选秀后可开局并完成代表能力链\02-蜘蛛宇宙-派系预览.jpg`
- `四派系真实选秀后可开局并完成代表能力链\03-终极战队-派系预览.jpg`
- `四派系真实选秀后可开局并完成代表能力链\04-神盾局-派系预览.jpg`
- `四派系真实选秀后可开局并完成代表能力链\05-漫威四派-真实选秀开局完成.jpg`
- `四派系真实选秀后可开局并完成代表能力链\07-复仇者-战术优势加力后.jpg`
- `四派系真实选秀后可开局并完成代表能力链\08-神盾局-并肩作战加力后.jpg`
- `四派系真实选秀后可开局并完成代表能力链\09-蜘蛛宇宙-蜘蛛感应抽牌后.jpg`
- `四派系真实选秀后可开局并完成代表能力链\10-终极战队-力量与速度移动后.jpg`

## 任务状态口径

已勾选：

- 2.4：`factionMeta.ts`、双语 locale 和派系选择 E2E 已证明四派系可见。
- 2.5：根级/游戏级 manifest、critical image resolver 和 `marvelResourceContract.test.ts` 已证明共享图集接线。
- 3.2 / 4.2 / 5.2 / 6.2：54 张唯一卡均已映射到 locked 合同、运行时入口和 L2/持续规则测试证据。
- 3.3 / 4.3 / 5.3 / 6.3：已有 L2 行为测试与真实入口 E2E evidence。
- 7.1 / 7.2 / 7.4 / 7.5 / 7.6：本轮已跑定向注册/资源/interaction 测试、定向 ESLint、`tsc`、逐卡矩阵、真实入口 E2E 和 OpenSpec strict validate，并移除四个漫威派系的 `in_progress` 状态。

暂不勾选：

- 7.3b：PR 合并/作者发布后的 `HEAD 200` 回查尚未发生。
