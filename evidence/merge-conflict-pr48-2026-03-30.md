# 冲突解决汇报：PR #48

## 1. 背景
- base: `main`
- head: `deathcats4/codex/smashup-pod-base-alignment` (`b17ffec72a60a20576c3ab224f3a8335324580f7`)
- 触发命令: `git merge FETCH_HEAD --no-commit --no-ff`

## 2. 冲突文件
- `src/games/smashup/__tests__/factionSelection.test.ts`
- `src/games/smashup/ui/SmashUpCardRenderer.tsx`

## 3. 解决策略

### `src/games/smashup/ui/SmashUpCardRenderer.tsx`
- 策略：保留主线后续加上的泰坦图集 locale 回退，同时并入 PR 的 POD 基地变体选择与动态图集兜底注册。
- 合并要点：
  - 保留 `SMASHUP_ATLAS_IDS.TITANS` 的 `zh-CN` 强制回退，避免泰坦图集走英文目录后丢图。
  - 保留 `getBasePodVariantId` / `isBasePodVariantSelected` 驱动的 POD 基地 key 解析。
  - 保留 `ensureSmashUpAtlasRegistered()` + `useEffect()` 的惰性注册，避免新 POD atlas 首帧冷加载。
- 原因：两侧修改解决的是不同问题，直接取单边都会丢功能。

### `src/games/smashup/__tests__/factionSelection.test.ts`
- 策略：保留主线已有的 Oops 四派系/泰坦覆盖，并并入 PR 对 POD 基地池、atlas 映射和本地 POD 资源路径的回归测试。
- 合并要点：
  - 删除只服务旧 lookup helper 的断言，改保留 `getBasePodVariantId()` 的真实行为测试。
  - 保留主线已有的 `getFactionTitans()` 覆盖。
  - 并入 PR 对 Cthulhu POD 基地池、四组 POD atlas 映射、本地 atlas 路径的断言。
- 原因：测试需要同时覆盖主线后续能力和本 PR 的回归风险。

## 4. 额外发现与补修
- `src/games/smashup/data/cards.ts`
  - `getBasePodVariantId()` 会对已带 `_pod` 的基地再次追加后缀，已改为复用 `toPodId()`。
- `src/games/smashup/domain/reduce.ts`
  - `CARD_BOXED` 原先只从来源区移除卡牌，没有写入 `removedFromGame`，已补成真实“放回盒中”迁移。
- `src/games/smashup/criticalImageResolver.ts`
  - 原实现只靠 `previewRef` 预热基地图集，无法覆盖 `tts_atlas_*` POD 基地，也漏掉没有 `previewRef` 的 canonical POD 基地，已补成 `previewRef + englishAtlasMap` 双来源解析。
- `src/games/smashup/domain/atlasCatalog.ts`
  - 补出统一的 `getSmashUpPodAtlasImagePath()`，并让 `getSmashUpAtlasImageById()` 能解析 `tts_atlas_*`。
- `public/locales/en/game-smashup.json`
  - 补齐 8 个 Cthulhu POD 基地的 `abilityText`，其中 `The Asylum` / `Miskatonic University` 使用当前实现对应的新文案。
- `public/locales/zh-CN/game-smashup.json`
  - 补齐剩余 6 个 Cthulhu POD 基地缺失的 `abilityText`。

## 5. 风险评估
- 风险点：`criticalImageResolver` 现在会返回本地 `/assets/i18n/en/...` POD atlas 路径，需要确认预加载器接受已本地化路径。
- 风险点：POD locale 文案补齐后，英文悬浮层会开始显示 POD 文案，需要与当前实现保持一致。
- 风险点：`CARD_BOXED` 改为进入 `removedFromGame` 后，任何读取该区的 UI/规则都会真正看到这张牌；这是预期修复，但需要避免重复入盒。

## 6. 回归与行为变化登记
- 原 PR 目标问题：
  - POD 基地 atlas 映射错误，导致部分基地底图错误或空白。
  - Cthulhu POD 基地池映射不对，POD 派系拿错 canonical 基地。
  - `The Asylum` / `Miskatonic University Base` 的 POD 行为未对齐。
- 本次额外发现的真实回归：
  - `CARD_BOXED` 丢失卡牌实体，没有进入 `removedFromGame`。
  - `getBasePodVariantId()` 对已是 POD 的基地会生成 `*_pod_pod`。
  - `criticalImageResolver` 不会预热真实的 POD 基地图集。
  - 英文 POD 基地 locale 缺失 `abilityText`，会继续显示旧规则说明。
- 仅业务口径 / 规则变化：
  - 无；本次没有新增规则口径，仅让现有实现与 POD 文案/资源一致。

## 7. 验证清单与结果
- 已跑：`npx vitest run src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts src/games/smashup/__tests__/baseProtection.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts`
  - 结果：通过（94 tests passed）
- 已跑：`npx tsc -p tsconfig.json --noEmit --pretty false`
  - 结果：通过
- 已跑：`git diff --check -- src/games/smashup public/locales/en/game-smashup.json public/locales/zh-CN/game-smashup.json`
  - 结果：无空白错误；仅有工作区 CRLF 提示
- 未跑：
  - 全仓库质量门
  - E2E
  - 原因：工作区存在与本次 PR 无关的 `dicethrone` / 脚本改动，避免把无关脏改动卷入本次合并判断

## 8. 结果
- 提交：待本次 merge commit 生成；实际 hash 以本轮合并提交为准
- 推送：计划推送到 `origin/main`
