# DiceThrone AI 卡死兜底 - E2E 证据（响应窗口强制关闭）

## 用例
- Online AI 响应窗口反复卡死时，watchdog 应强制关闭响应窗口

## 证据截图

### 1) 触发前（响应窗口卡死态）
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口反复卡死时，watchdog-应强制关闭响应窗口\20-online-ai-response-loop-before.png`

观察与结论：
- 右侧仍显示响应窗口相关卡牌列表，且“下一阶段”按钮为灰色不可用，说明当前处于响应阻塞态。
- 画面未出现异常遮挡或错误弹窗。
- **结论：符合“卡死前响应窗口仍未关闭”的预期前置条件。**

### 2) 触发后（watchdog 强制关闭响应窗口）
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口反复卡死时，watchdog-应强制关闭响应窗口\20-online-ai-response-loop-after.png`

观察与结论：
- “下一阶段”按钮变为橙色可用，表示响应窗口阻塞已解除。
- 画面保持在正常主流程界面，没有出现回合结束异常弹窗。
- **结论：响应窗口已被 watchdog 强制关闭，满足本轮验收标准。**

### 3) 重开前（响应窗口二次卡死态）
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口反复卡死时，watchdog-应强制关闭响应窗口\20-online-ai-response-loop-reopen-before.png`

观察与结论：
- 响应窗口再次出现，“下一阶段”按钮仍为灰色不可用，说明在同一对局中再次进入响应阻塞态。
- 右侧信息栏保持可见，没有 UI 抖动或遮挡异常。
- **结论：复现了“重复卡死”的触发前条件。**

### 4) 重开后（watchdog 再次强制关闭响应窗口）
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口反复卡死时，watchdog-应强制关闭响应窗口\20-online-ai-response-loop-reopen-after.png`

观察与结论：
- “下一阶段”按钮再次恢复为橙色可用，表明第二次卡死也被强制闭窗。
- 主流程面板保持正常，没有出现“强制结束失败”的弹窗提示。
- **结论：watchdog 能在同一场景重复触发时保持收口。**

## 追加用例：main2 卡死 / 弃牌超限 / 撤回卖牌循环

### 5) main2 卡死前（等待 AI 长时间停滞）
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-DiceThrone-main2-阶段持续卡死时，服务端-watchdog-应自动多步收口到我方回合且不再弹失败提示\19-online-ai-main2-stalled-before-watchdog.png`

观察与结论：
- 左侧回合顺序高亮在“6. 主流程阶段(2)”，表示当前仍处于 AI 的 main2 阶段。
- 中央覆盖“AI 2号位 正在思考中”，且右侧“下一阶段”按钮为灰色不可用，符合卡死前置条件。
- **结论：已处于 AI main2 阶段长时间停滞的目标前态。**

### 6) main2 卡死后（watchdog 多步收口到我方回合）
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-DiceThrone-main2-阶段持续卡死时，服务端-watchdog-应自动多步收口到我方回合且不再弹失败提示\20-online-ai-main2-stalled-after-watchdog.png`

观察与结论：
- 左侧回合顺序高亮回到“3. 主流程阶段(1)”，表明已推进到我方回合起始阶段。
- 右侧“下一阶段”按钮变为橙色可用，未出现“强制结束失败”弹窗。
- **结论：watchdog 成功从 AI 卡死状态自动收口到我方回合。**

### 7) 弃牌超限前（弃牌阶段）
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-DiceThrone-弃牌超限时应可正常弃到手牌上限并自动推进下一回合（避免弃牌-撤回循环卡死）\21-discard-overflow-before.png`

观察与结论：
- 左侧高亮“7. 弃牌阶段”，屏幕下方手牌数量明显超出上限，且提示“请选择3张卡牌弃置”。
- 当前为弃牌卡死前置态，尚未推进到下一回合。
- **结论：弃牌超限场景已成功进入。**

### 8) 弃牌超限后（自动推进）
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-DiceThrone-弃牌超限时应可正常弃到手牌上限并自动推进下一回合（避免弃牌-撤回循环卡死）\22-discard-overflow-after.png`

观察与结论：
- 左侧高亮回到“3. 主流程阶段(1)”，说明弃牌后已经进入下一回合主流程。
- 手牌数量明显减少，仅剩 1 张牌，符合弃到上限的预期。
- **结论：弃牌超限场景可正常弃牌并自动推进，无弃牌/撤回循环卡死。**

### 9) 撤回卖牌循环前（AI 仅剩撤回可选）
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-main2-仅剩撤回卖牌可选时应直接推进阶段（避免卖-撤循环卡死）\23-ai-undo-sell-loop-before.png`

观察与结论：
- 左侧高亮“6. 主流程阶段(2)”，右侧出现“撤销”按钮（卖牌撤回入口）。
- 画面停留在 AI 回合，符合“仅剩撤回卖牌可选”的前置条件。
- **结论：卖/撤循环卡死触发前置态已建立。**

### 10) 撤回卖牌循环后（强制推进阶段）
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-main2-仅剩撤回卖牌可选时应直接推进阶段（避免卖-撤循环卡死）\24-ai-undo-sell-loop-after.png`

观察与结论：
- 左侧高亮切换到“7. 弃牌阶段”，说明已从 main2 推进到后续阶段。
- 无“强制结束失败”弹窗或重复卡死提示。
- **结论：撤回卖牌循环被自动跳过，阶段推进生效。**
