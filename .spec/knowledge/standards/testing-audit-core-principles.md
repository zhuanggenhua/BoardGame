---
name: testing-audit-core-principles
description: 历史归档：旧测试审计原则分卷，当前只作兼容入口——旧链接命中时查
metadata:
  type: doc
  status: 历史归档
---

# 旧测试审计原则分卷

## 当前状态

本文件不再承载可执行审计正文。它保留路径，是为了让旧 evidence、旧任务记录和旧链接不悬空。

新的审计基准已经收束为：

- [`description-to-implementation-audit.md`](description-to-implementation-audit.md)：规则 / 玩法 / 机制审计主源。
- [`rule-contract-audit.md`](rule-contract-audit.md)：规则 bug 与录入合同裁定。
- [`audit-evidence-template.md`](audit-evidence-template.md)：审计 evidence 字段、结论等级和自检边界。
- [`e2e-verification.md`](e2e-verification.md)：E2E、截图、真实入口和可见结果证据。
- [`rule-driven-interaction-design.md`](rule-driven-interaction-design.md)：权限、响应窗口、Choice Request 和 AI 合法动作。

## 迁移原则

- 抽象方法可以迁入主源，但必须压缩成“要回答什么现实问题”，不得保留机械填表口径。
- 具体游戏、卡牌、骰面、公共区对象、场地/区域、教程章节、截图路径和历史事故，只能进入对应游戏 evidence 或 `docs/games/<gameId>/...`。
- 旧 D 编号、旧 L0-L4 表和旧矩阵可以作为历史证据里的定位语言，但不能成为新的项目级完成定义。
- 如果某条旧规则仍有价值，先判断唯一 canonical-source，再迁移；不要在本文件继续补丁式扩写。

## 兼容用法

旧文档引用本文件时，按下面翻译：

| 旧说法 | 当前对应 |
| --- | --- |
| fail-close / 深审流程 / 完整流程矩阵 | [`description-to-implementation-audit.md`](description-to-implementation-audit.md) 的语义、消费、功能结果、交互可用性和共享影响 |
| 旧 L0-L4 证据层级 | [`audit-evidence-template.md`](audit-evidence-template.md) 的真相源、语义、消费、结果、真实入口和证据边界 |
| 旧 D 维度 | [`testing-audit-dimensions.md`](testing-audit-dimensions.md) 的历史编号对照；新审计不要求按编号填表 |
| 旧 evidence 回写 | [`audit-evidence-template.md`](audit-evidence-template.md) 和 [`regression-closeout.md`](regression-closeout.md) |
