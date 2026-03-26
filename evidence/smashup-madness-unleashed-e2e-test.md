# 大杀四方《疯狂解放》原版/POD 修复验证

## 问题描述

用户反馈《大杀四方》中，`疯狂解放 / Madness Unleashed / cthulhu_madness_unleashed` 在弃掉疯狂卡后，没有获得对应数量的额外战术额度。

本次核对目标：

1. 原版 `cthulhu_madness_unleashed` 是否会按弃牌数立即发放额外战术额度。
2. POD 版 `cthulhu_madness_unleashed_pod` 是否存在相同问题。

## 修复结论

问题确认存在于 `src/games/smashup/abilities/cthulhu.ts` 的 `cthulhu_madness_unleashed` 交互处理链路中。

修复后行为改为：

1. 玩家一次性选择要弃掉的疯狂卡。
2. 先统一弃掉所有选中的疯狂卡。
3. 按弃牌数直接结算“每弃 1 张，抽 1 张牌并获得 1 个额外行动额度”。
4. 不再额外弹出二次“要使用几次收益”的交互。

由于 POD 版复用同一能力/交互别名链路，所以该修复同时覆盖原版与 POD 版。

## 验证命令

```bash
npx vitest run src/games/smashup/__tests__/madnessPromptAbilities.test.ts
npm run test:e2e:ci -- e2e/smashup-response-window-pass-test.e2e.ts
```

## 测试结果

### 1. Vitest

- `src/games/smashup/__tests__/madnessPromptAbilities.test.ts`
- 结果：`22 passed`

覆盖点：

- 原版：弃 2 张疯狂卡后，立即弃牌、抽 2 张，并获得 2 个额外行动额度。
- POD：弃 1 张疯狂卡后，立即获得 1 个额外行动额度。

### 2. E2E

- `e2e/smashup-response-window-pass-test.e2e.ts`
- 结果：`2 passed`

E2E 场景：

1. P0 手牌中有 `疯狂解放`、2 张 `疯狂卡`、2 张 `Mystic Studies`。
2. 通过 UI 打出 `疯狂解放`。
3. 在多选弹窗中选择两张疯狂卡并确认。
4. 立即检查 HUD：额外战术额度应变为 `+2`，总战术额度应为 `2/3`。
5. 再连续打出两张 `Mystic Studies`，验证额外额度可被实际消费。

说明：

- 自动化里直接点卡牌选项和普通 pointer click 容易受当前拖拽/放大镜/Spotlight 展示层影响，因此用弹窗内的 `Select All / 全选` 按钮完成同一个 UI 选择流程，再点击确认。
- 出牌后的 `CardSpotlightQueue` 是展示层遮罩，不影响实际状态；测试中会显式关闭后继续出牌。

## 关键截图

### 1. 选择两张疯狂卡后的交互阶段

![疯狂解放交互](/D:/GA/BoardGame-main-clean/test-results/evidence-screenshots/smashup-response-window-pass-test.e2e/疯狂解放：弃两张疯狂卡后应立即获得两个额外战术额度，并能继续打出两张行动卡/01-madness-unleashed-prompt.png)

截图路径：

- `D:\GA\BoardGame-main-clean\test-results\evidence-screenshots\smashup-response-window-pass-test.e2e\疯狂解放：弃两张疯狂卡后应立即获得两个额外战术额度，并能继续打出两张行动卡\01-madness-unleashed-prompt.png`

分析：

- 画面进入 `疯狂解放` 的多选弹窗。
- 测试已断言当前交互是 `multi: { min: 0, max: 2 }`，并且选项数为 2，和两张疯狂卡一致。

### 2. 结算后立即显示 2 个额外战术额度

![疯狂解放结算后额度](/D:/GA/BoardGame-main-clean/test-results/evidence-screenshots/smashup-response-window-pass-test.e2e/疯狂解放：弃两张疯狂卡后应立即获得两个额外战术额度，并能继续打出两张行动卡/02-after-madness-unleashed-quota.png)

截图路径：

- `D:\GA\BoardGame-main-clean\test-results\evidence-screenshots\smashup-response-window-pass-test.e2e\疯狂解放：弃两张疯狂卡后应立即获得两个额外战术额度，并能继续打出两张行动卡\02-after-madness-unleashed-quota.png`

分析：

- 顶部出现两条“获得1次额外行动机会”反馈。
- 左下角牌库剩余从 `6` 变成 `4`，说明本次效果已经立即抽了 2 张。
- 右侧 HUD 显示当前可用战术额度为 `2`，总额度为 `3`，与“基础 1 次 + 额外 2 次”一致。

### 3. 两次额外战术额度被实际消费

![消费两次额外战术后](/D:/GA/BoardGame-main-clean/test-results/evidence-screenshots/smashup-response-window-pass-test.e2e/疯狂解放：弃两张疯狂卡后应立即获得两个额外战术额度，并能继续打出两张行动卡/03-after-two-extra-actions.png)

截图路径：

- `D:\GA\BoardGame-main-clean\test-results\evidence-screenshots\smashup-response-window-pass-test.e2e\疯狂解放：弃两张疯狂卡后应立即获得两个额外战术额度，并能继续打出两张行动卡\03-after-two-extra-actions.png`

分析：

- 右侧 HUD 中战术剩余已变为 `0`，总额度仍是 `3`，说明两次额外额度已被两张 `Mystic Studies` 正常消耗。
- 左下角牌库变为 `0`，最终手牌为 `deck-1` 到 `deck-6` 共 6 张，符合：
  - `疯狂解放` 抽 2 张
  - 两张 `Mystic Studies` 各抽 2 张

## 最终结论

`疯狂解放` 的问题已经修复，且原版与 POD 版都已覆盖验证：

1. 原版：弃掉几张疯狂卡，就会立即获得对应数量的额外战术额度。
2. POD：复用同一能力处理链路，单测已确认行为一致。
3. E2E 已证明这些额外额度不仅显示正确，而且能够继续被实际出牌消耗。
