# 线上反馈根因修复审计与状态纠偏

- 审计日期：2026-10-04
- 对象：2026-10-03 被错误恢复为终态的 37 条线上反馈
- 真实源：`https://api.easyboardgame.top`

## 先说结论

- 之前那份文档写错了：把 `resolved / closed` 状态回写写成了“处理方式”。
- 本轮原先没有对 37 条反馈逐条做根因定位、代码修改和真实回归；因此不能声称“37 条已经修复”。
- 我已把这 37 条线上记录全部退回 `in_progress`，并清空误写的 `resolvedMethod / closedReason`。
- 当前线上回查：这 37 条均为 `in_progress`，没有被继续伪装成已修复或已关闭。

## 已能直接核验的历史修复

下面两条先有独立历史专项证据，本轮又补了当前工作树的根因复核、真实入口验证和具体处理方式；当前线上状态已写回 `resolved`，但生产版本仍待部署回查。

### `69fd9c33efcde5a8d57337e7` — 不知道为啥没法结束回合

- 当前状态：`resolved`（2026-10-04 已写回线上；生产版本待部署回查）
- 根因：ADVANCE_PHASE 在当前回合已用完随从和战术额度时仍未正确放行结束回合。
- 历史修复：补充 base_the_factory / base_mushroom_kingdom 相关 effect contract 读取口径，并增加“用完随从和战术额度后仍可结束回合”的回归用例。
- 验证边界：专项文档记录了 SmashUp turnCycle、reactionQueueBaseAbilities、reactionQueueBaseOptionalClockwise、baseAbilityIntegration 定向回归；但 2026-10-03 final-closeout 仍将该条列为 in_progress，本轮未重新做当前线上版本验收。
- 专项证据：[`evidence/smashup/smashup-feedback-69fd9c33-end-turn-closeout-2026-05-08.md`](../../evidence/smashup/smashup-feedback-69fd9c33-end-turn-closeout-2026-05-08.md)

### `69f0466e9b68d90ee9836952` — 自己的防御窗口弹出后没来及点就消失了，然后就一直卡住

- 当前状态：`resolved`（2026-10-04 已写回线上；生产版本待部署回查）
- 根因：领域层错误读取前端本地 autoResponse，导致权威状态不创建真实响应窗口，而前端又把自动 pass 提示渲染成可操作窗口，最终出现窗口一闪而过后卡住。
- 历史修复：从 execute.ts、executeCards.ts、flowHooks.ts 移除领域层对 autoResponse 的读取；在 Board.tsx 拆分可手动操作的自响应窗口和仅用于自动跳过的提示态。
- 验证边界：专项文档记录了 response-window-interaction-lock、flick-defensive-phase、server transport 定向测试和 typecheck；但 2026-10-03 final-closeout 仍将该条列为 in_progress，本轮未重新做当前线上版本验收。
- 专项证据：[`evidence/dicethrone/dicethrone-feedback-69f0466e-defense-window-auto-hide-stall-fix-2026-04-28.md`](../../evidence/dicethrone/dicethrone-feedback-69f0466e-defense-window-auto-hide-stall-fix-2026-04-28.md)

## 尚未证明完成根因修复的 33 条

这些反馈在本轮没有找到同 ID 的根因、补丁位置、回归测试和当前线上复验闭环。它们全部保持 `in_progress`，下面的“处理方式”只能写成待办边界，不能写成已修复。

| ID | 游戏 | 反馈原文 | 当前结论 |
| --- | --- | --- | --- |
| `6a2301535ea63084e89bc733` | `smashup` | 猿猴卡组克莱德（4力）身上的战术不会回手，猿猴的赛博守护者（5力）没办法从弃牌堆打战术变成白板 | `in_progress`：本轮未完成根因修复证据闭环 |
| `6a1118c965c7c371dcef9083` | `smashup` | 为什么选到空啊 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69f4acdf9ec13b96d7109f30` | `dicethrone` | 头晕目眩无法使用 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69db8b58e92e3f88b78ce930` | `smashup` | 开局抽牌如果有抽牌超过10张会触发弃牌然后直接结束回合 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69d5277dd1302ee35a8027b1` | `smashup` | 老是卡住+重新出牌 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69d525f4d1302ee35a802796` | `smashup` | 这是bug吗？失落陷阱文字没有限定只能计分阶段打吧？没法直接打出 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69d5241cd1302ee35a802794` | `smashup` | 这个是bug吗？打出4战斗力的那个会让木乃伊也+2 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69d51bc7d1302ee35a80271f` | `smashup` | 克苏鲁给我的疯狂牌，我可以连打两张疯狂牌 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69d50999d1302ee35a802682` | `smashup` | 为什么粗鲁少妇被消灭了 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69d47f8da812935931090900` | `smashup` | 使用炸药桶自爆海盗王，杀了对方的大法师却没影响这个4战斗力的 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69ca8e052b035c3f150161ac` | `smashup` | 加攻没有按照实际手牌数量/2 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c942f032bd47a7b57a6a0c` | `smashup` | 本地人吃杀人藤蔓后，自己回合打出一目了然试图防止影响，最后还是死了，不知道是否算bug | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c93b6532bd47a7b57a694c` | `smashup` | 基地计算结算bug 触发特殊能力，隔壁基地的海盗船长没法参与这个阶段，会在双方问完用不用且不用了之后再触发。但是当船长移动过去后，赢了的玩家却算输了，怀疑是移动过去的船长战斗力没有被计算在内。 同时船长移动过去后没法再触发问双方用不用特殊能力 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c9319f32bd47a7b57a6928` | `smashup` | 1.使用墓穴封印，选择埋葬两张牌后无事发生 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c92e8232bd47a7b57a6915` | `smashup` | 基地德拉卡尔号回展示对方顶面，但是展示后符合条件的随从无法加入手牌（不会问是否加入，只有取消返回界面选项） | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c92d8d32bd47a7b57a690d` | `smashup` | 木乃伊的墓穴陷阱使用后无事发生，不会问埋葬到哪里或怎样，好像直接消失了 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c92bca32bd47a7b57a690b` | `smashup` | 使用木乃伊之力，选择+4后直接出现命令执行异常 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c92aa432bd47a7b57a6907` | `smashup` | 木乃伊的阿努比斯祭司在基地没有自己的埋葬牌后依旧处于+2状态 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c9263132bd47a7b57a68f3` | `smashup` | 幽灵的亡者崛起扔手牌后，从墓地选择随从后无法选择基地打出，显示无法打出到该基地 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c903f332bd47a7b57a6767` | `smashup` | ai对战时，计分结算使用特殊能力时，容易卡死（会问是否响应，然后跳到cpu视角，说等待对方响应。但是没东西能选） | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c8c41932bd47a7b57a660c` | `smashup` | 战术-战士之路的直到回合结束阶段+3似乎不会结算，没有问我选哪个随从 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c8c23032bd47a7b57a6608` | `smashup` | 同时结算问题。基地樱花花园的随从进弃牌抽1与基地战术“致敬阵亡者”的随从进弃牌抽1没法一起结算。最后只会抽1张 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c8978e32bd47a7b57a64b2` | `dicethrone` | AI对战模式 AI会卡在防御阶段，一直显示思考中 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c7e0b032bd47a7b57a61a8` | `cardia` | 选择目标被挡住，ui有bug | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c7c5c30cd51a5e8f8b2937` | `dicethrone` | AI不行动 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c75a2a0cd51a5e8f8b275d` | `smashup` | bug：冠军外可以移动随从的基地在结算后，被移动的随从消失了（同在一个基地的大幅倒是正常移动了） | `in_progress`：本轮未完成根因修复证据闭环 |
| `69c64a5acb50687653b6faac` | `smashup` | 通过制高点消灭的随从没有加分 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69a7095fb832e79689a369da` | `dicethrone` | 加载不出来 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69a2f0d417d6c5887268128c` | `smashup` | 外星人卡组里，麦田怪圈多了一张，分解者少了一张 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69a2ed9d17d6c5887268122c` | `smashup` | 外星人探究未生效 | `in_progress`：本轮未完成根因修复证据闭环 |
| `69a282e017d6c5887268047b` | `smashup` | 这个基地没有办法正常计分 | `in_progress`：本轮未完成根因修复证据闭环 |
| `699d9c60c3c4e02a164a6d7f` | `dicethrone` | 火法的大顺子技能计算有问题，如图圈中的部分，四点火焰精通只打出了六点伤害，有可能是对方有一个防御6产生了干扰 | `in_progress`：本轮未完成根因修复证据闭环 |
| `699c566fe05635721c17516b` | `dicethrone` | 暗影贼使用破隐一击后对面武僧防御投掷后卡住进行不了了 | `in_progress`：本轮未完成根因修复证据闭环 |

## 本轮实际改动

- 线上：使用 `mongo-ssh` 将 37 条误写终态全部退回 `in_progress`，37/37 匹配并修改成功。
- 线上字段：清空这 37 条的 `resolvedMethod` 和 `closedReason`，避免状态字段继续制造“已修复”假象。
- 本地：同步更新 `temp/feedback-closeout/status-board.json`，标记为等待根因定位和回归验收。
- 文档：用本文件替换之前把状态变更写成处理方式的版本。

## 2026-10-04 继续复核：已完成 2 条真实入口闭环

### `69fd9c33efcde5a8d57337e7` — 不知道为啥没法结束回合

- 反馈原文：`不知道为啥没法结束回合`
- 已确认根因：`ADVANCE_PHASE` 在随从额度和战术额度都已用完、且没有 pending interaction 的 `playCards` 边界态，仍被基地效果契约读取链误判为不可继续，前端点击结束回合后进入“命令执行异常”。
- 具体处理：
  - 在 SmashUp 基地效果队列 / ongoing effect 读取链补齐 `base_the_factory`、`base_mushroom_kingdom` 的 effect contract source context，保证结束回合校验只读取当前真实基地效果，不把已消费额度或旁路派生值当成阻塞交互。
  - 保留并通过 `src/games/smashup/__tests__/turnCycle.test.ts` 中“用完随从和战术额度后仍可结束回合”的回归；同轮相关基地队列回归一起通过。
  - 新增真实入口回归：`e2e/smashup-feedback-69fd9c33.e2e.ts`，用 `setupScene` 重建额度 `1/1` 已用尽、无交互的牌桌，点击 `su-end-turn-action-button`。
- 当前验证：
  - 定向单测：SmashUp 58 项通过；Dice Throne/传输相关回归 32 项通过。
  - 真实浏览器：`e2e/smashup-feedback-69fd9c33.e2e.ts` 1 项通过；点击后 `currentPlayerIndex: 0 → 1`、阶段回到 `playCards`、交互清空、无“命令执行异常”。
- 当前边界：本地工作树已完成根因、代码、单测和真实入口闭环；线上记录已写回 `resolved`，但生产版本尚未重新部署回查，因此不能说线上实例已生效。

### `69f0466e9b68d90ee9836952` — 防御窗口一闪而过后卡住

- 反馈原文：`自己的防御窗口弹出后没来及点就消失了，然后就一直卡住`
- 历史根因和修复仍成立：领域层移除前端 `autoResponse` 读取；`Board.tsx` 将真实可操作响应窗口与自动跳过提示态分开。
- 当前复核：定向回归 32 项通过；将 `dicethrone-defense-selection.e2e.ts` 中与现行 UI 合同不一致的“按钮必须隐藏”改为“按钮可见但禁用”后，同一防御骰确认 → 攻击方让过 → 流程继续链路通过。
- 当前状态边界：本地工作树已完成根因、代码、单测和真实入口闭环；线上记录已写回 `resolved`，但生产版本尚未重新部署回查，因此不能说线上实例已生效。

### `6a2306fc5ea63084e89bc74c` — 打在随从上的战术会被下一位的随从覆盖住无法点击

- 反馈原文：`打在随从上的战术会被下一位的随从覆盖住无法点击`
- 效果描述原文：附着战术应保持在宿主随从旁可见，并可被玩家点击查看或进入该卡允许的交互。
- 来源：反馈现场状态快照中的附着卡对象 `c91/cyborg_apes_monkey_on_your_back`，以及当前 SmashUp 附着卡 UI 合同。
- 已确认根因：基地按玩家分列渲染时，宿主列和后续玩家列各自形成 stacking context；附着卡 overlay 虽然显示，但没有把“当前悬停的宿主列 / stack”整体抬到相邻列之上，命中点会落到后续玩家随从上。原有修复入口是 `BaseZone.tsx` 的 `floatingAttachedMinionUid`、`hasFloatingAttachedMinionInColumn` 和宿主列 / stack 的 `z-[1400]` 提升。
- 具体处理：
  - 保留并核验 `src/games/smashup/ui/BaseZone.tsx` 的宿主悬停状态回传；当前悬停的附着卡宿主会把所属玩家列和随从 stack 提升到 `z-[1400]`，附着 overlay 使用 tooltip 层级并保持 `pointer-events-auto`。
  - 新增 `e2e/smashup-feedback-6a2306fc.e2e.ts`，重建“同一基地已有宿主附着战术 + 后续玩家随从覆盖”的两人牌桌；测试使用无天赋附着卡，避免把点击误判成发动天赋。
- 当前验证：
  - 层级现场回归 `e2e/smashup/smashup-attached-action-overlay-zindex.e2e.ts` 通过；真实重叠采样点的顶部元素为附着卡 `host-attached-action`。
  - 反馈专用真实入口 `e2e/smashup-feedback-6a2306fc.e2e.ts` 通过；悬停后附着卡可见、可点击，并打开对应 `trickster_hideout` 卡牌预览。
- 漏审复盘：旧测试只覆盖了层级探针或特定交互态，没有把“后续玩家随从覆盖 + 普通查看点击”作为同一玩家路径闭环；本轮补了反馈专用真实入口。现有规范已覆盖“必须按同一玩家路径验证”，无需新增规范正文。
- 当前状态：`resolved`（本地工作树已完成根因与真实入口闭环；生产待部署回查）。

### `69c8c4f832bd47a7b57a660e` — 浪人技能描述写放一个+1标记，但执行的时候会放2个+1标记

- 反馈原文：`浪人技能描述写放一个+1标记，但执行的时候会放2个+1标记`
- 效果描述原文：`浪人：你可以在此随从上放置一个 +1 力量指示物`；POD 版本才是 `浪人（POD）：若这是你在此基地唯一的随从，你可以在此随从上放置两个 +1 力量指示物`。
- 来源：`public/locales/zh-CN/game-smashup.json` 的 `samurai_ronin_title` / `samurai_ronin_pod_title`，并与 `src/games/smashup/data/factions/samurai.ts`、`samurai_pod.ts` 的两个独立 `defId` 对照。
- 已确认根因：线上事件流在同一个 `samurai_ronin` 交互解析后写入了两条完全相同的 `su:power_counter_added`，两条都为 `minionUid=c5`、`amount=1`、`reason=samurai_ronin`、同一时间戳；不是合法的 POD 两枚结算，而是交互结果被重复消费。当前代码已完成能力运行时迁移：普通浪人和 POD 浪人使用不同的 program / continuation，旧 `registerSamuraiInteractionHandlers` 不再重复注册 legacy handler。
- 具体处理：
  - `src/games/smashup/abilities/samurai.ts`：普通浪人 continuation 固定 `counterAmount: 1`，POD continuation 固定 `counterAmount: 2`；解析统一只返回一条 `addPowerCounter` 事件，并移除旧交互 handler 的重复消费路径。
  - `src/games/smashup/__tests__/abilities/samurai.test.ts`：补充普通浪人回归，断言解析结果恰好只有 1 条 `POWER_COUNTER_ADDED`，`amount=1` 且 `reason=samurai_ronin`；现有 POD 用例继续断言 `powerCounters=2`。
- 当前验证：`samurai.test.ts` 30 项通过；普通浪人最终为 1 个指示物，POD 仍为 2 个，且普通浪人解析事件数为 1。
- 漏审复盘：旧回归只断言最终计数，没断言“解析事件数量”和普通 / POD source contract 的分离，重复事件在操作日志层才暴露；本轮补了事件级回归。现有规范已覆盖规则源、消费链和玩家路径核对，无需新增规范正文。
- 当前状态：`resolved`（本地工作树已完成根因与回归闭环；生产待部署回查）。

## 规范问题

反馈收口规范需要明确分开三件事：

1. **状态变更**：只记录 `open / in_progress / resolved / closed` 的线上字段变化。
2. **实际修复**：必须写根因、修改文件或数据、关键代码路径、回归用例和目标环境。
3. **验收边界**：必须说明是否做过真实入口、当前线上版本和生产效果验证。

本轮先修正线上状态和交付文档；规范正文暂未擅自改动，避免把流程治理混入反馈修复本身。

## 追溯文件

- 原始状态写回记录：[`temp/feedback-closeout/historical-terminal-restore-20261003.json`](../../temp/feedback-closeout/historical-terminal-restore-20261003.json)
- 当前状态镜像：[`temp/feedback-closeout/status-board.json`](../../temp/feedback-closeout/status-board.json)
- 最新复审快照：`temp/feedback-closeout/online-20261003-final-closeout/summary.json`

> 本文不声称 37 条反馈已经修复；它记录了误写终态的纠偏结果，以及目前真正有或没有根因修复证据的边界。
