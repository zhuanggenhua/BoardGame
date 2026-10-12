# Change: 建立 Fate/Domination 机制兼容运行框架

## Why

Fate/Domination 的基础运行时已经有阶段、移动、资源、卡牌选择和代表性战斗骨架，但真实卡面还会继续带来响应、替代、防止、持续修正、隐藏信息、多步选择、嵌套结算和跨区对象变化等机制。当前仓库已有这些能力的零散实现：Mage Wars 的能力/响应、Cardia 的效果宿主与卡牌操作、七大恨的多步选择与战斗承诺、Smash Up 的触发链与持续效果，但它们不能直接成为 Fate 的第二套规则内核。

本 change 先建立 Fate 可消费的机制框架和接入边界，把通用引擎原语、系统状态、游戏专属规则与数据录入合同分开。设计稿继续进行不阻塞领域框架设计；本 change 不把设计稿视觉结构写进规则内核。

## What Changes

- 建立 Fate/Domination 的重点机制矩阵，覆盖基础阶段、资源、卡牌、能力、响应、持续效果、规则改写、卡牌/能力复制、控制权变化、隐藏信息、战斗和终局；不以少量抽样代替关键机制族覆盖。
- 复用现有 `AbilityDef`、`AbilityRegistry`、`TimingPoint / Opportunity`、`ChoiceRequest`、`ResponseWindow`、`ResolutionFrame`、effect application gateway、modifier 和 provenance 原语；禁止为 Fate 再造平行 DSL、平行 pending 主链或平行能力注册表。
- 设计 Fate 专属 domain adapter：把御主/从者/攻击/局势/事件/令咒/魔力/地点/战斗语义映射到共享框架。
- 规定 `G.core` 只保存规则事实，`G.sys` 保存交互、响应、撤回、日志和结算阻塞；UI/AI/动画消费同一份派生合同。
- 提供第一批可实现的 pilot 顺序：两张攻击牌 → 战斗修正 → 局势/事件修正 → 从者/御主能力 → 规则改写与复制上下文 → 响应与替代 → 淘汰/终局。
- 不在本 change 中改设计稿、Board 视觉、素材落盘或完成全部卡牌效果。

## Impact

- Affected specs:
  - `fate-domination-mechanism-framework`（新增）
  - `fate-domination`（后续实现消费）
  - `domain-core`、`engine-primitives`、`interaction-system`、`resolution-stack`（只补接入约束，不在本草案直接改共享实现）
- Affected code after approval:
  - `src/games/fate-domination/domain/**`
  - `src/games/fate-domination/data/**`
  - 必要时扩展 `src/engine/primitives/**` 与 `src/engine/systems/**`
- Not changed in this draft:
  - `Board.tsx`、设计稿、正式素材发布、runtime 全量卡牌实现

## Approval Gate

本 change 已获明确批准，当前进入 runtime pilot：先落地已锁定的移动/地点规则查询、共享移动原语与复制上下文原语；复制/借用卡牌的 Fate 具体消费、响应、替代和完整卡牌消费仍按后续阶段推进。
