## 1. Specification

- [x] 1.1 为 `betrayal-first-scenario-runtime` 补充“真实首剧本 runtime” delta。
- [x] 1.2 运行 `openspec validate update-betrayal-first-scenario-haunt-runtime --strict --no-interactive`。

## 2. Domain

- [x] 2.1 把 `first-scenario` 从占位 haunt 改成《Crimson Jack Returns》真实配置。
- [x] 2.2 增加首剧本所需的 haunt 状态、触发条件、叛徒/英雄目标和最小动作闭环。
- [x] 2.3 去掉“只要探索次数够了就能 COMPLETE_SCENARIO”的代表态结算规则。

## 3. UI

- [x] 3.1 运行时主界面支持 haunt 后的真实目标、当前侧别和关键动作入口。
- [x] 3.2 去掉把“结算剧本”当成正常运行时按钮的实现。
- [x] 3.3 保持 v4 版式不变，只补首剧本真实玩法语义，不重开布局。

## 4. Verification

- [x] 4.1 更新领域层 Vitest，覆盖 haunt 触发、叛徒死亡后杰克之灵出现、驱魔或团灭结算。
- [x] 4.2 更新首剧本 E2E，证明第一剧本不是靠代表态注入终局收口。
- [x] 4.3 跑 targeted ESLint / Vitest / Playwright。

## 5. Documentation

- [x] 5.1 更新 betrayal 文档，明确“代表态已废弃，当前首剧本走真实 haunt runtime”。
