# 本地反馈批量收口证据：SummonerWars / DiceThrone AI 选角（2026-08-22）

## 口径

- 本轮口径：本地数据库反馈记录。
- 真实源：`mongodb://127.0.0.1:27017/boardgame.feedbacks`。
- 本文件只记录本地反馈收口证据；`temp/feedback-closeout/status-board.json` 只是镜像。

## 反馈：神出鬼没的效果无法点击使用啊

- 反馈 ID：`69ed86efa0adf1cb68601c12`
- 游戏：`summonerwars`
- 原始症状保真版：玩家反馈“神出鬼没”的效果无法点击使用。
- 当前反馈快照证据：
  - 反馈自带行动记录包含“发动技能：神出鬼没 来源：思尼克斯”。
  - 反馈自带状态中存在 `activated_ability_target` 的待响应选项，能力是 `vanish`，目标格为 0 费友方单位。
- 已有修复证据：`evidence/summonerwars/summonerwars-vanish-clickability-fix-2026-04-26.md`
  - 前端已把“神出鬼没”目标选择映射回可点击的技能目标模式。
  - 目标点击时已走当前交互的响应命令，不再错误地重新发动一次技能。
- 本轮当前树验证：
  - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-goblin.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/actionLogFormat.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "神出鬼没|\\[vanish\\]|annihilate|除灭|EVENT_PLAYED"`
  - 结果：`3 files passed / 8 tests passed`
- 收口结论：当前版本已经覆盖“神出鬼没”点击后进入目标选择、选择目标并完成交换的链路；按已恢复关闭。

## 反馈：对方突然全挂了，没看到事件牌打出

- 反馈 ID：`69eeac11d9cc518203642976`
- 游戏：`summonerwars`
- 原始症状保真版：玩家看到对方单位突然全部被消灭，并反馈没有看到事件牌被打出。
- 当前反馈快照证据：
  - 反馈自带事件流存在 `sw:event_played`。
  - 事件牌 ID 为 `necro-annihilate-0-1-23`，中文名《除灭》。
  - 随后事件流出现多个单位受伤和被消灭事件，能解释玩家看到的“突然全挂了”。
- 规则/实现解释：
  - 《除灭》的效果是指定任意数量友方单位为目标；每个目标可以对其相邻单位造成 2 点伤害，然后消灭所有目标。
  - 因此这局不是凭空消灭，而是事件牌结算造成的结果。
- 已有证据：`evidence/summonerwars/summonerwars-event-annihilate-e2e-test.md`
  - 已验证《除灭》事件卡的多目标交互链。
  - 当前行动记录格式测试包含“系统补执行的 EVENT_PLAYED 也会生成打出事件日志”的覆盖。
- 本轮当前树验证：
  - 命令同上 SummonerWars 定向验证。
  - 结果：`3 files passed / 8 tests passed`
- 收口结论：反馈快照能追溯到对手打出《除灭》，当前版本也有事件牌日志覆盖；按已有解释和当前恢复关闭。

## 反馈：ai没有选择角色

- 反馈 ID：`6a7d71172b841ba4e6115296`
- 游戏：`dicethrone`
- 原始症状保真版：真人玩家已经选择角色，但 AI 座位仍停在未选择角色，导致开局 setup 无法继续。
- 当前反馈快照证据：
  - 反馈自带状态中 `selectedCharacters` 为 `{ "0": "tianshi", "1": "unselected" }`。
  - `readyPlayers` 为 `{ "0": false, "1": false }`。
  - 这与“AI 没有选择角色”的玩家症状一致。
- 已有修复证据：`evidence/dicethrone/dicethrone-feedback-6a7d711-setup-ai-character-recovery-2026-08-13.md`
  - DiceThrone 的 setup 阶段已声明为普通 AI 可以公开探测合法动作的开局阶段。
  - 服务端在真人选角后会代普通 AI 执行 `SELECT_CHARACTER` 和 `PLAYER_READY`。
- 本轮当前树验证：
  - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "DiceThrone 普通 setup 阶段应代普通 AI 选择角色|DiceThrone 在线普通 AI 应在人类选角命令成功后立即由服务端继续选角"`
  - 结果：`1 file passed / 2 tests passed`
  - 测试日志显示 AI 座位执行 `SELECT_CHARACTER`，随后执行 `PLAYER_READY`。
- 收口结论：当前版本已经验证真人选角后普通 AI 会自动选角并 ready；按已恢复关闭。

## 未纳入本批关闭的相邻反馈

- `69f40b9e9efe1f53e1e9c700` 仍保留未关闭：本轮复跑更宽的 watchdog 测试时命中 `window.passedPlayers is not iterable`，需要先查清测试夹具/当前状态合同，不把这条混入 AI 选角反馈。
- DiceThrone 战争贩子、飞行、战术优势响应、装填 token 等反馈未在本证据中关闭；这些反馈的原始症状与本批验证不等价，必须另行锁定和验证。
