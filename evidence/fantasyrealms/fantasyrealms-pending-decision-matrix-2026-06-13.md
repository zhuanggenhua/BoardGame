# Fantasy Realms 待决策矩阵（2026-06-13）

## 说明

本表建立在两个已经锁定的前提上：

1. 用户认可的“通过 UI”来自 `feat/game-fantasyrealms` 的**历史已验证 committed 线**
2. 本轮已经把可确认的 committed 线内容同步到根目录当前工作区

因此，当前待决策不再是“到底哪边是真相”，而是：

- 哪些新增文件现在就可以继续纳入主线
- 哪些是 `dirty worktree` 才有的继续偏移，必须等用户一起拍板
- 哪些属于项目级规则/过程文档，不能借这次 UI 合并顺手吞并

## A. 已复制到根目录，但当前仍是 `??` 的新增文件

这些文件已经按通过 UI 的 committed 线复制到根目录当前工作区，**内容来源已确认**，但因为 `main` 之前没有追踪它们，所以当前还是未跟踪新增。

### A1. 可以继续保留为“待后续提交的新增实现”

- `docs/games/fantasyrealms/design/README.md`
- `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-deep.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-review.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-test-route-local-ai.e2e.ts`
- `e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts`
- `src/games/fantasyrealms/__tests__/ai.test.ts`
- `src/games/fantasyrealms/ai.ts`
- `src/pages/__tests__/TestMatchRoom.test.tsx`

这些都属于：

- Fantasy Realms 专项实现
- 或其已提交测试/验证支撑
- 且已从通过 UI 对应的 committed 线复制进来

### A2. 暂不自动纳入正式实现集合的新增证据/文档

- `evidence/fantasyrealms/fantasyrealms-approved-line-applied-2026-06-13.txt`
- `evidence/fantasyrealms/fantasyrealms-approved-ui-merge-status-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-pending-decision-matrix-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-duel-opening-online-flow-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-full-flow-guidance-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-ui-room-entry-first-loop-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-live-action-anchor-check-2026-06-07.md`
- `evidence/fantasyrealms/fantasyrealms-online-waiting-score-summary-check-2026-06-07.md`
- `evidence/fantasyrealms/fantasyrealms-test-route-local-ai-check-2026-06-10.md`
- `evidence/fantasyrealms/fantasyrealms-worktree-merge-conflict-audit-2026-06-13.md`

建议：

- 先保留在工作区
- 但不默认算作“本轮已经确认要进正式实现包”的内容

## B. 当前只存在于 dirty worktree 的继续偏移，暂不自动吸收

以下文件在 `feat/game-fantasyrealms` 当前 worktree 里，**相对它自己的 HEAD 仍有未提交继续改动**。  
这意味着它们已经偏离“通过 UI 对应的 committed 线”，本轮不再自动并。

### B1. 核心 UI / 测试 / 文案合同偏移

- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
- `design-system/games/fantasyrealms.md`
- `docs/games/fantasyrealms/design/README.md`
- `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- `e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts`
- `public/locales/en/game-fantasyrealms.json`
- `public/locales/zh-CN/game-fantasyrealms.json`

建议：

- 这些全部进入“后续集中裁决”集合
- 在用户明确前，不再继续按 dirty worktree 覆盖根目录

后续更正：

- 其中 4 个独立小项随后已单独收口，不再属于待裁决 dirty 集合：
  - `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
  - `src/games/fantasyrealms/domain/index.ts`
  - `src/games/fantasyrealms/manifest.ts`
  - `src/games/fantasyrealms/rule/幻想国度规则.md`
- 最新剩余集合与批次划分，见：
  - `evidence/fantasyrealms/fantasyrealms-safe-absorption-followup-2026-06-13.md`
  - `evidence/fantasyrealms/fantasyrealms-remaining-decision-batches-2026-06-13.md`

### B2. 当前 dirty worktree 才有的过程文件

- `progress.md`
- `task_plan.md`
- `design-system/game-ui/MASTER.md`
- `.spec/knowledge/standards/animation-effects.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `.spec/knowledge/standards/generated-design-implementation.md`
- `.spec/knowledge/standards/ui-ux.md`
- `docs/testing-best-practices.md`

建议：

- 不纳入产品实现并线
- 后续若要保留，只能按项目级规则或过程文档单独判断

## C. 根目录当前仍存在的主线侧独立改动

这些不是 Fantasy Realms 通过 UI 线的一部分，不能借本轮合并自动吞并：

- `.spec/skills/git-operations/SKILL.md`
- `AGENTS.md`
- `.spec/knowledge/standards/animation-effects.md`
- `.spec/knowledge/standards/asset-pipeline.md`
- `.spec/knowledge/README.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `.spec/knowledge/standards/generated-design-implementation.md`
- `.spec/knowledge/standards/ui-ux.md`
- `docs/automated-testing.md`
- `docs/testing-best-practices.md`

建议：

- 保持主线侧独立状态
- 不与 Fantasy Realms UI 合并动作耦合

## D. 根目录当前已经在脏状态里的旧参考稿 / 旧证据 / 删除项

当前根目录里还有一批已处于脏状态的删除或修改：

- `evidence/fantasyrealms/fantasyrealms-board-preview.*`
- `evidence/fantasyrealms/fantasyrealms-tabletop-board-implementation.md`
- `evidence/fantasyrealms/fantasyrealms-ui-16x9-layout-reference.svg`
- `evidence/fantasyrealms/fantasyrealms-ui-16x9-tabletop-reference.html`
- `evidence/fantasyrealms/fantasyrealms-ui-imagegen-brief.md`
- `evidence/fantasyrealms/fantasyrealms-ui-layout-draft.html`
- `evidence/fantasyrealms/fantasyrealms-ui-live-centered-redraft.html`
- `evidence/fantasyrealms/fantasyrealms-ui-style-lab.html`
- `evidence/fantasyrealms/fantasyrealms-ui-style-verdict.md`

以及一批已存在但被修改过的旧 `*-check-*.md` 证据文件。

建议：

- 这批不阻止主实现继续收口
- 但是否跟随 committed 线一起清理，需要用户后续统一拍板

## 当前结论

如果只看“现在还要不要继续自动合并”：

1. **A1** 可以继续保留为已合并到根目录当前工作区的新增实现
2. **B1 / B2** 不再自动吸收，等用户集中决策
3. **C** 保持主线独立，不跟 Fantasy Realms UI 混并
4. **D** 作为后续清理议题单列，不阻挡当前主实现收口
