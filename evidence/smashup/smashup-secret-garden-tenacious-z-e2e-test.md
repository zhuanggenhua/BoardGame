# SmashUp 神秘花园 + 顽强丧尸 E2E 证据

## 范围

- 游戏：SmashUp / 大杀四方
- 场景：神秘花园在回合开始授予 1 个仅限本基地的额外随从额度；随后从弃牌堆选择顽强丧尸并打到神秘花园。
- 回归点：神秘花园不应在进入 `playCards` 时凭已有随从预发额度，必须回到历史正常的 `onTurnStart` 授额行为。
- 当前状态：已按回归流程完成最小还原修复，并通过真实 E2E + 截图复核。旧的“第一次修复尝试”仅保留为失败历史，不能作为最终结论。

## 回归处理记录

用户原始问题：端到端跑一下大杀四方花园效果，顽强丧尸无法打上去，怀疑额外随从回归。

首跑复现结果：
- 真实 UI 链路中，先把随从打到神秘花园后，状态快照显示 `triggerOnGarden: true`，但 `gardenQuota: 0`、`powerCap: null`。
- 结论：回归成立。神秘花园已有随从在场，但没有授予能让顽强丧尸打出的基地限定额外随从额度。

最后正常证据：
- `63a9f026449d960b72acd5d9e2f1203a75997b10`（2026-04-10 17:17:40 +0800，`修正大杀四方额外出牌时机规则`）中，神秘花园为 `onTurnStart` / contextual extra minion 类触发。
- 本轮第一次处理曾推断“按随从实际打到这里后触发”，但缺少用户故事、规则文档或权威变更记录支撑；按回归规范，该推断不能作为偏离最后正常行为的依据。

导致回归提交：
- `fde11638744718b742aafaabc21bcea377031ef5`（2026-05-02 14:39:17 +0800，`重构 SmashUp 特殊激活模型并补齐相关回归`）。
- 该提交删除/停用 `base_secret_garden` 的 `onTurnStart` 注册，并在 `src/games/smashup/domain/index.ts` 新增进入 `playCards` 时扫描神秘花园已有己方随从再发额度的分支。
- 这把“回合开始获得本回合可用的基地限定额度”错误改成了“进入 phase 2 时必须已经有己方随从在花园上”，导致顽强丧尸无法依赖该额度打上去。

根因归类：
- 类型：实现逻辑 / 时序语义回归。
- 不是资源链路问题：截图中卡图和棋盘正常渲染。
- 不是顽强丧尸单卡能力问题：顽强丧尸从弃牌堆打出的 provider 仍能出现；失败点在花园额度没有正确发放。
- 不是单纯测试过时：首跑状态直接证明 `baseLimitedMinionQuota[0]` 未写入。

## 最终回归还原修复

- `src/games/smashup/domain/baseAbilities_expansion.ts` 与 `e2e/src/games/smashup/domain/baseAbilities_expansion.ts`：恢复 `base_secret_garden` / `base_secret_garden_pod` 的 `onTurnStart` 授额。
- `src/games/smashup/domain/index.ts` 与 `e2e/src/games/smashup/domain/index.ts`：移除神秘花园在 `playCards` 阶段扫描已有随从并预发额度的分支。
- `src/games/smashup/__tests__/archmageE2E.test.ts` 与 `e2e/src/games/smashup/__tests__/archmageE2E.test.ts`：恢复“回合开始后应拿到神秘花园基地限定额度”的回归断言。
- `src/games/smashup/__tests__/expansionBaseAbilities.test.ts` 与 `e2e/src/games/smashup/__tests__/expansionBaseAbilities.test.ts`：保留 `onTurnStart` 事件契约，明确 `onMinionPlayed` 不应成为神秘花园触发点。
- `e2e/smashup/smashup-secret-garden-tenacious-z.e2e.ts`：改成真实链路验证，先由 P1 结束回合进入 P0 `playCards`，确认花园额度出现，再用普通随从耗掉普通额度，最后用花园额外额度从弃牌堆打出顽强丧尸。

扩审范围与结果：
- 已扩审神秘花园 pod 注册：同步注册 `base_secret_garden_pod` 的 `onTurnStart`。
- 已扩审旧阶段预发测试：`archmageE2E` 旧断言已恢复为进入 `playCards` 后应持有神秘花园基地限定额度。
- 已补事件层测试：`expansionBaseAbilities` 断言 `onTurnStart` 发放 `restrictToBase` 与 `playTiming: 'banked'`，并确认 `onMinionPlayed` 不发额度。
- 神秘花园力量限制由基地 restriction 消费；这部分由 `baseRestrictions.test.ts` 验证。

## 验证命令

- `npx eslint e2e/smashup/smashup-secret-garden-tenacious-z.e2e.ts src/games/smashup/domain/index.ts src/games/smashup/domain/baseAbilities_expansion.ts src/games/smashup/__tests__/archmageE2E.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
  - 结果：0 errors；仅 `src/games/smashup/domain/index.ts` 既有 `any` / unused warnings。
- `npm run test -- src/games/smashup/__tests__/archmageE2E.test.ts src/games/smashup/__tests__/baseRestrictions.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
  - 结果：3 files passed，86 tests passed。
- `npm run test:e2e:ci:file -- e2e/smashup/smashup-secret-garden-tenacious-z.e2e.ts "神秘花园回合额度应允许从弃牌堆把顽强丧尸打到花园"`
  - 结果：1 passed。

## 截图观察

### 01-turn-start-garden-quota-visible

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-secret-garden-tenacious-z.e2e\神秘花园回合额度应允许从弃牌堆把顽强丧尸打到花园\01-turn-start-garden-quota-visible.png`

肉眼观察：
- 神秘花园、436-1337工厂、大图书馆都在场，左上角显示回合 2，画面没有缩在左上角或窄布局。
- 右下角状态区显示随从额度为 1，说明回合开始时神秘花园确实给了基地限定额度。
- 顽强丧尸仍在弃牌堆，尚未进入基地，符合“先确认额度，再执行后续打出”的链路。

结论：达到“回合开始时神秘花园额度可见”的验收点。

### 02-normal-minion-spent-garden-quota-remains

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-secret-garden-tenacious-z.e2e\神秘花园回合额度应允许从弃牌堆把顽强丧尸打到花园\02-normal-minion-spent-garden-quota-remains.png`

肉眼观察：
- 大副已经先落到 436-1337工厂，右侧玩家面板的随从计数变成 1，说明普通随从额度被正确消耗。
- 神秘花园仍然有绿色高亮，说明基地限定额外额度还在。
- 顽强丧尸仍在右下角弃牌堆操作区，未被误触发或提前打出。

结论：达到“普通额度先被消耗、神秘花园额外额度仍保留”的验收点。

### 03-tenacious-z-selected-garden-highlight

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-secret-garden-tenacious-z.e2e\神秘花园回合额度应允许从弃牌堆把顽强丧尸打到花园\03-tenacious-z-selected-garden-highlight.png`

肉眼观察：
- 中央弹出了顽强丧尸大卡，底部明确提示“点击基地部署”。
- 左侧神秘花园仍被高亮，说明当前可落点真实指向神秘花园，而不是只剩泛化提示。
- 画面同时保留弃牌堆、手牌和基地本体，可复查这不是伪造的快照。

结论：达到“顽强丧尸进入真实打出选择流程”的验收点。

### 04-tenacious-z-on-secret-garden

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-secret-garden-tenacious-z.e2e\神秘花园回合额度应允许从弃牌堆把顽强丧尸打到花园\04-tenacious-z-on-secret-garden.png`

肉眼观察：
- 神秘花园下方已出现顽强丧尸，基地高亮仍在，证明最终落点就是神秘花园。
- 神秘花园红方力量从 3 变为 5，符合先有基础力量 3，再加顽强丧尸 2 的实际结果。
- 弃牌堆中的顽强丧尸已经消失，说明它确实从弃牌堆进入基地而不是留在弃牌堆视图里。

结论：达到“顽强丧尸实际打上神秘花园”的验收点。

## 废弃尝试记录

- 第一次修复尝试曾把神秘花园改成 `onMinionPlayed`，并让 E2E 先打一张随从来触发花园额度。
- 该路线已废弃，原因是没有先锁定导致回归提交，也没有还原 `fde11638` 引入的错误 hunk。
- 本次最终修复已回到 `63a9f026` 的历史正确语义：`onTurnStart` 发放 banked 基地限定额度，神秘花园力量限制由基地 restriction 消费。
