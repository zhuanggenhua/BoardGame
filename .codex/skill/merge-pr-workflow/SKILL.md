---
name: merge-pr-workflow
description: "BoardGame PR 合并流程。用于合并 PR/分支、冲突处理、合并后校验和文档记录；覆盖预检查、冲突解决与回归登记。"
---

# PR 合并工作流（BoardGame）

## 概览
按仓库规范执行 PR 合并：自动发现目标 PR 分支、预检查、合并/冲突处理、审计与验证，并输出可追溯汇报。

## 必读/引用
- **必须先读**：仓库根目录 `AGENTS.md`（遵守分支/验证/提交要求）
- **合并规则参考**：本技能引用 `references/git-merge-checklist.md`（从 `docs/git-merge-checklist.md` 归档）

## 默认行为（减少追问）
> 除非被“权限门禁/预警阈值/合并冲突”阻塞，否则不要反复向用户询问分支或 PR 细节。

0) **工作树选择（主分支不干净时）**
- 判定“主分支工作区不干净”：`git status --porcelain` 非空，或存在合并中状态（如 `MERGE_HEAD`）。
- 若不干净：优先复用已存在的合并工作树；若不存在现成合并 worktree，且当前任务就是 PR 合并/冲突处理，**允许新建隔离合并 worktree**，不要因为“主工作区脏”直接卡死流程。
- 选择规则：`git worktree list` 中按以下优先级选一个路径：
  1. 分支名匹配 `pr-merge-main` 或 `pr-merge-*`
  2. 路径名包含 `merge`
- 若未发现合并工作树：按 `pr-merge-<编号或主题>` 创建新的隔离 worktree，并在最终汇报中写明路径与职责。
1) **目标 PR 选择（默认合并所有未合并 PR）**
- 若用户明确给出 PR 号/分支名，直接使用该单个 PR。
- 否则默认：合并**所有未合并 PR**，按数字升序执行。
  - 远端：`git branch -r --no-merged origin/main "origin/pr-*"`
  - 本地：`git branch --no-merged main "pr-*"`
  - 合并集合去重后，对同号分支优先远端 `origin/pr-*`。
- 若不存在 `pr-*` 分支，报告“未发现 PR 分支”并停止。

2) **目标分支**
- 默认合并到当前分支。
- 若需要切到 `main`：**可直接切换**（不再要求额外授权）。

2.5) **跨仓库 PR 写权限门禁（强制）**
- 若目标 PR 来自 fork / 跨仓库：
  - 必须先确认当前执行身份对 `head repo` 的真实权限
  - **不能只凭** `maintainerCanModify=true` 就假定后续可 push 回原 PR
- 判定优先级：
  1. GitHub API 的 `permissions.push`
  2. 实际 push 验证结果
- 若 `permissions.push=false` 或实际 push 失败：
  - 不再把“修复并推回原 PR”当默认路线
  - 直接切换到用户确认过的 fallback（例如把修复后的 PR 内容直接收口到主仓库可写分支）
  - 最终汇报里必须明确写“阻塞点是 head repo 真实不可写”
3) **远端同步**
- 默认执行 `git fetch --all --prune`（不切分支、不改历史）。

## 工作流（严格按顺序）

### A. 预检查（Pre-Merge）
对**每个**待合并 PR 按 `references/git-merge-checklist.md` 执行以下命令（记录输出）：

```bash
# 1) 提交与差异概览
git log --oneline --graph main...<pr-branch> -20

git diff --stat main...<pr-branch>

# 2) 变更统计
ADDED=$(git diff --diff-filter=A --name-only main...<pr-branch> | wc -l)
MODIFIED=$(git diff --diff-filter=M --name-only main...<pr-branch> | wc -l)
DELETED=$(git diff --diff-filter=D --name-only main...<pr-branch> | wc -l)

# 3) 关键文件删除检查
DELETED_TESTS=$(git diff --diff-filter=D --name-only main...<pr-branch> | grep -E '\\.(test|spec|e2e)\\.(ts|tsx)$' | wc -l)
DELETED_SCRIPTS=$(git diff --diff-filter=D --name-only main...<pr-branch> | grep -E '^scripts/.*\\.(mjs|js|ts)$' | wc -l)
DELETED_DOCS=$(git diff --diff-filter=D --name-only main...<pr-branch> | grep -E '\\.(md|txt)$' | wc -l)
```

**预警阈值触发即停止并汇报**（不可继续自动合并，且默认停止后续 PR）：
- 删除文件 > 50
- 删除测试文件 > 0
- 删除脚本 > 5
- 删除文档 > 20
- 分支落后 main > 50 提交

### B. 合并执行（Merge）
- 使用安全合并策略（不立即提交）：
```bash
git merge <pr-branch> --no-commit --no-ff
```

### C. 冲突处理（如有）
- **逐冲突块裁决**，禁止整份单边覆盖。
- 若冲突涉及游戏核心规则、结算语义、交互口径、房规能力或公开信息边界，必须先对照规则书 / OpenSpec / 用户故事 / 证据文档判断语义真相；不能把“某边当前版本更新”当成业务裁决本身。
- 完成后必须产出冲突汇报文档：
  - 路径：`evidence/merge-conflict-<pr-branch>-<YYYY-MM-DD>.md`
  - 内容必须包含：冲突背景、冲突文件清单、逐块裁决、风险评估、验证结果、最终提交信息。
  - 若某文件命中高风险 UI/交互范围，或裁决策略实际采用了“某一边作为基线再局部补丁”，必须额外写文件级原因说明：为什么采用这一边、另一边哪些有效内容被放弃/迁移、判断错了最可能丢哪条用户行为。
  - 若两边改动代表不同业务含义且现有真相源不能裁定，必须停止自动合并，转人工/用户判断。

### D. 单边覆盖审计（强制）
合并提交后立即执行：
```bash
npm run merge:audit -- HEAD
npm run merge:audit:strict -- HEAD
```
若出现“完全等于父1/父2”，必须在冲突汇报中说明原因，未说明不可 push。
即使 `merge:audit` 没报“完全等于父1/父2”，只要文件层面的裁决本质上是“优先对齐某边当前版本”，仍按“实际采用单边基线”写明原因，不能只留一句策略摘要。

### E. 合并后验证（Post-Merge）
按仓库规范选择最小但足够的验证：
- **必跑（合并场景默认）：**
  - `npx tsc --noEmit`
  - `npx eslint src/ --ext .ts,.tsx`
- 若改动涉及 `server.ts` / `src/server/` / `src/engine/transport/server.ts` / `package.json dependencies`：
  - `npm run check:prod-deps`
- 功能/逻辑改动：
  - 依规范选择 `npm run test:games:core` / E2E（按 AGENTS.md 要求）

### F. 回归与行为变化登记（强制）
- 无论是否有冲突，都必须写：
  - 原 PR 目标问题
  - 本次额外发现的真实回归
  - 仅业务口径/规则变化
- 若存在冲突汇报文档，登记写入同一文档；否则在最终汇报中单列一节。

### G. 完成与关闭 PR（强制）
> **合并完成标准：PR 必须关闭。**
- 合并结果进入 `main` 并推送后，使用 `gh pr close <编号> --comment "已合并到 main"` 关闭 PR。
- 若 PR 已显示为 Merged，仅需关闭/确认状态，无需二次合并。

## 输出要求（给用户的最终汇报）
必须包含：
- 目标 PR 分支、合并命令
- 预检查结果摘要（含是否触发阈值）
- 冲突处理摘要（若有）+ 证据文档路径
- 单边覆盖审计结果
- 验证命令与结果
- 回归与行为变化登记结论

## 资源
- `references/git-merge-checklist.md`：合并清单与审计要求（来源 `docs/git-merge-checklist.md`）
