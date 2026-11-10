# 线上反馈 6ac0df3fb9755a57b451f05e

## 反馈内容 / 现实症状

> 看不到公共牌。

真实来源：生产反馈接口 `https://api.easyboardgame.top/admin-api/feedback`，诊断包 `temp/feedback-closeout/20261003T162743Z-online/6ac0df3fb9755a57b451f05e.md`。该条与 6ac0e0c7b9755a57b451f138 命中同一 The Gang 个人公共牌消费根因。

## 发现的问题

这是同一 bug 的独立真人反馈。七张梭哈和香蕉分牌的公共牌写入 `players[id].communityCards`，但 `Board.tsx` 中央牌区、顶部座位和摊牌结果此前按共享 `core.communityCards` 读取，所以玩家实际已拿到后续牌，画面仍为空。

卡面不适用；本条是模式流程 / UI 读模型问题。源头合同为 `src/games/the-gang/domain/expansions.ts`，消费点为 `src/games/the-gang/Board.tsx`，推进链同时覆盖 `commands.ts`、`ai.ts`、`domain/reducer.ts`。

## 处理方式 / 修复结果

- 统一个人 / 共享公共牌选择器和完整牌面判定，修复规则推进与终局校验。
- 个人公共牌模式下中央牌区显示本地玩家明牌，顶部座位显示其它玩家明牌，摊牌至少显示本地玩家对应明牌。
- 真实浏览器回归：同一 The Gang 玩家入口切换香蕉分牌，完成四轮后中央牌区逐轮显示 1/2/3 张，并成功进入摊牌；用例 1/1 passed（2026-10-03）。
- 截图证据：`test-results/evidence-screenshots/the-gang/the-gang-runtime.e2e/香蕉分牌真实入口可看到个人公共牌并完成摊牌/banana-split-真实反馈路径个人公共牌可见并完成摊牌.jpg`。

## 漏审复盘 / 规范回代判断

旧审计验证了扩展配置和状态写入，但没有验证同一玩家视角的中央牌区、逐轮发牌和摊牌结果，属于单游戏 UI 消费链测试缺口；本轮已补真实入口双模式回归。现有规范已覆盖，不新增项目规范。

## 结论

本地代码与真实浏览器入口已恢复玩家可见公共牌链路；反馈可写回 `resolved`。生产部署尚未完成，因此“线上已生效”仍需单独发布后回查。
