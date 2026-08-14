---
name: testing-audit-dimensions-deferred-interaction
description: 延迟交互审计维度：deferred、finalize 和后续选择链——审计延迟结算时查
metadata:
  type: doc
  status: 已交付
---

# 测试审计 D 维度细则：延迟交互

> 来源：从 .spec/knowledge/standards/testing-audit-dimensions.md 无损拆出。交互上下文快照、延迟事件补发和跨阶段交互收口相关细则；正文可引用其他 D 编号作为交叉门禁。

**D35 交互上下文快照完整性（强制）**（新增/修改 `continuationContext`、跨阶段交互、基地计分后交互，或修"交互解决后找不到原对象/找到错对象"时触发）：交互创建时是否保存了 handler 真正需要、且在交互解决前可能变化的上下文。**核心原则：snapshot 负责“记住当时的上下文”，不负责充当事务真相源。凡是 handler 在稍后解决时仍要依赖、但中途可能被清场/换基地/替换/动态刷新改变的数据，都必须显式快照；凡是 deferred actions / deferred events / finalize 控制状态，则必须回到唯一权威宿主，不得只塞进 snapshot。** 审查方法：
1. **列出 handler 读取项**：交互 handler 在解决时会读哪些数据？区分为“实体身份”“实体快照”“事务状态”三类
2. **实体身份稳定性检查**：若交互会跨基地清场、基地替换、列表收缩、实体离场后再解决，不能只存 `baseIndex`/`cardUid` 这类易失引用；必须同时保存稳定标识（如 `baseDefId`、`ownerId`、必要的快照字段）
3. **快照充分性检查**：handler 需要的力量值、owner、defId、来源类型、候选列表基线等，是否都在创建交互时快照？不能指望解决时再从活体状态“临时现查”
4. **快照与事务宿主分离**：`continuationContext` 只保存 handler 所需上下文，不得把本应由 `session` / `frame` / `core` 持有的 deferred 状态偷偷塞成唯一来源；否则 finalize/后续系统会读不到
5. **重定位策略检查**：需要跨时序重新定位实体时，handler 是否先按稳定标识回找活体对象，再 fallback 到仍有效的位置索引；纯按钮确认类交互不要无脑塞无用标识，避免引发 D34 的 UI 误判
6. **测试要求**：至少覆盖一次“创建交互后，中途发生基地替换/清场/候选变化，再解决交互”的路径，确认 handler 仍命中正确对象

**D36 延迟事件补发的健壮性（强制）**（新增/修改 deferred events、deferred actions、交互补发、finalize 收口，或修"交互结束了但后续没发生"时触发）：延迟事件/动作的补发与最终消费是否建立在稳定的框架契约上。**核心原则：延迟事件可以延后，但不能失忆。框架层必须保证 deferred 状态沿交互链、session-first 链路、finalize 链路完整传递，且最终由同一权威宿主被消费。** 审查方法：
1. **识别 deferred 状态**：列出本轮机制的 `_deferredPostScoringEvents`、`deferredActions`、`pendingPostScoringActions`、`waitForFinalize` 等延迟状态及其创建点
2. **检查补发触发条件**：补发逻辑是否依赖 handler 注册成功、`sourceId` 存在、某个 UI 分支命中、某个可选上下文字段存在等脆弱条件？若依赖这些条件 = 高风险
3. **检查链式传递**：多个交互串联时，deferred 状态是否沿交互链传递到下一个交互，还是在中途被覆盖/清空/遗忘
4. **检查 session-first 回写**：若交互解决后新产生 deferred actions，而最终消费方是 scoring frame / finalize，则必须在交互收口时回写 frame；不能只写 `core.pendingPostScoringActions` 就结束
5. **检查 finalize 消费一致性**：最终 `scoreBases` / `afterScoring` / settle 收口时，消费方是否读取与写入方同一份 deferred 状态；若读的是另一份影子字段，即使 prompt 正常也属于未修好
6. **回归测试要求**：不能只测“prompt 出现”“interaction resolved”；必须补“交互解决后 finalize 继续执行，并真实消费 deferred 状态”的整链测试
7. **时间戳兜底要求**：当 `scoreBases` / `afterScoring` 依赖的命令时间戳缺失、为 0 或不可用时，必须验证实现仍会写入有效延迟并继续走完整链路，不能因为来源时间戳异常就直接把延迟字段写空。
