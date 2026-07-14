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

## 验证

- `npm run i18n:check`
- `npx vitest run src/games/smashup/__tests__/smashup.smoke.test.ts src/games/smashup/__tests__/ongoingEffects.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/smashup/__tests__/abilities/cease-and-desist.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/smashup/__tests__/runtimePromptRandomAudit.test.ts --config vitest.config.audit.ts --configLoader native`
- `git diff --name-only --diff-filter=U`
- `git diff --check`
