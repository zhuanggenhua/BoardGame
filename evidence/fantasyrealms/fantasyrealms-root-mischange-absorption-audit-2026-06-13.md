# Fantasy Realms 根目录剩余误改吸收审计（2026-06-13）

> 历史过程说明：
> 本文是当时用来判断“根目录误改里还有没有要吸收到正确 worktree 的内容”的过程审计。
> 它只说明**当时**根目录误改相对专项 worktree 的价值裁定，不是今天的正式 UI 合同。
> 若正文出现 `牌库 cue`、运行时短提示等表述，应理解为“那一阶段 worktree 曾承载过的实现状态”，不得直接当成今天的正式桌面方向。

## 目标

确认当前根目录 `main` 工作树里，是否还残留需要继续吸收到 `fantasyrealms` worktree 的 Fantasy Realms 实现改动。

## 现场

- 根目录：`D:\gongzuo\webgame\BoardGame`
- 正确专项 worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 当前专项分支：`feat/game-fantasyrealms`

## 审计结果

### 1. 根目录当前仍与 Fantasy Realms 直接相关的误改，只剩两处

- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`

除此之外，根目录当前的其余脏改不是 Fantasy Realms 实现文件：

- `AGENTS.md`
- `.spec/skills/git-operations/SKILL.md`
- `.spec/knowledge/standards/asset-pipeline.md`
- `.spec/knowledge/README.md`
- `docs/automated-testing.md`

这些属于项目级规范或流程文档，不属于“Fantasy Realms 实现吸收”范围。

### 2. 这两处误改不再需要迁入 worktree

#### `Board.tsx`

根目录这边剩余的差异，主要是：

- 把焦点区压成仅文字摘要，不再保留焦点卡预览；
- 收窄公共河间距、缩小少牌态横向展开；
- 调整桌面/紧凑横屏的焦点卡尺寸、位置和空河底板参数。

这些差异目前都**没有形成新的功能真相**，也没有覆盖 worktree 当前已经成立的更高优先级合同：

- worktree 已锁定 `compact-landscape` 命名与横屏断点；
- worktree 当时已锁定双人开局 `0` 手牌提示、牌库 cue、运行时短提示；
- worktree 已锁定首页真实建房到终局排名的 full-flow 链路；
- worktree 当前测试仍要求焦点区保留正式卡图预览，而不是退回纯文字摘要。

因此这部分应判定为：

- **错误落点上的旧版式试探**
- **不再迁入当前 worktree**

#### `Board.foundation.test.tsx`

根目录这边剩余测试差异只是为上面那版 `Board.tsx` 配套：

- 不再查 `fantasyrealms-focus-preview`
- 改成只看 `当前焦点` 文字摘要

由于实现边不迁，这些测试也没有独立迁移价值。

### 3. 当前 worktree 已覆盖的真实实现范围，明显新于根目录误改

当前 worktree 已具备而根目录误改并不承载的内容，包括：

- `public/locales/zh-CN/game-fantasyrealms.json`
- `public/locales/en/game-fantasyrealms.json`
  - 当时仍存在的牌库 cue、draw/discard/take 的运行时短提示
- `src/games/fantasyrealms/domain/index.ts`
  - `getDeckDrawCount`
- `src/games/fantasyrealms/manifest.ts`
  - `thumbnailPath`
  - `localAi: true`
- `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
  - 首页真实建房入口
  - full-flow 到终局排名
  - host 弃牌后允许 `waiting / host returned / direct gameover`

这说明当前专项线的真实实现已经继续向前演进，根目录那两处误改不是“漏迁功能”，只是错误工作树上的残留副本。

## 当前结论

本轮审计后，Fantasy Realms 在根目录 `main` 工作树里已经**没有需要继续吸收到 `fantasyrealms` worktree 的剩余实现差异**。

当前应保持的口径是：

1. `fantasyrealms` worktree 继续作为唯一实现真相源。
2. 根目录剩余 `Board.tsx / Board.foundation.test.tsx` 只作为错误落点残留，不再继续向专项线迁移。
3. 这条“如何回主线”的结论只属于当时的过程裁定；今天若讨论集成路径，仍需重新看当前 worktree 与当前根目录状态，不能直接把本文当成现行操作指令。

## 当前验证

- `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts --grep "首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图"` -> `1 passed`
- 当前关键链路图证：
  - [fantasyrealms-full-flow-guidance-2026-06-13.md](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/evidence/fantasyrealms/fantasyrealms-full-flow-guidance-2026-06-13.md)
