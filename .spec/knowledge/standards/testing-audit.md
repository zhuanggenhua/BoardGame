---
name: testing-audit
description: 测试审计总入口：审计路由、证据边界和旧分卷兼容——做规则或玩法审计时查
metadata:
  type: doc
  status: 已交付
---

# 测试与审计入口

## 角色

本文件是 `index / adapter`，不承载独立审计规则正文。规则、玩法和机制审计的项目级主源是 [`description-to-implementation-audit.md`](description-to-implementation-audit.md)。

旧 `testing-audit-core-principles.md`、`testing-audit-dimensions*.md` 和 `game-audit-workflow/references/*` 曾承载大量细表、D 编号和单游戏案例；现在只保留兼容入口，不能作为新的执行清单继续扩写。

## 审计时先选主源

| 目标 | 主源 | 说明 |
| --- | --- | --- |
| 查规则、技能、卡牌、状态、阶段或玩法实现是否吃对规则 | [`description-to-implementation-audit.md`](description-to-implementation-audit.md) | 默认基准；从权威语义追到消费点和最终状态 |
| 查玩家反馈的规则 bug、合同是否锁定、是否要回图面 | [`rule-contract-audit.md`](rule-contract-audit.md) | 先消费已有录入合同；合同缺失或冲突才回录入流程 |
| 写审计 evidence、降级旧结论、声明已收口 | [`audit-evidence-template.md`](audit-evidence-template.md) | 只定义证据字段、结论等级和自检边界 |
| 跑 E2E、截图、视觉或真实入口证据 | [`e2e-verification.md`](e2e-verification.md) | E2E 只证明真实入口和可见结果，不反推规则真相 |
| 推导权限、响应窗口、Choice Request、AI 合法动作 | [`rule-driven-interaction-design.md`](rule-driven-interaction-design.md) | 交互授权和消费者同源的主源 |
| 处理回归、漏审复盘和同类扩审 | [`regression-closeout.md`](regression-closeout.md) | 回到原始症状、最后正常证据和根因分层 |

## 项目级审计口径

- 审计默认覆盖**本轮已锁定范围**，不是自动扩大到整批、全牌库或全仓库。
- 审计先判断现实缺口类别：`功能实现阻塞`、`语义不一致`、`当前范围验证缺口`、`审计留档缺口`、`非阻塞扩展`。
- `功能实现阻塞` 只用于规则对象、玩家合法动作、候选生成、资源消耗、流程态、共享消费者或最终权威状态确实错误的情况。
- `审计留档缺口` 只说明证据没有被总账消费、旧结论未回写或目录未索引；不能写成“功能没实现”。
- 代表链只能在触发时机、候选生成、交互入口、payload、resolver / handler 和最终权威状态都等价时复用；否则必须对象级审计。
- 旧 evidence 被当前代码、测试或新合同推翻时，必须原地降级或回写旧结论，不能另建一份新文档让旧结论继续误导。

## 禁止

- 禁止把旧 D 编号清单当成机械填表任务。
- 禁止把单游戏规则、卡牌名、骰面、基地、随从、房间、教程章节或历史事故写回项目级审计正文。
- 禁止用 `prompt/modal 出现`、按钮可点、截图目录存在、测试文件名或工具绿灯替代最终权威状态证明。
- 禁止把 evidence、截图说明、测试报告或复盘文档写成新的规范来源。

## 旧分卷处理

旧链接命中时：

1. 先读本文件和 [`description-to-implementation-audit.md`](description-to-implementation-audit.md)。
2. 若旧分卷里有仍然有效的抽象方法，把它抽象后迁入对应 canonical-source。
3. 若旧分卷只是单游戏案例、历史缺口或具体事故，把它下沉到 `evidence/`、`docs/games/<gameId>/...` 或对应游戏专项 workflow。
4. 若无法判断主从关系，停止在“规范冲突未收敛”，不要继续执行审计或实现。
