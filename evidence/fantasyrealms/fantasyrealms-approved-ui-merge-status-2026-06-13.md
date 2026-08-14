# Fantasy Realms 通过 UI 基线合并状态（2026-06-13）

## 通过 UI 来源锁定

用户指定的通过 UI 产物目录：

- `C:\Users\zhuagenbao\CodexBridge\.codexbridge\turn-artifacts\b18b742c-d43c-4707-ab37-d7046fd32825`

其中两张图：

- `fantasyrealms-score-inline-topbar.png`
- `fantasyrealms-score-inline-near-end.png`

经 SHA256 反查，已与 `fantasyrealms` worktree 的历史证据截图完全一致：

1. `2775B219D528AC0469D3E8AFDC3902649251863BA5981E233C6BD9BE47318D41`
   - `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\test-results\evidence-screenshots\_shared\fantasyrealms-live-flow.e2e\顶部-live-HUD-保持左上牌库、居中状态轴与右上分数窄带三段锚点\顶部-live-HUD-保持左上牌库、居中状态轴与右上分数窄带三段锚点-live-hud-three-anchor-topbar.png`
2. `E0BAD2E1DE72D4586B95D85C70CB4586112537C6152056B8D120B202E0EFB693`
   - `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\test-results\evidence-screenshots\_shared\fantasyrealms-live-flow.e2e\3人基础版-9-10-代表态的公开弃牌保持两排交错牌河，而不是死板矩阵\3人基础版-9-10-代表态的公开弃牌保持两排交错牌河，而不是死板矩阵-near-end-interleaved-river.png`

结论：

- 这套通过 UI 来自 **Fantasy Realms worktree 这条历史已验证线**
- 不是根目录当前脏改现场生成的
- 因此本轮“能直接并”的范围，以 **`feat/game-fantasyrealms` 已提交内容** 为基线，而不是以当前未提交 worktree 脏改为基线

## 已直接并入根目录当前工作区的确认项

本轮已把以下类别，对齐到 `feat/game-fantasyrealms` 的 **已提交版本**：

1. `src/games/fantasyrealms/**` 的已确认专项实现
2. `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
3. `e2e/fantasyrealms/**`
4. `design-system/games/fantasyrealms.md`
5. `docs/games/fantasyrealms/design/README.md`
6. `public/locales/en/game-fantasyrealms.json`
7. `public/locales/zh-CN/game-fantasyrealms.json`
8. `scripts/infra/run-e2e-command.mjs`
9. `src/engine/transport/server.ts`
10. `src/engine/transport/__tests__/server.test.ts`
11. `src/pages/TestMatchRoom.tsx`
12. `src/pages/TestMatchRoomWithAudio.tsx`
13. `src/pages/__tests__/MatchRoom.onlineIdentity.test.tsx`
14. `src/pages/__tests__/MatchRoom.routeIdentity.test.ts`
15. `src/pages/__tests__/MatchRoom.routeIdentity.test.tsx`
16. `src/pages/__tests__/TestMatchRoom.test.tsx`

本轮实际应用清单见：

- `evidence/fantasyrealms/fantasyrealms-approved-line-applied-2026-06-13.txt`

## 当前明确不再自动并入的项

以下内容目前 **有证据不足或语义未锁定**，本轮不再自动吸收：

### A. worktree 当前未提交、但已偏离“通过 UI 历史线”的项

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

这些文件的特点是：

- 当前 worktree `HEAD` 已有一版可运行、且与通过 UI 图一致的历史线
- 但 worktree 当前未提交又在这些文件上继续改过
- 这批后续改动是否仍符合你认可的 UI，不应再由 agent 自动拍板

补充：

- 后续又完成了 4 个独立小项的单独收口：
  - `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
  - `src/games/fantasyrealms/domain/index.ts`
  - `src/games/fantasyrealms/manifest.ts`
  - `src/games/fantasyrealms/rule/幻想国度规则.md`
- 它们已不再属于“未确认 dirty 偏移集合”。
- 详见：
  - `evidence/fantasyrealms/fantasyrealms-safe-absorption-followup-2026-06-13.md`

### B. 项目级规则 / 主线规范

- `AGENTS.md`
- `.spec/knowledge/standards/**`
- `docs/e2e-testing-guide.md`
- `docs/testing-best-practices.md`
- `.spec/skills/git-operations/SKILL.md`

原因：

- 它们不是 Fantasy Realms 私有实现
- 且当前根目录本来就有并行主线修改
- 只能后续单独裁决，不能借着这次 UI 基线顺手一起吞并

### C. 过程文档 / 审计文档 / 一次性决策文档

- `progress.md`
- `task_plan.md`
- `findings.md`
- `evidence/fantasyrealms/*main-return*`
- `evidence/fantasyrealms/*absorption*`
- `evidence/fantasyrealms/*boundary*`
- `evidence/fantasyrealms/fantasyrealms-worktree-merge-conflict-audit-2026-06-13.md`

原因：

- 它们描述的是推进过程，不是产品实现真相

### D. 根目录当前残留的旧参考稿 / 草稿 / 预览资产

当前根目录里还有一批 `evidence/fantasyrealms` 删除项与修改项处于脏状态，例如：

- `fantasyrealms-board-preview.*`
- `fantasyrealms-tabletop-board-implementation.md`
- `fantasyrealms-ui-16x9-layout-reference.svg`
- `fantasyrealms-ui-16x9-tabletop-reference.html`
- `fantasyrealms-ui-imagegen-brief.md`
- `fantasyrealms-ui-layout-draft.html`
- `fantasyrealms-ui-live-centered-redraft.html`
- `fantasyrealms-ui-style-lab.html`
- `fantasyrealms-ui-style-verdict.md`

这批和“通过 UI”同属一条历史演进线，但是否现在就一起删净，属于次一级整理动作，后续可与你一起批量决策。

## 当前可执行结论

1. 通过 UI 的直接来源，已经锁定为 `fantasyrealms` worktree 的历史已验证线。
2. 本轮已经把这条线中**可确认的已提交实现**同步到根目录当前工作区。
3. 当前 worktree **未提交继续改出来的 UI/测试/文案变化**，不再自动并。
4. 后续只需对“未确认项”做一次集中裁决，而不用再回头争论“通过 UI 到底是哪边出的”。
