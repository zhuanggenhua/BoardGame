# SmashUp 随从入场动画回归检查（2026-04-08）

## 用户反馈

- 大杀四方里，教程或他人出牌时，随从入场动画看起来会卡顿，像开头反复播放，甚至主观上像“牌停在中间不走”。

## 本轮代码侧改动

- `src/games/smashup/ui/BaseZone.tsx`
  - 按 controller 记录当前基地上的随从 UID 快照
  - 仅把“本次新进入基地的 UID”标记为 `shouldAnimateEntry`
  - 不再让所有已存在随从因为父层重渲染重复走 `initial`
- `src/games/smashup/ui/BaseZone.tsx / MinionCard`
  - `initial` 改成只在 `shouldAnimateEntry` 时生效
  - 去掉与 motion 并行竞争的内联 `style.transform`
- `src/games/smashup/Board.tsx`
  - 为随从节点补 `data-tutorial-id={minion.uid}`，方便教程链路定位
  - 兼容教程手牌弃置 prompt，避免教程交互门控误伤这条链路

## 本轮验证

### ESLint

```powershell
npx eslint src/games/smashup/ui/BaseZone.tsx src/games/smashup/Board.tsx src/components/tutorial/TutorialOverlay.tsx
```

结果：
- 0 error
- `Board.tsx` 仅有仓库当前的 purity warning，本轮未新增 error

### E2E 1：首个随从入场时分数条平滑下移

```powershell
node scripts/infra/run-e2e-single.mjs ci --file e2e/smashup/smashup-local-gameplay.e2e.ts --case "本地模式：首个随从进入基地时分数条应平滑下移而不是单帧跳变"
```

结果：
- `1 passed`
- 运行日志里的采样结果：

```text
[smashup-first-minion-layout-motion] {"sampleCount":39,"distinctTops":[350.2,351.3,370.4,371,371.6,374.6,377.4,379.9,382.1,384.1,385.5,386.4,386.7],"totalTravel":36.5}
```

这说明分数条不是单帧跳变，而是出现了多个中间位置，随从入场引起的布局变化已经恢复成连续过渡。

### E2E 2：自己与对手出牌的入场轨迹对比

```powershell
node scripts/infra/run-e2e-single.mjs ci --file e2e/smashup/smashup-local-gameplay.e2e.ts --case "本地模式：诊断自己与对手打出随从时的入场时序差异"
```

结果：
- `1 passed`
- 运行日志里的采样结果：

```text
[smashup-minion-entry-diagnostic] {"self":{"firstVisibleAt":112.10000000009313,"lastShimmerAt":null,"distinctTops":[314.9,299.5,286.9,284,280.9,277.7,274.8,272.5,270.7,269.3,268.4,268.2,268.7,268.9,269.2,269.4,269.7,269.9,270.1,270.3,270.5,270.6,270.8,271,271.1,271.3,271.4,271.5,271.7,271.8,272,272.1,272.2,272.4,272.6,272.8,272.9,273,273.5,274.6,276.2,277.5,278.5,279.1,279.5,279.8,280,280.1]},"opponent":{"firstVisibleAt":101.10000000009313,"lastShimmerAt":null,"distinctTops":[280.1,268.4,268.2,268,267.8,267.7,268.7,268.9,269.2,269.4,269.7,269.9,270.1,270.3,270.5,270.6,270.8,271,271.1,271.3,271.4,271.5,271.7,271.8,272,272.1,272.2,272.4,272.5,272.6,272.8,272.9,273,273.5,274.6,276.2,277.5,278.5,279.1,279.5,279.8,280]}}
```

从采样看：
- 自己出牌和对手出牌都不是“只出现 1 帧后突然落位”
- 对手路径同样经过多帧中间位置，没有再表现成明显的重复首帧或长时间停在开头

## 截图证据

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-local-gameplay.e2e\本地模式：首个随从进入基地时分数条应平滑下移而不是单帧跳变\smashup-first-minion-layout-before.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-local-gameplay.e2e\本地模式：首个随从进入基地时分数条应平滑下移而不是单帧跳变\smashup-first-minion-layout-after.png`

我实际看到：
- `before` 图里该列仍是空位
- `after` 图里首张随从已经稳定落到基地列内，没有停在半路的中间卡面残影

## 结论

- 当前共享根因已经从“所有重渲染都触发入场动画”收窄为“只有新增 UID 才播入场动画”。
- 本轮 E2E 证明：
  - 首个随从入场导致的布局变化是连续的，不是单帧跳变
  - 对手出牌路径也能跑出多帧连续轨迹，不再像旧问题那样明显卡在开头
- 这条反馈当前可以视为已完成一轮共享层回归收口；如果后续用户再明确指出“在线房间隐藏手牌链路仍复现”，再补一条对应在线 E2E 即可。
