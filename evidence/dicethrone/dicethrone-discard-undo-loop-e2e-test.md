# DiceThrone 弃牌/撤回循环卡死 - E2E 证据（2026-04-11）

## 用例
- 用例名称：Online DiceThrone 弃牌超限时应可正常弃到手牌上限并自动推进下一回合（避免弃牌/撤回循环卡死）
- 运行命令：
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online DiceThrone 弃牌超限时应可正常弃到手牌上限并自动推进下一回合（避免弃牌/撤回循环卡死）"

## 关键截图与观察

### 1) 弃牌前（手牌超限 + 弃牌阶段提示）
- 截图：D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-DiceThrone-弃牌超限时应可正常弃到手牌上限并自动推进下一回合（避免弃牌-撤回循环卡死）\21-discard-overflow-before.png
- 观察：左侧阶段栏高亮在“7.弃牌阶段”，底部手牌区可见多张手牌，画面下方出现红色弃牌提示条，符合弃牌超限前置场景。
- 结论：✅ 进入弃牌阶段并触发弃牌提示，场景构造正确。

### 2) 弃牌后（自动推进到下一回合）
- 截图：D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-DiceThrone-弃牌超限时应可正常弃到手牌上限并自动推进下一回合（避免弃牌-撤回循环卡死）\22-discard-overflow-after.png
- 观察：阶段栏切换到“3.主要阶段(1)”，画面中央出现“正在思考中”，弃牌阶段高亮不再存在；底部手牌区仅剩单张手牌可见。
- 结论：✅ 弃牌完成后自动推进到下一回合，未出现弃牌/撤回循环卡死。

## 用例 2：AI 撤回卖牌循环防卡死
- 用例名称：Online AI 在 main2 仅剩撤回卖牌可选时应直接推进阶段（避免卖/撤循环卡死）
- 运行命令：
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 在 main2 仅剩撤回卖牌可选时应直接推进阶段（避免卖/撤循环卡死）"

### 1) main2 阶段（AI 仅剩撤回卖牌选择）
- 截图：D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-main2-仅剩撤回卖牌可选时应直接推进阶段（避免卖-撤循环卡死）\23-ai-undo-sell-loop-before.png
- 观察：左侧阶段栏高亮在“6.主要阶段(2)”，画面中央显示“AI 2号位 正在思考中”；右侧操作区仅剩“撤回/已确认”等按钮区域，没有出现新的卖牌可操作项。
- 结论：✅ 处于 main2 且只剩撤回卖牌相关选项，符合复现前置条件。

### 2) 自动推进到弃牌阶段
- 截图：D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-main2-仅剩撤回卖牌可选时应直接推进阶段（避免卖-撤循环卡死）\24-ai-undo-sell-loop-after.png
- 观察：阶段栏从“6.主要阶段(2)”切换到“7.弃牌阶段”，AI 思考提示仍在，但未卡死在 main2；右侧操作区没有出现循环撤回卖牌的停滞状态。
- 结论：✅ AI 在仅剩撤回卖牌时自动推进阶段，未出现卖/撤循环卡死。

## 小结
- E2E 覆盖了“弃牌超限 → 弃到手牌上限 → 自动推进下一回合”的完整链路，验证了修复后的弃牌流程不会被撤回卖牌循环卡死。
- AI 撤回卖牌场景在 main2 能自动推进到弃牌阶段，未出现卖/撤循环卡死。
