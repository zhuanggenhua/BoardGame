# DiceThrone 教程 `顿悟 -> 静心` 奖励骰遮挡链路排查（2026-04-05）

## 排查目标

- 确认 `顿悟` 在教程里的奖励骰面板是否真的进入“交互态”
- 确认 `静心` 被卡住时，最上层实际拦截点击的是哪一层
- 区分“卡牌/教程配置错误”与“共享 UI 关闭行为不正确”

## 代码事实

### 1. `顿悟` 本身不是可重投奖励骰

文件：`src/games/dicethrone/heroes/monk/cards.ts`

- `card-enlightenment` 的效果是普通 `rollDie`
- 配置为：
  - `type: 'rollDie'`
  - `diceCount: 1`
  - `conditionalEffects` 命中莲花时给 token
  - `defaultEffect` 为抽 1 张牌

### 2. `rollDie` 分支固定创建 `displayOnly` settlement

文件：`src/games/dicethrone/domain/effects.ts`

- `case 'rollDie'` 在生成 `BONUS_DIE_ROLLED` 后，会固定执行：
  - `createDisplayOnlySettlement(sourceAbilityId, targetId, targetId, rollDice, timestamp)`
- 这意味着 `顿悟` 这条链路产生的 `pendingBonusDiceSettlement.displayOnly` 应为 `true`
- 它不应进入“真正可重投”的业务交互态

### 3. UI 把“展示态 settlement”和“重投交互”复用到了同一个组件

文件：`src/games/dicethrone/ui/BoardOverlays.tsx`

- `BonusDieOverlay` 同时吃两类来源：
  - `props.pendingBonusDiceSettlement?.dice`
  - `props.bonusDie.bonusDice`
- 所以视觉上看都是同一块奖励骰面板
- 但是否为交互态，真正判断在 `BonusDieOverlay.tsx`：
  - `const isInteractive = !displayOnly && canReroll === true;`

## 真实浏览器复现

### 入口

- 地址：`http://127.0.0.1:4173/play/dicethrone/tutorial`
- 方式：Playwright 直连本地前端开发服务，真实点击 `顿悟` 与 `静心`

### 产物截图

- [01-before-enlightenment.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual-dicethrone-tutorial-bonusdie/01-before-enlightenment.png)
- [02-after-enlightenment-click.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual-dicethrone-tutorial-bonusdie/02-after-enlightenment-click.png)
- [03-before-inner-peace-click.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual-dicethrone-tutorial-bonusdie/03-before-inner-peace-click.png)
- [04-immediately-after-inner-peace-click.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual-dicethrone-tutorial-bonusdie/04-immediately-after-inner-peace-click.png)
- [05-600ms-after-inner-peace-click.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual-dicethrone-tutorial-bonusdie/05-600ms-after-inner-peace-click.png)

### 关键状态抓取

#### A. 点击 `顿悟` 后

- 当前教程步骤：`inner-peace`
- `bonus-die-overlay` 可见
- overlay 文案：`投掷结果`
- `window.__BG_LOCAL_STATE__.core.pendingBonusDiceSettlement` 为：
  - `displayOnly: true`
  - `dice[0].face: 'lotus'`
  - `dice[0].effectKey: 'bonusDie.effect.enlightenmentLotus'`
  - `maxRerollCount: 0`
  - `rerollCostAmount: 0`

结论：

- 这不是交互态 settlement
- `顿悟` 在真实链路里仍然是展示态，和代码定义一致

#### B. 点击 `静心` 前，用 `elementsFromPoint` 抓最上层元素

- 命中点：`静心` 卡牌中心区域
- `elementsFromPoint` 第 1 个元素为：
  - `className: fixed inset-0 flex items-center justify-center pointer-events-auto`
  - `text: 投掷结果莲花！获得 2太极 + 闪避 + 净化`

结论：

- 在用户准备点 `静心` 的那一刻，最上层拦截点击的是奖励骰特写背板
- 不是教程高亮框，不是手牌本身

#### C. 点击 `静心` 中心区域后

- 120ms 后：`bonus-die-overlay` 已不可见
- 600ms 后：`bonus-die-overlay` 仍不可见
- 但 `pendingBonusDiceSettlement` 还留在 core state 中

结论：

- 首击的正确职责是“关闭展示态特写”，不是直接打出 `静心`
- 当前实现下，首击已能关掉 overlay
- state 中保留 displayOnly settlement，本质上是本地 dismiss 隐藏，不是 reroll 交互没结算

## 结论

### 已证实

- `顿悟` 不是交互态奖励骰
- `顿悟 -> 静心` 这条链路里，真正拦截第一次点击的是奖励骰特写背板
- 之前“像交互态”的观察来自共享 UI 组件复用，不是业务状态真的进了 reroll 交互

### 根因归类

- 不是卡牌配置错误
- 不是教程步骤把 `顿悟` 强行变成交互态
- 是共享“展示态奖励骰特写”在教程切步后的关闭行为与用户下一步点击节奏发生冲突

## 残留问题 / 后续动作

### 已落地修复

- 将 `BonusDieOverlay` 的多骰/settlement 分支改为：
  - 只有 `isInteractive = !displayOnly && canReroll === true` 时，才保留 `closeClickGuardMs = 180`
  - 只要不是实际交互态（`displayOnly` 或没有资源可重投），首击关闭保护一律为 `0`
- 移除了 `Board.tsx -> BoardOverlays.tsx -> BonusDieOverlay.tsx` 这条 tutorial-only 的 `allowInteractiveBonusDieBackdropDismiss` 透传

### 修后验证

#### 1. 真实浏览器复现

再次跑教程到 `inner-peace` 前，抓到：

- `pendingBonusDiceSettlement.displayOnly === true`
- `pendingBonusDiceSettlement.maxRerollCount === 0`
- `pendingBonusDiceSettlement.rerollCostAmount === 0`
- `elementsFromPoint` 顶层仍是 `fixed inset-0 flex items-center justify-center pointer-events-auto`

随后真实点击 `静心` 卡牌中心区域：

- 教程步骤仍是 `inner-peace`
- `bonus-die-overlay` 立即消失

这证明修后行为是：

- 第一击先关掉展示态奖励骰特写
- 不再依赖教程专用特判

#### 2. 自动化验证

- `node node_modules/vitest/vitest.mjs run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx src/pages/__tests__/Maintenance.test.tsx --configLoader native --maxWorkers 1`
  - 结果：`54 passed`
- `npx eslint src/games/dicethrone/ui/BonusDieOverlay.tsx src/games/dicethrone/ui/BoardOverlays.tsx src/games/dicethrone/Board.tsx src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx`
  - 结果：无 error，保留仓库既有 warning
