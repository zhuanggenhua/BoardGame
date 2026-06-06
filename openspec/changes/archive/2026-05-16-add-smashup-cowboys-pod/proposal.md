# Change: 实现 Smash Up Cowboys POD 版
## Why

当前项目已经支持多套 Smash Up POD 阵营，但 Cowboys 仍只有基础版，导致英文阵营列表、POD 卡文、POD 基地池与 POD 主版本策略不一致。
同时，Cowboys 的专属泰坦 `pecos_bill` 与其依赖的 duel 生命周期共享钩子尚未接入，无法完整覆盖 Oops 系列 POD 规则口径。
## What Changes

- 新增独立阵营 `COWBOYS_POD`，显式接入 20 张 POD 牛仔卡与 2 个 POD 基地。
- 新增共享泰坦 `pecos_bill`，归属基础 `COWBOYS`，并通过 POD titan fallback 复用给 `COWBOYS_POD`。
- 为 duel 生命周期补充共享 `onDuelStarted` / `onDuelResolved` 触发时机，以及 `Pecos Bill` 所需的最小 clash 延后支持。
- 同步补齐 faction registry、factionMeta、locale、POD 基地池变体与相关测试。
## Impact

- Affected specs:
  - `smashup-faction-registry`
  - `smashup-titan-deployment`
  - `smashup-duel-lifecycle`
- Affected code:
  - `src/games/smashup/data/`
  - `src/games/smashup/domain/`
  - `src/games/smashup/abilities/`
  - `src/games/smashup/ui/`
  - `public/locales/`
  - `src/games/smashup/__tests__/`
