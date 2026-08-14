# DiceThrone 响应提示上移 E2E 验收

## 验收对象

- 用户可见对象：棋盘内“可以响应 / 跳过”提示条。
- 修改：默认底边距离由 `12vw` 提升到 `18vw`。
- 真实入口：AI 选中“制胜高地”后，真人进入发动前响应窗口；先关闭技能展示层，再操作响应提示条。

## 自动验证

用例：`e2e/dicethrone/dicethrone-ai-ultimate-response.e2e.ts` 中“真人响应提示上移后可跳过并关闭响应窗口”。

- Playwright：通过。
- 提示条和“跳过”按钮均可见、可操作。
- 提示条相对视口底边的留白不小于 `17.5vw`，直接验证“上移”这一纵向位置条件。
- 点击“跳过”后，响应窗口和提示条均关闭。

## 原图与图面结论

| 顺序 | 原图 | 直接证明的内容 |
| --- | --- | --- |
| 01 | `test-results/evidence-screenshots/dicethrone/dicethrone-ai-ultimate-response.e2e/真人响应提示上移后可跳过并关闭响应窗口/01-真人响应提示已上移并可跳过.jpg` | “可以响应 / 跳过”提示条位于手牌上方、离开屏幕底边，完整可见且没有被技能展示层遮挡。 |
| 02 | `test-results/evidence-screenshots/dicethrone/dicethrone-ai-ultimate-response.e2e/真人响应提示上移后可跳过并关闭响应窗口/02-真人跳过响应后提示关闭.jpg` | 点击“跳过”后的棋盘状态；响应提示条已退场，当前页面转为对手思考。 |

AI 图面验收：`PASS`，无主控件遮挡、裁切或无归属按钮。

## 规范更新

`.spec/knowledge/standards/e2e-verification.md` 已新增“位置改动必须证明同一控件沿指定方向实际变化”：位置类修改必须使用同一控件的真实几何和整屏截图证明，不得以相邻弹窗、同名按钮或元素存在替代。
