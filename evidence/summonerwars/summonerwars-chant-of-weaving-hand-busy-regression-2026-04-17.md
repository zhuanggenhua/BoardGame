# 召唤师战争：编织颂歌在召唤阶段被“请先完成当前操作”误拦截

## 范围

- 游戏：`summonerwars`
- 问题：召唤阶段点击 `编织颂歌`，前端先弹 `请先完成当前操作`，导致事件卡无法进入打出链路。
- 收口时间：2026-04-17

## 根因

- [Board.tsx](D:/gongzuo/webgame/BoardGame/src/games/summonerwars/Board.tsx) 在 2026-04-12 的回归里把 `handInteractionBusy` 扩成了：
  `engineInteractionBusy || !!abilityMode || interaction.hasActiveEventMode`
- 这里的 `engineInteractionBusy` 来自任意引擎层 `currentInteraction`，范围比召唤师战争 UI 真正可见、可处理的 `swInteraction` 更大。
- 结果是：手牌区会被“不属于 SummonerWars 手牌交互链的引擎 current interaction”误判成 busy，先在前端 toast 拦下，连 `REQUEST_EVENT_INTERACTION / PLAY_EVENT` 都进不去。

## 修复

- 新增 [handInteractionBusy.ts](D:/gongzuo/webgame/BoardGame/src/games/summonerwars/ui/handInteractionBusy.ts)。
- [Board.tsx](D:/gongzuo/webgame/BoardGame/src/games/summonerwars/Board.tsx) 改为只在以下情况阻塞手牌：
  - 本地 `abilityMode`
  - 本地 `hasActiveEventMode`
  - 当前确实存在 `swInteraction`
- 不再把未知/非 SW 的引擎交互直接当成“请先完成当前操作”。

## 验证

### 单测

- 命令：
  `npm run test -- src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts`
- 结果：
  `83 passed`
- 回归断言位置：
  [interaction-chain-comprehensive.test.ts](D:/gongzuo/webgame/BoardGame/src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts)

### E2E

- 命令：
  `npm run test:e2e:ci:file -- summonerwars/summonerwars-barbaric-abilities.e2e.ts "编织颂歌：召唤阶段可正常打出且不会被交互忙碌提示误拦截"`
- 结果：
  `1 passed`
- 用例位置：
  [summonerwars-barbaric-abilities.e2e.ts](D:/gongzuo/webgame/BoardGame/e2e/summonerwars/summonerwars-barbaric-abilities.e2e.ts)

## 截图观察

### 1. 打出前

- 路径：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-barbaric-abilities.e2e\编织颂歌：召唤阶段可正常打出且不会被交互忙碌提示误拦截\chant-weaving-before-play.png`
- 我实际看到：
  - 右侧阶段条处于 `召唤` 阶段。
  - 底部手牌区能直接看到 `编织颂歌` 卡面本体。
  - 截图里没有出现 `请先完成当前操作` toast。
- 验收结论：
  - 达到“问题触发前的真实入口”要求。

### 2. 打出后

- 路径：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-barbaric-abilities.e2e\编织颂歌：召唤阶段可正常打出且不会被交互忙碌提示误拦截\chant-weaving-after-play.png`
- 我实际看到：
  - 原本底部手牌里的 `编织颂歌` 已不在手牌位置。
  - 左侧出现 `编织颂歌` 的持续效果卡片/标记。
  - 截图里仍未出现 `请先完成当前操作` toast。
- 状态断言：
  - `players['0'].activeEvents` 包含 `barbaric-chant-of-weaving-e2e`
  - `players['0'].hand` 不再包含 `barbaric-chant-of-weaving-e2e`
- 验收结论：
  - 达到“召唤阶段可以成功打出编织颂歌，不再被忙碌提示误拦截”的标准。

## 残余风险

- 这次 E2E 主要证明“手牌点击链路恢复、卡能成功进入 activeEvents”，没有额外覆盖“编织颂歌后续相邻召唤与充能目标”的老能力语义；那部分已有领域测试覆盖。
