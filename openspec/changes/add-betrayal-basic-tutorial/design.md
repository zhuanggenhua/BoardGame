## Context

- `betrayal` 当前已经有两条真实链路可复用：
  - `basic-flow.e2e.ts`：角色选择确认到恶兆前运行时
  - `first-scenario.e2e.ts`：真实 haunt 运行时到幸存者终局
- 当前仓库已经支持：
  - 单教程 manifest
  - `TutorialCollection`
  - 标准教程路由 `/play/:gameId/tutorial`
  - 子教程深链 `/play/:gameId/tutorial/:tutorialId`
- `betrayal` 当前还没有：
  - `src/games/betrayal/tutorial.ts`
  - `tutorialCatalog`
  - `betrayal` 专属教程锚点测试
  - 教程证据目录

## Goals / Non-Goals

- Goals:
  - 让 `betrayal` 能通过标准教程路由进入基础教程。
  - 第一轮教程建立在当前真实 runtime 与第一剧本链上，而不是另造教程假页面。
  - 用多短章讲清基础目标、恶兆前主循环、第一剧本英雄目标与收尾。
  - 为后续叛徒教程、更多剧本教程保留标准 `tutorialId` 扩展面。
- Non-Goals:
  - 不在本轮做“所有剧本 + 所有视角 + 所有边界规则”的完整教程体系。
  - 不在本轮额外重做运行时大布局或终局视觉，只为教程补最低必要锚点。
  - 不在本轮承诺叛徒胜利页面级 E2E 教学链；该部分可后续单独补子教程。

## Decisions

### 1. 直接采用 TutorialCollection，而不是先做单教程再二次迁移

- 当前仓库已经正式支持 `TutorialCollection` 与 `tutorialId` 深链。
- `betrayal` 本身就天然适合分章：
  - `basic-setup-and-turn`
  - `move-explore-use`
  - `crimson-jack-objective`
  - `haunt-actions-and-finish`
- 因此本轮不再先落一个孤立单教程，再在下一轮改目录；直接声明目录结构，但只实现首批必要章节。

### 2. 教程必须复用当前真实页面链，不得另造 tutorial-only 页面

- 角色选择应直接复用当前 `/play/betrayal` 的真实选择页。
- 恶兆前教学应直接复用当前 runtime board。
- 第一剧本教学应复用当前真实 haunt board 与终局页。
- 这保证教程交互与正式游玩一致，也避免再出现“为了教程造一层壳”的历史问题。

### 3. 第一轮只做英雄线基础教程，不把叛徒线强绑进默认教程

- 当前英雄线已有：
  - 真实领域闭环
  - 真实终局 E2E
  - 可直接复用的 `createFirstScenarioReadyToExorciseRuntimeCore`
- 叛徒线虽然已有领域测试，但还没有页面级真实收尾链。
- 因此默认基础教程先聚焦“玩家第一次怎么玩、如何看懂第一剧本英雄线”，叛徒侧单独留给后续子教程。

### 4. 教程章节必须绑定覆盖矩阵，而不是边做边想

- 当前 `docs/games/betrayal/records/betrayal-tutorial-coverage-matrix.md` 已先列出：
  - 规则条目
  - 建议章节
  - 当前证据 / 当前缺口
- 实现前先按矩阵选定“本轮承诺覆盖”的章节，不允许边做边扩。

### 5. 章节前置局面优先复用现有 test helper / harness，而不是在 Board 里写教程特判

- 恶兆前基础步骤可直接从正式开局进入。
- 第一剧本章节如果需要稳定落到某个 haunt 局面，优先复用：
  - `createFirstScenarioHauntRuntimeCore()`
  - `createFirstScenarioReadyToExorciseRuntimeCore()`
  - 现有 tutorial system 的固定随机或 `aiActions`
- 不在 Board 组件里临时新增“如果教程就切某个假状态”的分支。

## Risks / Trade-offs

- `betrayal` 教程如果从真实开局完全无预置进入，某些“探索到恶兆 / 进入固定 haunt 局面”的步骤稳定性会不足。
  - Mitigation: 允许章节在真实 runtime 内用固定局面或 helper 进入，但仍必须落在正式页面，不得转成独立假页。
- 当前运行时锚点未必足够支撑所有教程步骤。
  - Mitigation: 只补真实交互对象上的 `data-tutorial-id`，不做额外替身元素。
- 若默认教程一口气塞太多，会再次落回“超长教程刷新即丢进度”的老问题。
  - Mitigation: 默认教程只承诺首批必要章节，更多内容走子教程。

## Verification Plan

- OpenSpec:
  - `openspec validate add-betrayal-basic-tutorial --strict --no-interactive`
- Static / Vitest:
  - 新增 `src/games/betrayal/__tests__/tutorial*.test.ts`
  - 至少覆盖教程目录结构、默认教程 ID、关键步骤 ID、关键锚点存在性
- Runtime / E2E:
  - 回归 `basic-flow.e2e.ts`
  - 回归 `first-scenario.e2e.ts`
  - 如新增教程级 E2E，则必须通过标准入口 `/play/betrayal/tutorial` 或 `/play/betrayal/tutorial/:tutorialId`
- Docs:
  - 更新 `docs/games/betrayal/README.md`
  - 维护 `docs/games/betrayal/records/betrayal-tutorial-coverage-matrix.md`
  - 为教程证据建立 `evidence/betrayal-tutorial/`
