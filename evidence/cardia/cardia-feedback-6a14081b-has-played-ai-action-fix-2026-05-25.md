# Cardia 线上反馈 6a14081b：已打牌玩家继续暴露打牌动作修复

## 范围

- 游戏：Cardia
- 线上只读复核时间：2026-05-25T15:25:32.229Z
- 反馈来源：生产机 `admin@8.148.71.102`，Mongo 容器 `boardgame-mongodb`，数据库 `boardgame`，集合 `feedbacks`
- 未执行：生产反馈状态回写、部署、提交、push

## 覆盖反馈

同一错误签名：

`[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:legal_action_command_failed:cardia:play_card:already_played_card_this_turn`

反馈 ID：

- `6a14081b94b5e7f2607c2313`
- `6a1408b794b5e7f2607c2324`
- `6a14097b94b5e7f2607c233b`

生产只读查询时三条均为 `open`，线上总量为 `open=13`、`in_progress=0`、`resolved=215`、`closed=75`。

## 原始症状

线上反馈发生在 Cardia `play` 阶段，`online-ai-watchdog` 尝试推动本地 AI 座位继续行动时，候选 legal action 仍包含 `cardia:play_card`，但执行命令被验证层拒绝为：

`cardia:play_card:already_played_card_this_turn`

症状形状是“AI legal action 暴露了一个验证层必拒的打牌命令”，不是执行层应该放宽校验。

## 根因

`src/games/cardia/ai.ts` 的 `buildPlayCardActions(core, playerId)` 只检查玩家存在并枚举手牌，没有检查 `player.hasPlayed`。

这导致玩家已经在本回合打过牌后，AI / watchdog 仍可能拿到 `play-card` legal action；而 `src/games/cardia/domain/validate.ts` 的 `validatePlayCard` 会正确拒绝 `hasPlayed=true` 的玩家继续打牌。

UI 层已有相同语义：打牌按钮要求 `phase === 'play' && !myPlayer.hasPlayed`。

## 修复

在 `buildPlayCardActions` 中增加最小早返回：

- 玩家不存在：返回空动作列表
- 玩家 `hasPlayed=true`：返回空动作列表
- 只有未打牌玩家才按手牌生成 `play-card` actions

涉及文件：

- `src/games/cardia/ai.ts`
- `src/games/cardia/__tests__/ai-action-generation.test.ts`

## 回归测试

新增测试：

- `线上反馈 6a14081b：已打牌玩家不应继续暴露打牌动作`

覆盖：

- `phase='play'`
- 当前玩家手牌中仍有牌
- 当前玩家 `hasPlayed=true`
- `cardiaAiRuntime.buildLegalActions(...)` 不再返回 `kind === 'play-card'`

## 验证

先补测试后，修复前复现失败：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/cardia/__tests__/ai-action-generation.test.ts --configLoader native --maxWorkers 1 -t "6a14081b"
```

失败形状：

- expected `play-card` 数量为 0
- 实际生成 1 个 `play-card`

修复后验证通过：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/cardia/__tests__/ai-action-generation.test.ts --configLoader native --maxWorkers 1 -t "6a14081b"
```

结果：1 passed。

完整相关测试：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/cardia/__tests__/ai-action-generation.test.ts --configLoader native --maxWorkers 1
```

结果：12 passed。

静态检查：

```bash
npx eslint src/games/cardia/ai.ts src/games/cardia/__tests__/ai-action-generation.test.ts
```

结果：0 errors，`src/games/cardia/ai.ts` 存在 8 个既有 `no-explicit-any` warnings。

## 未完成项

- 未回写线上反馈状态；当前 HTTP 反馈接口不可用，生产 Mongo 直写需要当轮明确授权。
- 未部署；本轮仅完成本地代码修复与验证。
