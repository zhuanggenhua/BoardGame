# Cardia 线上反馈 6a3517a35ed87cdca4f72044 收口证据

## 时间与口径

- 处理时间：`2026-06-19 20:11 +08:00`
- 反馈来源：线上真实反馈接口 `https://api.easyboardgame.top/admin/feedback`
- 反馈 ID：`6a3517a35ed87cdca4f72044`
- 游戏：Cardia

## 原始症状

- 系统自动反馈记录的是：Cardia 在线 AI watchdog 在出牌阶段尝试替 1 号位执行“打出卡牌”，服务端拒绝为“对手必须先出牌”（`opponent_must_play_first`）。
- 反馈自带的真实状态快照显示：
  - 当前阶段是出牌阶段（`play`）
  - 当前处理的座位是 `1`
  - 可见合法动作里错误地暴露了 5 个“打出卡牌”动作
  - 反馈错误文案正是 `cardia:play_card:opponent_must_play_first`

## 根因

- 不是 watchdog 瞎点，也不是服务端校验误报。
- 真正问题是 Cardia 的 AI 合法动作生成在 `src/games/cardia/ai.ts` 里只检查了“该玩家是否已经出过牌”，漏掉了“占卜师要求下回合由指定对手先出牌”（`forcedPlayOrderNextEncounter`）这条业务约束。
- 结果是：
  - 服务端校验层会正确拒绝非法出牌；
  - 但 AI 预览和 watchdog 看到的候选动作集已经是脏的，于是持续产生这条线上反馈。

## 修复

- 文件：`src/games/cardia/ai.ts`
- 改动：
  - 在生成 Cardia 出牌动作前，补上 `forcedPlayOrderNextEncounter` 检查；
  - 如果当前仍处于“指定对手必须先出牌”状态，且该指定玩家还没出牌，则其他座位不再暴露任何 `play-card` 动作。

## 验证

已通过定向回归：

```powershell
pnpm vitest run src/games/cardia/__tests__/ai-action-generation.test.ts --configLoader native -t "线上反馈 6a3517a3：占卜师要求对手先出牌时，不应给错误座位暴露打牌动作"
```

验证结果：

- 错误座位 `0` 不再暴露 `play-card`
- 被强制先手的座位 `1` 仍正常暴露 `play-card`

## 结论

- 该反馈属于**已用真实反馈状态快照命中根因**。
- 当前代码已修复，且已有定向回归覆盖。
- 发布/部署状态与反馈状态分轴：本证据只证明“代码修复 + 本地验证”成立，不代表已经部署上线。
