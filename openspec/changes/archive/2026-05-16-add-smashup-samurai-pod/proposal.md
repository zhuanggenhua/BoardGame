# Change: 实现 Smash Up Samurai POD 版

## Why

当前项目里已经接入了多套 Smash Up POD 阵营，但 Samurai 仍只有基础版，导致英文阵营选择、POD 卡牌文案与 POD 基地池都缺少对应版本。
同时，现有 Samurai 玩法逻辑已经与 POD 勘误基本等价，适合按现有 POD 阵营模式补齐注册与可见性，而不再复制一套能力实现。

## What Changes

- 新增独立阵营 `SAMURAI_POD`，显式接入 20 张 POD 武士卡牌与 2 个 POD 基地。
- 复用现有 `samurai` 的 ability / ongoing / interaction / base ability alias，不新增 Samurai titan，也不扩展 duel 或 discard 引擎。
- 同步补齐 faction registry、factionMeta、locale、POD 基地池 variant 与相关测试。
- 调整英文阵营可见性：英文列表显示 `SAMURAI_POD`，基础版 `SAMURAI` 仅保留中文对照用途。

## Impact

- Affected specs:
  - `smashup-faction-registry`
- Affected code:
  - `src/games/smashup/data/`
  - `src/games/smashup/ui/`
  - `public/locales/`
  - `src/games/smashup/__tests__/`
