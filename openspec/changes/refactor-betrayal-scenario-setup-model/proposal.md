# Change: 山屋惊魂剧本与起局配置模型收口

## Why

当前 `betrayal` 虽然已经能跑通一条首剧本黄金链，但 `game.ts` 仍把多种真相来源混在一起：
- 探索者模板里带了初始持有物；
- 房间起局结果态和可翻房间池直接写在同一文件常量里；
- 首剧本、公共 pre-haunt setup、随机抽牌结果态之间没有明确 owner 边界。

这会直接阻断“后续很多剧本，每个剧本各有特殊规则”的扩展，也不符合以规则为主、数据驱动可复用的目标。

## What Changes

- 为 `betrayal` 新增可扩展的 setup/source-of-truth 分层：`全局 pre-haunt setup`、`剧本配置`、`随机池/运行结果态`。
- 把探索者长期属性与剧本/起局状态拆开，不再让角色模板偷带错误 owner 的初始状态。
- 把房间与抽牌系统拆成 catalog/pool + setup/discovery rule + runtime result，避免把结果态硬写成默认真相。
- 在不重开 UI 布局的前提下，让现有首剧本链路继续跑在新模型上，为后续多剧本扩展留出正式落点。

## Impact

- Affected specs: `betrayal-scenario-setup-model`
- Affected code: `src/games/betrayal/**`, `docs/games/betrayal/**`, `design-system/games/betrayal.md`
- Verification: OpenSpec strict validation, targeted Vitest, targeted ESLint, existing betrayal basic-flow / first-scenario tests still pass after source-of-truth refactor.
