# Fantasy Realms 回主线最终文件清单（2026-06-13）

> 历史过程说明：
> 本文是当时为“回主线/收口文件集合”准备的**过程清单**，不是当前正式实施指令。
> 它可以用来理解当时如何区分“产品真相”和“过程噪音”，但**不等于**今天应该直接执行 merge、直接回主线，或直接按本文落地文件操作。
> 当前 Fantasy Realms 的正式产品真相，仍以前台实现、活测试合同和 `fr-merge-pass2-*` 当前 worktree 截图为准。

## 目标

把 `feat/game-fantasyrealms` 这棵正确 worktree 最终应带回 `main` 的内容收成一份**可执行清单**，并把不该一起回去的过程文件、状态噪音和项目级规则冲突分开。

## 现场

- 正确实施落点：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 分支：`feat/game-fantasyrealms`
- 真相源：
  1. 当前 `HEAD` 树：`git ls-tree --name-only -r HEAD ...`
  2. 当前 worktree 未提交集合：`git diff --name-only`
  3. 已有审计文档：
     - `fantasyrealms-main-return-audit-2026-06-13.md`
     - `fantasyrealms-process-artifact-return-policy-2026-06-13.md`
     - `fantasyrealms-worktree-dirty-set-audit-2026-06-13.md`
     - `fantasyrealms-root-mischange-absorption-audit-2026-06-13.md`

## 一、直接应回主线

这部分要么是 Fantasy Realms 本体，要么是它已经依赖的共享支撑，要么是证明当前产品行为的结果性证据。

### 1. Fantasy Realms 本体

- `src/games/fantasyrealms/**`
- `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
- `e2e/fantasyrealms/**`
- `design-system/games/fantasyrealms.md`
- `design-system/games/fantasyrealms-mahjong-table-layout.svg`
- `docs/games/fantasyrealms/design/README.md`
- `public/locales/zh-CN/game-fantasyrealms.json`
- `public/locales/en/game-fantasyrealms.json`

### 2. 应随本体一起回主线的共享支撑

- `scripts/infra/run-e2e-command.mjs`
- `src/engine/transport/server.ts`
- `src/engine/transport/__tests__/server.test.ts`
- `src/pages/TestMatchRoom.tsx`
- `src/pages/TestMatchRoomWithAudio.tsx`
- `src/pages/__tests__/MatchRoom.onlineIdentity.test.tsx`
- `src/pages/__tests__/MatchRoom.routeIdentity.test.ts`
- `src/pages/__tests__/MatchRoom.routeIdentity.test.tsx`
- `src/pages/__tests__/TestMatchRoom.test.tsx`

### 3. 当前 `HEAD` 里已经存在的产品证据

这组文件都在当前分支 `HEAD` 树里，且都在证明**真实运行态的当前产品行为**，不是在讲“这次怎么 merge / 怎么审”：

- `evidence/fantasyrealms/*-check-*.md`

> 说明：
> 这批 `*-check-*` 里有少数文件名仍保留旧 `stacked` 命名。
> 这些名字只代表当时的历史断点命名，不代表今天仍存在一套正式 `stacked` UI 家族；判断当前正式方向时，仍以后续 `fr-merge-pass2-*` 真相源为准。

按当前 `HEAD` 实际命中的是：

- `fantasyrealms-6p-dense-score-panel-check-2026-06-06.md`
- `fantasyrealms-6p-gameover-copy-check-2026-06-06.md`
- `fantasyrealms-6p-gameover-focus-review-check-2026-06-06.md`
- `fantasyrealms-6p-gameover-review-chip-check-2026-06-06.md`
- `fantasyrealms-6p-mobile-landscape-hand-priority-check-2026-06-06.md`
- `fantasyrealms-6p-stacked-insight-priority-check-2026-06-06.md`
- `fantasyrealms-card-atlas-preview-check-2026-06-06.md`
- `fantasyrealms-dynamic-focus-score-preview-check-2026-06-06.md`
- `fantasyrealms-live-action-anchor-check-2026-06-07.md`
- `fantasyrealms-local-3p-runtime-check-2026-06-06.md`
- `fantasyrealms-local-4p-empty-discard-copy-check-2026-06-06.md`
- `fantasyrealms-local-runtime-check-2026-06-06.md`
- `fantasyrealms-mahjong-pc-pass-check-2026-06-06.md`
- `fantasyrealms-minimal-desktop-check-2026-06-06.md`
- `fantasyrealms-minimal-live-near-end-check-2026-06-06.md`
- `fantasyrealms-mobile-action-panel-check-2026-06-06.md`
- `fantasyrealms-online-waiting-score-summary-check-2026-06-07.md`
- `fantasyrealms-pc-empty-discard-compact-check-2026-06-06.md`
- `fantasyrealms-stacked-compact-deck-check-2026-06-06.md`
- `fantasyrealms-tablet-action-panel-check-2026-06-06.md`
- `fantasyrealms-test-route-local-ai-check-2026-06-10.md`

### 4. 当前 worktree 里新增、且应跟实现一起回主线的产品证据

- `evidence/fantasyrealms/fantasyrealms-duel-opening-online-flow-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-ui-room-entry-first-loop-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-full-flow-guidance-2026-06-13.md`

## 二、不应回主线

这部分不是产品真相，而是本次专项推进日志、merge 前审计、设计试探或工作树状态噪音。

### 1. 当前专项过程文件

- `task_plan.md`
- `progress.md`
- `findings.md`

### 2. 本次 merge 前准备与误改审计

- `evidence/fantasyrealms/fantasyrealms-main-return-audit-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-process-artifact-return-policy-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-root-mischange-absorption-audit-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-worktree-dirty-set-audit-2026-06-13.md`

### 3. 当前 `HEAD` 里已有、但性质仍属于过程审计或参考研究的文件

- `evidence/fantasyrealms/fantasyrealms-completion-matrix-2026-06-10.md`
- `evidence/fantasyrealms/fantasyrealms-foundation-completion-audit-2026-06-06.md`
- `evidence/fantasyrealms/fantasyrealms-mahjong-layout-reference-study-2026-06-06.md`

### 4. 当前 worktree 里的运行截图 / 预览资产

当前 `evidence/fantasyrealms/` 目录下大量 `.png` 运行截图只承担本地看图与审查证据职责，不是本次“回主线文件集合”的正文真相源；后续若需要保留，应按专门证据策略处理，而不是跟代码一起机械并回。

### 5. 当前 `git status` 里仅是换行风格噪音的文件

以下路径当前不应算进“待回主线内容”：

- `src/components/home-v2/GameDetails.tsx`
- `src/components/lobby/GameDetailsModal.tsx`
- `src/components/lobby/RoomList.tsx`
- `src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts`
- `src/components/lobby/__tests__/RoomList.expansionSummary.test.tsx`
- `src/engine/ai/localMatchPreferences.ts`
- `src/engine/ai/__tests__/localMatchPreferences.test.ts`

## 三、不得直接从 worktree 覆盖回主线的项目级规则

这部分不能跟 Fantasy Realms 本体一起“整份带回”，必须以根目录当前版本为基底做人工吸收：

- `AGENTS.md`
- `.spec/knowledge/README.md`
- `.spec/decisions/document-consolidation.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `.spec/knowledge/standards/generated-design-implementation.md`
- `.spec/knowledge/standards/ui-ux.md`
- `docs/e2e-testing-guide.md`
- `docs/testing-best-practices.md`
- `.spec/knowledge/standards/animation-effects.md`
- `design-system/game-ui/MASTER.md`

这批文件的具体吸收策略，见：

- `evidence/fantasyrealms/fantasyrealms-rule-conflict-absorption-strategy-2026-06-13.md`

## 四、当前可执行结论

1. Fantasy Realms 本体、共享支撑和结果性产品证据已经能收成明确集合。
2. `task_plan / progress / findings / 审计类 evidence` 不应跟实现一起回主线。
3. 项目级规则文件不能直接用 worktree 版本覆盖 `main` 当前版本，必须按专项策略人工吸收。
4. 后续真正执行回主线前，应以本清单作为 staging 与冲突裁决边界，而不是直接照抄整棵 worktree。
