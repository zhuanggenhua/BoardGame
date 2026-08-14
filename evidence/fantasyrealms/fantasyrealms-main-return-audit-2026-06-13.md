# Fantasy Realms 回主线内容审计（2026-06-13）

> 历史过程说明：
> 本文记录的是当时为了判断“如果未来要回主线，哪些内容该分到哪一类”所做的过程审计。
> 它不是今天的实施指令，也不等于今天应继续执行回主线、执行 merge，或按本文分桶直接操作文件。
> 今天若要判断当前正式方向，仍应回到 `fr-merge-pass2-*` 真相图、活实现与活测试合同。

## 目标

在**不直接执行 merge** 的前提下，先把 `feat/game-fantasyrealms` 当时准备带回 `main` 的内容分三类审清：

1. Fantasy Realms 本体必须带回主线的实现；
2. 为 Fantasy Realms 本体成立而新增的共享支撑；
3. 当前 `main` 已有更新、不能让 worktree 旧版本反向覆盖的项目级规则。

## 现场

- 根目录 `main`：`D:\gongzuo\webgame\BoardGame`
- Fantasy Realms worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 当前专项分支：`feat/game-fantasyrealms`

## 一、必须带回主线的 Fantasy Realms 本体

这部分是当前 worktree 作为唯一实现真相源的核心内容，不应再回退到 `main` 旧实现：

### 游戏实现与领域

- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/ai.ts`
- `src/games/fantasyrealms/data/cards.ts`
- `src/games/fantasyrealms/domain/index.ts`
- `src/games/fantasyrealms/domain/scoring.ts`
- `src/games/fantasyrealms/domain/types.ts`
- `src/games/fantasyrealms/domain/view.ts`
- `src/games/fantasyrealms/foundation.ts`
- `src/games/fantasyrealms/game.ts`
- `src/games/fantasyrealms/manifest.ts`
- `src/games/fantasyrealms/rule/official-card-table-contract.md`
- `src/games/fantasyrealms/rule/幻想国度卡牌录入核对.md`

### 游戏测试

- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
- `src/games/fantasyrealms/__tests__/ai.test.ts`
- `src/games/fantasyrealms/__tests__/officialCardData.test.ts`
- `src/games/fantasyrealms/__tests__/runtimeSkeleton.test.ts`
- `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`

### 游戏端到端与 helper

- `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-deep.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-review.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-test-route-local-ai.e2e.ts`
- `e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts`

### 设计与文案真相

- `design-system/games/fantasyrealms.md`
- `docs/games/fantasyrealms/design/README.md`
- `public/locales/zh-CN/game-fantasyrealms.json`
- `public/locales/en/game-fantasyrealms.json`

### 当前未提交但已经通过验证的本体补充

- `src/games/fantasyrealms/manifest.ts`
  - 新增 `thumbnailPath: 'fantasyrealms/thumbnails/cover'`
- `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
  - 新增封面缩略图资产存在断言

这两笔已通过：

- `npx vitest run src/games/__tests__/fantasyrealmsManifestIntegration.test.ts ...`
- `62 passed`

## 二、应随本体一起回主线的共享支撑

这些文件虽然不在 `src/games/fantasyrealms/**` 下，但当前 diff 显示它们直接服务于 Fantasy Realms 的真实玩法链路、测试链路或本地 AI / spectator / route identity 合同。

### 共享运行与测试支撑

- `scripts/infra/run-e2e-command.mjs`
  - `ci` 模式补 `BG_NODE_MAX_OLD_SPACE_SIZE=12288`
  - 用途：避免 Fantasy Realms 长链 E2E 在默认命令下因前端子进程 OOM 假失败

### 共享 transport / watchdog

- `src/engine/transport/server.ts`
- `src/engine/transport/__tests__/server.test.ts`

用途：

- 补 `online AI watchdog` 在 Fantasy Realms 连续 legal-action 深分支下的恢复与跨回合追踪
- 这不是单纯“为测试而测”，而是 Fantasy Realms online AI 深链能持续推进的共享底座

### 共享测试页 / route identity / spectator 身份

- `src/pages/TestMatchRoom.tsx`
- `src/pages/__tests__/MatchRoom.onlineIdentity.test.tsx`
- `src/pages/__tests__/MatchRoom.routeIdentity.test.ts`
- `src/pages/__tests__/MatchRoom.routeIdentity.test.tsx`
- `src/pages/__tests__/TestMatchRoom.test.tsx`

用途：

- `TestMatchRoom` 支持按 seat controller / playerId 驱动本地 AI 场景
- `MatchRoom` 明确 spectator/null 不借用 seat 身份
- 这些都和 Fantasy Realms 的 local AI / spectator / online 身份正确性直接相关

## 三、不应让 worktree 旧版本反向覆盖当前 main 的项目级规则

以下文件当前根目录 `main` 工作树和 `fantasyrealms` worktree 版本都不同：

- `AGENTS.md`
- `.spec/knowledge/README.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `.spec/knowledge/standards/generated-design-implementation.md`
- `.spec/knowledge/standards/ui-ux.md`
- `docs/testing-best-practices.md`

其中当前 `main` 还带有本轮后续补强过的新规则，例如：

- 多 worktree 必须先锁正确实施落点；
- 根 AGENTS 只保留入口与红线，细节下沉；
- 规范落点分层、渐进式披露；
- 资产回退链不得单游戏自创；
- E2E / UI / 设计稿若已有新规则，以根目录当前版本为主。

因此这类文件的裁决应是：

1. **不能直接用 worktree 版本覆盖 main 当前版本**
2. 应以 `main` 当前规则版为基础
3. 只人工吸收 worktree 里仍然独有、且尚未进入主线的新条目

## 四、当前真正的回主线 blocker

### 1. 两边都还是脏工作区，不能直接做最终 merge 动作

#### 根目录 `main` 当前脏改

- `AGENTS.md`
- `.spec/skills/git-operations/SKILL.md`
- `.spec/knowledge/standards/asset-pipeline.md`
- `.spec/knowledge/README.md`
- `docs/automated-testing.md`
- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`

其中最后两处已在另一份审计里明确判定为**错误落点残留，不再反向迁入 worktree**。

#### Fantasy Realms worktree 当前脏改

- Fantasy Realms 核心实现与 E2E
- 设计/规则文档
- `task_plan.md`
- `progress.md`
- 新 evidence 文档

这说明当前还处于“正确 worktree 继续收口中”，不是已经可直接无审查 merge 的干净态。

### 2. 当前证据已足以证明“worktree 是真相源”，但还不足以替代正式 merge 前整理

已验证的代表链：

- `npx vitest run src/games/__tests__/fantasyrealmsManifestIntegration.test.ts src/games/fantasyrealms/__tests__/Board.foundation.test.tsx src/games/fantasyrealms/__tests__/runtimeSkeleton.test.ts src/games/fantasyrealms/__tests__/ai.test.ts src/games/fantasyrealms/__tests__/officialCardData.test.ts`
  - `62 passed`
- `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts --grep "首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图"`
  - `1 passed`

但当前还没做的，是正式 merge 前的最后整理：

- 把 worktree 当前脏改收成清晰提交边界；
- 决定 `task_plan/progress/evidence` 是否全部回主线，还是只保留结果性 evidence；
- 决定共享支撑改动是否与 Fantasy Realms 本体同批回主线。

## 五、当前结论

当前最稳的口径是：

1. `fantasyrealms` worktree 现在已经是 Fantasy Realms 的唯一实现真相源；
2. 根目录剩余 `Board.tsx / Board.foundation.test.tsx` 只是错误落点残留；
3. 真正准备回主线的内容，必须至少分成：
   - Fantasy Realms 本体；
   - 为其成立所需的共享支撑；
   - 项目级规则冲突人工裁决；
4. 在这三类未正式分批收口前，**还不应直接执行最终 merge**。
