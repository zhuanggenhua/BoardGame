---
name: merge-pr-workflow
description: 用于本仓库 PR 合并全流程：当用户说“合并PR/合并分支/合并新PR/merge PR/同步PR”等需要执行 PR 合并、冲突处理、合并后校验与文档记录时使用。默认合并所有未合并 PR；主分支工作区不干净时自动切到已有合并工作树继续。覆盖预检查、冲突解决、单边覆盖审计、回归与行为变化登记、验证与汇报。
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
- 若不干净：**必须继续在已存在的合并工作树**处理，禁止创建新 worktree。
- 选择规则：`git worktree list` 中按以下优先级选一个路径：
  1. 分支名匹配 `pr-merge-main` 或 `pr-merge-*`
  2. 路径名包含 `merge`
- 若未发现合并工作树：汇报“缺少已存在的合并工作树，无法继续”，等待用户指示。

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
- 完成后必须产出冲突汇报文档：
  - 路径：`evidence/merge-conflict-<pr-branch>-<YYYY-MM-DD>.md`
  - 内容必须包含：冲突背景、冲突文件清单、逐块裁决、风险评估、验证结果、最终提交信息。

### D. 单边覆盖审计（强制）
合并提交后立即执行：
```bash
npm run merge:audit -- HEAD
npm run merge:audit:strict -- HEAD
```
若出现“完全等于父1/父2”，必须在冲突汇报中说明原因，未说明不可 push。

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
