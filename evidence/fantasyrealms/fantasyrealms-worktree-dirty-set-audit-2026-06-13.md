# Fantasy Realms 当前 worktree 脏改集合审计（2026-06-13）

> 历史过程说明：
> 本文记录的是当时为了区分“真实内容差异”和“工作树状态噪音”所做的过程审计。
> 它不是今天的实施指令，也不等于今天应继续执行回主线、执行 merge，或按本文直接操作当前文件集合。
> 文中出现的“待合回内容 / 回主线”都应理解为当时的过程上下文，而不是今天的当前动作。

## 目标

审清 `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms` 当前未提交集合里，哪些是**真实内容差异**，哪些只是工作树状态噪音，避免后续回主线时把无内容差异误算进“待合回内容”。

## 现场

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 分支：`feat/game-fantasyrealms`

## 一、当前真实未提交内容差异

当前 `git diff --name-only` 的真实集合是：

### 1. Fantasy Realms 本体与验证

- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
- `src/games/fantasyrealms/domain/index.ts`
- `src/games/fantasyrealms/manifest.ts`
- `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
- `public/locales/zh-CN/game-fantasyrealms.json`
- `public/locales/en/game-fantasyrealms.json`
- `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- `e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts`
- `src/games/fantasyrealms/rule/幻想国度规则.md`

### 2. 设计 / 规则 / 项目门禁

- `design-system/game-ui/MASTER.md`
- `design-system/games/fantasyrealms.md`
- `.spec/knowledge/standards/animation-effects.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `.spec/knowledge/standards/generated-design-implementation.md`
- `.spec/knowledge/standards/ui-ux.md`
- `docs/games/fantasyrealms/design/README.md`
- `docs/testing-best-practices.md`

### 3. 过程计划与进度

- `task_plan.md`
- `progress.md`

### 4. 当前新增 evidence 文档

- `evidence/fantasyrealms/fantasyrealms-duel-opening-online-flow-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-full-flow-guidance-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-main-return-audit-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-root-mischange-absorption-audit-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-ui-room-entry-first-loop-2026-06-13.md`

## 二、当前 `git status` 里显示已改，但**没有内容 diff** 的状态噪音

下列文件当前 `git status` 显示 `M`，但：

- `git diff --raw -- <path>` 无输出
- `git diff --ignore-cr-at-eol --name-only -- <path>` 无输出
- `git ls-files --eol` 显示 `i/lf w/mixed`

因此它们当前应判定为**工作树换行风格噪音**，不是本轮真实内容改动：

- `src/components/home-v2/GameDetails.tsx`
- `src/components/lobby/GameDetailsModal.tsx`
- `src/components/lobby/RoomList.tsx`
- `src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts`
- `src/components/lobby/__tests__/RoomList.expansionSummary.test.tsx`
- `src/engine/ai/localMatchPreferences.ts`
- `src/engine/ai/__tests__/localMatchPreferences.test.ts`

当前证据：

- index：`i/lf`
- working tree：`w/mixed`

这说明当前它们不是“本轮还没看完的业务改动”，而是工作树文本换行状态不一致。

## 三、当前直接结论

1. 回主线前真正要处理的**真实未提交集合**只有上面的 Fantasy Realms 本体、规则文档、计划进度和新增 evidence。
2. `lobby/home-v2/localMatchPreferences` 这 7 个文件当前不应再算作“待裁决业务改动”，它们只是 `mixed line endings` 噪音。
3. 后续若继续做回主线收口，应以本审计列出的真实 diff 集合为准，而不是直接抄 `git status` 的全部 `M`。

## 四、当前验证

- `git diff --name-only`
- `git diff --stat`
- `git diff --raw -- <suspect paths>`
- `git diff --ignore-cr-at-eol --name-only -- <suspect paths>`
- `git ls-files --eol <suspect paths>`
- `npx eslint src/games/fantasyrealms/Board.tsx src/games/fantasyrealms/__tests__/Board.foundation.test.tsx` -> `passed`
- `npx vitest run src/games/fantasyrealms/__tests__/Board.foundation.test.tsx` -> `32 passed`
