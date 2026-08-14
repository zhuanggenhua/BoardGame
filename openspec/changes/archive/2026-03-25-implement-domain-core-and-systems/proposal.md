# Change: 域内核与系统层基建归档

## Why
- 项目当前已经全面采用自研引擎架构：`DomainCore + Pipeline + Systems + Transport`。
- 原 active change 还混有过渡期表述和未落地的未来项，例如 `boardgameio-adapter` 与 `ugc-optional`，不适合原样归档。

## What Changes
- 按现实实现沉淀 `domain-core` 正式能力。
- 按现实实现沉淀 `systems-layer` 正式能力。
- 从本 change 中移除未形成现行能力的过渡项与未来项。

## Impact
- Affected specs:
  - `domain-core`
  - `systems-layer`
- Affected code:
  - `src/engine/types.ts`
  - `src/engine/pipeline/`
  - `src/engine/systems/`
  - `src/engine/adapter.ts`
  - `src/engine/transport/`
  - `src/games/dicethrone/domain/`
  - `src/games/tictactoe/`
  - `.spec/knowledge/standards/engine-systems.md`

## Current Status
- 已完成实现，按收缩后的真实范围归档。
