## 1. Specification

- [ ] 1.1 在 `domain-core` 中补充稳定对象身份、跨边界 provenance、事件自足性要求
- [ ] 1.2 在 `engine-primitives` 中补充对象生命周期 primitives 的复用要求

## 2. Design

- [ ] 2.1 设计统一的对象引用 / provenance value object / reify helper 模型
- [ ] 2.2 明确 transfer / attach / detach / control-change / zone-destination 的通用 seam
- [ ] 2.3 定义业务层允许传什么、禁止推断什么，避免继续扩散零散参数

## 3. Implementation

- [ ] 3.1 提供底层统一 helper，承接跨区对象重建与 provenance 保留
- [ ] 3.2 迁移至少一类现有跨区对象链路到统一 seam
- [ ] 3.3 为“来源对象已不可见时仍能按 provenance 正确重建/归区”补回归测试

## 4. Rollout

- [ ] 4.1 盘点现有各游戏所有高风险跨边界对象事件
- [ ] 4.2 制定分批迁移清单，避免一次性改散所有游戏
