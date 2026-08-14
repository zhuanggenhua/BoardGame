# Fantasy Realms 当前 staging 边界（2026-06-13）

> 历史过程说明：
> 本文记录的是当时为了准备“未来可回主线的最窄代码包”而做的 staging 边界裁定。
> 它不是今天的实施指令，也不等于今天应直接回主线、执行 merge，或按本文直接挑文件。
> 今天若要判断当前正式方向，仍应回到 `fr-merge-pass2-*` 真相图、活实现与活测试合同。

## 目标

把当前 `fantasyrealms` worktree 的**未提交集合**直接收成一份可执行 staging 边界，回答三件事：

1. 现在如果要准备“最终回主线”的代码包，哪些文件可以直接纳入；
2. 哪些文件只属于过程记录或本地专项，不应进入回主线代码包；
3. 哪些文件当前虽然还在 worktree diff 里，但已经不该再作为专项线正文继续带着走。

## 现场

- 正确 worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 当前真实未提交集合：
  - `git diff --name-only`
  - `git ls-files --others --exclude-standard`

## 一、当前可直接纳入“回主线代码包”的未提交文件

这部分是当前 worktree 未提交集合里，已经明确属于 Fantasy Realms 本体、专项设计真相、产品证据或直接服务于专项链路的文件。

### A. Fantasy Realms 本体

- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
- `src/games/fantasyrealms/domain/index.ts`
- `src/games/fantasyrealms/manifest.ts`
- `src/games/fantasyrealms/rule/幻想国度规则.md`
- `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
- `public/locales/zh-CN/game-fantasyrealms.json`
- `public/locales/en/game-fantasyrealms.json`

### B. 当前未提交的专项 E2E / helper

- `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- `e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts`

### C. 当前未提交的专项设计真相

- `design-system/games/fantasyrealms.md`
- `docs/games/fantasyrealms/design/README.md`

### D. 当前未提交、且应随实现一起保留的产品证据

- `evidence/fantasyrealms/fantasyrealms-duel-opening-online-flow-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-ui-room-entry-first-loop-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-full-flow-guidance-2026-06-13.md`

## 二、当前不应纳入“回主线代码包”的未提交文件

这部分不是产品真相，而是过程计划、merge 前裁决、专项审计或本地状态记录。

### A. 当前专项过程文件

- `task_plan.md`
- `progress.md`

### B. 当前新增、但只属于 merge 前准备与审计的 evidence

- `evidence/fantasyrealms/fantasyrealms-formal-commit-boundary-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-formal-commit-paths-2026-06-13.txt`
- `evidence/fantasyrealms/fantasyrealms-local-only-paths-2026-06-13.txt`
- `evidence/fantasyrealms/fantasyrealms-main-return-audit-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-main-return-execution-status-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-main-return-final-manifest-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-process-artifact-return-policy-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-root-board-value-audit-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-root-mischange-absorption-audit-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-rule-conflict-absorption-strategy-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-worktree-dirty-set-audit-2026-06-13.md`

## 三、当前不建议再继续纳入专项线正文提交的规则文件

这部分虽然仍在 worktree 当前 diff 里，但根据已经完成的规则吸收策略，它们不应再作为“准备回主线的专项正文”继续携带：

- `design-system/game-ui/MASTER.md`
- `.spec/knowledge/standards/animation-effects.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `.spec/knowledge/standards/generated-design-implementation.md`
- `.spec/knowledge/standards/ui-ux.md`
- `docs/testing-best-practices.md`

当前裁决：

- 根目录 `main` 已经开始吸收这些条目；
- 这些文件应以根目录当前版本为基底；
- 不再让 worktree 版本整份反向覆盖回来。

因此，若现在要准备“回主线代码包”，这 6 个文件不应再被当成专项正文一起打包。

## 四、当前只是状态噪音，不进入任何 staging 判断

以下路径当前只是换行风格噪音：

- `src/components/home-v2/GameDetails.tsx`
- `src/components/lobby/GameDetailsModal.tsx`
- `src/components/lobby/RoomList.tsx`
- `src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts`
- `src/components/lobby/__tests__/RoomList.expansionSummary.test.tsx`
- `src/engine/ai/localMatchPreferences.ts`
- `src/engine/ai/__tests__/localMatchPreferences.test.ts`

它们不属于本轮“该不该回主线”的判断对象。

## 五、当前最窄可执行 staging 边界

如果此刻只为了准备一份“未来可以回主线”的最窄代码包，那么**当前未提交集合**里应只取：

1. Fantasy Realms 本体：
   - `src/games/fantasyrealms/Board.tsx`
   - `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
   - `src/games/fantasyrealms/domain/index.ts`
   - `src/games/fantasyrealms/manifest.ts`
   - `src/games/fantasyrealms/rule/幻想国度规则.md`
   - `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
   - `public/locales/zh-CN/game-fantasyrealms.json`
   - `public/locales/en/game-fantasyrealms.json`
2. 专项 E2E / helper：
   - `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
   - `e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts`
   - `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts`
   - `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
   - `e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts`
3. 专项设计真相：
   - `design-system/games/fantasyrealms.md`
   - `docs/games/fantasyrealms/design/README.md`
4. 产品证据：
   - `evidence/fantasyrealms/fantasyrealms-duel-opening-online-flow-2026-06-13.md`
   - `evidence/fantasyrealms/fantasyrealms-ui-room-entry-first-loop-2026-06-13.md`
   - `evidence/fantasyrealms/fantasyrealms-full-flow-guidance-2026-06-13.md`

## 六、当前结论

到这一步为止，当前 worktree 的未提交集合已经不再是“一大坨待判断”：

1. 可以进“回主线代码包”的文件，已经缩成一组明确清单；
2. 过程类 evidence、计划进度文件、规则冲突文档，已经明确排除；
3. 项目级规则文件当前不再应继续作为专项正文携带；
4. 真正剩下的下一步，不是再分桶，而是决定是否要把“最窄可执行 staging 边界”继续收成正式提交边界。
