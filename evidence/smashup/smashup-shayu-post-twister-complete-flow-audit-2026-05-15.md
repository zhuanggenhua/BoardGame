# SmashUp shayu 三派系 Twister 后完整技能流程再审计（2026-05-15）

## 目标与完成定义

本轮不是重新证明“已有测试很多”，而是把 Twister 反馈暴露出的新门禁应用回 shayu 全集：每个可执行对象都必须按完整技能流程矩阵复核，不能只用“可触发 / prompt 出现 / 成功路径”替代完整审计。

## 2026-05-15 失效结论回写：完整流程矩阵仍缺逐子句门禁

后续“长描述复杂对象抽样全链路审计”发现，本文件虽然补了对象级完整流程矩阵，但仍未强制把每张卡/基地的真相源文本拆成独立规则子句逐项核销。`mythic_greeks_argonaut` 因此出现漏审：

- 旧矩阵行写“触发希腊行动后能力”，但没有逐项列出“所有 action 后能力”应包含 Jason。
- 旧矩阵行写 `PLAY_MINION`，但没有把第二句“可以改为打出这张牌”映射到替代行动额度入口、command payload 与 reducer 消耗。

修复后证据入口：

- `evidence/smashup/smashup-shayu-long-text-sample-audit-2026-05-15.md`
- `.spec/knowledge/standards/testing-audit.md` 已新增通用“规则文本逐句/子句覆盖”门禁。

因此本文的对象级 `mythic_greeks_argonaut` pass 结论在 2026-05-15 前是不完整的；后续引用必须同时引用上述修复证据。

全集：

- Sharks：12 张。
- Tornados：12 张。
- Mythic Greeks：15 张。
- shayu 基地：6 张。
- 合计：45 个对象。

本轮成功标准：

1. 45/45 对象在下方矩阵中有逐对象行。
2. 每行覆盖：真相源、静态定义、候选/入口、命令/执行、消耗/限制、主效果、分支/否定、后续清理、证据层级。
3. Twister 反馈新增的不变量已应用到全体新派系：凡“你可以 / 至多 / 任意数量”必须有拒绝/空选或说明其可选性已由激活入口承载。
4. 完成后抽查至少 3 条不同机制家族的全链路；若发现实现错误，必须修复、补规范、再重审。

## Prompt-to-Artifact Checklist

| 用户要求 | 具体证据 |
| --- | --- |
| 全面重审新派系 | 本文 45 行完整技能流程矩阵；对象全集来自 `src/games/smashup/data/factions/{sharks,tornados,mythic_greeks}.ts` 与 `src/games/smashup/data/cards.ts`。 |
| 完成后抽查几个全链路审查 | 本文“全链路抽查计划与结果”记录至少 3 条机制家族抽查、命令和结果。 |
| 如果有实现不对就加强审计规范 | Twister 已触发一次规范升级；本轮若再发现新缺陷，必须追加到 `.spec/knowledge/standards/testing-audit.md` 或项目 skill。 |
| 然后再重审，如此循环 | 本轮专门在 Twister 修复和规范升级之后执行再审计；guard：`temp/smashup-shayu-post-twister-loop-2026-05-15.json`。 |

## 完整技能流程矩阵

缩写：

- TS：正式卡图 / 规则真相源。
- L1：静态/数据/注册证据。
- L2：领域行为测试。
- L3：真实入口 E2E / 截图。
- L4：时序、队列、跨阶段或 once/turn 证据。
- N/A：该对象没有对应维度，理由写在单元格内。

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sharks_megalodon` | TS：入场/计分前可消灭低战力 | minion + onPlay/special 注册 | 随从入场、计分前窗口 | PLAY_MINION / special trigger | 随从打出额度；special 窗口由引擎控制 | 消灭同基地合法目标 | 可选 destroy prompt 允许 skip；低战力过滤 | 交互清空，destroy trigger 后处理 | L2 + L3/L4 代表 | 通过；special 归入 beforeScoring 代表链 |
| `sharks_great_white` | TS：天赋移动自身并消灭 2- | minion talent 注册 | 真实点击随从天赋 | USE_TALENT | talent once/use 状态 | 自身移动，目的地 2- 被消灭 | 激活天赋本身承载可选；无合法目标时反馈 | 交互清空，目标移除 | L2 + L3 | 通过 |
| `sharks_hammerhead` | TS：你消灭随从后 +1 | trigger 注册 | destroy 后自动触发 | destroy trigger queue | 无额外消耗 | 锤头鲨加指示物 | 非你消灭不触发由 destroyerId 合同约束 | trigger queue 清空 | L2 + L4 代表 | 通过 |
| `sharks_mako` | TS：你消灭随从后可立即打出灰鲭鲨 | destroy trigger + extra minion | destroy 后额外出牌窗口 | immediate extra minion | sameNameOnly + 限定基地 | 灰鲭鲨打到触发基地 | 可跳过；非灰鲭鲨不候选 | extra prompt 清空 | L2 + L3 代表 | 通过 |
| `sharks_blood_in_the_water` | TS：基地持续，destroy 后额外打出 3- | base ongoing + trigger | 行动附着基地；destroy 后窗口 | PLAY_ACTION + extra minion | powerMax 3，restrictToBase | 3- 随从打到触发基地 | 可跳过；4+ 不候选 | extra prompt 清空 | L2 + L3/L4 代表 | 通过 |
| `sharks_week_of_sharks` | TS：回合结束额外抽牌 | base ongoing endTurn | 行动附着基地，endTurn 自动 | ADVANCE_PHASE endTurn | 同拥有者多张只一次 | 抽 1 | 无玩家分支；空牌库由抽牌系统处理 | 回合推进继续 | L2 + L4 | 通过 |
| `sharks_torn_apart` | TS：消灭低力量并抽牌 | action onPlay | 手牌行动入口 | PLAY_ACTION | 行动额度 | 目标被消灭并抽牌 | 可选/多选不适用；目标阈值过滤 | destroy 后触发链收口 | L2 + L3 | 通过 |
| `sharks_chum` | TS：附着，基地有随从被消灭则宿主 +1 | minion ongoing attach | playNeedsMinion | PLAY_ACTION attach | 行动额度，附着随从 | 宿主获得 +1 指示物 | 分支不适用；附着目标由入口限定 | destroy 后 trigger 清空 | L2 + L3 代表 | 通过 |
| `sharks_dangerous_waters` | TS：基地持续天赋 -2 | base ongoing talent | 附着基地后 talent | USE_TALENT ongoing | talent use 状态 | 同基地目标临时 -2 | 激活入口承载可选；其他基地不候选 | 临时修正清理随回合系统 | L2 + L3 代表 | 通过 |
| `sharks_feeding_frenzy` | TS：消灭任意数量低力量 | action onPlay + multi | 手牌行动入口 | PLAY_ACTION | 行动额度 | 多个 2- 目标被消灭 | 任意数量通过 multi min=0/skip 合同；高力量过滤 | multi prompt 清空 | L2 + L3 | 通过 |
| `sharks_air_jaws` | TS：选己方随从移动并消灭目的地低战力 | action playNeedsMinion self | 手牌选己方随从 | PLAY_ACTION + destination prompt | 行动额度 | 源随从移动，目的地低战力目标消灭 | 第一入口不得二次选随从；非己方不候选 | destination prompt 清空 | L2 + L3 | 通过 |
| `sharks_freakin_laser_beam` | TS：以己方随从为源消灭同基地低战力 | action playNeedsMinion self | 手牌选己方随从 | PLAY_ACTION + target prompt | 行动额度 | 同基地合法目标消灭 | 非己方源不可选；高战力不候选 | target prompt 清空 | L2 + L3 | 通过 |
| `base_shark_reef` | TS：消灭者给自己随从 +1 | base ability | destroy 后 optional trigger | trigger queue | 无消耗 | destroyer 的己方随从 +1 | 可跳过；非 destroyer 随从不候选 | base trigger 清空 | L2 + L4 | 通过 |
| `base_the_deep` | TS：4+ 打入后消灭更低战力 | base ability | onMinionPlayed | base trigger queue | 无消耗 | 更低战力目标消灭 | 可跳过；自身/更高不候选 | trigger 清空 | L2 + L4 | 通过 |
| `tornados_monster_tornado` | TS：你可以移动 4- 随从进/出本基地 | talent push/pull | talent 入口 | USE_TALENT | talent use 状态 | 4- 随从移动 | 合法候选存在时可 skip；单候选不自动结算 | prompt 清空 | L2 + L3 代表 | 通过；Twister 后已补否定路径 |
| `tornados_cyclone` | TS：天赋移动自身 | minion talent | talent 入口 | USE_TALENT | talent use 状态 | 自身移动到另一基地 | 激活入口承载可选；不能选当前基地 | prompt 清空 | L2 + L3 代表 | 通过 |
| `tornados_twister` | TS：你可以移动 3- 随从进/出本基地 | onPlay push/pull | 手牌随从入场 | PLAY_MINION + optional prompt | 随从额度 | 3- 随从移动 | 合法候选存在时可 skip；单候选不自动结算 | prompt 清空，状态不变 | L2 + L3 | 通过；反馈修复对象 |
| `tornados_dust_devil` | TS：计分前可移动到计分基地 | beforeScoring special | 计分前 in-play special | response/special command | special 窗口 | 自身移到计分基地 | 可选/skip 由计分前窗口承载 | response window 继续 | L3 + L4 | 通过 |
| `tornados_trade_winds` | TS：交换两个不同基地低战力随从 | action two-step | 手牌行动入口 | PLAY_ACTION + two prompts | 行动额度 | 两随从交换基地 | 第二目标必须另一基地且 3- | prompt 链清空 | L2 + L3 | 通过 |
| `tornados_carried_away` | TS：移动一个随从到另一基地 | action playNeedsMinion | 手牌选随从 | PLAY_ACTION + destination prompt | 行动额度 | 目标随从移动 | 第一入口已消费，不二次选随从 | prompt 清空 | L2 + L3 | 通过 |
| `tornados_whirlwinds` | TS：移动任意数量己方随从 | action multi + per-target | 手牌行动入口 | PLAY_ACTION + multi/destination | 行动额度 | 被选己方随从逐个移动 | 任意数量；每个目标各选目的地 | continuation 清空 | L2 + L3/L4 | 通过 |
| `tornados_gone_with_the_wind` | TS：计分后让随从逃离清场 | afterScoring special | 计分后响应窗 | afterScoring special | special 窗口 | 随从移走不进弃牌 | 可选窗口；只你的随从候选 | deferred cleanup 后继续 | L3 + L4 | 通过 |
| `tornados_ripped_off` | TS：转移持续/附着行动 | action onPlay | 手牌行动入口 | PLAY_ACTION | 行动额度 | 行动卡从源转到目标 | base/minion 两类目标分支 | prompt 清空 | L2 + L3 | 通过 |
| `tornados_picked_up` | TS：计分前移出随从 | hand special | Me First 窗口 | ACTIVATE_SPECIAL | special 使用 | 随从移出计分基地 | 可选窗口承载拒绝 | response window 继续 | L3 + L4 | 通过 |
| `tornados_not_in_kansas` | TS：替换基地并保留对象 | action playNeedsBase | 手牌选基地 | PLAY_ACTION | 行动额度 | 基地替换、保留随从、清理行动 | 分支不适用；新基地不得同 action 误触发 | base replace 后队列正确 | L2 + L3 + L4 | 通过 |
| `tornados_over_the_rainbow` | TS：计分前移入随从 | hand special | Me First 窗口 | ACTIVATE_SPECIAL | special 使用 | 随从移入计分基地 | 可选窗口承载拒绝；目标过滤 | response window 继续 | L3 + L4 | 通过 |
| `base_trailer_park` | TS：随从移入后 +1 | base ability automatic | onMinionMoved | base trigger | 无消耗 | 移入随从 +1 | 无玩家分支 | 自动 trigger 清空 | L2 + L4 | 通过 |
| `base_tornado_alley` | TS：每回合首次移入后可拉入随从 | base ability once/turn | onMinionMoved | base trigger prompt | once/turn 标记 | 另一随从移入 | 可跳过；防自递归 | once 标记与 prompt 清空 | L2 + L3 + L4 | 通过 |
| `mythic_greeks_odysseus` | TS：行动后给己方随从 +1 | action trigger | onActionPlayed prompt | trigger queue | once/trigger 由系统 | 己方随从 +1 counter | 可选 trigger；非己方不候选 | trigger 清空 | L2 + L3/L4 | 通过 |
| `mythic_greeks_argonaut` | TS：打出后触发行动态持续能力 | minion onPlay | PLAY_MINION | onPlay + action trigger session | 随从额度 | 触发希腊行动后能力 | 分支由触发队列处理 | trigger session 收口 | L2 + L3 + L4 | 通过 |
| `mythic_greeks_jason` | TS：行动后选基地给己方随从 +1 | action trigger | onActionPlayed base prompt | trigger queue | once/turn metadata | 目标基地己方随从 +1 | 可选 trigger；敌方不候选 | sourceBaseIndex 标记清理 | L2 + L3/L4 代表 | 通过 |
| `mythic_greeks_heracles` | TS：行动后自身临时 +1 | automatic trigger | onActionPlayed | trigger queue | 无消耗 | 自身 temp +1 | 分支不适用 | 回合清理临时修正 | L2 + L4 代表 | 通过 |
| `mythic_greeks_spartan` | TS：你行动后自身 +1 指示物每回合一次 | automatic trigger | onActionPlayed self | trigger queue | once/turn metadata | 自身 +1 counter | 非自己行动不触发 | metadata 防重复 | L2 + L4 | 通过 |
| `mythic_greeks_favor_of_hades` | TS：从弃牌堆行动牌回手 | action onPlay | 手牌行动入口 | PLAY_ACTION + card prompt | 行动额度 | 选定行动牌回手 | 非行动不候选；可选性按 prompt/skip | prompt 清空 | L2 + L3 | 通过 |
| `mythic_greeks_favor_of_ares` | TS：己方随从临时 +3 | action playNeedsMinion self | 手牌选己方随从 | PLAY_ACTION | 行动额度 | 目标 temp +3 | 非己方不候选 | 临时修正回合清理 | L2 + L3 代表 | 通过 |
| `mythic_greeks_favor_of_aphrodite` | TS：额外打出一个随从 | no-target action | 手牌行动入口 | PLAY_ACTION | 行动额度 | minionLimit +1 | 分支不适用 | 额度被后续出牌消费 | L2 | 通过 |
| `mythic_greeks_favor_of_dionysus` | TS：随从 +1，可放回牌库顶，并额外行动 | action + optional topdeck | 手牌行动入口 | PLAY_ACTION + prompt | 行动额度 | +1、extra action、可 topdeck | skip/topdeck 两分支已测 | prompt 清空 | L2 + L3 代表 | 通过 |
| `mythic_greeks_favor_of_hera` | TS：至多两个随从 +1 | action multi any | 2026-06-04 按 `temp/smashup-hera-card-crop-20260604-r5c8/slot-33.webp` 回写旧“己方”误判；手牌行动入口 | PLAY_ACTION + multi | 行动额度 | 0-2 个任意玩家随从 +1 | 至多语义允许少选/空选，并已补对手随从可选 | multi 清空 | L2 + L3 | 通过 |
| `mythic_greeks_favor_of_athena` | TS：展示顶 5，选行动入手，其余排序回顶 | action reveal/pick/order | 手牌行动入口 | PLAY_ACTION + pick/order prompts | 行动额度 | 选行动入手、其余回顶 | 可跳过入手；排序到剩 1 自动收口 | reveal/order 清空 | L2 + L3/L4 | 通过 |
| `mythic_greeks_favor_of_apollo` | TS：抽牌并额外行动 | no-target action | 手牌行动入口 | PLAY_ACTION | 行动额度 | 抽牌，actionLimit +1 | 空牌库由抽牌系统处理 | 无 pending | L2 + L3 | 通过 |
| `mythic_greeks_favor_of_hermes` | TS：额外两个行动 | no-target action | 手牌行动入口 | PLAY_ACTION | 行动额度 | actionLimit +2 | 分支不适用 | 无 pending | L2 | 通过 |
| `mythic_greeks_favor_of_poseidon` | TS：至多三张弃牌洗回 | action multi discard | 手牌行动入口 | PLAY_ACTION + multi | 行动额度 | 选中弃牌洗回牌库 | 至多语义允许少选/空选 | multi 清空 | L2 + L3 | 通过 |
| `mythic_greeks_favor_of_zeus` | TS：基地爆破点 -5 | action playNeedsBase | 手牌选基地 | PLAY_ACTION | 行动额度 | tempBreakpointModifiers 写入 | 第一入口已消费，不二次选基地 | 无 pending | L2 + L3 | 通过 |
| `base_oracle_at_delphi` | TS：随从打入后展示顶牌，行动牌入手 | base ability | onMinionPlayed | base trigger | 无消耗 | action 顶牌入手，非 action 留顶 | 两分支均测 | trigger 清空 | L2 + L4 | 通过 |
| `base_wooden_horse` | TS：行动后可给这里随从 +2 | base ability optional | onActionPlayed prompt | trigger queue | 无消耗 | 这里任意随从 +2 temp | 可跳过；行动玩家决策 | trigger 清空 | L2 + L3/L4 代表 | 通过 |

## 全链路抽查计划与结果

已执行 3 条不同机制家族的真实入口全链路抽查。

### 1. 可选/否定路径：`tornados_twister`

命令：

```bash
npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Tornados 旋风真实入口必须允许跳过可选移动"
```

结果：`1 passed`。

截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-旋风真实入口必须允许跳过可选移动\shayu-tornados-twister-skip-open.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-旋风真实入口必须允许跳过可选移动\shayu-tornados-twister-after-skip.png`

肉眼观察：

- 打出 Twister 后，合法 3- 目标 Mako 存在，交互仍显示“跳过”，证明不是靠“无候选”绕过可选语义。
- 点击跳过后，Twister 留在入场基地，Mako 仍留在 Wooden Horse，没有被移动；交互已关闭并回到出牌阶段。
- 该截图直接覆盖 Twister 反馈暴露的不变量：合法候选存在时也必须能拒绝执行，且权威状态不变。

### 2. 多步/排序/交换：`mythic_greeks_favor_of_athena` + `tornados_trade_winds`

命令：

```bash
npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Mythic Greeks 与 Tornados 复杂入口覆盖哈迪斯、宙斯、雅典娜和信风"
```

结果：`1 passed`。

截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-与-Tornados-复杂入口覆盖哈迪斯、宙斯、雅典娜和信风\shayu-mythic-greeks-athena-order-open.png`

肉眼观察：

- 雅典娜排序弹层真实显示 5 张揭示牌，标题明确要求选择放回牌库顶的第一张牌，说明 pick/order 链已经进入排序阶段。
- 弹层中行动牌和随从牌同时存在，背景手牌可见 Athena 已从手牌打出；这不是静态卡图预览，而是真实行动入口后的交互状态。
- 该 E2E 同时覆盖 Hades 回收、Zeus 基地入口和 Trade Winds 双目标交换；本轮重点复核 Athena 排序链未被 Twister 后门禁改动破坏。

### 3. 跨阶段/afterScoring：`tornados_gone_with_the_wind`

命令：

```bash
npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Tornados 随风而逝从 afterScoring 窗口打出并让随从逃离清场"
```

结果：`1 passed`。

截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-open.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-cleanup.png`

肉眼观察：

- afterScoring 打开图中，计分已发生，P0 已得 3 VP，界面出现“选择一个反应动作”，并提供 `随风而逝->基地1`、泰坦特殊能力与“跳过”，手牌里的 Gone with the Wind 可见。
- 清场后截图中，Twister 已逃离原计分基地并留在 Trailer Park，原计分基地被清理/替换，阶段回到出牌阶段，说明延迟清场链继续推进且没有残留交互。
- 该链覆盖 hand special、afterScoring response window、延迟清场和阶段恢复，属于本轮跨阶段时序抽查。

## 当前结论

45/45 对象完整技能流程矩阵已补齐，Twister 反馈新增的“可选否定路径”门禁已应用回 shayu 三派系全集。三条不同机制家族全链路抽查均通过，实际看图未发现新的实现错误。

本轮没有触发新的规范升级：Twister 暴露的可选/否定路径缺口已经在 `.spec/knowledge/standards/testing-audit.md`、`.spec/skills/add-new-faction/SKILL.md` 与 `.spec/skills/smashup-faction-addition/SKILL.md` 固化；本次 post-Twister 再审计没有发现第二类新不变量。
