# Smash Up 反应资源模型重构证据

## 验证范围
- 反应排序主路径改为从事件、结构化交互 option、触发源上下文推导 `ResourceFootprint`，不再用旧 `effectContract` 作为排序依据。
- 未知交互形状必须形成带 reason 的 fallback audit；显式 fallback 按真实资源读写参与冲突比较。
- 蘑菇王国 + 对手幼苗：不弹“选择结算顺序”，走场上目标选择。
- 蘑菇王国 + 自己的新娘泰坦：蘑菇王国先按正常效果执行；新娘作为 optional timing window 通过泰坦本体点击/跳过处理。
- 旧 OR 代表路径（人鱼女王移动/控制分支）端到端不回归。
- Effect DSL 后续补强：Fairies/Titania OR 分支选项携带实际资源 footprint；初始分支选择、场上目标选择、剩余分支+跳过、最终收口均走原有 UI 链路。
- Fairies OR / 仙灵泰坦覆盖面补强：Titania、Puck、Magic Acorns、Fairy Ballet、Fairy Ring 的主要分支已接入 DSL primitive 或 option 级真实 footprint，不再只覆盖 Titania 单点。

## 验证命令与结果
```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__ --configLoader native --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/turnCycle.test.ts --configLoader native --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueOnMinionPlayed.test.ts src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts src/games/smashup/__tests__/reactionQueueOnMinionDiscardedFromBase.test.ts --configLoader native --maxWorkers 1
npm run typecheck
openspec validate refactor-smashup-reaction-resource-model --strict --no-interactive
npx eslint src/games/smashup/abilities/*.ts src/games/smashup/domain/baseAbilities.ts src/games/smashup/domain/baseAbilities_expansion.ts src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/reactionQueueOnMinionDiscardedFromBase.test.ts src/games/smashup/__tests__/reactionQueueOnMinionPlayed.test.ts src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts src/games/smashup/domain/types.ts src/games/smashup/domain/reactionResources.ts src/games/smashup/domain/reactionOrdering.ts src/games/smashup/domain/reactionSession.ts src/games/smashup/domain/ongoingEffects.ts src/games/smashup/domain/baseAbilityQueue.ts
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国面对对手幼苗时，应走场上选择且不弹结算顺序"
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序"
npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "人鱼女王应可选择移动其他玩家的一个仆从到这里"
npx eslint src/games/smashup/domain/branchingChoice.ts src/games/smashup/domain/reactionResources.ts src/games/smashup/domain/effectDsl.ts src/games/smashup/abilities/fairies.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/newFactionAbilities.test.ts -t "option 级真实资源|fairies_titania" --configLoader native
npx tsc --noEmit --pretty false
npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "Fairies OR 分支：Titania 会先执行已选分支，再给剩余分支与跳过"
npx eslint src/games/smashup/domain/effectDsl.ts src/games/smashup/abilities/fairies.ts src/games/smashup/domain/baseAbilities_expansion.ts src/games/smashup/domain/branchingChoice.ts src/games/smashup/domain/reactionResources.ts
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "fairies_puck|fairies_fairy_ballet|fairies_magic_acorns|base_fairy_ring|fairies_titania" --configLoader native
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueOrdering.test.ts -t "option 级真实资源|结构化交互 option" --configLoader native
npx tsc --noEmit --pretty false
npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "Fairies OR 分支：Fairy Ring 单分支确认会先执行该分支，再允许跳过剩余分支"
openspec validate refactor-smashup-effect-dsl-primitives --strict --no-interactive
```

结果：
- Smash Up 全量 Vitest：149 files passed、9 skipped；2188 tests passed、19 skipped。
- 反应队列定向 Vitest：3 files passed、57 tests passed；新增真实事件 footprint 回归：3 files passed、5 tests passed。
- TypeScript：通过。
- OpenSpec strict validate：通过。
- ESLint：0 errors；仅既有 warnings。
- E2E：3 条目标用例均通过（本轮重新运行并重新看图）。
- Effect DSL / Titania OR 补强：ESLint 0 errors；定向 Vitest 2 files passed、4 tests passed；TypeScript 通过；Titania OR E2E 1 passed，并已重新看图。
- Fairies OR / Fairy Ring 扩面：目标 ESLint 0 errors；newFactionAbilities 定向 7 passed；reactionQueueOrdering 定向 7 passed；TypeScript 通过；Fairy Ring E2E 1 passed，并已重新看图。

## 2026-05-10 21:25-21:34 最终复核：旧抽象删除 + 关键端到端复跑

本轮专门复核“结算顺序重构是否真的完成、旧抽象是否清掉”：

```bash
rg -n "effectContract|TriggerEffectContract|triggerEffectContract|wrapTriggerCallbackWithEffectContract|requireTriggerEffectContract|ReactionOrderingAtom|minionBoardState|handState|playLimits|sourceSelfState|turnFlags" src/games/smashup -S
npx tsc --noEmit --pretty false
openspec validate refactor-smashup-effect-dsl-primitives --strict --no-interactive
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts src/games/smashup/__tests__/ongoingEffects.test.ts src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts src/games/smashup/__tests__/reactionQueueBaseReplaceLki.test.ts src/games/smashup/__tests__/reactionQueueOnBaseRevealed.test.ts src/games/smashup/__tests__/reactionQueueOnMinionDiscardedFromBase.test.ts src/games/smashup/__tests__/reactionQueueOnMinionPlayed.test.ts src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts --configLoader native
npx eslint src/games/smashup/domain/types.ts src/games/smashup/domain/baseAbilityQueue.ts src/games/smashup/domain/baseAbilities.ts src/games/smashup/domain/ongoingEffects.ts src/games/smashup/domain/branchingChoice.ts src/games/smashup/domain/effectDsl.ts src/games/smashup/domain/reactionResources.ts src/games/smashup/domain/reactionOrdering.ts src/games/smashup/abilities/fairies.ts src/games/smashup/__tests__/baseAbilities.test.ts src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/reactionQueueBaseReplaceLki.test.ts src/games/smashup/__tests__/reactionQueueOnBaseRevealed.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/zombieInteractionChain.test.ts
PW_WORKERS=1 PW_E2E_FRONTEND_PORT=6473 PW_E2E_GAME_SERVER_PORT=20300 PW_E2E_API_SERVER_PORT=21300 npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国面对对手幼苗时，应走场上选择且不弹结算顺序"
PW_WORKERS=1 PW_E2E_FRONTEND_PORT=6473 PW_E2E_GAME_SERVER_PORT=20300 PW_E2E_API_SERVER_PORT=21300 npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序"
PW_WORKERS=1 PW_E2E_FRONTEND_PORT=6473 PW_E2E_GAME_SERVER_PORT=20300 PW_E2E_API_SERVER_PORT=21300 npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "Fairies OR 分支：Titania 会先执行已选分支，再给剩余分支与跳过"
PW_WORKERS=1 PW_E2E_FRONTEND_PORT=6473 PW_E2E_GAME_SERVER_PORT=20300 PW_E2E_API_SERVER_PORT=21300 npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "Fairies OR 分支：Fairy Ring 单分支确认会先执行该分支，再允许跳过剩余分支"
```

结果：
- `src/games/smashup` 旧抽象关键词无命中；`triggerEffectContract.ts` 已删除。
- TypeScript 通过。
- OpenSpec `refactor-smashup-effect-dsl-primitives` strict validate 通过。
- 结算顺序定向 Vitest：11 files passed、143 tests passed。
- ESLint：0 errors；保留 12 个既有 warnings。
- 4 条关键 E2E 均通过，并已实际打开截图核对：
  - 蘑菇王国 + 对手幼苗：1 passed。
  - 蘑菇王国 + 自己新娘泰坦：1 passed。
  - Titania OR：1 passed。
  - Fairy Ring OR：1 passed。

执行说明：默认托管 single-worker 端口 `6273/20100/21100` 当时被另一个 worktree 的 E2E runtime 占用，本轮未清理/终止对方进程；改用 `6473/20300/21300` 隔离端口完成复跑。

## 2026-05-10 相关端到端扩面复跑

用户追问“相关端到端是否只有这点”后，本轮继续补跑旧派系 OR、同回合开始反应、对手泰坦、以及同 frame 插队交互，覆盖面不再只限蘑菇王国 + 幼苗 / 新娘与 Titania / Fairy Ring 主路径。

```bash
$env:CODEX_MANAGED_BY_NPM='1'
Remove-Item Env:PW_WORKERS -ErrorAction SilentlyContinue
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "Invisible Ninja 同回合开始"
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "对手新娘泰坦"
npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "Wizard Neophyte 可选放入手牌"
npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "Zombie Walker 可选弃掉"
npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "Alien Scout 计分后可选返回手牌"
npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "同 frame 插队交互会先于剩余分支收口"
npx eslint e2e/smashup/smashup-gameplay.e2e.ts
```

结果：
- Invisible Ninja 同回合开始：1 passed。
- 蘑菇王国 + 对手新娘泰坦：1 passed。
- Wizard Neophyte 旧派系 OR：1 passed。
- Zombie Walker 旧派系 OR：1 passed。
- Alien Scout 计分后 OR：1 passed；该用例旧断言曾错误期待“选择先结算的强制效果”，已按新规则改为直接等待 `alien_scout_return` 并点击“返回手牌”。
- Titania 同 frame 插队交互：1 passed。
- ESLint：0 errors；仅保留该 E2E 文件既有 `any` warnings。


## 截图与肉眼结论

### 1. 蘑菇王国 + 对手幼苗：走场上选择，不弹排序
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈复现：蘑菇王国面对对手幼苗时，应走场上选择且不弹结算顺序/smashup-mushroom-opponent-sprout-field-selection.png`

肉眼观察：
- 顶部提示为“蘑菇王国：选择一个对手随从移动到蘑菇王国”，不是“选择结算顺序”。
- 对手幼苗卡牌本体有绿色高亮，说明使用真实场上目标选择。
- 中央只有跳过按钮，没有把对手幼苗效果放进当前玩家强制排序。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈复现：蘑菇王国面对对手幼苗时，应走场上选择且不弹结算顺序/smashup-mushroom-opponent-sprout-resolved.png`

肉眼观察：
- 幼苗已移动到蘑菇王国所在基地。
- UI 回到出牌阶段，流程已收口。

验收结论：达到“对手幼苗不是当前玩家的回合开始 optional，不参与强制排序”的要求。

### 2. 蘑菇王国 + 自己的新娘泰坦：先执行强制效果，再 optional 点击泰坦
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序/smashup-mushroom-own-bride-field-selection.png`

肉眼观察：
- 先出现蘑菇王国的真实场上选择提示。
- 没有“选择结算顺序”弹窗。
- 牌库旁可见自己的 The Bride，但没有抢在蘑菇王国前触发。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序/smashup-mushroom-own-bride-titan-click-window.png`

肉眼观察：
- Buccaneer 已被移动到蘑菇王国。
- 中央提示为“点击高亮泰坦执行效果，或选择跳过”。
- The Bride 本体在牌库旁有“可触发”徽标，中央有“让过”按钮；不是 generic reaction prompt。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序/smashup-mushroom-own-bride-branch-after-titan-click.png`

肉眼观察：
- 点击 The Bride 后进入“新娘：选择第一个效果”。
- 选项包含“放进盒中 / 消灭己方随从 / 移除+1指示物 / 跳过”，这是新娘自身正常效果交互。
- 没有停留在“是否打出/是否触发泰坦”的通用反应选择层。

验收结论：达到“正常效果顺序执行；optional titan 通过本体点击 + 跳过入口处理”的要求。

### 3. 旧 OR 代表：人鱼女王移动分支仍可端到端执行
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-robot-hoverbot-new.e2e/人鱼女王应可选择移动其他玩家的一个仆从到这里/mermaid-queen-move-prompt.png`

肉眼观察：
- 顶部提示为“人鱼女王：选择一个其他玩家的随从移到这里”。
- Microbot Guard 有绿色高亮，说明 OR 分支选择后进入真实场上目标选择。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-robot-hoverbot-new.e2e/人鱼女王应可选择移动其他玩家的一个仆从到这里/mermaid-queen-move-resolved.png`

肉眼观察：
- 人鱼女王与被移动的 Microbot Guard 已同处左侧基地。
- UI 回到出牌阶段，分支端到端完成。

验收结论：旧 OR 分支代表路径在资源模型重构后仍可正常执行。

### 4. Effect DSL / Titania OR：分支先选，再走场上选择，剩余分支带跳过
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/Fairies-OR-分支：Titania-会先执行已选分支，再给剩余分支与跳过/fairies-titania-branch-prompt-visible.png`

肉眼观察：
- 初始提示只展示两个分支按钮：“额外打出一个随从”和“将一个随从移回其拥有者手牌”。
- 目标随从 First Mate 没有混在初始分支选择里，说明不是把分支和目标选择揉成一层。
- 丛林之灵与 Titania 本体均在场，测试覆盖的是 OR 可执行两支的真实场景。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/Fairies-OR-分支：Titania-会先执行已选分支，再给剩余分支与跳过/fairies-titania-target-prompt-visible.png`

肉眼观察：
- 点击“返回随从”分支后，提示切换为“选择一个要移回其拥有者手牌的随从”。
- 画面没有通用弹窗遮住棋盘，目标选择走现有 `targetType=minion` 场上选择链路。
- 可见 First Mate 卡牌本体仍在母舰基地上，等待被真实点击选择。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/Fairies-OR-分支：Titania-会先执行已选分支，再给剩余分支与跳过/fairies-titania-follow-up-prompt-visible.png`

肉眼观察：
- First Mate 已不在母舰基地，说明“返回随从”分支已经先结算。
- 后续提示只剩“额外打出一个随从”和“跳过”，原“返回随从”分支已从选项中移除。
- 丛林之灵尚未标记本回合已用，符合“只有实际执行第二个分支时才消费 OR 升级”的流程。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/Fairies-OR-分支：Titania-会先执行已选分支，再给剩余分支与跳过/fairies-titania-sequential-resolved.png`

肉眼观察：
- 交互已全部关闭，右下角玩家行动额度显示“随从 1 / 战术 1”，证明额外随从额度已写入。
- First Mate 不在基地上；Titania 仍在母舰基地。
- 流程回到可继续出牌/结束回合状态。

验收结论：达到“先选择执行哪个 OR 分支；执行后选项减少，并提供跳过；返回随从走正常场上选择”的要求。当前实现还把 Titania 分支的真实资源 footprint 写入 simple-choice option，排序推导不需要手写 `effectContract`。

### 5. Fairy Ring / 仙灵泰坦：基地 OR 分支也先执行，再给剩余分支与跳过
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/Fairies-OR-分支：Fairy-Ring-单分支确认会先执行该分支，再允许跳过剩余分支/fairy-ring-follow-up-prompt-visible.png`

肉眼观察：
- 精灵之环与丛林之灵在同一基地可见，覆盖的是仙灵泰坦增强 OR 的基地能力场景。
- 已执行“额外打出一张行动卡”后，提示只剩“额外打出一个随从到这里”和“跳过”。
- 右下角行动额度已变为“战术 2”，证明第一分支已经真实写入，再进入剩余分支选择。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/Fairies-OR-分支：Fairy-Ring-单分支确认会先执行该分支，再允许跳过剩余分支/fairy-ring-sequential-resolved.png`

肉眼观察：
- 交互关闭，顶部 toast 显示获得额外行动机会。
- 右下角仍保留“战术 2”，流程回到可继续操作状态。
- 没有出现先选择排序编号或一次性多选两支的交互。

验收结论：Fairy Ring 的 OR 分支也符合“先选一支执行；执行后选项减少并可跳过”的流程，并且分支 option 已携带 DSL primitive footprint。


### 6. 蘑菇王国 + Invisible Ninja：对方反应不制造排序弹窗
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈复现：蘑菇王国-+-Invisible-Ninja-同回合开始时，应直接进入真实交互，不先弹结算顺序/smashup-mushroom-invisible-first-prompt.png`

肉眼观察：
- 顶部提示为“蘑菇王国：选择一个对手随从移动到蘑菇王国”，不是“选择结算顺序”。
- Invisible Ninja 在右侧基地上可见，但没有作为当前强制排序选项抢先出现。
- 当前仍走蘑菇王国自身的场上选择链路，中央只有跳过按钮。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈复现：蘑菇王国-+-Invisible-Ninja-同回合开始时，应直接进入真实交互，不先弹结算顺序/smashup-mushroom-invisible-resolved.png`

肉眼观察：
- 目标随从已移动到蘑菇王国所在基地。
- 流程回到出牌阶段，未残留排序弹窗或待处理反应。

验收结论：达到“无真实资源冲突时不强制弹排序；当前效果按正常场上选择执行”的要求。

### 7. 蘑菇王国 + 对手新娘泰坦：对手 optional 泰坦不参与当前强制排序
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈复现：蘑菇王国面对对手新娘泰坦时，应走场上选择且不弹结算顺序/smashup-mushroom-opponent-bride-field-selection.png`

肉眼观察：
- 顶部仍是蘑菇王国的场上目标选择提示。
- 对手 The Bride 在目标基地上可见，但没有弹“是否触发泰坦”或“选择结算顺序”。
- 目标随从有绿色可选高亮，说明继续使用正常场上选择。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈复现：蘑菇王国面对对手新娘泰坦时，应走场上选择且不弹结算顺序/smashup-mushroom-opponent-bride-resolved.png`

肉眼观察：
- 目标随从已移动到蘑菇王国基地。
- The Bride 仍留在原基地；流程已回到出牌阶段。

验收结论：达到“对手 optional 泰坦不会被当作当前玩家 mandatory 排序项”的要求。

### 8. 旧派系 OR / Wizard Neophyte：确认式 OR 仍可完整走额外行动分支
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/老派系-OR：Wizard-Neophyte-可选放入手牌或作为额外行动打出，并能走完整额外行动链路/legacy-or-wizard-neophyte-prompt-visible.png`

肉眼观察：
- 中央提示为 P1 牌库顶“秘术学习”的处理方式。
- 两个按钮分别是“放入手牌”和“作为额外行动打出”，没有出现排序编号或多选 UI。
- Wizard Neophyte 与基地状态可见，覆盖旧派系 OR 的真实牌库顶确认链路。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/老派系-OR：Wizard-Neophyte-可选放入手牌或作为额外行动打出，并能走完整额外行动链路/legacy-or-wizard-neophyte-play-extra-resolved.png`

肉眼观察：
- “秘术学习”已作为额外行动打出到基地区域。
- 右下角显示行动额度变化，流程回到可继续操作状态。

验收结论：旧派系 OR 的确认式分支没有被 Effect DSL / 结算顺序重构破坏。

### 9. 旧派系 OR / Zombie Walker：弃牌分支仍直接按自身交互执行
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/老派系-OR：Zombie-Walker-可选弃掉或放回牌库顶，并能走完整弃牌分支/legacy-or-zombie-walker-prompt-visible.png`

肉眼观察：
- 中央提示为牌库顶“大副”的处理方式。
- 按钮是“弃掉”和“放回牌库顶”，没有插入结算顺序选择。
- Zombie Walker 在基地上，覆盖的是老派系墓地/牌库顶 OR 链路。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/老派系-OR：Zombie-Walker-可选弃掉或放回牌库顶，并能走完整弃牌分支/legacy-or-zombie-walker-discard-resolved.png`

肉眼观察：
- 大副已进入弃牌区侧边展示。
- 交互关闭，流程回到出牌阶段。

验收结论：旧派系 OR 的弃牌分支仍能端到端结算，不受新排序模型影响。

### 10. 旧派系 OR / Alien Scout：计分后直接进入自身返回/留场交互
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/老派系-OR：Alien-Scout-计分后可选返回手牌或留在基地，并能走完整返回手牌链路/legacy-or-alien-scout-prompt-visible.png`

肉眼观察：
- 顶部提示为“侦察兵：基地记分后，是否将此侦察兵返回手牌？”。
- 可见两个按钮“返回手牌 / 留在基地”，不是“选择先结算的强制效果”。
- 计分 VP 跳字仍在画面中，说明这是基地计分后的真实时点。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/老派系-OR：Alien-Scout-计分后可选返回手牌或留在基地，并能走完整返回手牌链路/legacy-or-alien-scout-return-in-hand.png`

肉眼观察：
- 侦察兵卡牌本体出现在手牌截图中，证明“返回手牌”分支已经真实写入状态。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/老派系-OR：Alien-Scout-计分后可选返回手牌或留在基地，并能走完整返回手牌链路/legacy-or-alien-scout-return-resolved.png`

肉眼观察：
- 基地区域已清场/淡出，侦察兵不再留在原计分基地。
- 玩家手牌侧可见后续卡牌，流程回到可继续出牌阶段。

验收结论：旧测试中“先期待强制排序”的断言是旧口径错误；新口径应直接进入 Alien Scout 自身 optional 交互，并能完成返回手牌。

### 11. Titania OR 插队：同 frame 新交互先处理，再回到剩余分支/收口
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/Fairies-OR-分支：同-frame-插队交互会先于剩余分支收口/fairies-titania-inserted-interaction-visible.png`

肉眼观察：
- 顶部/中央提示为“模拟返回时插队交互”，说明返回分支触发的新交互先进入队列。
- Titania、丛林之灵和目标随从仍在场，覆盖的是 OR 分支执行过程中的插队场景。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/Fairies-OR-分支：同-frame-插队交互会先于剩余分支收口/fairies-titania-follow-up-after-inserted-visible.png`

肉眼观察：
- 插队交互完成后，提示回到 Titania 剩余分支“额外打出一个随从”和“跳过”。
- 没有直接吞掉剩余分支，也没有把插队交互排到 OR 收口之后。

截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/Fairies-OR-分支：同-frame-插队交互会先于剩余分支收口/fairies-titania-inserted-interaction-resolved.png`

肉眼观察：
- 交互关闭，画面回到可继续操作状态。
- Titania 与丛林之灵仍在基地上，流程没有卡在待处理分支。

验收结论：达到“一个 OR 分支执行后若产生同 frame 插队交互，应先处理插队，再回到剩余分支/跳过收口”的要求。

## 审计结论
- 当前发布口径已收口：L1 结构（footprint 类型/事件覆盖/fallback audit）、L2 行为（Smash Up 全量 Vitest 2188 条通过 + 反应队列定向回归）、L3 真实入口 E2E（核心路径 + 旧派系 OR + 插队链路均已通过并看图）、L4 evidence 证据均已覆盖。
- 旧 `effectContract` / `TriggerEffectContract` / `ReactionOrderingAtom` 抽象已从 `src/games/smashup` 删除；能力/基地/泰坦注册里的手写读写合同参数已清理。当前结算顺序只吃真实 `ResourceFootprint`、runtime artifact / 结构化 interaction option footprint，以及带 reason 的少量 `fallbackFootprint`。
- optional 不参与 mandatory 强制排序；mandatory 之间只有真实资源 footprint 冲突才弹“选择结算顺序”。轮到某个效果时再进入该效果原本的场上选择、分支选择、泰坦点击或跳过链路。
