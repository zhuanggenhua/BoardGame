# Summoner Wars 狱火铸剑打出链路 E2E 证据（2026-05-10）

## 范围

- 游戏：Summoner Wars / 召唤师战争
- 卡牌：狱火铸剑（`necro-hellfire-blade`）
- 链路：建造阶段点击事件卡 -> 进入目标选择 -> 取消不消耗 -> 再次选择目标 -> 卡牌从手牌移除并附加到友方士兵

## 同类分流审查（2026-05-10）

本轮根因不是“狱火铸剑不该在建造阶段打出”。狱火铸剑就是建造阶段事件卡，问题是交互事件卡在 `REQUEST_EVENT_INTERACTION` 发出后、`swInteraction` 同步到 UI 前，`selectedHandCardId` 仍保留，棋盘快速点击会继续落入普通阶段动作分支。

所选审计维度：

- `D5 交互完整`：事件卡应进入 InteractionSystem 目标链，而不是被普通召唤/建造/移动/攻击分流抢走。
- `D8 时序正确`：覆盖 `REQUEST_EVENT_INTERACTION` 发出后到 `swInteraction` 可见前的短窗口。
- `D15 UI 状态同步`：UI 选中态、事件模式态、棋盘点击消费链必须读取同一张选中卡。
- `D23 非常规目标机制`：跨阶段事件卡通过事件目标、手牌目标、多目标、按钮确认等非常规交互完成。
- `D47 E2E`：对真实 UI 入口补代表性回归与截图证据。

对象清单与结论：

| 对象 | 阶段 | 交互类型 | 本轮层级 | 结论 |
| --- | --- | --- | --- | --- |
| `necro-hellfire-blade` 狱火铸剑 | build | 单目标 `event_target` | L3 | 已通过真实入口 E2E：快速点棋盘不再弹建造位置错误，最终附加到友方士兵。 |
| `frost-glacial-shift` 冰川位移 | build | 建筑选择 + 位移目标 | L1/L2 | 共享入口覆盖：同属 `requiresEventInteraction()`，建造阶段快速点击会被 `isSelectedInteractiveEvent` 截断，不再进入 `BUILD_STRUCTURE`。未单独补 L3。 |
| `necro-blood-summon` 血契召唤 | summon | 目标单位 -> 手牌单位 -> 放置点 -> 确认 | L3 | 已通过真实入口 E2E：快速点棋盘不再弹召唤/建造位置错误，流程可到确认与完成状态。 |
| `trickster-mind-control` 心灵操控 | summon | 多目标敌方单位 | L1/L2 | 共享入口覆盖：同属 `requiresEventInteraction()`，不会在短窗口落入 `SUMMON_UNIT`。 |
| `trickster-hypnotic-lure` 催眠引诱 | summon | 单目标敌方单位 | L1/L2 | 共享入口覆盖：同属 `requiresEventInteraction()`，不会在短窗口落入 `SUMMON_UNIT`。 |
| `barbaric-chant-of-entanglement` 交缠颂歌 | summon | 两个友方士兵 | L1/L2 | 共享入口覆盖：同属 `requiresEventInteraction()`，不会在短窗口落入 `SUMMON_UNIT`。 |
| `barbaric-chant-of-weaving` 编织颂歌 | summon | 单目标友方单位 | L1/L2 | 共享入口覆盖：同属 `requiresEventInteraction()`，不会在短窗口落入 `SUMMON_UNIT`。 |
| `necro-annihilate` 除灭 | move | 多目标 + 逐个伤害选择 | L1/L2 | 共享入口覆盖：同属 `requiresEventInteraction()`，快速棋盘点击不会继续落入普通移动/选择单位路径。 |
| `trickster-stun` 震慑 | move | 目标 + 推拉终点 | L1/L2 | 共享入口覆盖：同属 `requiresEventInteraction()`，快速棋盘点击不会继续落入普通移动/选择单位路径。 |
| `barbaric-chant-of-growth` 生长颂歌 | move | 单目标友方单位 | L1/L2 | 共享入口覆盖：同属 `requiresEventInteraction()`，快速棋盘点击不会继续落入普通移动/选择单位路径。 |
| `goblin-sneak` 潜行 | move | 多单位 + 方向选择 | L1/L2 | 共享入口覆盖：同属 `requiresEventInteraction()`，快速棋盘点击不会继续落入普通移动/选择单位路径。 |
| `barbaric-chant-of-power` 力量颂歌 | attack | 单目标友方单位 | L1/L2 | 共享入口覆盖：同属 `requiresEventInteraction()`，快速棋盘点击不会继续落入普通攻击/选择单位路径。 |

共享入口核对：

- `src/games/summonerwars/ui/HandArea.tsx`：交互事件卡点击走 `onPlayEvent(cardId)`，不走普通两段式选卡确认。
- `src/games/summonerwars/ui/useEventCardModes.ts`：`requiresEventInteraction(cardId)` 统一通过 `getBaseCardId()` 识别真实牌组实例 ID，覆盖带后缀的卡实例。
- `src/games/summonerwars/ui/useCellInteraction.ts`：本轮新增 `isSelectedInteractiveEvent`，在 `eventCardModes.handleEventModeClick(...)` 之后、普通召唤/建造/移动/攻击分支之前直接 `return`。
- `src/games/summonerwars/domain/systems.ts`：上述 12 张事件卡均由 `REQUEST_EVENT_INTERACTION` 创建对应 `swInteraction`，最终通过 `PLAY_EVENT` 收口。

审查结论：同类“交互事件卡在阶段动作分流短窗口被误当作普通阶段牌”的共享入口已修复。当前 L3 代表性覆盖为建造阶段的狱火铸剑与召唤阶段的血契召唤；其余 10 张卡已完成结构/共享入口审查，但未逐张补真实入口 E2E，不能把它们表述成逐卡 L3。

## 本轮修改

- 修复 `src/games/summonerwars/ui/useCellInteraction.ts`：建造阶段如果当前选中的是需要 InteractionSystem 目标选择的事件卡，不再继续走 `BUILD_STRUCTURE` 的建造位置校验。
- 同步修复 `e2e/src/games/summonerwars/ui/useCellInteraction.ts` 镜像。
- 加强 `e2e/summonerwars/summonerwars.e2e.ts` 中“交互事件牌可直接进交互，取消后不消耗”用例。
- 测试卡 ID 改为真实牌组风格的后缀 ID：`necro-hellfire-blade-0-99`，覆盖 `getBaseCardId` 路径。
- 新增精确回归断言：点击狱火铸剑后立刻快速点击棋盘空格，不得出现建造位置错误文案；断言同时覆盖本地文案“无法在该位置建造 / Cannot build there”和用户反馈文案片段“建筑必须 / 传送门附近”。
- 新增最终态断言：
  - 确认目标后，狱火铸剑必须从玩家 0 手牌移除。
  - 确认目标后，友方普通单位的 `attachedCards` 必须包含该事件卡。

## E2E 结果

命令：

```bash
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "事件卡：交互事件牌可直接进交互，取消后不消耗（单目标不自动触发）"
```

结果：通过（1 passed）。

2026-05-10 复跑同一用例，已加入“传送门附近”文案与 800ms toast 延迟检查：

```bash
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "事件卡：交互事件牌可直接进交互，取消后不消耗（单目标不自动触发）"
```

结果：通过（1 passed）。

补跑教程全流程：

```bash
npm run test:e2e:ci:file -- e2e/summonerwars-tutorial.e2e.ts "教程完整流程 - 从初始化到完成"
```

结果：通过（1 passed）。

2026-05-10 复跑教程完整流程：

```bash
npm run test:e2e:ci:file -- e2e/summonerwars-tutorial.e2e.ts "教程完整流程 - 从初始化到完成"
```

结果：通过（1 passed）。

同类代表回归：

```bash
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "事件卡：血契召唤收口流程"
```

结果：通过（1 passed）。

Runtime 清理复核：

```bash
npm run test:e2e:doctor
```

结果：无活跃重任务、无活跃 E2E runtime，`6174/20000/21000` 等关键端口均为空闲。

## 截图观察

截图 1：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\事件卡：交互事件牌可直接进交互，取消后不消耗（单目标不自动触发）\event-interactive-single-target-open.png`

- 我实际看到：建造阶段点击狱火铸剑后，顶部出现“选择事件卡目标”和“取消”按钮，棋盘上有 1 个友方士兵目标处于可选状态。
- 我没有看到“无法在该位置建造”“建筑必须”“传送门附近”等建造位置错误；顶部红色阶段提示属于建造阶段常驻提示，不是本轮错误 toast。
- 验收结论：达到“能进入目标选择，不是直接卡死/无响应”的验收标准。

截图 2：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\事件卡：交互事件牌可直接进交互，取消后不消耗（单目标不自动触发）\event-interactive-single-target-attached.png`

- 我实际看到：确认目标后，手牌区不再显示 `necro-hellfire-blade-0-99`，目标友方士兵身上出现“点击查看卡牌详情”的附加提示。
- 同时 E2E 从权威状态读取到目标友方普通单位 `attachedCards` 包含 `necro-hellfire-blade-0-99`。
- 验收结论：达到“狱火铸剑已实际打出并附加到底层”的验收标准。

教程截图 1：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-tutorial-e2e-2026-05-10\01-event-card-attached.png`

- 我实际看到：教程在建造阶段完成事件卡教学后，右下教程提示已变成“事件卡已施放！点击「结束阶段」进入攻击阶段。”；棋盘中部友方单位身上可见“狱火铸剑（+2战力）”的附着状态。
- 验收结论：达到“教程真实链路里狱火铸剑可打出、可附着、可推进到下一教程步骤”的验收标准。

教程截图 2：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-tutorial-e2e-2026-05-10\02-finish-step-visible.png`

- 我实际看到：教程到达“恭喜完成教学！”收口步骤，提示玩家已掌握召唤/移动/攻击、事件卡施放和召唤师技能使用。
- 验收结论：达到“教程完整流程可从初始化跑到完成”的验收标准。

血契召唤截图 1：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\事件卡：血契召唤收口流程\event-blood-summon-confirm-step.png`

- 我实际看到：血契召唤完成 1 次后，顶部出现“是否继续？”确认条，并显示“继续 / 完成”按钮。
- 我没有看到“无法在该位置召唤”“无法在该位置建造”“建筑必须”“传送门附近”等错误提示。
- 验收结论：达到“召唤阶段交互事件卡不再被普通召唤/建造校验抢分流”的代表性验收标准。

血契召唤截图 2：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\事件卡：血契召唤收口流程\event-blood-summon-finish-state.png`

- 我实际看到：完成后棋盘状态保留新召唤出的单位，手牌中的血契召唤流程已收口。
- 验收结论：达到“血契召唤可从真实入口走完收口”的验收标准。

## 教程全流程修复

- `e2e/summonerwars-tutorial.e2e.ts` 对齐当前教程 manifest：补上 `map-controls`，移除已不存在的 `attack-result`，远程说明改验 `sw-start-archer`。
- 复活死灵放置步骤改点 `data-valid-ability-pos="true"`，避免把系统能力落点误当成普通召唤落点。
- 攻击后若出现“灵魂转移”响应窗口，E2E 明确点击“跳过”，模拟真实玩家收口。
- `src/games/summonerwars/tutorial.ts` 的 `attack-action` 不再等待 FX 动画完成；该步骤以 `UNIT_ATTACKED` 作为业务完成信号，避免攻击后响应窗口插入时教程卡在攻击教学。
- `src/games/summonerwars/Board.tsx` 的 FX 完成回调在召唤/攻击动画完成时直接通知教程系统；系统无 pending 时会忽略该命令，避免依赖 React 当前渲染帧里的 pending 标志造成漏发。

## 回归归因

- 这轮用户看到的“建筑必须在传送门附近哦”类错误，本质是 `useCellInteraction` 在建造阶段把已选中的交互事件卡继续当作可建造卡处理，落进 `BUILD_STRUCTURE` 位置校验 / `interaction.cannotBuildThere` toast。
- 最早把狱火铸剑从直接 `PLAY_EVENT` 改成 `REQUEST_EVENT_INTERACTION -> event_target -> PLAY_EVENT` 链路的是提交 `a350d766633c7c80192f1a0b2fc50cbda5580080`（作者/提交者：时侍，2026-04-12 21:32:55 +0800，提交信息：`修复 HUD 与 AI 交互链并补审计证据`）。该提交在 `handlePlayEvent` 中先 `dispatch(REQUEST_EVENT_INTERACTION)` 并保留 `selectedHandCardId`，但 `handleCellClick` 的建造阶段分支没有排除“需要交互的事件卡”；在 InteractionSystem 交互尚未同步到 UI 的短窗口里，快速点棋盘就会误触发建造校验。
- 后续提交 `936a8d63189e099709b46786ee6c8ce9a409d774`（时侍，2026-04-18 18:08:24 +0800）补了“单目标不自动触发、可取消”的交互 E2E，但原测试只验证进入交互和取消，没有验证最终打出后 `attachedCards`，因此不能证明“真的打出”。
- 本轮补齐最终态断言，防止同类回归再次被弱断言放过。
- 教程全流程卡住不是狱火铸剑本体执行器导致：
  - `map-controls`、`attack-action.waitForAnimation`、`sw-start-archer` 等教程配置来自 `1d5069a0ff4aa52faa008609a29f76bc3abd6013` / grafted `9c9dd78d`（时侍，2026-03-04 23:36:19 +0800，`Merge pull request #7 from zhuanggenhua/fix/restore-p1-deletions`）。
  - 教程 E2E 与 manifest 不一致的历史来源同样落在 `1d5069a0` 初始引入；`9f88fae8106ccc3eb7ead4f4a0e901457c829f23`（时侍，2026-04-11 09:14:58 +0800，`整理当前工作区改动并同步 E2E/文档路径`）曾删除该 E2E，后续恢复后没有随教程配置继续校准。
