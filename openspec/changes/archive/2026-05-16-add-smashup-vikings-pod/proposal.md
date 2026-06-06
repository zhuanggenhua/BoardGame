# Change: 实现 Smash Up Vikings POD 版
## Why

当前项目已经接入多套 Smash Up POD 阵营，但 Vikings 仍只有基础版，导致英文阵营列表、POD 文案与 POD 基地池未与当前 POD 主版本策略保持一致。
同时，现有 Vikings 玩法逻辑已经与 POD 勘误基本等价，更适合按现有 POD 模式补齐注册、文案与测试，而不是重复实现一套新的玩法逻辑。
## What Changes

- 新增独立阵营 `VIKINGS_POD`，显式接入 20 张 POD 维京人卡与 2 个 POD 基地。
- 复用现有 Vikings ability / interaction / ongoing / base ability alias，不新增 Vikings titan，也不扩展 ownership / boxed / buried 引擎。
- 同步补齐 faction registry、factionMeta、locale、POD 基地池变体与相关测试。
- 调整英文阵营可见性：英文列表显示 `VIKINGS_POD`，基础版 `VIKINGS` 仅保留中文对照用途。
## Impact

- Affected specs:
  - `smashup-faction-registry`
- Affected code:
  - `src/games/smashup/data/`
  - `src/games/smashup/ui/`
  - `public/locales/`
  - `src/games/smashup/__tests__/`
