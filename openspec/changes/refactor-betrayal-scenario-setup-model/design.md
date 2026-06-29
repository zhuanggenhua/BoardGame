# Design: 山屋惊魂剧本与起局配置模型收口

## Context

当前 `betrayal` 的首剧本实现已经证明 UI 和领域链路可跑，但 setup 真相仍然混杂在 `game.ts`：
- `EXPLORER_CATALOG` 同时承担角色身份与起始持有物；
- `ROOM_LAYOUT` 同时承担公共起始房间与当前局结果态；
- `ROOM_DISCOVERY_POOL` / `DRAW_POOL` 是随机池，但和 runtime 结果态没有清晰分层。

规则真相显示：
- 恶兆前公共 setup 包括三张起始房间、其余房间洗成一叠、探索者放在 Entrance Hall；
- Scenario card 决定本局 haunt/动机；
- haunt 后各剧本再注入特定 token、物品、怪物与 turn order。

## Goals

- 明确 `全局 setup / 角色模板 / 剧本配置 / 随机池 / runtime result` 的 owner 边界。
- 让首剧本继续可跑，同时为后续多个剧本留出正式配置入口。
- 不重开 Board 视觉语义，只替换其底层真相来源。

## Non-Goals

- 本轮不实现完整 5 张官方 scenario 卡选择 UI。
- 本轮不接完整 haunt 书/叛徒书的全部剧本规则。
- 本轮不重做 room atlas 或完整房间牌目录录入。

## Decisions

- Decision: 新增 `scenario config` 层，至少承载当前首剧本的 id、haunt 标识、起局覆写、结算规则入口；后续所有剧本都必须复用同一条配置入口，而不是再新增 `START_FIRST_SCENARIO` 这类一次性命名。
- Decision: 剧本配置不只承载“起局给什么”，还要承载剧本自己的运行策略，例如结算时谁算叛徒、谁算幸存者、最低奖励下限，以及用于代表态 / E2E 的怪物预演数据；这些都不能继续散落在通用 helper 或 `execute()` 默认分支里。
- Decision: 保留 `explorer catalog` 作为长期身份数据，只包含长期不变属性；起始持有物与起始站位移出角色模板。
- Decision: 把房间系统拆成 `starting tile layout`、`room discovery pool`、`runtime discovered rooms` 三层；当前 UI 继续消费 runtime rooms。
- Decision: 现有首剧本仍允许使用精简的代表态规则，但必须显式写成剧本配置，不再散落在默认常量和 reducer 分支里。

## Risks / Trade-offs

- 风险：当前 first-scenario tests 依赖硬编码房间/持有物，重构后需要一起更新。
- Mitigation: 先保持同一条首剧本体验语义，再逐步纠正不符合规则的起局细节，并用定向测试锁住。
