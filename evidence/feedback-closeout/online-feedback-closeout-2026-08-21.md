# 线上反馈收口证据 - 2026-08-21

## 本轮口径

- 处理口径：线上真实反馈。
- 正式真相源：`https://api.easyboardgame.top` 返回的线上反馈记录；生产状态回写使用反馈状态脚本自动选择的线上写入口。
- 本地镜像：`temp/feedback-closeout/status-board.json` 只用于镜像和回查，不等于线上正式记录。
- 拉取时间：`2026-08-21T14:36:27.052Z`。
- 拉取命令：`node .spec\skills\feedback-closeout\scripts\triage-open-feedback.mjs --statuses open,in_progress --limit 100 --slots 6 --out-dir temp\feedback-closeout\2026-08-21-online-triage`。
- 本批线上未收口反馈：4 条，归并为 4 个代表项。

## 本批反馈

| 反馈 | 游戏 | 类型 | 玩家/系统原始内容 | 本轮结论 |
| --- | --- | --- | --- | --- |
| `6a88349b3d0fef1e2e4e5381` | Smash Up | 系统自动反馈 | `[system][online-ai-watchdog] force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable` | 当前树已覆盖同类恢复链；按旧自动反馈已失效关闭。 |
| `6a88349c3d0fef1e2e4e5389` | Smash Up | 系统自动反馈 | `[system][online-ai-watchdog] repeated-recovery-force-unblocked active-turn-legal-only:repeat-limit-force-unblock:3/3:commands=ADVANCE_PHASE` | 当前树已覆盖同类恢复链；按旧自动反馈已失效关闭。 |
| `6a8854a33d0fef1e2e4e5766` | Smash Up | 玩家建议 | `可以给20分的模式，15分的模式太少了` | 这是胜利分数模式建议，不是当前对局故障；记录为后续玩法配置候选并关闭。 |
| `6a87ebe23d0fef1e2e4e4be4` | Dice Throne | 玩家 bug | `火法在圣骑士防御骰后不断重复攻击，直接给50血我秒了` | 已用真实反馈状态定位并修复，准备回写 resolved。 |

## Dice Throne 真 bug：火法炎爆术重复扣血

### 原始症状与真实证据

- 玩家原始描述：`火法在圣骑士防御骰后不断重复攻击，直接给50血我秒了`。
- 诊断包：`temp/feedback-closeout/2026-08-21-online-triage/6a87ebe23d0fef1e2e4e4be4.md`。
- 原始位点：`/play/dicethrone/match/lRFwgqAg2mS?playerID=0`。
- 真实反馈状态处于 `defensiveRoll`；玩家 0 是圣骑士，玩家 1 是火法。
- 真实状态中同一攻击链已经有 `pendingAttack.damageResolved=true`、`pendingAttack.resolvedDamage=49`、`pendingAttack.bonusDiceResolved=true`，同时仍残留 `pendingBonusDiceSettlement.displayOnly=true`、`customResolutionId=pyro-blast-roll`、`continuation.kind=attack`。
- 操作日志在同一秒反复出现“确认防御投掷（神圣防御 III）”“炎爆术 II 造成 2/3 点伤害”“奖励骰确认 / 掷出”，能解释玩家看到的“防御骰后不断重复攻击、血量被打空”。

### 分层归因

- 现实故障现象：圣骑士防御骰确认后，火法炎爆术 II 在同一攻击链里反复续跑，重复奖励骰和扣血。
- 直接触发条件：防御阶段退出时恢复同一攻击链，攻击链已经标记奖励骰已结算，但效果结算仍把炎爆术 II 的自定义骰子动作当作可再次执行。
- 止血/恢复动作：在攻击链已标记奖励骰结算完成时，跳过同一攻击者、非防御技能上下文里的骰子动作，防止再次投奖励骰。
- 根本机制：原逻辑只跳过通用 `rollDie`，没有跳过炎爆术 II 这种 `custom + dice` 的自定义骰子动作；因此主伤害续跑时会再次生成奖励骰请求并再次落地伤害。

### 本轮修复

- 修改 `src/games/dicethrone/domain/effects.ts`：在 `resolveEffectsToEvents` 中把“奖励骰已结算后不得再次投掷”的判断扩展到 `custom` 且属于骰子类的动作，并限定同一攻击者、非防御技能上下文、当前攻击链已 `bonusDiceResolved`，避免影响真正的防御骰流程。
- 修改 `src/games/dicethrone/__tests__/pyromancer-behavior.test.ts`：补回归测试“奖励骰已结算后，防御阶段续跑不应再次投奖励骰或重复扣血”，断言不会再生成奖励骰请求，不会新增扣血事件，只保留一次攻击结算。

### 验证

- 红测记录：修复前新用例仍收到 1 个 `BONUS_DICE_REROLL_REQUESTED`，证明测试命中重复奖励骰问题。
- 已通过：
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\pyromancer-behavior.test.ts -t "奖励骰已结算后|pyro-blast-2-roll" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\roll-context.test.ts src\games\dicethrone\__tests__\basic-commands-coverage.test.ts -t "bonusDiceResolved|奖励骰|defensiveRoll|防御" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - `npx eslint src\games\dicethrone\domain\effects.ts src\games\dicethrone\__tests__\pyromancer-behavior.test.ts`
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\pyromancer-behavior.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - `npx vitest run src/games/dicethrone/__tests__/pyromancer-behavior.test.ts`

### 同类扩审：同一攻击连续攻击修正

- 现实问题：同一笔攻击内如果连续打出两张攻击修正，系统不能把第二次覆盖第一次，也不能只在界面汇总里累计而最终伤害没吃到。
- 实现证据：当前攻击存在时，`BONUS_DAMAGE_ADDED` 会把每次修正累加到当前攻击的总额外伤害 `pendingAttack.bonusDamage`；带卡牌来源的攻击修正也会同步累加到攻击修正汇总 `pendingAttack.attackModifierBonusDamage`。
- 本轮补证：`src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts` 新增“同一笔攻击连续两次攻击修正时，应累计到当前攻击并进入最终伤害”，覆盖红热 + 升温两次修正累计为 5，最终伤害从 2 变 7，伤害事件落地后攻击收尾记录 `lastResolvedAttackDamage=7`。
- 已通过：`npx vitest run src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts`，60 passed。

## Smash Up 系统自动反馈

### `6a88349b3d0fef1e2e4e5381`

- 诊断包：`temp/feedback-closeout/2026-08-21-online-triage/6a88349b3d0fef1e2e4e5381.md`。
- 自动检测场景：线上 AI watchdog 在 `server-watchdog` 记录 AI 1 号位无法强制结束回合。
- 现实状态：matchId `wLMt88w5exR`，阶段 `factionSelect`，AI 1 号位已持有 `zombies_pod,shield_pod`，合法动作总数为 0。
- 监控触发条件：`active-turn-legal-only:follow-up-advance:legal_action_unavailable`。

### `6a88349c3d0fef1e2e4e5389`

- 诊断包：`temp/feedback-closeout/2026-08-21-online-triage/6a88349c3d0fef1e2e4e5389.md`。
- 自动检测场景：同一 matchId `wLMt88w5exR` 的重复恢复记录。
- 现实状态：阶段已到 `playCards`，合法动作总数为 1，唯一动作是 `ADVANCE_PHASE`。
- 监控触发条件：`active-turn-legal-only:repeat-limit-force-unblock:3/3:commands=ADVANCE_PHASE`；其 blocker 指纹仍指向旧 `factionSelect`。

### 结论与验证

- 这两条是系统自动反馈，不是玩家手动 bug 描述。
- 本轮没有给 Smash Up 新增代码修复；当前树已有 transport/watchdog/factionSelect 相关改动，定向验证已覆盖此类“派系选择 / active-turn-legal-only / legal_action_unavailable / 手动代 AI 选派系”恢复链。
- 已通过：`node scripts\infra\vitest-cli-safe.mjs run src\engine\transport\__tests__\server.test.ts -t "factionSelect|active-turn-legal-only|legal_action_unavailable|手动代 AI 选派系" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`。
- 状态处理：按“当前树已恢复 / 旧自动反馈已失效”关闭，不把它写成本轮新增根因修复。

## Smash Up 20 分模式建议

- 反馈：`6a8854a33d0fef1e2e4e5766`。
- 诊断包：`temp/feedback-closeout/2026-08-21-online-triage/6a8854a33d0fef1e2e4e5766.md`。
- 玩家原始内容：`可以给20分的模式，15分的模式太少了`。
- 原始位点：`/play/smashup/match/0n2NR8xgoWV?playerID=0`。
- 诊断状态：`factionSelect` 初始阶段，未附带功能错误、异常堆栈或卡死证据。
- 结论：这是胜利分数模式建议，不是当前对局故障；本轮记录为后续玩法配置候选，不擅自改默认 15 分规则。

## 回写与回查

- 线上回写入口：`.spec\skills\feedback-closeout\scripts\update-feedback-status.mjs`，实际 writer 为 `mongo-ssh`，每条反馈 `matchedCount=1`、`modifiedCount=1`。
- 已回写状态：
  - `6a87ebe23d0fef1e2e4e4be4`：`resolved`。
  - `6a88349b3d0fef1e2e4e5381`：`closed`。
  - `6a88349c3d0fef1e2e4e5389`：`closed`。
  - `6a8854a33d0fef1e2e4e5766`：`closed`。
- 本地镜像：`temp/feedback-closeout/status-board.json` 已同步，`node scripts\verify\verify-feedback-status.mjs temp\feedback-closeout\status-board.json` 通过。
- 线上回查：`node .spec\skills\feedback-closeout\scripts\triage-open-feedback.mjs --statuses open,in_progress --limit 100 --slots 6 --out-dir temp\feedback-closeout\2026-08-21-online-recheck` 返回 `open=0`、`in_progress=0`、`totalFetched=0`，回查时间 `2026-08-21T15:07:04.521Z`。
- 代码状态说明：Dice Throne 修复已在当前工作树验证；这不等于线上已经发布，线上是否生效取决于后续部署。
