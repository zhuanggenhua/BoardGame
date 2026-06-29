# Design: 山屋惊魂真实首剧本 runtime

## Context

现有 `first-scenario` 只是一个“可切三屏”的代表态，不是真正的《Crimson Jack Returns》：
- 没有 `A Splash of Crimson` 触发后的 haunt 切换；
- 没有叛徒揭示、杰克之灵释放和驱魔动作；
- 没有真实输赢条件，只有手工 `COMPLETE_SCENARIO`。

## Goals

- 让第一剧本至少形成一条真实可玩的剧本链，而不是截图链。
- 保持现有 `scenarioConfig + game.ts + Board.tsx` 的数据驱动方向，不新起一套临时页面。
- 先把第一剧本本体跑通，再为后续教程提案提供真实玩法基线。

## Non-Goals

- 本轮不实现完整通用 combat engine。
- 本轮不实现全部 50 个 haunt 或完整 scenario card 体系。
- 本轮不改 v4 视觉总布局，只补真实剧本动作和状态。

## Decisions

- Decision: 在现有 `preHaunt / endgame` 之间新增正式 `haunt` 阶段。
- Decision: 首剧本所需的 haunt 规则先以“剧本特有最小闭环”实现进 `betrayal`，由 `scenarioConfig` 提供配置，不把当前最小实现冒充成完整通用战斗系统。
- Decision: 运行时不再提供“直接结算剧本”按钮；终局只能由首剧本规则推进得到。
- Decision: E2E 继续按分段合同写，但“第一剧本”用例必须至少覆盖一次真实 haunt 触发和一次真实剧本结算。

## Risks / Trade-offs

- 风险：当前 Board 有本地预演状态，新增 haunt 动作后容易再次出现“dispatch 一套、本地预演一套”的双真相。
- Mitigation: 规则状态只允许写入 `G.core`；Board 本地状态只保留选中卡、预览开关、移动选目标等 UI 临时态。
