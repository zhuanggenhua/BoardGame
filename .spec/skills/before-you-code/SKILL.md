---
name: before-you-code
description: "BoardGame 动手前的渐进式上下文加载。修改项目代码、配置、规则数据、测试、正式文档或交付时使用，按小中大任务选择最少相关规范、workflow 和源文件。"
---

# Before You Code

先校准任务规模，再读最少必要上下文。不要把已读内容复述成任务回执，也不要无差别加载所有规范。

## 强制设计入口

只要本轮会新增或修改手写源码、测试、E2E、项目脚本、devtools 或运行时配置，必须先读 [`code-design`](../../knowledge/standards/code-design.md)。它是 BoardGame 项目内“六大基本原则 / 设计模式选择 / 反模式预防”的唯一执行主源；不能依赖个人系统目录、代码注释、旧 evidence 或局部设计文档来替代。

读完后先判断：本轮是新增 owner、扩展已有 owner、拆分 owner、迁移测试夹具，还是只做紧急最小修复。没有完成这个判断，不得把新能力、新测试组或大段 UI 直接追加到既有文件。

## 任务规模

| 规模 | 识别条件 | 读取深度 | 执行方式 |
| --- | --- | --- | --- |
| 小 | 只改一个独立文件，逻辑不跨模块 | 涉及手写代码 / 测试 / 工具时先读 [`code-design`](../../knowledge/standards/code-design.md)，再读直接相关规范、项目 workflow 与源文件 | 直接实施 |
| 中 | 涉及 2 至 5 个文件，或影响规则、UI、测试、数据、共享行为其中两项以上 | 涉及手写代码 / 测试 / 工具时先读 [`code-design`](../../knowledge/standards/code-design.md)，再读 [知识导航](../../knowledge/README.md)、全部命中标准、workflow 和关键源文件 | 先锁改动边界，再实施 |
| 大 | 多模块、多步骤依赖、系统架构或 AI 规范结构变更 | 读取 [`code-design`](../../knowledge/standards/code-design.md)、知识导航和相关入口后停止直接编码 | 先锁定对应入口；本 skill 只覆盖 AI 规范的加载和结构裁决 |

## 加载顺序

1. 根据用户目标和当前文件范围判定任务规模。
2. 若会改手写源码、测试、E2E、脚本、devtools 或运行时配置，先读 [`code-design`](../../knowledge/standards/code-design.md) 并完成 owner / 六大原则判断。
3. 从 [知识导航](../../knowledge/README.md) 选择直接相关的标准和项目 workflow。
4. 阅读所选 workflow 的 `SKILL.md`；只在它明确指向时继续读 references/ 分卷。
5. 阅读会被改动的关键源文件、接口和现有测试。
6. 小/中任务直接在已锁定范围内继续；大任务先锁定产品任务入口或 AI 规范结构入口，不在上下文不足时试改。

## 边界

- 简单的本地事实查询、用户明确限定的单文件只读查看、时间查询等不触发本 skill。
- 用户已指定正式流程、skill 或文档时，仍先用知识导航补齐其直接相关的项目标准，不改走平行流程。
- 规则正文只在各专项主源维护；本 skill 只决定读取深度和下钻顺序。
- 产品需求、提案和任务编排由它们自己的系统承担，不由本 skill 路由或校验。
