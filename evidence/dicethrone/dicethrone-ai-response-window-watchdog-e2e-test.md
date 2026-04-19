# DiceThrone AI 响应窗口 watchdog E2E 证据

## 覆盖用例
- Online AI 响应窗口反复卡死时，watchdog 应强制关闭响应窗口
- Online AI 响应窗口在 sourceId 变化的重复 reopen 下仍应被 watchdog 收口

## 运行信息
- 命令：
  - npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 响应窗口反复卡死时，watchdog 应强制关闭响应窗口"
  - npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 响应窗口在 sourceId 变化的重复 reopen 下仍应被 watchdog 收口"
- 时间：2026-04-12（首次），2026-04-14（复跑）

## 截图与观察
### 用例：Online AI 响应窗口反复卡死时，watchdog 应强制关闭响应窗口
1) 进入卡死前（响应窗口仍存在）
- 路径：D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口反复卡死时，watchdog-应强制关闭响应窗口\20-online-ai-response-loop-before.png
- 观察：右侧“下一阶段”按钮为灰色不可用，页面处于响应/交互阻塞态；未见“强制结束失败”提示。
- 结论：仍处于卡死前置状态，未满足收口目标。

2) watchdog 收口后
- 路径：D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口反复卡死时，watchdog-应强制关闭响应窗口\20-online-ai-response-loop-after.png
- 观察：右侧“下一阶段”按钮点亮可用，页面无失败提示，主界面可继续推进。
- 结论：watchdog 已关闭响应窗口并释放阻塞，达到本用例验收要求。

3) 二次 reopen 前
- 路径：D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口反复卡死时，watchdog-应强制关闭响应窗口\20-online-ai-response-loop-reopen-before.png
- 观察：再次进入阻塞态，“下一阶段”按钮灰显；无失败提示弹窗。
- 结论：重开后仍处于卡死前置态，需继续观察收口。

4) 二次 reopen 收口后
- 路径：D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口反复卡死时，watchdog-应强制关闭响应窗口\20-online-ai-response-loop-reopen-after.png
- 观察：页面无额外响应弹窗/失败提示，主界面保持可用状态。
- 结论：二次 reopen 仍被 watchdog 收口，未出现响应窗口循环卡死。

### 用例：Online AI 响应窗口在 sourceId 变化的重复 reopen 下仍应被 watchdog 收口
1) sourceId 反复变化前
- 路径：D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口在-sourceId-变化的重复-reopen-下仍应被-watchdog-收口\20-online-ai-response-loop-reopen-sourceid-before.png
- 观察：处于响应窗口注入态，页面无异常提示。
- 结论：进入 sourceId 反复 reopen 前置状态。

2) sourceId 反复变化后收口
- 路径：D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口在-sourceId-变化的重复-reopen-下仍应被-watchdog-收口\20-online-ai-response-loop-reopen-sourceid-after.png
- 观察：页面无响应弹窗与失败提示，主界面保持稳定。
- 结论：sourceId 多次变化后 watchdog 仍能收口，满足用例要求。
