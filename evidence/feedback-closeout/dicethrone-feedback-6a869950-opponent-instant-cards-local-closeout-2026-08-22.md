# Dice Throne 本地反馈收口：对手没攻击就到我了

- 日期：2026-08-22
- 口径：本地数据库反馈；Mongo `boardgame.feedbacks`
- 反馈 ID：`6a8699507e2d294f31fecd38`

## 原始症状

玩家反馈：`是不是bug对方没攻击就到我了？`

## 真实反馈状态

- 游戏：Dice Throne
- 当前阶段：进攻掷骰阶段
- 当前行动玩家：玩家 `0`
- 当前攻击：无，`pendingAttack = null`
- 当前阻塞交互：无
- 对手玩家 `1` 在日志里连续打出：
  - `card-super-double`：抽 3 张牌
  - `card-boss-generous`：获得 2 CP
  - `dodge`：获得 1 个闪避

这说明现场没有进入对手的攻击回合。对手是在玩家 `0` 的进攻掷骰阶段打了即时牌，随后仍停在玩家 `0` 的进攻掷骰阶段，等待玩家继续投骰 / 确认 / 选择攻击。

## 规则结论

这条不是规则 bug。

`card-super-double`、`card-boss-generous` 和月精灵 `dodge` 都是即时行动牌；当前出牌校验允许“没有额外前提的即时行动牌”在对方普通回合通过领域校验。它们不会把回合所有权改成对手，也不会产生对手攻击。

## 验证记录

```text
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/card-timing-response-boundaries.test.ts --configLoader native -t "所有没有额外前提的即时行动牌，在对方普通回合都能通过领域校验"
PASS: 1 passed / 7 skipped

node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/moon-elf-abilities.test.ts --configLoader native -t "行动卡 timing 正确"
PASS: 1 passed / 36 skipped
```

额外说明：完整 `card-timing-response-boundaries.test.ts` 当前有一条既有失败，内容是诅咒海盗 `card-cursed-pirate-ransom` 是否应进入改骰响应清单；它不涉及本反馈中的三张牌，也不改变“当前仍是玩家 0 的进攻掷骰阶段”这个结论。

## 收口口径

按非 bug 关闭。玩家无需额外操作；看到 AI 在你的掷骰攻击阶段打即时牌，不代表对手获得了攻击回合。
