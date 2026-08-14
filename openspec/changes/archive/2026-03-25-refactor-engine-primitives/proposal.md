# Change: 引入 engine-primitives 纯函数原语层

## Why
旧 change 的口径已经明显落后于仓库现状。当前真实架构不是“删除 systems 层”，而是在保留 `src/engine/systems/` 运行时系统层的前提下，新增并广泛落地 `src/engine/primitives/` 纯函数原语层，承接跨游戏可复用的底层工具、注册器和数值/状态管线。

如果继续沿用旧 proposal，会把以下错误事实归档进正式 spec：
- 错误地声称 `src/engine/systems/` 已被删除
- 错误地声称骰子能力仍以全局 singleton/definition registry 为中心
- 低估了 primitives 的实际范围和多游戏落地程度

## What Changes
- 新增 `engine-primitives` capability，正式定义引擎层可复用纯函数原语库
- 将 `dice-system` spec 从“全局注册 + singleton API”改为“游戏显式传入定义 + 纯函数 API”
- 将 change scope 收敛为已经落地的真实能力：
  - `expression` / `condition` / `target` / `effects`
  - `zones` / `dice` / `resources`
  - `ability` / `abilityConstraints` / `tags` / `modifier` / `attribute`
  - `damageCalculation` / `actionRegistry` / `grid` / `uiHints`
  - `spriteAtlas` / `actionLogHelpers` / `mulligan` / `visual`
- 明确 systems 层仍然存在，且与 primitives 层分工不同：
  - `systems/` 负责对局生命周期与运行时系统
  - `primitives/` 负责跨游戏复用的纯函数与注册器

## Impact
- Affected specs:
  - `engine-primitives`
  - `dice-system`
- Affected code:
  - `src/engine/primitives/`
  - `src/games/dicethrone/**`
  - `src/games/summonerwars/**`
  - `src/games/smashup/**`
  - `src/games/cardia/**`
  - `AGENTS.md`
  - `.spec/knowledge/standards/engine-systems.md`
  - `docs/architecture.md`
