# 线上反馈 6ac5811f20524b0f4888d910：Dice Throne AI 选角占用真人英雄位

## 反馈内容 / 现实症状

> 选择AI并选择AI派系，但每次选英雄都是AI英雄无法选择自己英雄

来源：线上 `https://api.easyboardgame.top/admin-api/feedback`，反馈记录创建于 `2026-10-06T23:15:43.362Z`；路由为 `/play/dicethrone/match/Qtqie4bO6Ew?playerID=0`。现场快照显示 `player-0` 尚未选角、`player-1` 为 `local-ai`，但旧接管逻辑在选派系后已释放。

## 发现的问题

`OnlineManualSetupSelectionBridge` 只在 `factionSelect` 阶段覆盖手动接管玩家 ID，进入 `characterSelect` 后就退回默认真人座位视角。于是 AI 座位的选英雄请求和真人座位的选择面混在一起，表现为玩家只能继续看到/选择 AI 英雄，无法选择自己的英雄。

## 处理方式 / 修复结果

- `src/pages/onlineManualSetupSelectionBridge.tsx`：将接管条件从“仅 factionSelect 阶段”改为整个手动设置选择期间，只要存在有效的手动接管就持续提供正确的 `playerId` 和 dispatch。
- `src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx`：补人类 + 两个 AI 的完整选择顺序回归，确认先处理 AI 1，再处理 AI 2，两个 AI 都确认后才还原到真人座位并显示主机开始控件。

## 验证

- 在线手动选角接管回归：`5 passed`。
- `npx tsc --noEmit --pretty false`：通过。
- `git diff --check`：通过；仅有工作树既有 LF/CRLF 提示，无 diff 错误。

## 当前状态与边界

`resolved`。本地根因、修复和定向回归已完成；本轮未执行生产发布或当前线上房间同入口回放，因此不宣称生产版本已经生效。

## 漏审复盘 / 规范回代判断

旧测试只覆盖了单阶段或默认主机上下文，没有覆盖“真人 + 多个 AI 连续完成派系和英雄选择”的接管生命周期；属于共享 setup bridge 的跨阶段回归缺口。现有反馈收口规范已覆盖逐条现场、根因、修复和验证要求，本轮不新增第二套规范源。
