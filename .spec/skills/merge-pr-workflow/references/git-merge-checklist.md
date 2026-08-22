# Git 合并冲突处理检查清单

本分卷只补充 [`merge-pr-workflow`](../SKILL.md) 的合并检查细节；分支、worktree、回滚和授权边界以仓库根 `AGENTS.md` 与 [`worktree-branch-target-lock`](../../../knowledge/standards/worktree-branch-target-lock.md) 为上位规则。

## 0. 先锁目标和权限

合并前必须锁定：

- 目标 PR / 分支、目标基线分支和当前所在工作区。
- 当前工作树是否干净，是否已有合并中状态。
- 本轮是否已经获得创建 / 切换 / 删除分支或 worktree 的明确授权。
- 当前身份是否能向目标远端 push；跨仓库 PR 不得只凭页面字段推断权限。

未锁定授权时，只能读取、统计和汇报；不得新建 worktree、切分支、开始合并或 push。

## 1. 拆开旧分支漂移和真实删除

不要把“当前主线相对 PR 分支显示删除”直接理解成 PR 作者删除。先计算共同祖先：

```bash
MERGE_BASE=$(git merge-base main branch-name)
git diff --name-status "$MERGE_BASE" branch-name
git diff --name-status "$MERGE_BASE" main
```

裁决：

- 第一条结果里的 `D` 才是 PR 作者实际删除的候选项。
- 第二条结果里主线新增、而旧 PR 分支没有的文件，属于旧分支漂移，默认保留主线内容。
- 共享文件大范围差异时，从最新主线出发，只提取 PR 从共同祖先以来真实新增或有意修改的块。
- 测试、规范、证据和资源默认保留；只有 PR 实际提交明确删除且有迁移、废弃或用户授权证据时，才允许删除。

## 2. 预检查命令

```bash
git log --oneline --graph main...branch-name -20
git diff --stat main...branch-name

git diff --diff-filter=A --name-only main...branch-name
git diff --diff-filter=M --name-only main...branch-name
git diff --diff-filter=D --name-only "$MERGE_BASE" branch-name

git merge-tree "$(git merge-base main branch-name)" main branch-name
```

需要单独统计：

- PR 实际删除文件数、删除测试数、删除脚本数、删除文档数。
- 分支落后主线提交数。
- 冲突预测中的共享核心、UI、规范、资源和测试文件。

## 3. 停止阈值

命中以下情况时停止自动合并并汇报：

- PR 实际删除文件超过 50 个。
- PR 实际删除测试文件。
- PR 实际删除脚本超过 5 个。
- PR 实际删除文档超过 20 个。
- 分支落后主线超过 50 个提交。
- 冲突含义需要用户裁定“保留哪边 / 是否都保留”。

仅由旧分支漂移造成的当前主线相对删除，不计入真实删除阈值，但必须进入内容提取审查。

## 4. 合并执行

只有目标、权限和工作区前提都锁定后，才执行：

```bash
git merge branch-name --no-commit --no-ff
```

需要更保守三方匹配时，可用：

```bash
git merge -X patience branch-name --no-commit --no-ff
```

执行后立即检查：

```bash
git status
git diff --name-status
git diff --name-only --diff-filter=U
```

## 5. 冲突裁决

冲突必须逐文件、逐块处理：

- 不得整份接受 ours / theirs 来替代语义判断。
- 先看共同祖先到 PR head 的真实意图，再叠到最新主线。
- 主线已有修复、测试、规范、证据和资源默认保留。
- 游戏规则、公开信息、交互权限、结算时机或资源发布冲突，必须回查对应规则源、OpenSpec、用户故事或 evidence；代码较新不等于语义正确。
- 两边都可能有效且现有真相源不能裁定时，停止并使用 `merge-decision-package` 让用户判断。

## 6. 冲突汇报

出现冲突并完成解决后，必须写：

`evidence/merge-conflict-<pr-or-branch>-<YYYY-MM-DD>.md`

最低内容：

- 背景：base/head、触发命令、共同祖先。
- 冲突文件清单：每个 `UU` 文件都列出。
- 逐文件策略：保留哪边、合并了哪些块、为什么。
- 文件级原因：若采用某边作基线，说明另一边有效内容如何迁移、放弃或判定失效。
- 风险：最可能丢失的用户可见行为、测试断言或规则语义。
- 验证：已跑 / 未跑命令、结果和未跑原因。
- 最终结果：commit hash、push 目标或仍阻塞的最小补救动作。

## 7. 合并后验证

默认至少运行：

```bash
npx tsc --noEmit
npx eslint src/ --ext .ts,.tsx
```

按改动范围追加：

- 规则 / 引擎 / 游戏逻辑：相关单测、集成测试或 E2E。
- 规范 / skill / knowledge：`npm run spec:lint`，并扫过期入口和第二套规范。
- 资源：按 [`asset-pipeline`](../../../knowledge/standards/asset-pipeline.md) 发布和远端回查。
- 冲突合并：`npm run merge:audit -- HEAD` 与 `npm run merge:audit:strict -- HEAD`。

验证失败时，合并不得宣告完成；汇报要写清现实影响、证据和最小补救动作。

## 8. 假设自检

禁止把以下线索当结论：

- 当前 diff 显示删除，所以 PR 一定删了文件。
- 出现冲突标记，所以冲突解决一定有问题。
- 文件数量减少，所以合并导致丢文件。
- 编译通过，所以语义合并正确。

必须用以下证据回查：

```bash
git ls-files
git show --stat HEAD
git diff <before> <after> --name-status
git diff <merge-base> branch-name
```

## 9. 完成口径

只有满足以下条件，才能说合并完成：

- PR 真实意图和旧分支漂移已拆开。
- 冲突裁决有证据，且没有未解释的单边覆盖。
- 必要验证已通过。
- 需要 push / close PR 的外部动作已经完成并回查真实结果。

任何一步缺失，都只能称为“合并候选已处理到某阶段”，不能宣告 PR 已完成。
