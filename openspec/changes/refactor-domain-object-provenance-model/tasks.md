## 1. Specification

- [ ] 1.1 在 `domain-core` 中补充统一决策上下文、稳定对象身份、跨边界 provenance、事件自足性要求
- [ ] 1.2 在 `domain-core` 中补充 deferred interaction 必须明确 live-state 与 snapshot 边界的要求
- [ ] 1.3 在 `engine-primitives` 中补充对象生命周期与交互描述 primitives 的复用要求

## 2. Design

- [ ] 2.1 设计统一的 session context / current actor 查询模型
- [ ] 2.2 设计统一的对象引用 / provenance value object / reify helper 模型
- [ ] 2.3 明确 transfer / attach / detach / control-change / zone-destination / deferred snapshot 的通用 seam
- [ ] 2.4 定义交互语义描述与 UI 展示模式分离的 contract
- [ ] 2.5 定义业务层允许传什么、禁止推断什么，避免继续扩散零散参数与 payload 猜测

## 3. Implementation

- [ ] 3.1 提供底层统一 helper，承接 current actor / 跨区对象重建 / provenance 保留 / deferred snapshot
- [ ] 3.2 迁移至少一类现有跨区对象链路到统一 seam
- [ ] 3.3 迁移至少一类现有 deferred interaction 链路到统一 snapshot seam
- [ ] 3.4 为“来源对象已不可见时仍能按 provenance 正确重建/归区”补回归测试
- [ ] 3.5 为“deferred interaction 不再依赖 live state / UI 不再由 payload 形状误判”补回归测试

## 4. Rollout

- [ ] 4.1 盘点现有各游戏所有高风险跨边界对象事件
- [ ] 4.2 盘点现有各游戏所有高风险 deferred interaction / snapshot / payload-driven UI 链路
- [ ] 4.3 制定分批迁移清单，避免一次性改散所有游戏
