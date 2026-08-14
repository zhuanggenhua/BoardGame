# Fantasy Realms 正式提交边界（2026-06-13）

> 历史过程说明：
> 本文记录的是当时为了形成“一份可提交的专项边界”所做的过程裁定。
> 它不是今天的实施指令，也不等于今天应直接提交、继续回主线，或按本文清单直接 staging。
> 今天若只看当前正式产品真相，应优先看 `fr-merge-pass2-*` 真相图、活实现与活测试合同，而不是这份提交边界文档。

## 目标

把上一份 staging 边界进一步收成**当时的正式提交边界**，也就是：

- 如果当时要把当前 worktree 里的有效专项成果收成提交；
- 哪些文件应进入正式提交；
- 哪些文件继续只留在本地；
- 推荐按什么顺序收口。

## 结论先行

当前最稳的正式提交边界只有一份：

### 应进入正式提交的文件

#### 1. Fantasy Realms 本体

- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
- `src/games/fantasyrealms/domain/index.ts`
- `src/games/fantasyrealms/manifest.ts`
- `src/games/fantasyrealms/rule/幻想国度规则.md`
- `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
- `public/locales/zh-CN/game-fantasyrealms.json`
- `public/locales/en/game-fantasyrealms.json`

#### 2. 专项 E2E / helper

- `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- `e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts`

#### 3. 专项设计真相

- `design-system/games/fantasyrealms.md`
- `docs/games/fantasyrealms/design/README.md`

#### 4. 当前新增产品证据

- `evidence/fantasyrealms/fantasyrealms-duel-opening-online-flow-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-ui-room-entry-first-loop-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-full-flow-guidance-2026-06-13.md`

## 当前不进入正式提交的文件

### 1. 过程文件

- `task_plan.md`
- `progress.md`

### 2. merge 前裁决 / 审计 evidence

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
- `evidence/fantasyrealms/fantasyrealms-staging-boundary-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-worktree-dirty-set-audit-2026-06-13.md`

### 3. 当前不应继续作为专项正文提交的规则文件

- `design-system/game-ui/MASTER.md`
- `.spec/knowledge/standards/animation-effects.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `.spec/knowledge/standards/generated-design-implementation.md`
- `.spec/knowledge/standards/ui-ux.md`
- `docs/testing-best-practices.md`

原因：

- 这 6 个文件当前应以根目录 `main` 版本为基底；
- 本轮已经把 worktree 独有有效条目吸回根目录；
- 不应再让 worktree 版本整份反向覆盖回来。

## 推荐收口顺序

### Step 1：先只收专项正文

只收：

- 本体
- E2E / helper
- 专项设计真相
- 3 份产品证据

这一步的目标是先得到一份**不掺过程文件、不掺项目级规则冲突**的专项成果边界。

### Step 2：继续让规则冲突留在主线侧处理

项目级规则继续按这条口径处理：

- 根目录 `main` 为基底
- 保留本轮已经吸收进去的新增条目
- worktree 不再承担这些文件的最终真相角色

### Step 3：过程审计继续只留本地

当前这一批审计 / 裁决 / merge 准备 evidence，继续只承担：

- 当前 worktree 推进记录
- merge 前证据链

不承担最终产品正文角色。

## 机器可执行清单

配套路径清单文件：

- 正式提交边界：
  - `evidence/fantasyrealms/fantasyrealms-formal-commit-paths-2026-06-13.txt`
- 本地保留边界：
  - `evidence/fantasyrealms/fantasyrealms-local-only-paths-2026-06-13.txt`

## 当前结论

到这一步，当前 worktree 已经不只是“知道哪些文件大概有价值”，而是：

1. 已经有一份**正式提交边界**
2. 已经有一份**不进提交的本地保留边界**
3. 已经把项目级规则冲突从专项正文里隔离出去

下一步如果继续推进，就不再是“判断提交什么”，而是决定是否把这份正式提交边界真的收成当前专项提交。

## 2026-06-13 dry-run 校验

已按 `git status --porcelain=v1 -z` 重新核对当前 worktree 的真实脏改集合：

- 跟踪文件使用 `git -c core.quotePath=false diff --name-only`；
- 未跟踪文件使用 `git ls-files --others --exclude-standard`；
- 正式提交清单里的路径都能命中当前真实改动；
- 本地保留清单已补齐这 3 个过程产物：
  - `fantasyrealms-formal-commit-boundary-2026-06-13.md`
  - `fantasyrealms-formal-commit-paths-2026-06-13.txt`
  - `fantasyrealms-local-only-paths-2026-06-13.txt`
- 除 7 个已知换行噪音文件外，当前未再出现新的“边界外脏改”。
