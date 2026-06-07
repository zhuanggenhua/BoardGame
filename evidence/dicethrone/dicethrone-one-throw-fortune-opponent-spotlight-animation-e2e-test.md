# DiceThrone 一掷千金对手特写骰子动画修复证据（2026-05-17）

## 范围

- 游戏：`DiceThrone`
- 场景：对手打出 `card-one-throw-fortune`（一掷千金）时，我方视角看到的 `CardSpotlightOverlay`
- 本轮验收目标：
  - 不是“只看到最终结果”
  - 而是“先看到骰子进入滚动/揭示，再落到最终结果，再自动收口”

## 根因

这次不是单点补丁，根因有两层：

1. 底层结果揭示 hook `src/hooks/ui/useResultRevealAnimation.ts`
   - 首次挂载动画依赖 effect 启动。
   - 在开发态 `StrictMode` 下，effect replay 会把这次首次揭示立刻吞掉。
   - 结果是某些只能依赖“首次挂载动画”的场景，会直接落到 settled。

2. 对手卡牌特写链 `src/games/dicethrone/hooks/useCardSpotlight.ts` → `src/games/dicethrone/ui/CardSpotlightOverlay.tsx`
   - 奖励骰绑定进对手卡牌特写时，旧实现没有把 `presentationKey` 继续传到 `BonusDieSpotlightContent`。
   - 这导致“同一颗骰子的新展示事件”无法显式重播，只能赌组件首次挂载动画。

本轮修复后的设计是：

- React `key` 表示“这是谁”：
  - 例：`die-0`
- `presentationKey` 表示“这次发生了一个新的可见事件”：
  - 例：`BONUS_DIE_ROLLED:1100`

这不是给每个动画乱塞补丁，而是把“实体身份”和“表现事件身份”分开，后续同类奖励骰、重投、复用组件场景都能走同一套契约。

## 修复点

- `src/hooks/ui/useResultRevealAnimation.ts`
  - 首次挂载揭示改为基于初始 state + 独立 timer effect。
  - 后续 reveal 用 `revealSequence` 重置计时器。
  - 不再在“没有新 reveal 事件”时主动把首次动画清掉。

- `src/games/dicethrone/hooks/useCardSpotlight.ts`
  - 对绑定到 `cardSpotlightQueue` 的奖励骰补 `presentationKey`。
  - 统一通过 `buildBonusDiePresentationKey(type, eventTimestamp)` 生成。

- `src/games/dicethrone/ui/CardSpotlightOverlay.tsx`
  - 把 `presentationKey` 透传给 `BonusDieSpotlightContent`。
  - React key 改为稳定的骰子身份 key，不再混用时间戳冒充实体身份。

## 验证

### 已执行命令

- `node scripts/infra/vitest-cli-safe.mjs run src/hooks/ui/__tests__/useResultRevealAnimation.test.ts src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx --configLoader native`
  - 结果：通过
- `npx tsc --noEmit --pretty false`
  - 结果：通过
- `npx eslint src/hooks/ui/useResultRevealAnimation.ts src/hooks/ui/__tests__/useResultRevealAnimation.test.ts src/games/dicethrone/hooks/useCardSpotlight.ts src/games/dicethrone/ui/CardSpotlightOverlay.tsx src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx`
  - 结果：无 error
  - 备注：`useCardSpotlight.ts` 有既有 warning，非本轮新增
- `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-one-throw-fortune-spotlight.e2e.ts "opponent one throw fortune spotlight should visibly roll before settling"`
  - 结果：`1 passed`

### E2E 断言覆盖

- 对手实际打出 `一掷千金`
- 我方视角必须出现 `card-spotlight-overlay`
- 特写中的骰子先满足 `data-is-rolling=true`
- 滚动中还必须满足“非平面 3D 几何”门禁：
  - 侧面或顶/底面投影必须展开到可见阈值
  - 正面投影不能接近整张平铺
- 随后变为 `data-is-rolling=false`
- 特写自动关闭
- 不允许额外错误弹出独立 `bonus-die-overlay`

## 截图观察

### 1. 滚动中

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\opponent-one-throw-fortune-spotlight-should-visibly-roll-before-settling\opponent-one-throw-fortune-spotlight-should-visibly-roll-before-settling-01-opponent-one-throw-fortune-rolling.png`
- 我实际看到：
  - 居中的 `一掷千金` 卡牌特写已经出现。
  - 卡牌右侧能直接看到骰子本体，不是只有容器或遮罩。
  - 这颗骰子当前是明显倾斜的 3D 视角，能同时看到多个面，不是平铺正面。
  - 这张图里的骰面也不是最终 settled 的 `2 + 拳头`。
- 是否达到本步验收标准：
  - 达到。它证明这条链路不再“特写一出现就是最终结果”，而且滚动中确实出现了肉眼可见的非平面 3D 中间帧。

### 2. 结果落地

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\opponent-one-throw-fortune-spotlight-should-visibly-roll-before-settling\opponent-one-throw-fortune-spotlight-should-visibly-roll-before-settling-02-opponent-one-throw-fortune-settled.png`
- 我实际看到：
  - 同一张 `一掷千金` 卡牌特写仍在中央。
  - 右侧骰子已经落到 `2 + 拳头` 的最终结果。
  - 与上一张对比，骰子本体确实发生了从中间帧到最终结果的变化。
- 是否达到本步验收标准：
  - 达到。它证明本轮问题位点已经从“直接出结果”恢复成“先滚再落地”。

### 3. 收口后

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\opponent-one-throw-fortune-spotlight-should-visibly-roll-before-settling\opponent-one-throw-fortune-spotlight-should-visibly-roll-before-settling-03-opponent-one-throw-fortune-closed.png`
- 我实际看到：
  - 卡牌特写和骰子特写都已经关闭。
  - 画面回到正常对局视图，没有残留的独立奖励骰弹层。
  - 页面仍可继续推进，不是卡在特写态。
- 是否达到本步验收标准：
  - 达到。它证明这次修复没有引入“动画完了但 UI 不收口”的新问题。

## 结论

- 这次修复命中的是两个真实根因：
  - 底层首次 reveal 时序
  - 对手卡牌特写的 `presentationKey` 透传契约
- `一掷千金` 的真实 E2E 结果已经证明：
  - 对方特写骰子不再是“只出结果”
  - 现在会先出现可见的非平面 3D 滚动帧，再落到最终结果，再自动关闭
- 本轮可以按该证据收口；后续同类对手卡牌特写奖励骰场景也应沿用“稳定实体 key + presentationKey 表现事件”的同一设计模式
