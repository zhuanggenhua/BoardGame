---
name: pua-debugging
description: "历史兼容入口。BoardGame 不在项目目录维护通用 PUA / recovery skill 副本；遇到连续失败时，直接使用全局 pua，再按具体任务回到项目 workflow。"
---

# Deprecated: Redirect To Global `pua`

这个文件保留只是为了兼容历史入口。

## 现在的正确做法

- 通用“卡住了、失败两次以上、别再磨洋工”的恢复逻辑：直接使用全局 `pua`
- 进入具体任务后，再按场景回到项目 skill，例如：
  - Git / PR：`.windsurf/skills/git-operations/SKILL.md`
  - 部署：`.windsurf/skills/deploy-after-ci/SKILL.md`
  - 反馈收口：`.windsurf/skills/feedback-closeout/SKILL.md`
  - 移动端适配：`.windsurf/skills/adapt-game-mobile/SKILL.md`

## 为什么不在项目里复制一份

`pua` 属于跨任务、跨项目都成立的通用恢复能力，不该在 BoardGame 项目目录里再维护一整份副本。
