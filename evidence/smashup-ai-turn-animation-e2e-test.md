# SmashUp 随从入场动画不应重复播放 E2E 证据（2026-04-08）

## 范围

- 目标问题：大杀四方里，教程或他人/AI 出牌后，随从视觉上像“开头动画又播了一次”，看起来会在中间停一下、像反复入场。
- 本轮修复：
  - `src/games/smashup/ui/BaseZone.tsx`
    - 只对**本次状态变化中新出现的随从 UID**播放 `initial` 入场动画
    - 已在场随从重渲染时不再重新走入场 `initial`
    - 去掉 `style.transform` 与 `motion.rotate` 双重控制导致的视觉抖动干扰
- 本轮验证目标：
  - 自己打出随从时只出现一次入场动画
  - 对手位（模拟他人/AI 视角渲染）打出随从时也只出现一次入场动画
  - 最终稳定态无 atlas shimmer、无“重新播放开场动画”的二次轨迹

## 执行命令

### ESLint
```powershell
npx eslint src/games/smashup/ui/BaseZone.tsx src/games/smashup/Board.tsx e2e/smashup-local-gameplay.e2e.ts
```

结果：
- 0 error
- 历史 warning：
  - `src/games/smashup/Board.tsx` 仍有 1 条既有 `react-hooks/purity` warning（`Date.now()`），不是本轮新增
  - `e2e/smashup-local-gameplay.e2e.ts` 仍有 1 条既有 `any` warning，不阻断

### E2E
```powershell
node scripts/infra/run-e2e-single.mjs ci --file e2e/smashup-local-gameplay.e2e.ts --case "本地模式：自己与对手打出随从时都只应出现一次入场动画，不应像开头那样反复播放"
node scripts/infra/run-e2e-single.mjs ci --file e2e/smashup-local-gameplay.e2e.ts --case "本地模式：出牌 → 结束回合 → 回合切换"
```

结果：
- `本地模式：自己与对手打出随从时都只应出现一次入场动画，不应像开头那样反复播放` → `1 passed`
- `本地模式：出牌 → 结束回合 → 回合切换` → `1 passed`

## 关键状态断言

针对新补的“自己/对手入场时序差异”回归，用例直接在页面内采样随从 DOM 的 `top` 轨迹，并新增以下门禁：

- 自己与对手的随从都必须成功进入可见态
- 两边 `lastShimmerAt` 都必须为 `null`
- 两边压缩后的轨迹 `directionChanges <= 1`
  - 含义：只能出现“一次入场曲线”，不能出现“走完一遍又重新来一遍”的多次方向反转

本轮实际日志：

```text
self.directionChanges = 1
opponent.directionChanges = 1
```

说明当前自己与对手位的入场轨迹都只出现了一次完整弧线，没有出现“重复入场”的第二次拐点。

## 截图证据

### 1. 自己打出的随从稳定态

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：自己与对手打出随从时都只应出现一次入场动画，不应像开头那样反复播放\smashup-self-minion-entry-stable.png`
- 我实际看到什么：
  - 海盗大副已经稳定落在己方列位里，不是半透明、不在飞入中、也没有被第二层入场姿态重新覆盖。
  - 卡面文字和力量值都已清晰落稳，没有 shimmer 或空白卡面。
  - 截图里显示的是最终稳定牌面，而不是“还停在中间做开场动作”的瞬间。
- 是否达到验收标准：
  - 达到。自己打出的随从已经收敛到稳定态，没有“像开头动画还在重播”的残留现象。

### 2. 对手位打出的随从稳定态

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：自己与对手打出随从时都只应出现一次入场动画，不应像开头那样反复播放\smashup-opponent-minion-entry-stable.png`
- 我实际看到什么：
  - 机器小兵 Alpha 已稳定落在对手列位里，不是二次飞入状态，也没有被重新缩放/旋转成“刚进场”的姿态。
  - 卡面已完整显示，没有 shimmer、没有残留卡背。
  - 这张图对应的是对手位渲染，不是再次拍自己列位，因此直接命中“他人出牌看起来像重播”的问题位点。
- 是否达到验收标准：
  - 达到。对手位的最终稳定态也已正常，不再出现“他人出牌像重新播开场动画”的表现。

## 结论

本轮已经把这条视觉问题收口到可复查证据：

- `BaseZone` 现在只让**新进入基地的 UID**播放入场动画
- 已在场随从重渲染不会重新触发 `initial`
- 自己与对手位都补了同一条 E2E 回归
- 轨迹断言和最终截图都表明：当前不会再出现“入场动画像开头一样反复播放”的重复拐点

## 备注

- 这条回归主要锁定的是**渲染层重复入场**，因此用本地模式同时模拟 `player0 / player1` 两侧渲染即可命中根因。
- 如果后续又出现“联机状态同步时额外 remount”这一类新问题，应继续沿 `data-minion-uid` 生命周期和 React remount 链路补查，但本轮针对当前反馈的视觉重播现象已达到验收标准。
