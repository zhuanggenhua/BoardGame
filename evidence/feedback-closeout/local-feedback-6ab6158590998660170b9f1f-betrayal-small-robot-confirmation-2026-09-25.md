# 山屋惊魂本地反馈：小机器人事件确认链与移动阻塞

## 反馈原文

> 小机器人事件，我没点确认就被跳过了，什么情况

本轮补充症状：

> 同一个反馈的场景，也看下为什么无法从大阶梯移动到实验室，明明有门联通
>
> 什么情况，怎么卡住了，而且过程有先出结果才显示事件？ 修反馈吧
>
> 我发现只有最后一个点确认，才能正常推进

- 反馈 ID：`6ab6158590998660170b9f1f`
- 口径：本地 Mongo `boardgame.feedbacks`
- 创建时间：`2026-09-25T06:32:37.806Z`
- 原始入口：`/play/betrayal/match/bz-VKa3RXW9?playerID=0`
- 原始版本：`0.6.47`，commit `ea4512381d34`

## 效果描述原文

> 一台小小的，哔哔啵啵的机器人坐在你的脚下。他向着你哔哔叫：`-.. --- / -.-- --- ..- / .-- .- -. - / - --- / .--.`；`.-.. .- -.-- / .- / --. .- -- .`。进行一次知识检定。5+：抽取一张物品卡。0-4：受到一颗骰子的物理伤害。

来源：`evidence/betrayal/betrayal-event-card-ingest-2026-07-03.md:76`，当前事件录入合同状态为 `locked`；实现索引见同文件 `:102`。

## 现场与根因

- 反馈操作日志记录了 AI 4 号位探索礼拜堂并触发“小机器人”，随后由 AI 处理事件并结束回合；玩家提交反馈时状态快照中的 `pendingEventRollResolution` 已为空，说明确认窗口已经被错误消费。
- 根因在共享 AI 决策 / 恢复路径：混合真人 + AI 对局中，传入 AI 决策的 `state.core` 可能缺少运行时 `seatControllers`。确认人解析因此把真人确认误判为可由 AI 代发，AI 生成 `FINALIZE_EVENT_ROLL`，真人未点击也完成结算。
- 第二个根因是确认名单读模型在 `requiredPlayerIds` 已经写入 pending 快照后，仍可能按当前 `seatControllers` 动态重算；快照缺失或运行时状态变化时，确认总数会漂移，表现为前几次点击只更新计数、最后一次才真正推进，或把 AI 座位重新算进来。
- “大阶梯到实验室不能移动”与当前事件卡住是同一条阻塞链：只要 `pendingEventRollResolution` 尚未收口，`MOVE_TO_ROOM` 会先被 `请先处理当前事件投掷结果。` 拦截；这不等于门位断开。当前实验室配置仍保留其 `north/east` 门位，未发现足够证据证明本次是实验室门位录入错误。
- “先出结果才显示事件”属于展示时序问题：当前实现保留 `pendingEventRollStart`，先展示事件牌和“开始投掷”，点击后才出现骰盘结果；没有把结果先渲染成事件牌之前的首屏内容。

## 处理方式

- `src/engine/transport/localAiResolution.ts`：对混合真人 + AI 决策与恢复状态注入运行时 `seatControllers`，让真人确认仍由真人完成；全 AI 对局保持原有自动确认语义。
- `src/games/betrayal/__tests__/ai.test.ts`：补缺失 `core.seatControllers` 的混合真人 / AI 回归，确认 AI 不得替真人跳过“小机器人”事件确认。
- `src/games/betrayal/__tests__/betrayal-haunt-reveal-and-event-cards.test.ts`：补抽物品分支确认前 pending、库存和物品牌堆不变，显式确认后才抽牌。
- `e2e/betrayal/event-choice-coverage.e2e.ts`：只修过时的测试承载断言，按当前卡面、骰盘和无障碍结果分层验证；未改变玩家界面或规则。
- `src/games/betrayal/acknowledgementReadModel.ts`：确认名单优先使用事件 / recent-roll 创建时写入的快照；只有旧数据缺字段时才回退到当前真人解析，并对名单去重。
- `src/games/betrayal/__tests__/latestDiscoveryPresentation.test.ts`：补缺少 `seatControllers` 时仍保持 `1/1` 的展示回归。
- `src/games/betrayal/__tests__/ai.test.ts`：补命令层回归；pending 快照为 `['0']` 时，玩家 `0` 一次确认即清空 pending 并应用效果。
- `src/games/betrayal/__tests__/betrayal-possessions-and-recent-roll-rerolls.test.ts`：修正旧夹具，让重投后的确认名单使用真实真人快照，不再人为把 AI 塞入已落盘名单。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/latestDiscoveryPresentation.test.ts src/games/betrayal/__tests__/actionLogUndo.test.ts src/games/betrayal/__tests__/betrayal-haunt-reveal-and-event-cards.test.ts src/games/betrayal/__tests__/ai.test.ts src/games/betrayal/__tests__/betrayal-possessions-and-recent-roll-rerolls.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`：5 个文件、142 项通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/ai.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "本地 AI 决策缺少 core.seatControllers"`：1 项通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。
- 既有真实入口证据：`e2e/betrayal/event-choice-coverage.e2e.ts` 的“小机器人抽物品直接结算”曾 1 passed，覆盖真实探索、翻牌、开始投掷、骰盘结果、抽物品和回牌桌。
- 本轮再次尝试小机器人真实入口时被本机内存 watchdog 终止，不能把这次环境阻塞写成产品卡死。
- 三人确认视觉 E2E 当前被既有视觉门禁拦截：结果区实际为 `open-info-band`，断言期望 `open-transparent`；不是确认命令失败。

## 漏审复盘

- 旧 AI 测试覆盖了正常座位状态和全 AI 行为，但没有覆盖“`core.seatControllers` 缺失 + 混合真人 / AI”这一传输边界；事件领域测试也只覆盖了效果结算，没有同时锁定真人确认权限与确认前不抽牌。
- 本轮判定为共享 AI 传输状态缺失 + 确认名单快照消费漂移造成的实现 / 测试缺口，不是小机器人事件录入合同缺陷；现有交互确认规范已覆盖原则，本轮不新增规范正文。
- 多真人公开事件的“最后一个确认才推进”是正式语义；本次修的是名单漂移。单真人事件的确认名单为 `['0']` 时，不能再要求额外确认。

## 当前状态

`resolved`（仅本地代码 / 本地反馈镜像口径）。原始“未点击却被 AI 跳过”链路已修，确认名单漂移与事件先后展示也已补回归；实验室移动症状在当前可见证据下归因为未收口事件的移动门禁，未另改门位配置。未执行生产发布或线上反馈回写；本轮无法连接本机 Mongo 做新的状态回查。
