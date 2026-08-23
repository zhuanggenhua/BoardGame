# DiceThrone 本地反馈 69f44ba5：装填 Token 被触发两次（2026-08-22）

## 口径

- 本轮口径：本地数据库反馈记录。
- 真实源：`mongodb://127.0.0.1:27017/boardgame.feedbacks`。
- 反馈 ID：`69f44ba55045b6dda354882d`
- 原始症状保真版：玩家反馈“使用了两次装填token，虽然第二次没有效果，但应该只触发一次，是什么重复了”。

## 原始反馈命中的症状

反馈自带行动记录显示同一次“左轮手枪”攻击里出现两条“使用 装填（奖励骰加伤）”：

- `[14:42:32] 游客2141: 使用 装填（奖励骰加伤）`
- `[14:42:38] 游客2141: 使用 装填（奖励骰加伤）`

保存的系统事件流进一步确认这不是单纯日志重复：

- 第 45 条事件打开“攻击掷骰阶段结束 Token 选择”，第 47 条事件选择了装填。
- 第 50 条事件已经创建第一次装填奖励骰，等待右侧骰盘确认。
- 第 51 条事件在第一次奖励骰仍未结算时，又打开了同一个“攻击掷骰阶段结束 Token 选择”。
- 第 56 至 60 条事件由这个过早残留的第二个选择再次消耗装填并加 1 点伤害。
- 最终伤害为 6：左轮手枪基础 3 点，加上第一次装填奖励骰 1 点、荒野西部额外 1 点、第二次装填 1 点。

因此玩家看到的“两次装填 Token”与快照一致，属于实现 bug。

## 当前规则合同

- 枪手“装填”Token 可堆叠 2 层，每次使用消耗 1 个装填并掷 1 颗奖励骰。
- 规则允许玩家在同一次攻击中实际拥有多层装填时分别消耗，但不允许同一个已经打开的奖励骰确认流程尚未落地时，系统先重复打开下一轮装填选择。
- 本条反馈命中的问题不是装填数值规则错误，而是阶段自动推进在奖励骰事件尚未写入当前状态前，抢先继续推进并生成了重复选择入口。

合同入口：

- `src/games/dicethrone/heroes/gunslinger/tokens.ts`
- `src/games/dicethrone/domain/customActions/gunslinger.ts`
- `src/games/dicethrone/domain/flowHooks.ts`

## 根本机制

- 现实故障现象：玩家在一次左轮手枪攻击里看见装填被使用两次。
- 触发检测条件：同一批事件中先出现装填选择完成，再出现未结算的奖励骰请求。
- 止血 / 修复动作：自动推进检查把“当前批次刚创建的奖励骰”也视为阻塞，等待奖励骰状态落地后再继续。
- 根本机制：原先自动推进只检查“当前状态里是否已经有待结算奖励骰”，没有检查“这一批事件刚刚创建了待结算奖励骰”。由于奖励骰事件还未被 reducer 写入状态，自动推进误以为阻塞已清空，于是又推进一次并重复打开攻击结束 Token 选择。

## 本轮改动

- `src/games/dicethrone/domain/flowHooks.ts`
  - 新增“当前事件批次是否刚打开可交互奖励骰”的判断。
  - 自动阶段和战斗阶段的自动推进都同时检查当前状态与当前事件批次，避免奖励骰刚创建但尚未落地时被绕过。
- `src/games/dicethrone/__tests__/auto-phase-progress.test.ts`
  - 新增回归用例：装填奖励骰刚创建时不应自动推进并重复打开攻击结束 Token 选择。

## 验证

红测命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/auto-phase-progress.test.ts --configLoader native -t "装填奖励骰刚创建"
```

修复前结果：

- `1 failed`
- 失败断言：实际返回 `{ autoContinue: true, playerId: '0' }`，说明当前实现确实会继续自动推进。

修复后命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/auto-phase-progress.test.ts --configLoader native -t "装填奖励骰刚创建"
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/auto-phase-progress.test.ts --configLoader native
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/gunslinger-loaded-contract.test.ts src/games/dicethrone/__tests__/roll-context.test.ts --configLoader native -t "Loaded|装填|bonus dice|奖励骰"
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-execution.test.ts src/games/dicethrone/__tests__/token-fix-coverage.test.ts --configLoader native -t "Sneak Attack USE_TOKEN|USE_TOKEN 在响应时机|暴击 Token|终极技能无视潜行|装填"
```

修复后结果：

- 新增回归用例：`1 passed / 7 skipped`
- 自动推进测试全量：`1 file passed / 8 tests passed`
- 枪手装填合同 + 奖励骰上下文：`2 files passed / 25 tests passed / 29 skipped`
- Token 邻近用例：`2 files passed / 4 tests passed / 85 skipped`

## 同类扩审

- 搜索了奖励骰请求、攻击结束 Token 选择、自动推进、装填、左轮手枪相关入口。
- 根因在共享自动推进门口，不是枪手单个装填 handler 的数值错误；因此修在 `flowHooks.ts`，同时覆盖自动阶段与战斗阶段的同类奖励骰创建时序。
- 回归测试覆盖“奖励骰刚创建但尚未写入当前状态”这个原始缺口，避免以后同类 Token 或卡牌奖励骰再次被自动推进抢跑。

## 收口结论

这条反馈是实现 bug。当前版本已经修复：当装填奖励骰刚创建时，自动推进会等待玩家确认 / 重掷这颗奖励骰，不会在同一批事件里重复打开下一次“攻击结束 Token 选择”。玩家不需要额外操作，更新后同类局面只会看到当前奖励骰正常收口。
