## ADDED Requirements

### Requirement: 勇士派系必须逐对象审计

勇士派系 MUST 只有在 12 张卡牌和 2 个基地均有独立 L2 领域结论，并且每个交互 / 流程态对象有真实入口与图面证据后，才能标记为对象级完成。

#### Scenario: 代表链不能替代整派系证据

- **WHEN** 只有少量勇士代表卡牌的领域测试或截图通过
- **THEN** evidence MUST 继续把其它未覆盖对象标记为 `blocked` 或 `scoped-debt`
- **AND** 不得把代表链外推为勇士或 Munchkin 新派系整体完成
