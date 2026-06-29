# Change: 山屋惊魂首剧本从代表态升级为真实 haunt runtime

## Why

当前 `betrayal` 虽然已经有“角色选择 -> 恶兆前运行时 -> 终局”的黄金链，但它仍然只是首剧本代表态：
- `first-scenario` 仍把《Crimson Jack Returns》写成 `饥饿` 占位；
- 运行时可以直接点“结算剧本”，没有真实 haunt 触发、叛徒揭示、杰克之灵出现和驱魔收口；
- E2E 只能证明三屏会切换，不能证明第一剧本本体已经成立。

用户本轮要求先完成“第一个真剧本”本身，再讨论教程，因此需要把当前代表态升级为真实首剧本 runtime。

## What Changes

- 让 `first-scenario` 对应真实剧本《Stacked Like Cordwood 2: Crimson Jack Returns》。
- 新增首剧本所需的最小真实阶段：haunt 触发、叛徒揭示、英雄特殊动作、杰克之灵释放、驱魔胜利/英雄全灭结算。
- 移除把“直接结算剧本”当成正式玩法入口的 UI 口径；终局必须来自真实首剧本推进。
- 更新 Vitest / E2E / 文档，使“第一剧本已完成”的证据回到真实剧本链路，而不是代表态截图。

## Impact

- Affected specs: `betrayal-first-scenario-runtime`
- Affected code: `src/games/betrayal/**`, `e2e/betrayal/**`, `docs/games/betrayal/**`, `public/locales/**/game-betrayal.json`
- Verification: OpenSpec strict validation, targeted ESLint, targeted Vitest, 分段 E2E（恶兆前进入 haunt、haunt 关键动作、第一剧本收口）
