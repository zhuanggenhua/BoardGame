# 幻想国度双人变体核心回合任务

> 说明：当前仓库里可能已经存在 `fantasyrealms` 双人核心回合的探索性实现与验证记录；在 `0.1` 未完成前，这些都只能算“草案对应的探索产物”，不能按正式 change 收口。

## 0. Approval Gate
- [x] 0.1 用户批准 `add-fantasyrealms-two-player-core-loop` 的范围与边界

## 1. Domain core loop
- [x] 1.1 扩展 `FantasyRealmsCore`，加入真实牌库、弃牌堆、手牌状态与回合阶段
- [x] 1.2 实现双人变体的 `DRAW_FROM_DECK / TAKE_FROM_DISCARD / DISCARD_CARD` 命令与校验
- [x] 1.3 实现“未满 7 手牌前摸 2 弃 1，满 7 后抽 1 弃 1”的阶段切换
- [x] 1.4 实现双方都满 7 且弃牌堆达到 12 张时的结束判定

## 2. Board runtime
- [x] 2.1 把当前静态公共牌列改成真实弃牌堆公开区
- [x] 2.2 在 Board 中表达当前回合允许的动作来源（牌库 / 弃牌堆 / 待弃状态）
- [x] 2.3 在未实现完整计分前，避免把分数摘要伪装成官方最终得分

## 3. Verification
- [x] 3.1 为双人变体 core loop 补领域测试
- [x] 3.2 更新 Board 测试，锁住弃牌堆公开区和回合阶段显示
- [x] 3.3 运行 `openspec validate add-fantasyrealms-two-player-core-loop --strict --no-interactive`
- [x] 3.4 运行 `npx vitest run` 的 fantasyrealms 定向测试集
