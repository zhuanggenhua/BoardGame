# 大杀四方漫威第一波当前发布口径收口记录

## 范围

- 本轮对象：复仇者、神盾局、蜘蛛宇宙、终极战队。
- 资源交付：不走 R2 上传；正式 PNG、压缩 WebP、manifest、代码、测试与 evidence 通过 PR 提交给作者。
- 远端回查：作者合并/发布前不执行 `HEAD 200`；发布后再回查代表 URL。

## 当前结论

| 模块 | 当前结论 | 证据 |
| --- | --- | --- |
| 静态牌组 | 已按四派系生成 `18/12/12/12` 个唯一卡面，实体牌数均为 20，atlas 索引为 `0-53` | `src/games/smashup/__tests__/marvelResourceContract.test.ts` |
| 资源链 | 本地正式 PNG 与压缩 WebP 存在，根级与游戏级 manifest 均记录 `marvel_wave_one` | `src/games/smashup/__tests__/marvelResourceContract.test.ts` |
| 关键预加载 | 复仇者、神盾局、蜘蛛宇宙、终极战队同时入局时只预热一次共享 `smashup/cards/marvel_wave_one` | `src/games/smashup/__tests__/criticalImageResolver.test.ts` |
| 玩法行为 | 已有复仇者专项 L2 行为测试 12 条、其余三派系漫威共享 L2 行为测试 19 条，并已完成 54 张唯一卡逐卡实现矩阵 | `src/games/smashup/__tests__/abilities/avengers.test.ts`、`src/games/smashup/__tests__/abilities/marvel.test.ts`、`evidence/smashup/smashup-marvel-pr-closeout-2026-07-12.md` |
| 派系状态 | 复仇者、神盾局、蜘蛛宇宙、终极战队已移除 `implementationStatus: 'in_progress'` | `src/games/smashup/ui/factionMeta.ts` |
| 真实入口 | 已从真实派系选择入口验证四派系可见、共享图集加载、真实选秀开局与代表能力链 | `e2e/smashup/smashup-marvel-wave-one-four-factions.e2e.ts` |

## 已运行验证

- `node scripts/assets/generate_asset_manifests.js --validate --id smashup`
  - 结果：通过，`public\assets\smashup\assets-manifest.json` incremental 校验通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/avengers.test.ts src/games/smashup/__tests__/abilities/marvel.test.ts src/games/smashup/__tests__/marvelResourceContract.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果：通过，4 个文件 / 45 条测试。
- `npx eslint --no-cache --max-warnings=0 src/games/smashup/domain/ids.ts src/games/smashup/domain/atlasCatalog.ts src/games/smashup/data/cards.ts src/games/smashup/data/factions/avengers.ts src/games/smashup/data/factions/shield.ts src/games/smashup/data/factions/spider_verse.ts src/games/smashup/data/factions/ultimates.ts src/games/smashup/abilities/index.ts src/games/smashup/abilities/avengers.ts src/games/smashup/abilities/marvel.ts src/games/smashup/ui/factionMeta.ts src/games/smashup/__tests__/abilities/avengers.test.ts src/games/smashup/__tests__/abilities/marvel.test.ts src/games/smashup/__tests__/marvelResourceContract.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts e2e/smashup/smashup-marvel-wave-one-four-factions.e2e.ts`
  - 结果：通过，0 warning。
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-marvel-wave-one-four-factions.e2e.ts`
  - 结果：通过，2 条测试。
- `openspec validate add-smashup-marvel-avengers-shield-spiderverse-ultimates --strict --no-interactive`
  - 结果：通过。

## E2E 截图证据

- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e\派系选择页能看到复仇者、神盾局、蜘蛛宇宙、终极战队，并加载共享漫威图集\marvel-wave-one-faction-selection-visible.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e\四派系真实选秀后可开局并完成代表能力链\01-复仇者-派系预览.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e\四派系真实选秀后可开局并完成代表能力链\02-蜘蛛宇宙-派系预览.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e\四派系真实选秀后可开局并完成代表能力链\03-终极战队-派系预览.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e\四派系真实选秀后可开局并完成代表能力链\04-神盾局-派系预览.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e\四派系真实选秀后可开局并完成代表能力链\05-漫威四派-真实选秀开局完成.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e\四派系真实选秀后可开局并完成代表能力链\06-漫威代表能力-触发前.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e\四派系真实选秀后可开局并完成代表能力链\07-复仇者-战术优势加力后.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e\四派系真实选秀后可开局并完成代表能力链\08-神盾局-并肩作战加力后.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e\四派系真实选秀后可开局并完成代表能力链\09-蜘蛛宇宙-蜘蛛感应抽牌后.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-wave-one-four-factions.e2e\四派系真实选秀后可开局并完成代表能力链\10-终极战队-力量与速度移动后.jpg`

## 当前后置范围

- 四派系 54 张唯一卡已完成 locked 规则合同、运行时入口、L2/持续规则测试证据与逐卡矩阵；逐卡矩阵见 `evidence/smashup/smashup-marvel-pr-closeout-2026-07-12.md`。
- 四派系 metadata 已移除 `implementationStatus: 'in_progress'`，当前派系选择入口按完成派系口径展示。
- 不执行 R2 上传，也不在作者合并/发布前做远端 `HEAD 200`。
- PR 合并/作者发布后，再对代表 CDN URL 执行 `HEAD 200` 回查。
