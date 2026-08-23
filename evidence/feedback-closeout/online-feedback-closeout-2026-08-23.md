# 线上反馈收口证据（2026-08-23）

## 口径锁定

- 本轮口径：线上真实反馈。
- 真实来源：生产 Mongo `boardgame.feedbacks`，本地原始镜像为 `temp/feedback-closeout/2026-08-23-online-in-progress/raw-feedback.json`。
- 抓取时间：`2026-08-23T02:11:12.017Z`。
- 本轮范围：12 条当时仍为 `in_progress` 的线上反馈。
- 验收口径：真 bug 需要有代码修复、回归测试和线上状态回写；旧包或当前树已恢复的反馈，需要写清关闭理由并回写线上状态。
- 本轮未执行生产部署或 Android OTA；涉及代码修复的反馈，含义是“当前代码已修复并通过本地验证，发布后线上生效”。

## 收口汇总

| 结论 | 数量 | 反馈 |
| --- | ---: | --- |
| 已修复，回写 `resolved` | 7 | `6a89e651e3171a1d19dfd296`, `6a89e650e3171a1d19dfd28e`, `6a89e650e3171a1d19dfd286`, `6a89c2bee3171a1d19dfd18e`, `6a89c170e3171a1d19dfd13a`, `6a89d302e3171a1d19dfd1ff`, `6a8879bf10df78bf002c873b` |
| 当前树已恢复或旧包问题，回写 `closed` | 5 | `6a89be1ce3171a1d19dfd03c`, `6a89b7e3e3171a1d19dfcf0f`, `6a894f07e3171a1d19dfc8dc`, `6a894ee2e3171a1d19dfc8d9`, `6a894a9fe3171a1d19dfc8ae` |

## Dice Throne：AI watchdog 推阶段失败

反馈：`6a89e651e3171a1d19dfd296`, `6a89e650e3171a1d19dfd28e`, `6a89e650e3171a1d19dfd286`。

- 玩家可见影响：同一局 `noCXRKa_5sB` 卡在 AI 座位恢复流程，系统自动检测尝试推进阶段，但阶段推进失败。
- 真实证据：系统自动检测记录保存的当前阶段是 `main1`，当前玩家是 AI 座位 `1`，没有正在等待的交互或响应窗口；AI 合法动作数量为 0。第三条命令失败反馈的可见状态里，玩家 `0` 还有未收口的展示型奖励骰：奖励骰记录 `pendingBonusDiceSettlement.id = card-cursed-pirate-sip-display-1787422285811`，当前奖励骰上下文 `currentRollContext.kind = bonus`、主人 `ownerPlayerId = 0`、`policy.blocksPhaseFlow = true`，并且它挂起的是玩家 `1` 的进攻骰流程。
- 四层归因：
  - 现实故障：对局还需要玩家 `0` 收口奖励骰，但系统恢复层把当前操作者看成了 AI `1`。
  - 触发检测：watchdog 看到 AI `1` 当前阶段无合法动作，尝试 `ADVANCE_PHASE`，得到 `cannot_advance_phase`。
  - 止血动作：watchdog 的重复恢复被抑制，避免继续重复裸推阶段。
  - 根本机制：Dice Throne 在线恢复的“当前操作者”解析只在 `defensiveRoll` 阶段看奖励骰；当 `main1` 阶段仍有未收口奖励骰时，恢复层漏看奖励骰主人，错误把 AI 回合玩家当成恢复操作者。
- 修复：`src/games/dicethrone/game.ts` 中的 Dice Throne 运行时操作者解析现在先检查当前未收口奖励骰；只要奖励骰还开着，就由奖励骰主人持有恢复操作者身份，之后才回到原 defensiveRoll 逻辑。
- 回归：`src/games/dicethrone/__tests__/onlineAiRecovery-current-player.test.ts` 新增主阶段奖励骰主人识别，以及“真人奖励骰未收口时 watchdog 不替 AI 裸推进阶段”。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/onlineAiRecovery-current-player.test.ts --configLoader native`：1 file passed / 4 passed。
  - 历史同批定向回归已通过：`ai-main-phase-turn-gating.test.ts` 的展示型奖励骰 / 主阶段临时骰相关 5 条通过；`basic-commands-coverage.test.ts` 的 bonus dice 相关 6 条通过。

## Smash Up：葫芦小金刚复制六娃失败

反馈：`6a89c2bee3171a1d19dfd18e`, `6a89c170e3171a1d19dfd13a`。

- 玩家可见影响：玩家在“葫芦小金刚复制六娃天赋”交互里选择复制后，命令管线报错，操作没有正常结算。
- 真实证据：两条系统反馈都来自 `SYS_INTERACTION_RESPOND`，当前交互都是 `huluwawa_little_king_kong_copy_talent`，可选项包含“跳过”和“六娃 @ 印斯茅斯”。失败原因说明这个交互处理器在发出领域事件时同时改了权威对局状态。
- 四层归因：
  - 现实故障：复制六娃天赋时，玩家已经点了交互选项，但对局未能正常写入限时减力效果。
  - 触发检测：命令处理管线发现交互处理器同时返回领域事件和直接改过的权威状态，拒绝提交。
  - 止血动作：系统拒绝这次有冲突的写入，避免权威状态被事件和手工改动重复写。
  - 根本机制：六娃天赋原实现一边返回永久力量事件，一边直接把限时力量记录写进 `core`，违反“领域事实必须通过事件正式归约一次”的规则。
- 修复：`src/games/smashup/abilities/huluwawa.ts` 改为只发带过期回合的力量事件，由领域事件归约写入限时力量记录。
- 回归：`src/games/smashup/__tests__/abilities/huluwawa.test.ts` 新增“葫芦小金刚复制六娃天赋时通过领域事件写入限时力量修正”。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/huluwawa.test.ts --configLoader native -t "葫芦小金刚复制六娃天赋时通过领域事件写入限时力量修正"`：1 file passed / 1 passed。

## Smash Up：对手打战术误触发哥佐拉

反馈：`6a89d302e3171a1d19dfd1ff`。

- 玩家可见影响：玩家反馈“别人打战术也能触发我的哥佐拉的效果”。
- 真实证据：反馈快照里的行动记录显示，对手在哥佐拉所在基地相关回合打出战术；当时哥佐拉位于东京，反馈内容指出对手战术触发了自己的泰坦效果。
- 四层归因：
  - 现实故障：对手打战术时，不该让玩家自己的哥佐拉加标记或弹抽牌提示。
  - 触发检测：反应队列按泰坦控制者上下文收集触发，但没有同时确认“打出这张牌的人就是哥佐拉控制者”。
  - 止血动作：无单独止血；按触发源过滤修复。
  - 根本机制：哥佐拉的随从 / 战术打出触发只应响应控制者自己在同基地打出的牌，旧触发条件只看同基地和泰坦控制者，漏掉了事件玩家校验。
- 修复：`src/games/smashup/abilities/titans.ts` 在哥佐拉随从 / 战术触发里增加事件玩家必须等于泰坦控制者的条件；反应队列测试同步锁住对手打牌不触发。
- 回归：
  - `src/games/smashup/__tests__/abilities/kaiju.test.ts` 增加“对手在 Gorgodzolla 所在基地打战术不会给它加标记或弹抽牌提示”。
  - `src/games/smashup/__tests__/reactionQueueEventPlayerContext.test.ts` 增加反应队列层面的同类断言。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/kaiju.test.ts --configLoader native -t "Gorgodzolla"`：1 file passed / 5 passed / 14 skipped。测试中 `BASE_REPLACED` stderr 来自 Kaiju Island 测试夹具没有基地牌库，不是失败。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueEventPlayerContext.test.ts --configLoader native -t "Gorgodzolla"`：1 file passed / 3 passed / 150 skipped。

## Smash Up：怨灵 / 复苏自动选择旧问题

反馈：`6a89be1ce3171a1d19dfd03c`, `6a89b7e3e3171a1d19dfcf0f`。

- 玩家可见影响：
  - `6a89be1ce3171a1d19dfd03c`：玩家本来想摧毁“幽灵”，系统却自动选择了另一张牌摧毁。
  - `6a89b7e3e3171a1d19dfcf0f`：行动“复苏”没有转移玩家的行动牌，只移除了持续战术。
- 真实证据：
  - 怨灵反馈的可见日志显示 `Ellen` 天赋触发后直接移除持续战术“人类的愚蠢”，并调整基地爆分线。
  - 复苏反馈的可见日志显示 `Resurgence` 打出后直接移除持续战术“放射性吐息”，没有转移选择链。
- 反馈本体结论：当前工作树已经把这些自动选择改为玩家选择流程，并用怨灵 / 复苏定向测试验证；这两条按“当前版本已不再保留该自动选择行为”关闭，不把它们写成本轮新修的代码成果。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts --configLoader native -t "Resurgence|复苏|Ellen|艾伦|Ancient Sumerian|古苏美尔|Watson|怨灵|幽灵"`：1 file passed / 18 passed / 61 skipped。

## 客户端：旧 WebView 不支持 `.at()`

反馈：`6a894f07e3171a1d19dfc8dc`, `6a894ee2e3171a1d19dfc8d9`, `6a894a9fe3171a1d19dfc8ae`。

- 玩家可见影响：旧 Android WebView 中进入教程或操作棋盘时报 `*.at is not a function`，页面加载失败或命令执行失败。
- 真实证据：
  - 三条自动反馈的 userAgent 都是 Android 14 的 WebView / VivoBrowser，内核为 Chrome 87。
  - 报错分别出现在纸牌帮教程、法师战争教程、召唤师战争教程，堆栈指向线上压缩产物中的 `.at()` 调用。
- 当前结论：当前源码非测试代码里已经没有 `.at(` 调用；本轮运行 `rg -n "\.at\(" src -g "*.ts" -g "*.tsx" -g "*.js" -g "*.jsx" -g "!**/__tests__/**" -g "!**/*.test.*"` 无输出。
- 关闭理由：这三条来自旧线上包 / 旧 WebView 对现代数组方法的兼容问题；当前源码已移除同类语法。需要发布新构建后再观察是否还有旧包残留或新的同类堆栈。

## Smash Up：急速侠点击移动但未移动

反馈：`6a8879bf10df78bf002c873b`。

- 玩家原始症状：超级英雄里的急速侠，对方放置随从后，系统问是否移动；玩家点击了移动，但急速侠没有移动。
- 真实证据：
  - 反馈快照里急速侠 `c89 / superheroes_the_burst` 由玩家 `2` 控制，位于葫芦山，同基地有玩家 `2` 的秘密基地。
  - 玩家 `0` 在七彩莲蓬打出随从后，事件流两次记录急速侠交互被玩家 `2` 选择 `move`，交互上下文里目标基地是七彩莲蓬。
  - 同一快照行动日志只记录“爆发 → 葫芦山”的登场，没有后续“移动随从：爆发”；最终棋盘里爆发仍在葫芦山。
- 四层归因：
  - 现实故障：玩家点了急速侠移动，界面交互被系统接收，但随从没有移动到对手刚打出随从的基地。
  - 触发检测：急速侠移动交互成功解析，后续没有产生真实移动事件。
  - 止血动作：无单独止血；从移动事件保护判定修复。
  - 根本机制：移动事件本身带有真实来源玩家 `sourcePlayerId = 2`，但语义保护判定在处理“随从移动”时使用当前命令玩家作为来源；当时当前命令玩家是打出随从的玩家 `0`，葫芦山保护己方高力量随从的效果误把急速侠自己的移动当成“其他玩家影响”拦掉。
- 修复：`src/games/smashup/domain/effectSemantics.ts` 中，随从移动保护判定优先使用事件自带的真实来源玩家；随从摧毁仍按摧毁者优先。
- 回归：`src/games/smashup/__tests__/abilities/superheroes.test.ts` 增加“爆发在秘密基地同基地保护下点击移动仍会真实移到对手打出随从的基地”。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/superheroes.test.ts --configLoader native -t "爆发|superheroes_the_burst"`：1 file passed / 4 passed / 25 skipped。
  - 历史同批保护扩审已通过：`huluwawa.test.ts` 全量 25 passed；熊骑兵 / 杀手植物移动保护定向 37 passed / 72 skipped。

## 额外代表测试

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionChainE2E.test.ts src/games/smashup/__tests__/promptResponseChain.test.ts --configLoader native`：
  - `promptResponseChain.test.ts` 通过：14 passed。
  - `interactionChainE2E.test.ts` 有 3 个相邻交互链失败：`ninja_disguise` 单基地期望值、`alien_probe` 单对手自动确认期望值、`elder_thing_unfathomable_goals` 单目标自动消灭期望值。
  - 这 3 个失败不作为本批 12 条线上反馈的通过证据；本批反馈采用上面列出的定向回归作为收口依据。
