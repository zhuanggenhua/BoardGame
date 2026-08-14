---
name: pua-debugging
description: "BoardGame 恢复/收敛路由。用于连续失败、反复返工或把问题转回项目 workflow；通用恢复优先项目 pua。"
---

# Route To Project `pua`

这个 skill 用来把“卡住了”的任务路由回正确入口。

## 使用方式

- 通用“卡住了、失败两次以上、别再磨洋工”的恢复逻辑：直接使用项目 `.spec/skills/pua/SKILL.md`
- 进入具体任务后，再按场景回到项目 skill，例如：
  - Git / PR：`.spec/skills/git-operations/SKILL.md`
  - 部署：`.spec/skills/deploy-after-ci/SKILL.md`
  - 反馈收口：`.spec/skills/feedback-closeout/SKILL.md`
  - 移动端适配：`.spec/skills/adapt-game-mobile/SKILL.md`

## 目录原则

`pua` 的本项目正文是协作者的执行入口；系统版本只作后续人工比较的上游候选。
