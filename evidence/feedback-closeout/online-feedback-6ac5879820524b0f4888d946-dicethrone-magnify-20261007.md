# 线上反馈 6ac5879820524b0f4888d946：Dice Throne 结算提示期间无法查看

## 反馈内容 / 现实症状

> 一些提示结算的时点无法缩小退出查看游戏过程对方使用的卡牌或者技能状态，手牌无法在一些关键时点使用

来源：线上 `https://api.easyboardgame.top/admin-api/feedback`，反馈记录创建于 `2026-10-06T23:43:20.410Z`，路由为 `/?homeStyle=classic`。

## 发现的问题

Dice Throne 交互提示弹出时，旧 `Board` effect 会立即关闭已有的放大预览；同时交互弹窗的遮罩吞掉背景指针事件。结果是玩家在关键结算窗口不能继续查看对方卡牌/技能状态，也不能使用仍然合法的背景手牌操作。旧兼容性测试还把“进入交互就清理放大层”固化成了错误合同。

## 处理方式 / 修复结果

- `src/games/dicethrone/Board.tsx`：移除交互出现时自动 `closeMagnify()` 的清理逻辑，保留玩家当前阅读上下文。
- `src/games/dicethrone/Board.tsx`、`src/games/dicethrone/ui/BoardOverlays.tsx`：交互期间将放大层提升到提示之上，避免提示层遮住放大内容和关闭控件。
- `src/games/dicethrone/Board.tsx`、`src/games/dicethrone/ui/InteractionOverlay.tsx`、`src/games/dicethrone/ui/components/GameModal.tsx`：提示内容仍可确认/取消，但背景棋盘与合法手牌操作不再被遮罩无条件吞掉。
- `src/games/dicethrone/ui/__tests__/BoardOverlays.magnify.test.tsx`、`InteractionOverlay.test.tsx`、`compatSource.test.ts`：补放大层级、背景指针穿透和不再自动清理的回归。

## 验证

- Dice Throne 放大层、交互提示和兼容性回归：`48 passed`。
- `npx tsc --noEmit --pretty false`：通过。
- `git diff --check`：通过；仅有工作树既有 LF/CRLF 提示，无 diff 错误。

## 当前状态与边界

`resolved`。本地根因、修复和回归已完成；本轮未执行生产发布，也未把线上旧版本行为观察写成已生效证据。

## 漏审复盘 / 规范回代判断

旧测试只验证了交互弹窗会关闭放大层，没有验证“提示期间继续阅读”和“合法背景操作”这两个玩家可见合同；属于 UI 交互回归缺口与过时兼容性断言。现有反馈收口和 UI 变化规范已覆盖本类证据要求，本轮不新增第二套规范源。
