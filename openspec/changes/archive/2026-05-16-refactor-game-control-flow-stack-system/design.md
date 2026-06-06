## Context
这次不是“要不要重构”的讨论，而是对现有代码现状做架构收束。

当前真实代码已经说明了几件事：

1. **Modal 栈已经存在且可用**
   - `src/contexts/ModalStackContext.tsx`
   - `src/hooks/ui/useSyncedModalStackEntry.tsx`
   - 王权骰铸 `Board.tsx` 已把 token response / status interaction / choice 等前台阻塞面板同步到 modal stack。

2. **Interaction / ResponseWindow / Flow 也都已经存在**
   - `InteractionSystem` 有 `current / queue / multistep-choice`
   - `ResponseWindowSystem` 有 responder loop / interaction lock
   - `FlowSystem` 已经用 `hasBlockingResolutionFrame()` 阻止错误 auto-advance

3. **resolutionStack 原先只是 block gate 骨架，需要升级为真正 driver**
   - 旧实现只有 active frame / block / unblock / phase gate
   - 本轮要补 parent/child 嵌套恢复、顺序策略驱动、deferred follow-up 单一所有权、foreground owner 对齐

4. **大杀四方必须把主恢复权收束进通用 frame**
   - `reactionSession.ts` / `scoringSession.ts` 可以保留游戏专属 helper / view model
   - 但“当前结算到哪一步 / 被谁打断 / deferred follow-up 何时恢复”必须落到 resolution frame，而不是 sys 私有镜像

5. **王权骰铸已经证明“前台栈”与“业务主链”是两个层面**
   - modal stack 已经能解决 blocking UI 前台切换
   - 但它还不是业务恢复权威；如果直接把 UI 栈当主链，会把“视觉关闭”误当成“业务完成”

6. **SummonerWars 现状只能当历史兼容事实，不能当新范式**
   - 某些 adapter / route 还带着旧式桥接痕迹
   - 但用户明确说明它现在没有 bug，本轮不应该为了架构洁癖把它拖进实现
   - 正确做法是：在 spec 中把这类桥接写成历史反模式与 deferred migration，而不是继续复制到新游戏

## Goals / Non-Goals
- Goals:
  - 建立唯一业务主链：resolution frame stack
  - 保留并升级现有 Modal / Interaction / ResponseWindow / Flow，而不是平行重造
  - 明确三种顺序语义：嵌套本体优先、显式顺序链、顺时针响应轮
  - 让候选有效性、deferred follow-up、恢复位点进入统一权威
  - 用 **SmashUp + DiceThrone** 两个真实问题样本验证最小可扩展原语
  - 把 SummonerWars 明确登记为历史桥接反模式 / deferred migration，避免它继续污染未来 100 游戏范式
- Non-Goals:
  - 不把所有系统硬塞进“一个栈结构”
  - 不要求所有游戏本轮全部迁完
  - 不在 spec 阶段设计新的平行 UI 框架
  - 不把没有现实 bug 的 SummonerWars 拉进本轮强制实现与验收
  - 不为了“看起来统一”而写 SmashUp / DiceThrone 特判式框架

## Decision 1: 不是一个栈吃掉一切，而是四层系统围绕同一主链协作

### 1. Resolution Frame Stack
唯一业务主链权威，负责：
- 当前正在结算什么；
- 被谁打断；
- 当前走哪种顺序策略；
- 是否在等 interaction / response window / post-reduce；
- deferred follow-up 何时补发；
- 下一步恢复到哪里。

### 2. Interaction System
只负责：
- 发起输入步骤；
- 暴露当前交互；
- 接收响应结果；
- 把结果回传给所属 resolution frame。

不负责：
- 决定整条结算链是否完成；
- 替游戏保存第二套 continuation 主链；
- 决定 deferred follow-up 补发。

### 3. ResponseWindow System
只负责：
- 某个 frame 当前是否进入响应轮；
- 当前响应者是谁；
- pass / action / 交互锁定后该如何继续当前响应轮。

不负责：
- 充当第二主链；
- 越过 frame 直接推动阶段。

### 4. Modal Stack
只负责：
- 当前哪个阻塞 UI 在前台；
- 顶层关闭后恢复哪一层；
- 保证同一时刻只有一个前台 blocking modal。

不负责：
- 自动结算业务；
- 自动结束交互；
- 决定谁是业务主链 owner。

## Decision 2: Resolution frame 必须支持三种明确顺序语义

### A. 嵌套本体优先（nested-body）
用于：
- 大杀四方 Card Resolution Order 第 2 步；
- “打出 A 时又额外打出 B，必须先完整结算 B 再回来继续 A”。

要求：
- 创建 child frame 时父 frame 进入 suspended；
- child 完成后自动恢复父 frame；
- 不再允许父子恢复逻辑散落在游戏私有 session 栈里。

### B. 显式顺序链（explicit-order）
用于：
- 大杀四方多基地记分；
- 同时触发的强制能力由当前玩家决定顺序。

要求：
- 顺序一旦锁定，frame driver 按该顺序推进；
- 不能因为“用了栈”就把显式顺序误改成后进先出。

### C. 顺时针响应轮（responder-round）
用于：
- 大杀四方 Card Resolution Order 第 4 步；
- 当前玩家开始，顺时针每人打一张牌 / 发动一个能力 / 或 pass，直到所有玩家连续 pass。

要求：
- 这是单独的顺序语义，不等于普通 queue；
- 有人执行动作后，已经 pass 的玩家下一轮仍可再次参与；
- 必须与 interaction lock 协作，而不是被 modal/interaction 打断后丢失轮次。

## Decision 3: 候选有效性由 resolution frame 统一重验
当前用户报的第一个问题，本质不是“按钮多了”，而是：
- 候选产生时有效；
- 但在它真正轮到被选择时，来源/目标已经不在场；
- UI 仍把它展示出来，点击后无效果。

因此统一要求：
- **展示前重验**：frame driver 每次把候选交给 Interaction / Modal 之前，必须先用最新状态裁剪；
- **提交时重验**：玩家点击后必须再次按最新状态核实；
- **失效候选自动丢弃**，而不是“点了没反应”。

这个规则要直接覆盖：
- 大杀四方 `选择结算顺序` 的 stale trigger / stale target；
- 响应轮中已失效的 special / activated ability；
- 其他未来复杂游戏的多步骤候选。

## Decision 4: deferred follow-up 归 frame 所有
当前大杀四方把 deferred 数据分散在：
- `scoringSession.deferredPostScoringEvents`
- `pendingPostScoringActions`
- interaction continuationContext

这会制造“双主线”。

重构后要求：
- deferred events / deferred actions / replacement follow-up 都挂在 resolution frame；
- Interaction 只允许持有 frame 引用或最小 UI metadata；
- ResponseWindow 只允许持有当前轮的 responder metadata；
- frame 完成时只补发一次，并立即清空。

## Decision 5: UI 前台恢复必须绑定业务 owner，但不替代业务 owner
王权骰铸的 modal stack 重构方向是对的，但还要补一层规则：
- 顶层 blocking modal 必须能映射回一个 interaction / response window / frame owner；
- 关闭顶层时，恢复下层前台；
- 但 modal close 本身不能被当成“业务已收口”的信号。

这样可以避免两种错法：
1. 只有 UI 栈，没有业务链 → 关掉后业务不知道该恢复哪里；
2. 让 UI 栈直接当业务链 → 视觉关闭就被误判为业务已完成。

## Decision 6: 本轮只用两个真实问题游戏做强制验收，第三类历史模式只做登记

### 王权骰铸：验证“多阻塞前台 + 恢复顺序”
必须验证：
- 4 人枪手 `The Law` 多目标选择；
- token response 与 selectPlayer / simple-choice 不并列抢前台；
- 顶层交互关闭后，排队的 token response 恢复前台并能继续收口。

### 大杀四方：验证“结算顺序 + 插队恢复 + stale 清理”
必须验证：
- Card Resolution Order 第 1~4 步映射；
- 多基地计分显式顺序；
- 子本体先结算、父本体后恢复；
- 强制触发排序；
- 当前玩家起顺时针的可选响应轮；
- stale 候选不能继续显示或执行。

### 召唤师战争：本轮只登记为 deferred migration / anti-pattern
本轮要求：
- 不改实现；
- 不纳入强制验收矩阵；
- 在 spec / design 中明确：现有 route / adapter 式桥接只能作为历史兼容事实，不能继续作为新游戏或新重构的参考范式。

## Risks / Trade-offs
- 若把 resolution stack 继续做成“只有 blocked gate”，会再次回到每游戏私有续链。
- 若把 Modal / Interaction / ResponseWindow 全塞进同一状态对象，会丢失现有系统的清晰边界。
- 若不把 stale candidate 规则上升到框架层，只修 SmashUp 单点，其他游戏会重复踩坑。
- 若把 SummonerWars 也强行纳入本轮实现，会显著放大改动面与验证成本，反而损害“只做必要部分”的目标。

## Migration Plan
1. 先通过 spec 固化边界、最小原语与两游戏验收矩阵；
2. 在引擎层把 `resolutionStack` 升级为真正的 frame driver；
3. 先迁移大杀四方的计分链、reaction session、response round；
4. 对齐王权骰铸前台阻塞 ownership；
5. 把 SummonerWars 登记为历史桥接反模式 / deferred migration；
6. 完成 Engine + SmashUp + DiceThrone 验证后，再决定是否扩到其他复杂游戏。

## Open Questions
- `resolution frame` 的 ordering 枚举最终命名采用 `nested-body / explicit-order / responder-round`，还是保留更底层的 `stack / explicit / loop`？
- frame driver 是否需要在系统层暴露统一 `ownerToken`，供 modal / interaction / response window 共用？
- 大杀四方现有 `reactionSession` 最终保留为 UI projection，还是进一步折叠为 frame view model？
