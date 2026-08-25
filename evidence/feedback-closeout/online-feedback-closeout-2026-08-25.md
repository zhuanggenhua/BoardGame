# 线上反馈收口证据（2026-08-25）

## 口径锁定

- 本轮口径：线上真实反馈。
- 真实来源：`https://api.easyboardgame.top` 抓取的线上反馈快照，汇总文件为 `temp/feedback-closeout/2026-08-24T13-04-58-588Z/summary.json`。
- 抓取时间：`2026-08-24T13:05:01.270Z`，北京时间 `2026-08-24 21:05:01`。
- 本轮范围：12 条 `open` 线上反馈，归并为 12 个代表项。
- 验收口径：玩家反馈需要代码修复、定向回归和线上状态回写；系统自动反馈至少做最低分诊，不能把恢复、跳过或降噪写成根因修复。
- 本轮未执行生产部署或 Android OTA；代码修复含义是“当前代码已修复并通过本地验证，发布后线上生效”。

## 收口汇总

| 结论 | 数量 | 反馈 |
| --- | ---: | --- |
| 已修复，回写 `resolved` | 9 | `6a8b541f446de293e25ffc6e`, `6a8b54a0446de293e25ffc81`, `6a8b5623446de293e25ffc8d`, `6a8b5712446de293e25ffc97`, `6a8b579b446de293e25ffca1`, `6a8b5832446de293e25ffcaa`, `6a8b58df446de293e25ffcbd`, `6a8b592b446de293e25ffcc6`, `6a8c33d116013ecedf5cb998` |
| 已最低分诊，回写 `closed` | 1 | `6a8bf0f516013ecedf5cb4bf` |
| 已最低分诊，当前线上已无待处理记录 | 2 | `6a8befef16013ecedf5cb493`, `6a8beff016013ecedf5cb49b` |
| 线上复查 | 0 剩余 | `2026-08-25 00:37:28` 重新拉取线上 `open=0`, `in_progress=0` |

## Smash Up：弃牌触发和目标选择漏链

反馈：`6a8b541f446de293e25ffc6e`, `6a8b54a0446de293e25ffc81`, `6a8b5623446de293e25ffc8d`, `6a8b5712446de293e25ffc97`。

- 玩家可见影响：
  - 加斯顿酒馆丢弃“发现图书馆”后，没有进入可从弃牌堆作为额外行动打出的链路。
  - “打破诅咒 / 发现图书馆”这两张从手牌弃掉后的特殊没有触发。
  - “魔法物品”从手牌弃掉后，本应让玩家选择是否从弃牌堆额外打出并选择基地，却被自动打到第一个基地。
  - “电源大厅 / 电源插排”本应让玩家选择己方角色移入或移出该基地，却跳过选择并自动移动到第一个基地。
- 真实证据：反馈诊断包显示加斯顿酒馆丢弃后只记录“调整随从额度 +1”，未打开“图书馆”额外行动打出流程；截图核对到“发现图书馆”“打破诅咒”“魔法物品”“电源大厅 / 电源插排”牌面都要求特殊触发或玩家选择。
- 根本机制：弃牌触发给出的受限额外出牌额度没有允许“从弃牌堆选择这张被弃掉的牌”，同时部分单选目标交互仍会自动确认，导致玩家本该选择的目标被第一个合法目标代替。
- 修复：
  - `src/games/smashup/domain/types.ts`, `abilityHelpers.ts`, `commands.ts`, `extraPlay.ts`, `reducer.ts` 增加受限立即额外出牌从弃牌堆选择的正式路径，并保留来源和“不消耗常规额度”的结算信息。
  - `src/games/smashup/abilities/beauty_and_the_beast.ts` 让“魔法物品”“打破诅咒”“发现图书馆”“不断的惊喜”从手牌弃掉后进入对应的额外打出选择链。
  - `src/games/smashup/abilities/wreck_it_ralph.ts` 为“电源插排”保留跳过选项并关闭单目标自动确认，避免自动移到第一个基地。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/disney-factions-abilities.test.ts --configLoader native -t "魔法物品|图书馆|电源插排|玫瑰花瓣|魔法城堡|甜蜜冲刺车手|阿修|薄荷喷发"`：1 file passed / 9 passed / 23 skipped。

## Smash Up：狮子王天赋和基地触发漏链

反馈：`6a8b579b446de293e25ffca1`, `6a8b5832446de293e25ffcaa`, `6a8b58df446de293e25ffcbd`, `6a8b592b446de293e25ffcc6`。

- 玩家可见影响：
  - “沙祖”牌面是 OR 二选一，但木法沙在弃牌堆时旧实现直接走抽牌，没有询问是否选择第一个效果。
  - “沙祖”牌面写的是天赋，但旧数据把它接成了入场一次性效果，导致场上每回合天赋入口不可用。
  - “鬣狗巢穴”牌面有天赋：这里一个己方角色本回合 +2，但旧数据没有可用天赋入口。
  - “丛林乐园”要求每回合一次在己方角色打到这里后选择己方角色放 +1 指示物，旧实现没有在角色打出后触发。
- 真实证据：截图核对到“沙祖”牌面含“另一个角色 +2 OR 木法沙在弃牌堆抽一张牌”，“鬣狗巢穴”牌面含天赋，“丛林乐园”牌面含角色打到该基地后的 +1 指示物触发。
- 根本机制：部分 Lion King 牌面只有其中一个分支或计分后特殊被接入；沙祖还被接成入场效果而不是场上每回合天赋，导致“每回合天赋入口”“OR 选择入口”和“角色打到基地后触发入口”都没有完整进入规则链。
- 修复：
  - `src/games/smashup/data/factions/lion_king.ts` 和 `src/games/smashup/abilities/disney_four_factions.ts` 将沙祖改为 playCards 阶段的场上天赋，并让木法沙位于弃牌堆时也打开二选一选择；新增“这里另一个角色本回合 +2”的结算模式。
  - `src/games/smashup/data/factions/lion_king.ts` 与 `disney_four_factions.ts` 为“鬣狗巢穴”登记 playCards 阶段天赋入口并结算 +2。
  - `src/games/smashup/abilities/disney_four_factions.ts` 为“丛林乐园”补上角色打到该基地后的可选 +1 指示物触发。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/disney-four-factions.test.ts --configLoader native -t "沙祖|鬣狗巢穴天赋|丛林乐园|狮子王|花木兰"`：1 file passed / 15 passed / 13 skipped。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/disney-four-factions.test.ts --configLoader native`：1 file passed / 28 passed。

## Dice Throne：枪手对决输掉后卡住

反馈：`6a8c33d116013ecedf5cb998`。

- 玩家原始症状：枪手对决输掉之后游戏卡住无法进行。
- 真实证据：诊断包显示当前阶段是防御投掷阶段，当前玩家有 `compare-roll-choice` 结果弹层；来源是“对决”，结果是“输掉对决”，确认值是造成 1 点不可防御伤害。行动日志已经显示“你输掉了对决：对攻击方造成 1 点不可防御伤害”，但弹层仍停留在当前交互上。
- 四层归因：
  - 现实故障：玩家已经看到对决输掉结果，但界面没有可靠的继续入口，导致对局卡在结果弹层。
  - 触发条件：这是一个没有可选按钮、只有确认值的对掷结果交互；旧界面只显示“确认中…”，依赖自动确认定时器。
  - 止血动作：无单独止血；本轮给玩家补上手动确认继续入口。
  - 根本机制：服务端收到确认命令后能关闭交互并结算 1 点不可防御伤害，但前端对“无选项 compare-roll 结果”没有手动确认按钮；自动确认没有发出或被中断时，玩家没有任何可点击的继续方式。
- 修复：
  - `src/games/dicethrone/ui/CompareRollOverlay.tsx` 在无选项且当前玩家可处理时显示“确认继续”按钮，同时保留自动确认提示；非拥有者显示等待文案。
  - `public/locales/zh-CN/game-dicethrone.json` 和 `public/locales/en/game-dicethrone.json` 补充确认按钮文案。
  - `src/games/dicethrone/__tests__/choice-interaction-anchor-contract.test.ts` 增加对决输掉后的无按钮确认管线回归。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/CompareRollOverlay.test.tsx --configLoader native`：1 file passed / 5 passed。测试环境有一条已有音效注册提示，不影响结果。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/choice-interaction-anchor-contract.test.ts --configLoader native -t "无按钮确认"`：1 file passed / 1 passed / 32 skipped。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/roll-context.test.ts --configLoader native -t "枪手对决|枪手摊牌"`：1 file passed / 2 passed / 50 skipped。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/choice-interaction-anchor-contract.test.ts --configLoader native -t "gunslinger duel"`：1 file passed / 7 passed / 26 skipped。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/actionLogFormat.test.ts --configLoader native -t "compare-roll-choice"`：1 file passed / 1 passed / 14 skipped。

## 系统自动反馈：AI watchdog 最低分诊

反馈：`6a8befef16013ecedf5cb493`, `6a8beff016013ecedf5cb49b`, `6a8bf0f516013ecedf5cb4bf`。

- `6a8befef16013ecedf5cb493`：自动检测记录显示 Smash Up 在选派系阶段，AI 座位当前无合法动作，自动结束回合失败；没有玩家交互、响应窗口或待处理伤害。
- `6a8beff016013ecedf5cb49b`：同一房间同一进度的重复恢复被抑制，状态仍是选派系阶段 AI 无合法动作；没有玩家交互、响应窗口或待处理伤害。
- `6a8bf0f516013ecedf5cb4bf`：自动检测记录显示 Smash Up 出牌阶段存在“魔法的一种”分配 +1 指示物交互；watchdog 在重复限制后执行 `SYS_INTERACTION_CANCEL+ADVANCE_PHASE` 强制解除。
- 状态回写：`6a8bf0f516013ecedf5cb4bf` 在生产反馈集合中命中并回写 `closed`；`6a8befef16013ecedf5cb493` 和 `6a8beff016013ecedf5cb49b` 在当前生产反馈集合中按 ObjectId 和字符串 ID 均未命中，因此没有冒充远端回写成功，只在本地镜像按“当前线上已无待处理记录”关闭。
- 当前结论：这三条是系统自动恢复/监控记录，诊断包足以确认监控场景和当时的恢复动作，但不足以证明本轮已经定位 AI 合法动作生成或交互无人处理的根本机制；本轮按“已最低分诊并记录为系统监控线索”收口，不称为根因修复。
- 线上复查：`node .spec/skills/feedback-closeout/scripts/triage-open-feedback.mjs --statuses open,in_progress --limit 100 --slots 4 --out-dir temp/feedback-closeout/2026-08-25T00-37-recheck` 返回 `open=0`, `in_progress=0`。
- 后续入口：若同类再次出现，应按 Smash Up AI 合法动作生成、选派系阶段 AI 决策、以及可见交互超时恢复链路继续专项排查。
