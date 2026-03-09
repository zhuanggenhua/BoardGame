# 全仓真实差异复审交接文档（2026-03-09）

## 1. 当前任务口径

- 任务已经从“只看 POD / 只看高风险”切换为：**全仓真实语义 diff 全量复审**。
- 审查对象不只包括新增错误逻辑，也包括：
  - 回滚了用户已经修好的逻辑；
  - 删除了用户原本好的内容；
  - 混入了审计/调试/试验残留。
- **不能**把用户当前正在新增的正常内容自动判成错误内容。
- **只有明确已经审过且结论稳定的点**，才允许跳过。

### 重要说明：这不是“只审重点文件”

- 本文档记录的是**截至写文档那个时点**，对“当时那批真实 diff”的复审结果摘要。
- 摘要里重点展开的是：
  - 新发现并修掉的真实漏洞；
  - 明确应保留的有效修复；
  - 明确应清掉的残留。
- **这不等于只审了这些文件。**
- 实际执行口径仍然是：**对当时 `git diff -w --name-only` 里那一整批真实 diff 做全量复审**，而不是只挑重点文件。
- 之所以没有把每个文件逐行展开写进交接文档，只是为了避免文档过长、失去可读性；不是缩小了审查范围。

## 1.1 历史上下文：原始 POD 提交与既有审计材料

### 原始 POD 提交 ID

- 既有审计材料中反复引用的原始 POD 提交为：
  - 短哈希：`6ea1f9f`
  - 完整哈希：`6ea1f9f069d2cbec322636f9cc0455bc21437ad8`
- 该信息可在以下现有文档中找到：
  - `evidence/summonerwars-files.txt`
  - `evidence/audit-methodology.md`
  - `evidence/audit-tracking-overview.md`
  - `evidence/VALIDATION-FIX-COMPLETE.md`
- 注意：
  - 当前本地 Git 历史里，`git show 6ea1f9f` / `git show 6ea1f9f069d2cbec322636f9cc0455bc21437ad8` 可能无法直接解析；
  - 但仓库内大量既有审计文档都把它当作原始 POD 提交来引用；
  - 因此后续交接和复审说明里，**必须显式记录这个提交 ID**，不能省略。

### 已存在、必须纳入上下文的审计文档

以下不是“新增文档”，而是仓库内已经存在、与本次持续复审直接相关的材料：

- 总览 / 方法论
  - `evidence/audit-tracking-overview.md`
  - `evidence/audit-methodology.md`
  - `evidence/audit-results-complete.md`
  - `evidence/DEEP-REAUDIT-ANALYSIS.md`
  - `evidence/DEEP-AUDIT-COMPLETE.md`
- POD / recovery / reaudit 主线
  - `evidence/POD-AUDIT-COMPLETE.md`
  - `evidence/POD-AUDIT-MISSING-ITEMS.md`
  - `evidence/POD-AUDIT-USER-CHANGES-CHECK.md`
  - `evidence/pod-commit-scope-audit.md`
  - `evidence/pod-reaudit-progress.md`
  - `evidence/pod-reaudit-conclusion.md`
  - `evidence/pod-reaudit-complete.md`
  - `evidence/POD-REAUDIT-COMPLETE-FINAL.md`
  - `evidence/POD-REAUDIT-FINAL-COMPLETE.md`
  - `evidence/REAUDIT-COMPLETE.md`
  - `evidence/POD-RECOVERY-PLAN.md`
  - `evidence/POD-RECOVERY-COMPLETE.md`
  - `evidence/POD-RECOVERY-FINAL-SUMMARY.md`
  - `evidence/POD-RECOVERY-VERIFICATION-COMPLETE.md`
- 关键专项审计 / 反思
  - `evidence/VALIDATION-FIX-COMPLETE.md`
  - `evidence/TEST-FIXES-COMPLETE.md`
  - `evidence/TEMPLE-FIRSTMATE-TESTS-PASSED.md`
  - `evidence/ULTIMATE-SHIELD-IMMUNITY-VERIFIED.md`

### 历史材料口径统一说明

- `evidence/pod-reaudit-progress.md` 是**阶段性进度快照**，其中“需要检查 / 待查”只代表 2026-03-04 当时的中间状态；
- 该批剩余项后续已由 `evidence/POD-REAUDIT-REMAINING-20-FILES.md` 收口；
- 当前 POD 历史材料的**最终口径**以 `evidence/pod-reaudit-conclusion.md` 为准：
  - `316/316` 文件
  - `100%` 审计完成
  - “已恢复 / 已重构 / 合理删除”均已归档到最终结论，不应再把旧进度文档里的“待查”当成当前状态。

### 本次交接遗漏说明

- 之前的交接文档没有写出原始 POD 提交 ID，也没有明确挂出这些既有审计文档；
- 这是交接质量问题，不是任务范围变小；
- 后续继续任务时，必须把“当前真实 diff 复审”与“既有 POD 审计上下文”一起带上，避免再次脱离历史材料单独叙述。

## 2. 审查原则

- 主要依据：
  - `git -c safe.directory=F:/gongzuo/webgame/BoardGame -c core.autocrlf=false diff -w --name-only`
  - `git -c safe.directory=F:/gongzuo/webgame/BoardGame -c core.autocrlf=false diff -w --numstat`
- 不依赖 `git status` 判断真实语义改动。
- 不使用 `git reset`、`git restore`、`git revert` 之类回退命令。
- 只在两类场景下删/改：
  1. 能明确证明是审计/调试/试验残留；
  2. 能明确证明会回滚用户已修好的逻辑，或把旧目标复活/复制回来。

## 3. 已完成复审范围

### 引擎 / 通用层

- `src/engine/systems/InteractionSystem.ts`
- `src/engine/systems/SimpleChoiceSystem.ts`
- `src/engine/systems/index.ts`
- `src/engine/transport/server.ts`
- `src/engine/transport/__tests__/server.test.ts`
- `src/engine/types.ts`

结论：这组属于有效通用修复，当前保留。

### Dice Throne

- `src/games/dicethrone/Board.tsx`
- `src/games/dicethrone/ui/AbilityChoiceModal.tsx`
- `src/games/dicethrone/ui/AbilityOverlays.tsx`
- `src/games/dicethrone/ui/HandArea.tsx`
- `src/games/dicethrone/hooks/useAttackShowcase.ts`
- `src/games/dicethrone/__tests__/cross-hero.test.ts`
- `src/games/dicethrone/__tests__/righteous-combat-variant-selection.test.ts`
- `src/games/dicethrone/ui/abilityChoiceText.ts`
- `src/games/dicethrone/ui/abilitySlotMapping.ts`
- `public/locales/en/game-dicethrone.json`

结论：这组变体技能修复有效，当前保留。

### SmashUp：UI / locale / data / domain / abilities / tests

已逐批复审：

- UI / 文案 / 元数据：
  - `src/games/smashup/Board.tsx`
  - `src/games/smashup/ui/BaseZone.tsx`
  - `src/games/smashup/ui/HandArea.tsx`
  - `src/games/smashup/ui/SmashUpCardRenderer.tsx`
  - `src/games/smashup/ui/factionMeta.ts`
  - `public/locales/en/game-smashup.json`
  - `public/locales/zh-CN/game-smashup.json`
- 数据 / 元数据：
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/data/factions/ninjas.ts`
  - `src/games/smashup/data/factions/pirates_pod.ts`
- 逻辑层：
  - `src/games/smashup/abilities/*.ts` 当前真实 diff 涉及文件
  - `src/games/smashup/domain/abilityHelpers.ts`
  - `src/games/smashup/domain/baseAbilities.ts`
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/domain/events.ts`
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/domain/reducer.ts`
  - `src/games/smashup/domain/systems.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/utils.ts`
- 测试层：
  - `src/games/smashup/__tests__/*` 当前真实 diff 涉及文件
  - `src/games/smashup/__tests__/helpers/simpleChoiceAst.ts`

### E2E 测试框架

- `e2e/framework/GameTestContext.ts`

结论：不是忍者试验残留，而是现有状态注入能力增强，当前保留。

### 本轮补充复审：之前文档未单列但当前 diff 已补看

- 文档 / 配置：
  - `AGENTS.md`
  - `docs/automated-testing.md`
  - `playwright.config.ts`
- 引擎 / transport / domain：
  - `src/engine/systems/__tests__/InteractionSystem-auto-injection.test.ts`
  - `src/engine/transport/react.tsx`
  - `src/games/smashup/domain/index.ts`
- E2E：
  - `e2e/smashup-robot-hoverbot-chain.e2e.ts`
  - `e2e/test-mode-basic.e2e.ts`
  - `e2e/smashup-afterscoring-card-play.e2e.ts`

结论：

- `AGENTS.md` / `docs/automated-testing.md` / `playwright.config.ts` 当前属于测试规范、环境隔离与旧 E2E 发现隔离的有效补充，保留。
- `src/engine/systems/__tests__/InteractionSystem-auto-injection.test.ts` 是对通用刷新、live 校验与兼容字段映射的有效覆盖补强，保留。
- `src/engine/transport/react.tsx` 把最小化空白状态初始化从历史遗留的 `sys.flow.phase` 改为现行的 `sys.phase`，属于有效修复，保留。
- `src/games/smashup/domain/index.ts` 当前真实 diff 中保留的是 afterScoring 响应窗口打开事件透传修复，判断为有效。
- `e2e/smashup-robot-hoverbot-chain.e2e.ts` 与 `e2e/test-mode-basic.e2e.ts` 当前判断是有效测试；其中 `test-mode-basic` 走的是仓库当前真实可用的 `/play/<gameId>/test` TestHarness 流程，不按“旧 fixture”判残留。
- 旧 `e2e/smashup-afterscoring-card-play.e2e.ts` 的删除属于淘汰旧 `fixtures + harness.state.patch()` 模式；其新框架替代稿为 `e2e/smashup-afterscoring-simple-complete.e2e.ts`，当前保留为未跟踪有效文件。

## 4. 已修掉的真实逻辑问题

### 4.1 `base_the_mothership` stale 回手

- 文件：`src/games/smashup/domain/baseAbilities.ts`
- 处理：改成 `buildValidatedReturnEvents(...)`
- 结果：避免旧快照目标离场后又被回手。

### 4.2 `innsmouth_return_to_the_sea` 错误 `fromBaseIndex` + stale 回手

- 文件：`src/games/smashup/abilities/innsmouth.ts`
- 处理：
  - 选项 value 携带 `baseIndex`
  - handler 改成 `buildValidatedReturnEvents(...)`
- 结果：避免 afterScoring 响应窗口中把旧目标错误回手。

### 4.3 `elder_thing_elder_thing_choice` stale 放牌库底

- 文件：`src/games/smashup/abilities/elder_things.ts`
- 处理：改成 `buildValidatedCardToDeckBottomEvents(...)`
- 结果：避免远古之物已离场后仍被旧交互塞回牌库底。

### 4.4 `frankenstein_angry_mob_choose_card` stale 手牌塞牌库底

- 文件：`src/games/smashup/abilities/frankenstein.ts`
- 处理：改成 `buildValidatedCardToDeckBottomEvents(...)`
- 结果：避免已离开手牌的卡又被旧交互塞回牌库底。

### 4.5 之前同轮已补的两个点

- `base_nine_lives_intercept`：改成验证后移动。
- `ninja_disguise_choose_play2`：修正错误状态读取。

### 4.6 `scoreBases` halt 时吞掉 `RESPONSE_WINDOW_OPENED`

- 文件：`src/games/smashup/domain/index.ts`
- 处理：`onPhaseExit` 在检测到 afterScoring 响应窗口打开时，`halt: true` 仍显式透传 `RESPONSE_WINDOW_OPENED`
- 结果：transport / UI 侧能收到窗口打开事件，不会只改状态不发事件。

## 5. 已确认保留的有效修复

### SmashUp

- `src/games/smashup/domain/abilityHelpers.ts`
  - `buildValidatedMoveEvents(...)`
  - `buildValidatedDestroyEvents(...)`
  - `buildValidatedReturnEvents(...)`
  - `buildValidatedCardToDeckBottomEvents(...)`
- `src/games/smashup/domain/utils.ts`
  - `matchesDefId(...)`
  - 额外随从额度 / 基地额度 / 力量上限辅助函数
- `src/games/smashup/domain/commands.ts`
  - 额外随从额度与力量上限校验修复
- `src/games/smashup/Board.tsx`
  - UI 层与命令层对齐的额外随从可打出检查
- `src/games/smashup/abilities/killer_plants.ts`
  - `autoRefresh: 'deck'`
  - `responseValidationMode: 'live'`
  - 多嫩芽共享牌库候选时的实时刷新与去重
- `src/games/smashup/abilities/wizards.ts`
  - `wizard_neophyte` / `wizard_scry` 等牌库实时校验
  - `CARD_REMOVED_FROM_DECK`
- `src/games/smashup/domain/systems.ts`
  - `pendingPostScoringActions` 延后执行
- `src/games/smashup/ui/factionMeta.ts`
  - 缺失 POD 阵营元数据补齐
- `public/locales/en/game-smashup.json`
  - POD 阵营文案补齐
  - 多张 POD 卡牌的专属文案补齐

### 仍保留的未跟踪有效文件

- `e2e/smashup-afterscoring-simple-complete.e2e.ts`
- `src/games/dicethrone/ui/abilityChoiceText.ts`
- `src/games/dicethrone/ui/abilitySlotMapping.ts`
- `src/games/smashup/__tests__/helpers/simpleChoiceAst.ts`

## 6. 已清掉的明确残留

本轮新增清理：

- `e2e/framework-pilot-ninja-infiltrate.e2e.ts`
- `evidence/framework-pilot-ninja-infiltrate-fix.md`
- `src/games/smashup/__tests__/ninja-infiltrate-unit.test.ts`
- `src/games/smashup/__tests__/ninjaInfiltrateUnit.test.ts`
- `test-ninja-log.txt`
- `test-ninja-log2.txt`
- `test-ninja-log3.txt`

并把其中真正有价值的忍者渗透断言并回现有测试：

- `src/games/smashup/__tests__/baseFactionOngoing.test.ts`

新增并回的断言包括：

- 多个基地战术时创建选择交互
- 只有一个基地战术时自动消灭
- 没有基地战术时不创建交互也不多发事件

## 7. 当前验证状态

- `npm run typecheck`：通过
- `npx vitest run src/games/smashup/__tests__/baseFactionOngoing.test.ts --config vitest.config.ts`
  - 当前环境失败于 `spawn EPERM`
  - 这是本机 `vitest/esbuild` 环境问题，不是本轮新增逻辑错误

## 8. 当前结论

- 以**当前这批真实 diff**为准，已经完成一轮全量复审。
- 本轮没有再发现新的“删掉用户原本好东西”的点。
- 本轮新增处理结果主要是：
  - 补掉几处真实 stale / 回滚类漏洞；
  - 清掉一组明显的忍者试验残留；
  - 补看并挂出了之前交接里没单列的文档 / 配置 / E2E / transport / domain 差异；
  - 其余保留项当前判断均为有效修复。

## 9. 下一窗口继续方式

如果用户在新窗口继续，请先重新拉一遍**最新真实 diff**，因为工作树仍可能继续变化：

```powershell
git -c safe.directory=F:/gongzuo/webgame/BoardGame -c core.autocrlf=false diff -w --name-only
git -c safe.directory=F:/gongzuo/webgame/BoardGame -c core.autocrlf=false diff -w --numstat
```

然后按以下顺序继续：

1. 先看是否出现了**新的真实 diff**；
2. 如果只是 `status` 变了、`diff -w` 没变，不要误判；
3. 如果有新增真实 diff：
   - 先判断是否是用户当前正常新增；
   - 再判断是否属于审计/调试残留；
   - 最后判断是否回滚了用户已修好的逻辑；
4. 每轮汇报都给两个百分比：
   - **当前真实 diff 审查完成度**
   - **整个持续任务的整体完成度**

### 额外说明

- 因为工作树是持续变化的，**交接文档中的“已复审范围”只代表写文档时的那一批 diff**。
- 如果新窗口重新拉 `git diff -w --name-only` 后，发现文件列表比本文档更多，说明这是**后续新增差异**，需要继续审，不代表之前“只审了重点文件”。

## 10. 百分比口径

- 对**当前这批已拉取的真实 diff**：
  - 审查完成度可按 **100%** 报
- 对**整个持续变化中的任务**：
  - 只能按“截至当前工作树”的估算值汇报
  - 若用户继续恢复/新增内容，整体完成度会动态变化

推荐后续固定汇报格式：

- 当前真实 diff 审查完成度：`XX%`
- 整体任务完成度：`YY%`
- 本轮新增修复：`...`
- 本轮新增清理：`...`
- 当前保留有效项：`...`
