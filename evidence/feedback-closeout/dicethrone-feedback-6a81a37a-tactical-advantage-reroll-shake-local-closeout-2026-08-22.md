# Dice Throne 本地反馈收口：战术优势重投后响应窗口 + 震动动画崩溃

- 日期：2026-08-22
- 口径：本地数据库反馈；Mongo `boardgame.feedbacks`
- 代表反馈：`6a81a37a45cdffaacb0aae3f`
- 同根自动反馈：`6a81a2da45cdffaacb0aae34`

## 原始症状

- 玩家反馈：`用战术优势重投，再次触发响应？不应该不点跳过不结束吗，为什么感觉和卡牌逻辑不一样`
- 自动错误：`Cannot read properties of undefined (reading 'x')`
- 错误位置：`src/components/common/animations/ShakeContainer.tsx`

## 真实反馈状态

- 游戏：Dice Throne
- 阶段：防御掷骰阶段
- 进攻方：玩家 `0`，战术家
- 防御方：玩家 `1`，枪手
- 当时窗口：防御骰确认后打开的 `afterRollConfirmed` 响应窗口，当前响应者是玩家 `0`
- 事件链：
  - 防御方确认防御骰 `[4,5]`
  - 玩家 `0` 消耗 1 个战术优势，重投防御方骰子 `4 -> 5`
  - 旧响应窗口关闭
  - 防御方重新确认防御骰 `[5,5]`
  - 系统再次打开 `afterRollConfirmed` 响应窗口给攻击方

## 规则结论

这条“重投后再次触发响应窗口”不是规则实现 bug。

现有合同和测试已经明确：防御骰在 `afterRollConfirmed` 响应窗口里被响应者改动或重投后，防御方需要重新确认新的骰面；新骰面确认后，攻击方仍有一次响应新骰面的机会。因此不点“跳过 / 让过”时，这个响应窗口不会直接结束。这一点和卡牌改骰逻辑一致，不是战术优势独有的异常。

本轮验证的现有合同：

- `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`：`defensiveRoll 响应者改骰后，防御方重新确认应再次打开攻击方响应窗口`
- `src/games/dicethrone/__tests__/passive-reroll-validation.test.ts`：`战术优势当前骰区重投矩阵`

## 前端崩溃结论

伴随自动错误是真实前端 bug。震动容器根据动画进度计算关键帧下标；当外部动画时钟出现短暂回退或非正常进度时，下标可能变成负数或非数字，导致读取不到关键帧，再访问 `x` 时崩溃。

本轮修复：

- `src/components/common/animations/ShakeContainer.tsx`
  - 新增动画进度归一化，只允许关键帧索引使用 `0..1` 范围内的进度。
  - 非数字进度直接结束本次震动，避免继续写入 `NaN` 或越界关键帧。
- `src/components/common/animations/__tests__/ShakeContainer.test.tsx`
  - 新增回归测试：动画时钟短暂回退时不应读取越界关键帧。

## 验证记录

首跑失败已复现同类崩溃：

```text
node scripts/infra/vitest-cli-safe.mjs run src/components/common/animations/__tests__/ShakeContainer.test.tsx --configLoader native -t "动画时钟短暂回退"
FAIL: TypeError: Cannot read properties of undefined (reading 'x')
```

修复后验证：

```text
node scripts/infra/vitest-cli-safe.mjs run src/components/common/animations/__tests__/ShakeContainer.test.tsx --configLoader native
PASS: 3 passed

node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native -t "defensiveRoll 响应者改骰后"
PASS: 1 passed / 157 skipped

node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/passive-reroll-validation.test.ts --configLoader native -t "战术优势当前骰区重投矩阵"
PASS: 21 passed / 14 skipped

npx eslint src/components/common/animations/ShakeContainer.tsx src/components/common/animations/__tests__/ShakeContainer.test.tsx
PASS: exit 0；保留既有 react-refresh/only-export-components warning
```

## 收口口径

- 规则反馈：关闭为“规则行为符合现有合同，需要玩家跳过/让过新骰面的响应窗口”。
- 自动错误：作为真实前端 bug 收口，已修复动画关键帧越界崩溃。
- 用户无需额外操作；更新后同类动画时钟异常不会再把页面打进错误边界。
