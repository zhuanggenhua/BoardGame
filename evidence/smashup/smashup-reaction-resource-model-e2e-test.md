# Smash Up 反应资源模型与新娘泰坦 E2E 证据

## 验证范围
- 蘑菇王国回合开始强制效果与自己的新娘泰坦 optional special 同时存在时，不应弹“选择结算顺序”。
- 蘑菇王国应先走正常场上随从选择交互。
- 蘑菇王国执行后，新娘泰坦仍作为 optional timing window 保留，并通过泰坦本体高亮点击触发，旁边保留跳过入口。

## 验证命令
```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序"
```

结果：通过（1 passed）。

补充验证：
```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/turnCycle.test.ts --configLoader native --maxWorkers 1 -t "footprint|蘑菇王国|The Bride|mandatory|ordering|泛滥横行|Invisible Ninja|新娘|幼苗"
npx eslint src/games/smashup/domain/types.ts src/games/smashup/domain/reactionResources.ts src/games/smashup/domain/reactionOrdering.ts src/games/smashup/domain/reactionSession.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/Board.tsx src/games/smashup/ui/BaseZone.tsx src/games/smashup/ui/DeckDiscardZone.tsx e2e/smashup/smashup-base-minion-selection.e2e.ts
```
Vitest 通过；ESLint 0 errors，存在既有 warnings。

## 截图与肉眼结论

### 1. 蘑菇王国先走场上选择
截图：`D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序\smashup-mushroom-own-bride-field-selection.png`

肉眼观察：
- 顶部提示为“蘑菇王国：选择一个对手随从移动到蘑菇王国”，不是“选择结算顺序”。
- 场上 Buccaneer 随从有绿色可选高亮，说明交互落在真实场上随从选择。
- 画面底部可看到自己的 The Bride 泰坦在牌库旁，但此时没有抢在蘑菇王国前弹 optional 选择。

验收结论：达到“mandatory 蘑菇王国先按正常效果执行，optional 新娘不参与强制排序”的要求。

### 2. 蘑菇王国执行后进入新娘泰坦 timing window
截图：`D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序\smashup-mushroom-own-bride-titan-click-window.png`

肉眼观察：
- Buccaneer 已移动到蘑菇王国。
- 中央提示为“点击高亮泰坦执行效果，或选择跳过”，没有 generic “选择一个反应动作”弹窗。
- The Bride 泰坦本体在牌库旁显示黄色“可触发”徽标，中央有“让过”按钮。

验收结论：达到“通过泰坦本体点击 + 跳过入口处理 optional titan special”的要求。

### 3. 点击泰坦后进入新娘正常分支选择
截图：`D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序\smashup-mushroom-own-bride-branch-after-titan-click.png`

肉眼观察：
- 点击 The Bride 后出现“新娘：选择第一个效果”弹窗。
- 分支选项包含“放进盒中 / 消灭己方随从 / 移除+1指示物 / 跳过”，说明点击泰坦后进入新娘自身的正常效果交互。
- 没有停留在“是否打出/是否触发泰坦”的通用反应选择层。

验收结论：达到“点击泰坦后执行正常效果交互，不再用通用反应弹窗替代”的要求。


## 补充覆盖：对手幼苗与旧 OR 分支

### 4. 蘑菇王国 + 对手幼苗
命令：
```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国面对对手幼苗时，应走场上选择且不弹结算顺序"
```
结果：通过（1 passed）。

截图：`D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国面对对手幼苗时，应走场上选择且不弹结算顺序\smashup-mushroom-opponent-sprout-field-selection.png`

肉眼观察：
- 顶部提示是蘑菇王国移动对手随从，未出现“选择结算顺序”。
- 对手幼苗卡牌本体有绿色高亮，说明仍走场上目标选择。
- 中央只保留跳过按钮，没有把对手幼苗的可选牌库效果放进当前玩家的强制排序。

验收结论：达到“对手幼苗不是你的、也不在你的回合触发 optional 效果”的要求。

### 5. 旧分支代表：人鱼女王 OR 分支仍可端到端执行
命令：
```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "人鱼女王应可选择移动其他玩家的一个仆从到这里"
```
结果：通过（1 passed）。

截图 1：`D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\人鱼女王应可选择移动其他玩家的一个仆从到这里\mermaid-queen-move-prompt.png`

肉眼观察：
- 顶部提示为“人鱼女王：选择一个其他玩家的随从移到这里”。
- 目标 Microbot Guard 卡牌有绿色高亮，说明 OR 分支选择后进入真实场上目标选择，不是停在抽象分支桶。

截图 2：`D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\人鱼女王应可选择移动其他玩家的一个仆从到这里\mermaid-queen-move-resolved.png`

肉眼观察：
- 人鱼女王与被移动的 Microbot Guard 已同处左侧基地。
- UI 回到出牌阶段，说明旧 OR 分支端到端完成并收口。

验收结论：旧 OR 分支代表路径在当前重构后仍可端到端执行。
