# 线上反馈 6ac0e0c7b9755a57b451f138

## 反馈内容 / 现实症状

> 七张梭哈和香蕉分牌都没办法正常游玩，都看不到后续派发得牌

真实来源：生产反馈接口 `https://api.easyboardgame.top/admin-api/feedback`，诊断包 `temp/feedback-closeout/20261003T162743Z-online/6ac0e0c7b9755a57b451f138.md`。反馈发生在 The Gang（纸牌帮）真实房间，原始日志已推进到第 4 轮，状态快照显示 `gameMode=seven-card-stud` 且三名玩家各自拥有 4 张 `players[id].communityCards`，但共享 `core.communityCards` 为空。

## 发现的问题

这是 bug。七张梭哈、香蕉分牌的牌面按玩家存入 `players[id].communityCards`；推进校验、AI/自动推进和中央牌区原先仍只读取共享 `core.communityCards`。因此玩家可继续拿筹码，但公共牌展示为空，且终局完整牌面判断也会误判为未完成。

卡面不适用；本条是模式流程 / 视图消费问题。模式合同来源为 `src/games/the-gang/domain/expansions.ts`，领域消费链为 `commands.ts`、`ai.ts`、`domain/reducer.ts`，玩家可见消费点为 `Board.tsx`。

## 处理方式 / 修复结果

- 在 `expansions.ts` 集中提供个人公共牌模式判定、应有牌数和完整牌面判定。
- `commands.ts`、`ai.ts`、`domain/reducer.ts` 统一使用该判定，不再假设共享牌区。
- `Board.tsx` 在个人公共牌模式显示本地玩家中央牌区、其它座位个人公共牌和摊牌结果对应明牌。
- 补充领域回归：七张梭哈 4 张、香蕉分牌 3 张个人公共牌均可随四轮推进并进入摊牌。
- 补充真实浏览器回归：`node scripts/infra/run-e2e-single.mjs default e2e/the-gang/the-gang-runtime.e2e.ts "真实入口可看到个人公共牌并完成摊牌"`，七张梭哈与香蕉分牌 2/2 passed（2026-10-03）。
- 截图证据：`test-results/evidence-screenshots/the-gang/the-gang-runtime.e2e/七张梭哈真实入口可看到个人公共牌并完成摊牌/seven-card-stud-真实反馈路径个人公共牌可见并完成摊牌.jpg`。

## 漏审复盘 / 规范回代判断

旧的 The Gang 流程测试只覆盖共享德州扑克牌区；扩展配置测试只断言配置和状态数量，没有从玩家视角断言中央牌区及摊牌入口。属于单游戏扩展合同的测试缺口，现已用领域回归 + 同一真实 UI 入口补齐；现有 `feedback-closeout` 与 `e2e-verification` 规范已覆盖，不新增项目规范。

## 结论

本地代码与真实浏览器入口已恢复原始玩家可见链路；反馈可写回 `resolved`。生产部署尚未完成，因此“线上已生效”仍需单独发布后回查。
