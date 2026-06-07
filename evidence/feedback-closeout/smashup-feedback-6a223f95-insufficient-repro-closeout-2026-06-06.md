# SmashUp 反馈 `6a223f957d14bb74e8214da8` 复核记录（2026-06-06）

## 反馈原文

- `6a223f957d14bb74e8214da8`
- 内容：
  - `基地爆破有bug，我同时爆破俩基地但是只爆了一个`

## 本轮真相源

- 反馈原始包：
  - `temp/feedback-6a223f957d14bb74e8214da8.raw.json`
- 当前树计分入口：
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/domain/scoringSession.ts`
  - `src/games/smashup/domain/ongoingModifiers.ts`

## 先锁反馈包结构

- 这条反馈的 `stateSnapshot` 不是对象，而是**字符串化 JSON**。
- 解析后当前快照是：
  - `turnNumber = 12`
  - `phase = playCards`
  - `currentPlayerIndex = 0`
  - `sys.interaction.queue = []`
  - `sys.resolution = null`
- 也就是说，包里保留的是**计分结束若干动作之后的 current state**，不是进入 `scoreBases` 前的现场。

## 当前快照按规则函数复算

- 执行命令：
  - `npx tsx -`
- 调用：
  - `getTotalEffectivePowerOnBase`
  - `getEffectiveBreakpoint`
  - `getScoringEligibleBaseIndices`
- 当前快照中的有效力量结果：
  - `工坊（base_the_workshop）= 5 / 20`
  - `宠物战斗俱乐部（base_critter_combat_club）= 7 / 23`
  - `刚柔流寺庙（base_temple_of_goju）= 7 / 18`
  - `龙之荒芜（base_wyrms_desolation）= 16 / 20`
  - `龙穴（base_dragons_lair）= 6 / 18`
- 当前快照下：
  - `getScoringEligibleBaseIndices(core) = []`

这只能说明“当前事后态没有待计分基地”，不能倒推出“进入计分阶段时一定有第二个基地曾达标”。

## Action Log 可确认的事实

- 原始 `actionLog` 里，和计分直接相关的记录只有 3 条：
  - `[08:00:00] AI 4 号位: 基地结算： 藏骨堂 ... [总力量: 17/Infinity（原始破坏点 20）] [锁定计分：进入计分阶段时已达标]`
  - `[08:00:00] AI 4 号位: 清空藏骨堂`
  - `[08:00:00] AI 4 号位: 基地替换： 藏骨堂 → 工坊`
- 没有第二条 `基地结算`
- 也没有第二条 `清空...`
- 也没有第二条 `基地替换...`

## 为何现有包锁不出“第二个应爆基地”

- `actionLog` 顶部是更新的记录，`藏骨堂` 计分行之上的内容都发生在它之后。
- `宠物战斗俱乐部`、`龙之荒芜`、`龙穴` 的现有动作记录都出现在 `藏骨堂` 结算行**上方**，说明这些建场/移动/附着动作是结算之后的后续回合记录，不能拿来当作“同时爆破”的前态证据。
- 反馈包没有：
  - `undo` 快照
  - `scoreBases` 入口前快照
  - 第二个候选基地在进入 `scoreBases` 时的有效力量
  - 第二个候选基地对应的锁定计分日志

因此当前只能确认：

- `藏骨堂（base_ossuary）` 确实在进入 `scoreBases` 时被锁定并完成了结算
- 但**没有足够证据**确认当时还有哪一个具体基地也达标且应同步进入多基地计分链

## 对当前实现的判断

- 当前树在 `scoreBases` 侧已经有：
  - 锁定 eligible 基地列表
  - `multi_base_scoring` 交互
  - `scoringSession` 恢复与链式继续
- 这条反馈包目前缺的不是“某个显见的代码缺口”，而是**原始现场前提**。
- 在没锁定第二个基地前，直接修改多基地计分链，只会把一次“事后态不足”的反馈误升级成共享逻辑改动。

## 结论

- 本轮**不改业务代码**。
- 当前结论不是“问题已修复”，而是：
  - `反馈原始包只保留了藏骨堂已结算后的事后态，无法唯一还原“同时爆俩基地”中的第二个基地，因此前提未锁定，不能实施猜测性修复。`

## 若要继续推进，最小补证需求

- 至少补其中一项：
  - 进入 `scoreBases` 前一拍的 `stateSnapshot`
  - 含 undo 的更早状态包
  - 同局录像 / 截图，能看到第二个被用户认为已达标的基地
  - 服务端更完整 action log，覆盖 `藏骨堂` 结算前数步而不是只留事后 current state
