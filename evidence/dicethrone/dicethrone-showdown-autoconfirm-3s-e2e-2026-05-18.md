# DiceThrone Showdown 自动确认统一 3 秒验证（2026-05-18）

## 范围

- 游戏：`dicethrone`
- 角色：`Gunslinger vs Monk`
- 目标：
  1. `compare-roll` 无按钮确认链路统一使用 `3000ms`
  2. `Showdown` 联机双页特写在 3 秒后仍能自动收口
  3. 自动确认计时器不再因为父级重渲染被反复重置

## 代码结论

- `src/games/dicethrone/ui/CompareRollOverlay.tsx`
  - 默认自动确认时间从 `1500` 调整为 `3000`
  - 自动确认改为通过 `ref` 持有最新 `onConfirm`，计时器只跟 `compareRollId / isVisible / canResolve / hasOptions / autoConfirmDelayMs` 绑定，不再被普通重渲染打断
- `src/games/dicethrone/domain/customActions/gunslinger.ts`
  - 删除 `Showdown` 与 `Duel` 失败分支的 `1300ms` 特例，统一回落到 compare-roll 默认值
- `src/games/dicethrone/ui/__tests__/CompareRollOverlay.test.tsx`
  - 新增回归测试：重渲染时不应重置 3 秒自动确认计时器

## 验证命令

```powershell
npx vitest run src/games/dicethrone/ui/__tests__/CompareRollOverlay.test.tsx
npx vitest run src/games/dicethrone/__tests__/cross-hero.test.ts -t "showdown uses compare-roll-choice and confirms into bonus damage"
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-showdown-multiplayer.e2e.ts "枪手 Showdown 应在联机双方页面同时展示枪战决斗特写并自动收口"
```

结果：

- `CompareRollOverlay.test.tsx` 2/2 通过
- `cross-hero.test.ts` 指定用例通过
- `dicethrone-showdown-multiplayer.e2e.ts` 指定用例通过

## 关键截图

### 1. guest 侧特写打开时，确实是枪战决斗本体，不是日志

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-showdown-multiplayer.e2e\枪手-Showdown-应在联机双方页面同时展示枪战决斗特写并自动收口\showdown-guest-open.png`
- 我实际看到：
  1. 画面中央是 `枪战决斗` 标题，下方能直接看到两颗对掷骰子本体，不是底部手牌，也不是 action log。
  2. 背景仍是 Showdown 卡图，说明这是一层 compare-roll 特写覆盖层，而不是普通卡牌预览。
  3. 结果文案仍在特写层内，符合“展示双方骰面后等待自动确认”的目标场景。
- 验收判定：达标，已证明联机链路里的 Showdown 特写本体真实出现。

### 2. host 侧特写收口后，流程回到可继续推进的棋盘

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-showdown-multiplayer.e2e\枪手-Showdown-应在联机双方页面同时展示枪战决斗特写并自动收口\showdown-host-closed.png`
- 我实际看到：
  1. compare-roll 特写已经关闭，画面回到完整棋盘，没有残留遮罩。
  2. 左侧阶段条高亮在 `5. 掷骰防御阶段`，说明自动确认完成后链路已经继续推进。
  3. host 侧 HUD、手牌和棋盘都保持正常布局，没有因为特写收口卡死或停在半透明覆盖层上。
- 验收判定：达标，已证明 owner 侧在 3 秒自动确认后能正常收口并继续流程。

### 3. guest 侧也同步收口，没有停留在旧特写

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-showdown-multiplayer.e2e\枪手-Showdown-应在联机双方页面同时展示枪战决斗特写并自动收口\showdown-guest-closed.png`
- 我实际看到：
  1. guest 侧也已经回到棋盘主视图，看不到 compare-roll 浮层残留。
  2. 左侧阶段条同样来到 `5. 掷骰防御阶段`，说明双页状态同步收口。
  3. 右侧防御按钮与骰子区仍可见，页面处于可继续操作状态，不是被旧 overlay 卡住。
- 验收判定：达标，已证明非 owner 侧不会因为 3 秒自动确认而留在过期特写里。

## 结论

- 之前 `Showdown` 看起来不像“统一 3 秒”，根因不是业务数据录错，而是 compare-roll 默认值、枪手特例值和前端计时器行为三处不一致。
- 现在已经统一为 `3000ms`，并修掉了“父级重渲染会把自动确认计时器反复重置”的实现问题。
- 本轮联机 E2E 已再次证明：`Showdown` 双页特写会出现，3 秒后会自动收口，并继续推进到 `defensiveRoll`。
