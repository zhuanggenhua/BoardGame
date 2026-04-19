# SmashUp 派系取消与重选 E2E 验证

## 测试目标

- 验证已被自己选择的派系卡片仍可点击打开详情。
- 验证详情面板出现“取消选择”按钮，而不是只能显示“已选择”。
- 验证取消后可以重新选择其他派系，并让选秀继续流转到下一位玩家。

## 执行命令

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/smashup-4p-layout-test.e2e.ts "PC 已选派系可取消并重新选择"
```

## 结果

- Playwright 单用例通过。
- 关键状态断言通过：
  - 取消后，P0 的 `playerSelections['0']` 变为 `[]`，当前行动者仍是 `P0`。
  - 重新选择后，P0 的 `playerSelections['0']` 变为 `['aliens']`，当前行动者切换为 `P1`。

## 截图证据

### 取消前

图片：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\PC-已选派系可取消并重新选择\18-desktop-faction-cancel-before.png`

肉眼观察：

- 海盗详情面板已经打开，左侧主按钮明确是“取消选择”，不是灰掉的“已选择”状态。
- 泰坦区只保留了卡图本体，没有再额外重复一行泰坦名称。
- 右侧卡牌预览区仍完整可见，说明详情面板布局没有因为新增取消按钮而挤压坏掉。

### 重选后

图片：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\PC-已选派系可取消并重新选择\19-desktop-faction-cancel-after.png`

肉眼观察：

- 详情面板已经关闭，界面回到派系列表主视图，没有残留半开的侧栏。
- 顶部标题区仍保持正常，页面没有白屏、错层或额外报错遮罩。
- 派系列表继续处于可操作状态，说明“取消选择”没有把选秀界面锁死。

## 结论

- 本次改动在 UI 上完成了“自己已选派系可再次点开并取消”的交互补齐。
- 文案去重也已生效：扩展开关文案改为“泰坦”，派系详情里的泰坦卡不再重复显示名称。
