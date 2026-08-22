---
name: merge-pr-workflow
description: "BoardGame PR 合并流程。用于合并 PR/分支、冲突处理、合并后校验和文档记录。"
---

# PR 合并工作流

## 职责边界

- 本 skill 是 PR / 分支合并的执行入口。
- 日常提交、推送、pre-push 阻塞和普通 Git 操作走 [`git-operations`](../git-operations/SKILL.md)。
- 分支 / worktree 目标锁定以上位标准 [`worktree-branch-target-lock`](../../knowledge/standards/worktree-branch-target-lock.md) 为准。
- 用户需要判断“保留哪边 / 是否都保留”时，转 [`merge-decision-package`](../merge-decision-package/SKILL.md)；本 skill 不复制用户决策包。
- 合并命令、统计阈值、冲突裁决和审计细节只维护在 [`references/git-merge-checklist.md`](references/git-merge-checklist.md)。

## 开始前

先锁定：

- 目标 PR / 分支。
- 目标基线分支和当前所在工作区。
- 当前工作树是否干净，是否存在合并中状态。
- 是否已获得创建 / 切换 / 删除分支或 worktree 的明确授权。
- 当前身份是否能 push 到目标远端；跨仓库 PR 不得只凭页面字段推断权限。

前提未锁定时，只能读取、统计和汇报，不得开始合并、切分支、创建 worktree 或 push。

## 默认目标

- 用户给出 PR 号 / 分支名：只处理该 PR。
- 用户未指定：默认扫描 `pr-*` 未合并分支，按编号升序处理。
- 默认合并到当前分支；需要切到 `main` 或其它分支时，先说明目标、影响和脏工作区风险，等用户明确授权。

主工作区不干净时，优先复用当前已授权、已存在且目标匹配的合并 worktree；没有可用现场时，向用户请求创建隔离 worktree / 清理当前工作区 / 暂停的明确授权。

## 合并顺序

1. 读 [`references/git-merge-checklist.md`](references/git-merge-checklist.md)。
2. 执行预检查：共同祖先、真实删除、旧分支漂移、冲突预测、权限和停止阈值。
3. 阈值未触发且权限已锁定后，执行 `git fetch --all --prune` 和 `git merge <branch> --no-commit --no-ff`。
4. 有冲突时逐文件、逐块裁决；不得整份接受 ours / theirs 替代语义判断。
5. 冲突解决后写 `evidence/merge-conflict-<pr-or-branch>-<YYYY-MM-DD>.md`。
6. 运行合并审计：`npm run merge:audit -- HEAD` 与 `npm run merge:audit:strict -- HEAD`。
7. 按改动范围运行验证：类型、lint、相关测试、E2E、spec lint、资源发布与远端回查。
8. push 后关闭或确认 PR 状态；PR 未关闭时不得说合并完成。

## 关键裁决

- `git diff main...branch` 显示的删除不等于 PR 作者删除；必须先看共同祖先到 PR head 的真实改动。
- 旧分支缺少主线后来新增的测试、规范、证据和资源时，默认保留主线内容。
- 共享文件大范围差异时，从最新主线出发，只提取 PR 从共同祖先以来真实新增或有意修改的块。
- 游戏规则、公开信息、交互权限、结算时机或资源发布冲突，必须回查规则源、OpenSpec、用户故事或 evidence；代码版本新旧不能单独裁决业务语义。
- 两边都可能有效且真相源不能裁定时，停止自动合并，转用户决策包。

## 验证口径

默认至少验证：

```bash
npx tsc --noEmit
npx eslint src/ --ext .ts,.tsx
```

追加规则：

- 规则 / 引擎 / 游戏逻辑：跑相关单测、集成测试或 E2E。
- 规范 / skill / knowledge：跑 `npm run spec:lint` 并扫过期入口和第二套规范。
- 运行时资源：按 [`asset-pipeline`](../../knowledge/standards/asset-pipeline.md) 发布和远端回查。
- 冲突合并：合并审计必须通过，且没有未解释的单边覆盖。

任一验证失败，只能称为“合并候选处理到某阶段”，不能宣告 PR 完成。

## 最终汇报

必须包含：

- 目标 PR / 分支和合并目标。
- 预检查结果：真实删除、旧分支漂移、权限和是否触发阈值。
- 冲突处理摘要和 evidence 路径。
- 合并审计结果。
- 验证命令与结果。
- push / PR close 真实结果。
- 仍阻塞的现实影响和最小补救动作。
