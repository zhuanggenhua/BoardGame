# 旧审计红线兼容入口

> 角色：historical adapter。
>
> 本文件不再承载可执行审计红线。它保留路径，是为了让旧 skill、旧 evidence 和旧任务记录不悬空。

## 当前主源

| 旧红线主题 | 当前主源 |
| --- | --- |
| 审计不是录入、先消费已有合同、合同缺失时阻塞 | `.spec/knowledge/standards/rule-contract-audit.md`、`.spec/knowledge/standards/data-entry.md` |
| 描述到实现、功能缺口、语义一致性、最终权威状态 | `.spec/knowledge/standards/description-to-implementation-audit.md` |
| 审计缺口分类、旧结论回写、证据自检 | `.spec/knowledge/standards/audit-evidence-template.md` |
| 真实入口、E2E、截图和可见结果 | `.spec/knowledge/standards/e2e-verification.md` |
| 权限、响应窗口、Choice Request、AI 合法动作 | `.spec/knowledge/standards/rule-driven-interaction-design.md` |
| 回归、同类扩审和漏审归因 | `.spec/knowledge/standards/regression-closeout.md` |
| 教程是否教会玩家 | `.spec/knowledge/standards/tutorial-design.md` |
| UI 改动门禁和视觉审计 | `.spec/knowledge/standards/ui-change-gates.md`、`.spec/knowledge/standards/ui-ux.md` |

## 兼容规则

- 旧链接命中本文件时，先回到 `../SKILL.md` 和上表主源。
- 旧红线里的具体游戏、卡牌、骰面、房间、教程章节、截图路径或历史事故，不得再迁回项目级审计正文。
- 若旧红线里有仍需保留的方法，必须先抽象成跨游戏问题，再迁入对应 canonical-source。
