# DiceThrone 反馈修复证据（69a58f38bd494244e5a29f30）

> 2026-06-06 当前有效口径：本文只对应反馈 `69a58f38bd494244e5a29f30` 这一条“中了眩晕还能出牌”的历史修复证据，不是当前 DiceThrone 所有 `DAZE/STUN` 门禁、所有打牌限制或新英雄补审的完成证明。阅读时只能把它当作单条反馈修复记录。

- 日期：2026-04-23
- 反馈：`69a58f38bd494244e5a29f30`
- 原始描述：中了眩晕还能出牌
- 游戏：DiceThrone

## 修复点

- 命令验证补齐（`PLAY_CARD`）：当前回合玩家若仍有 `DAZE`，直接拒绝并返回 `player_is_dazed`。
- 保持 `STUN` 拒绝打牌规则不变（`player_is_stunned`）。
- 同步 `src` 与 `e2e/src` 镜像测试，锁定回归。

### 代码变更

- `src/games/dicethrone/domain/commandValidation.ts`
- `e2e/src/games/dicethrone/domain/commandValidation.ts`
- `src/games/dicethrone/__tests__/daze-action-blocking.test.ts`
- `e2e/src/games/dicethrone/__tests__/daze-action-blocking.test.ts`
- `e2e/dicethrone/dicethrone-daze-extra-attack.e2e.ts`（补截图落证）

## 验证记录

- `npm run i18n:check`
- `npm run typecheck`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/daze-action-blocking.test.ts src/games/dicethrone/__tests__/token-execution.test.ts src/games/dicethrone/__tests__/shared-state-consistency.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1 -t "daze 状态会阻止当前回合玩家打牌|stun 状态会阻止当前回合玩家打牌|有 stun 时进入 offensiveRoll|眩晕（stun）进攻阶段处理"`
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-daze-extra-attack.e2e.ts "晕眩应该在攻击结束后触发额外攻击"`

## 关键截图与观察

- 截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-daze-extra-attack.e2e\晕眩应该在攻击结束后触发额外攻击\daze-extra-attack-triggered.png`

- 我实际看到：
  - 回合处于掷骰攻击阶段，且触发后仍由同一攻击方继续处于可进攻状态，说明 Daze 额外攻击链路未被本轮打牌限制修复破坏。

- 验收判定：
  - 达标。当前回合携带 `DAZE/STUN` 的“还能出牌”问题已在命令验证层封堵，并由单测锁定；Daze 额外攻击主链路 E2E 通过，未引入回归。

---

**当前阅读说明**：本文只能证明 `DAZE/STUN` 下仍可打牌这条专项问题曾被修复，不能外推为当前所有状态门禁、所有额外攻击链或 DiceThrone 当前整体审计都已收口。
