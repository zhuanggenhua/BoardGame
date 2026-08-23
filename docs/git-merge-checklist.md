# Git 合并检查清单（旧入口）

本文只保留旧链接兼容。合并、冲突裁决、审计和 push 前验收的执行正文统一看项目 skill：

- 合并 workflow：[`merge-pr-workflow`](../.spec/skills/merge-pr-workflow/SKILL.md)。
- 合并检查细节：[`git-merge-checklist`](../.spec/skills/merge-pr-workflow/references/git-merge-checklist.md)。
- 分支、worktree、授权和回滚边界：[`worktree-branch-target-lock`](../.spec/knowledge/standards/worktree-branch-target-lock.md)。

## 保留结论

- 开始合并前先锁定目标 PR / 分支、基线分支、当前工作区、工作树状态和授权范围。
- 先用共同祖先拆开“PR 真实删除”和“旧分支落后主线造成的差异”；不要把当前 diff 里的删除直接当成作者意图。
- 冲突裁决单位是冲突块，不是整份文件；测试、规范、证据、资源、共享 UI 和规则实现默认双方都可能有效。
- 游戏规则、公开信息、交互权限、结算时机和业务口径冲突时，回查规则源、已批准规格、用户故事、测试或 evidence，不能只按哪边更新来裁决。
- 出现冲突并完成解决后，按项目 skill 写独立冲突汇报，并运行对应审计与验证；验证缺失时只能说“合并候选已处理到某阶段”。

旧版命令清单、阈值细节和长模板已迁入 `.spec` 主源；本文件不再维护第二套合并规范。
