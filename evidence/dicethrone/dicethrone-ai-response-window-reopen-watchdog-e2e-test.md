# DiceThrone 响应窗口 sourceId 重开场景历史 watchdog E2E 证据

> 2026-06-06 当前有效口径：本文只保留 `sourceId` 连续变化导致响应窗口重复 reopen 时，watchdog 仍能收口这一条历史 E2E 证据，不代表 DiceThrone 全体 response window / watchdog、任一单英雄，或四位新英雄整批当前已经审计完成。它现在只能证明当时这条单链路被专项验证过，不能外推成 DiceThrone 当前总体收口。

- 测试用例：`Online AI 响应窗口在 sourceId 变化的重复 reopen 下仍应被 watchdog 收口`
- 文件：`e2e/dicethrone/dicethrone-simple-start.e2e.ts`
- 运行时间：2026-04-12

## 场景说明
AI 响应窗口被人为注入为“pendingInteractionId 阻塞”，并在 watchdog 超时前多次变更 `responseWindow.id/sourceId`（模拟业务侧重复 reopen + sourceId 抖动）。期望 watchdog 仍能强制关闭响应窗口，避免卡死。

## 关键截图与观察

1. **响应窗口重开（sourceId 变化）前**
   - 路径：  
     `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口在-sourceId-变化的重复-reopen-下仍应被-watchdog-收口\20-online-ai-response-loop-reopen-sourceid-before.png`
   - 观察：右侧“下一阶段”按钮为灰色不可用，处于响应窗口阻塞态；画面仍停在主流程，未能继续推进。
   - 结论：**未达到收口标准**（窗口仍阻塞）。

2. **watchdog 收口后**
   - 路径：  
     `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-响应窗口在-sourceId-变化的重复-reopen-下仍应被-watchdog-收口\20-online-ai-response-loop-reopen-sourceid-after.png`
   - 观察：右侧“下一阶段”按钮变为橙色可用，阻塞已解除，可继续推进阶段。
   - 结论：**达到收口标准**（watchdog 成功关闭响应窗口）。

## 结果
- **通过**：watchdog 在 `sourceId` 连续变化的 reopen 场景下仍能强制关闭响应窗口，未出现卡死。

## 当前阅读说明

- 本文只覆盖 `sourceId` 抖动 reopen 这一条历史 watchdog 单链路，不覆盖更广范围 DiceThrone 在线 AI / response watchdog 或新英雄整批完成态。
- 即使本文中的通过结论与截图在当轮成立，也不能把它当成当前 DiceThrone 或新英雄整批“全面收口”的证明。
