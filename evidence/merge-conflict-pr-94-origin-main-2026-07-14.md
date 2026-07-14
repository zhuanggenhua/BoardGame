# #94 合并主线冲突审计

## 对象

- PR：#94 `实装大杀四方 Cease and Desist 四派系`
- head：`codex/smashup-cease-and-desist-pr`
- base：`origin/main`
- 执行位置：`.tmp/pr94-merge-20260714-081543`

## 冲突范围

本次同步主线时出现 11 个真实冲突：

- `public/assets/smashup/assets-manifest.json`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/abilities/mega_troopers.ts`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/domain/abilityHelpers.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/domain/commands.ts`
- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/variantBindings.ts`
- `src/games/smashup/ui/factionMeta.ts`

## 裁决

- 保留 #94 新增的 Cease and Desist 四派系资源、卡牌、能力、派系元数据与文案。
- 保留主线已有的 Marvel、POD、Pretty Pretty 等资源、卡牌、能力、派系元数据与文案。
- JSON 同 key 文案冲突采用主线版本，避免覆盖主线已经合并的 POD 基地文案。
- TypeScript 冲突按双边有效逻辑合成：
  - `canControllerPlayTitan` 保留 Red Trooper POD 对同控制者双泰坦上限的主线规则，同时保留 #94 调用点兼容。
  - `validateManualSpecialScoringBase` 同时支持旧 defId 推断和主线 `anyBase` 来源范围。
  - `mega_troopers` 保留 Omega Protocol breakpoint modifier 注册与主线 action controller 逻辑。

## 合并副产物修复

- 去掉 `ongoingEffects.ts` 中重复生成的 base VP modifier POD alias 注册循环。
- 修正 `commands.ts` 中重复声明的计分基地校验变量。
- 修正泰坦 special 分支计分基地校验使用未定义 `titan` 的问题，改为按 `spTitanUid` 读取当前泰坦定义。
- 修正 `cease_and_desist.ts` 中 3 处运行时 `onResolve` 抽牌手传 random，改为 `buildStandardDrawEventsFromRuntimeContext`。
- 修正 Cease and Desist 随从文案字段，将中英文 locale 中的随从能力文本从 `effectText` 改为 `abilityText`。

## 2026-07-14 二次同步主线

- 最新主线推进到 `f757e2366` 后，#94 再次合入 `origin/main`。
- 本次同步没有文本冲突标记，也没有未解决冲突。
- 双侧重叠文件为 `public/assets/i18n/assets-manifest.json`，结果保留主线新增 i18n 资产清单，同时保留 #94 的 Cease and Desist 资产清单。
- 未改动 #94 的 Cease and Desist 卡牌、能力和文案语义；本次只是跟随主线资产清单更新。

## 2026-07-14 POD 基地图集门禁修复

- 远端 quality-gate 在 `factionSelection.test.ts` 的 POD 基地图集映射检查失败。
- 缺口为 4 个已启用 POD 的基地：`base_the_vats_pod`、`base_faceless_city_pod`、`base_boneyard_pod`、`base_ossuary_pod`。
- 修复方式：在 `englishAtlasMap.json` 中复用原基地的英文图集坐标：
  - `base_the_vats_pod` -> `smashup:base9` index 4
  - `base_faceless_city_pod` -> `smashup:base9` index 5
  - `base_boneyard_pod` -> `smashup:base6` index 2
  - `base_ossuary_pod` -> `smashup:base6` index 3
- 本次只补齐图集映射契约，不改变基地、派系或能力规则。

## 2026-07-14 反应队列调用点门禁修复

- 远端 quality-gate 在 `reactionQueueFireTriggersCallerContract.test.ts` 失败。
- 原因是 `reducer.ts` 中已存在一个经过替换阶段保护的回手后处理入口：`onCardReturnedToHand`，但契约测试只截取 `fireTriggers` 调用后 600 字符，未覆盖到完整 options 参数，误判为非 replacement 调用。
- 修复方式：测试改为截取完整 `fireTriggers(...)` 调用表达式，并把 `onCardReturnedToHand` 作为已审计的 replacement 入口加入白名单。
- 本次只修测试契约与审计范围，不改变回手后处理运行时逻辑。

## 2026-07-14 响应窗口行动牌目标契约修复

- 远端 quality-gate 在 `reactionSessionResponseActionTargetContext.test.ts` 失败。
- 缺口为 2 张 Cease and Desist 响应窗口行动牌：`astroknights_block_the_probe`、`star_roamers_port_me_up`。
- 当前响应窗口的 `play_action` 选择尚不携带 `targetMinionUid`，因此响应窗口行动牌不能声明 play-time 随从目标。
- 修复方式：去掉这两张 special 行动牌的 `playNeedsMinion` / `playTargetMinionController` 声明，保留能力实现中的目标处理。
- 本次只收窄响应窗口牌的数据契约，不改变普通行动牌的 play-time 目标声明。

## 验证

- `npm run i18n:check`
- `npx vitest run src/games/smashup/__tests__/factionSelection.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/smashup/__tests__/reactionQueueFireTriggersCallerContract.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/smashup/__tests__/reactionQueueEventPlayerContext.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/smashup/__tests__/reactionSessionResponseActionTargetContext.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/smashup/__tests__/smashup.smoke.test.ts src/games/smashup/__tests__/ongoingEffects.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/smashup/__tests__/abilities/cease-and-desist.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/smashup/__tests__/runtimePromptRandomAudit.test.ts --config vitest.config.audit.ts --configLoader native`
- `npx vitest run src/games/smashup/__tests__/cardI18nIntegrity.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
- `git diff --name-only --diff-filter=U`
- `git diff --check`
