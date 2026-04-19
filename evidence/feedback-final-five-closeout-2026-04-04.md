# Feedback Final Five Closeout 2026-04-04

## 范围

- 对象：导出批次 `C:\Users\zhuagenbao\GameNotes\不烂\BoardGame反馈导出-2026-04-04T04-52-08-844Z` 中第一轮回写后仍为 `open` 的 `5` 条
- 目标：补足仓库证据，完成第二轮真实线上回写

## 结论

| feedbackId | game | 最终状态 | 结论 |
| --- | --- | --- | --- |
| `69ce62f3094b1acda250f7a5` | `cardia` | `resolved` | 审判官 `winTies` 逻辑已存在，且已补直接回归证明“赢得平局但仍跳过 ability 阶段”。 |
| `69c9436732bd47a7b57a6a10` | `smashup` | `resolved` | `关门放狗` 连续消灭与剩余预算过滤已有直接回归。 |
| `69cc8633c3e278ba205eb020` | `smashup` | `resolved` | 在线 AI 卡住链路已有专项审计与在线 E2E 证据。 |
| `69cca643c3e278ba205eb08d` | `smashup` | `closed` | 截图、状态快照和现有 `大衮` 测试共同表明不是 bug。 |
| `69ce7358094b1acda250f8ab` | `smashup` | `closed` | 生产日志与状态快照表明是两次 `Deputy +2` 叠加，不是异常 `+4`。 |

## 关键证据

### `69ce62f3094b1acda250f7a5`

- 实现：
  - `src/games/cardia/domain/execute.ts`
  - 平局时先记录 `originalWinner === 'tie'`，再应用 `winTies`
  - 即使改判胜负，仍按原始平局直接结束回合，不进入 `ability`
- 回归：
  - `src/games/cardia/__tests__/flow-system-auto-advance.test.ts`
  - 用例：`审判官赢得平局时，仍应跳过 ability 阶段并把平局改判为己方获胜`
- 验证点：
  - 最终阶段回到 `play`
  - `encounterHistory` 最后一条记录为 `winnerId='0'`、`loserId='1'`
  - 获胜方场上最后一张牌获得 `1` 枚印戒

### `69c9436732bd47a7b57a6a10`

- 回归：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - 用例：`关门放狗：预算应跨多次选择递减并支持连续消灭`
  - 用例：`关门放狗：预算允许时应支持第三次连续选择并消灭剩余目标`
  - 用例：`关门放狗：第一次消灭后应按剩余预算过滤目标`
- 结论：
  - 用户反馈的“只能消灭两个，不能继续选择剩下的”已被三段链式回归直接覆盖，属于历史 bug 已修

### `69cc8633c3e278ba205eb020`

- 证据文档：
  - `evidence/ai-interaction-audit-2026-04-04.md`
- 关键覆盖：
  - 在线 AI 使用 seat 私有视角
  - `isBlocked` 处理
  - 在线 `sendBatch(...)`
  - `attemptKey` 失败回退
  - Smash Up 在线 AI 隐藏交互 E2E
- 结论：
  - 反馈正文提到“出完一张就停住”，与该专项修复覆盖的链路一致，可判已修复

### `69cca643c3e278ba205eb08d`

- 截图：
  - `C:\Users\zhuagenbao\GameNotes\不烂\BoardGame反馈导出-2026-04-04T04-52-08-844Z\images\smashup\69cca643c3e278ba205eb08d\01-Screenshot.jpg`
- 人工结论：
  - `Ritual Site` 上有 `3` 张 `The Locals`
  - 每张都带 `+1`
  - 基地下方该方总战力显示 `9`
- 仓库回归：
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - 用例：`大衮在基地上只为你成组同名的随从提供力量`
- 结论：
  - 加成已算进总战力，更像对牌面 `+1` 标记和总战力读数的误解

### `69ce7358094b1acda250f8ab`

- 生产状态快照 / 日志结论：
  - `actionLog` 中有两次 `弃置1张牌`
  - 同局有 `临时力量+2：枪手`
  - 当前 `Gunfighter` 上 `tempPowerModifier: 4`
  - 弃牌堆里有两张 `Deputy`
- 仓库回归：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - 用例：`cowboys_deputy 可在决斗中弃牌给任意随从 +2 力量并改变胜负`
- 实现：
  - `src/games/smashup/domain/duel.ts`
  - `Deputy` 每次调用都固定 `addTempPower(..., 2, ...)`
- 结论：
  - 这是两次 `Deputy +2` 累加成 `+4`，不是异常结算

## 本轮验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/cardia/__tests__/flow-system-auto-advance.test.ts --configLoader native`
  - 结果：`5 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native`
  - 结果：`113 passed, 1 skipped`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`
  - 结果：`95 passed`

## 真实回写口径

- 本轮正式状态更新仍然不是走本地接口，也不是走网页 fallback。
- 真实写入口为：
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh boardgame`
  - 直接更新生产库 `feedbacks` 集合

## 收口结果

- 这批导出时的 `21` 条 `open` 反馈，当前线上现态为：
  - `resolved: 15`
  - `closed: 6`
  - `open: 0`
