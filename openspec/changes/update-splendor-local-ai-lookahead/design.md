## Context
`splendor` 已经接入通用本地 AI 运行时，但其决策层仍保留一套 Splendor 私有的策略工厂。当前实现能完成基本对局，但在几个方面存在明显短板：

- `hard` / `expert` 没有复用公共 `lookahead` trace 协议
- 目标卡排序对“已预留高价值卡”保持不够稳定
- 宝石溢出与丢弃的代价没有进入主要评分链
- 困难难度前瞻只停留在 scorer 级别，没有统一的可见态投影入口

## Goals
- 保持现有 `legalActions` / `playerView` / pending-resolution 边界不变
- 将 `splendor` 的本地 AI 迁移到公共 `createLookaheadLocalAiPolicy`
- 让 `hard` / `expert` 能基于可见态投影评估动作后收益
- 强化目标卡、贵族、预留、拿宝石、丢弃与终局评分
- 保持当前测试语义与难度梯度不反转

## Non-Goals
- 不修改 `domain`、`engine/ai` 公共类型或全局难度模型
- 不实现跨回合 seat memory / true momentum
- 不引入 Softmax 或第二套动作选择协议
- 不预测真实 deck top 或对手隐藏信息

## Decisions

### 1. 继续以现有 `legalActions` 为唯一根动作集合
Splendor AI 只消费 `buildSplendorAiLegalActions` 生成的动作。公开买、公开预留、牌堆预留、强制弃牌、强制选贵族全部沿用现状，不新增私有动作模型。

### 2. `hard` / `expert` 只做可见态 projection
投影状态只基于 `visibleState` 推导，不读取真实 deck 顺序或对手隐藏预留。对 `reserve-deck` 的未来价值评估保持保守，只使用 tier 期望，不把 hidden placeholder 反解成真实卡。

### 3. `expert` 的第二层前瞻定义为“合成 self follow-up”
`expert` 不模拟对手回合。它在动作投影后，基于“若轮到自己再次行动且棋盘公开信息不变”的前提，生成一组 follow-up 动作并评估 top 4，用折扣分回灌当前动作。

### 4. 动量改为无状态近似
不扩展公共 AI 框架做 seat memory。本次只使用当前可见状态近似“连贯性”：

- 已预留目标卡
- 当前红利结构
- 当前手里宝石结构
- 当前目标卡集合

## Risks / Trade-offs
- 只做可见态投影会低估 `reserve-deck` 的真实收益，但能守住 hidden-info 边界
- `normal` 为兼容现有测试，仍保留有限的对手阻止语义，而不是完全无干扰
- scorer 与 projection 同时增强后，难度梯度可能抖动，需要对现有 AI-vs-AI 基准回归

## Validation Plan
- 保持现有 `src/games/splendor/__tests__/ai.test.ts` 通过
- 增加针对目标卡偏置、discard 偏好、projected hidden-state 保守性、hard/expert trace 的单测
