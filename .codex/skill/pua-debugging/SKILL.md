---
name: pua-debugging
description: "BoardGame 的恢复/收敛路由 skill。遇到连续失败、反复返工或需要把问题转回项目 workflow 时使用；通用恢复逻辑优先走全局 pua。"
---

# Route To Global `pua`

这个 skill 用来把“卡住了”的任务路由回正确入口。

## 使用方式

- 通用“卡住了、失败两次以上、别再磨洋工”的恢复逻辑：直接使用全局 `pua`
- 进入具体任务后，再按场景回到项目 skill，例如：
  - Git / PR：`.codex/skill/git-operations/SKILL.md`
  - 部署：`.codex/skill/deploy-after-ci/SKILL.md`
  - 反馈收口：`.codex/skill/feedback-closeout/SKILL.md`
  - 移动端适配：`.codex/skill/adapt-game-mobile/SKILL.md`

## 目录原则

`pua` 属于跨任务、跨项目都成立的通用恢复能力，不该在 BoardGame 项目目录里再维护一整份副本。
