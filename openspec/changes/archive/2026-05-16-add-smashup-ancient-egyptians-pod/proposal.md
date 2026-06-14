# Change: 实现大杀四方 Ancient Egyptians POD 版

## Why

当前项目已支持多套 Smash Up POD 派系，但 Ancient Egyptians 仍只有基础版，导致英文 POD 牌池、POD 基地池与 POD 牌面文案不完整。

同时，Ancient Egyptians 的专属泰坦 `Sphinx` 以及“埋葬牌回手”共享事件链路尚未接入，无法完整覆盖该派系的 POD 规则口径。

## What Changes

- 新增独立派系 `ANCIENT_EGYPTIANS_POD`，按 POD 规则显式接入 20 张派系卡与 2 个 POD 基地。
- 新增共用泰坦 `sphinx`，归属基础版 Ancient Egyptians，POD 版通过现有 `getFactionTitans()` fallback 复用。
- 为 buried lifecycle 增加共享事件 `BURIED_CARD_RETURNED_TO_HAND`，供 `Sphinx` 与后续 bury 体系复用。
- 同步补齐 faction registry、factionMeta、locale、文字卡面 fallback 与相关测试。

## Impact

- Affected specs:
  - `smashup-faction-registry`
  - `smashup-titan-deployment`
  - `smashup-buried-card-lifecycle`
- Affected code:
  - `src/games/smashup/data/`
  - `src/games/smashup/domain/`
  - `src/games/smashup/abilities/`
  - `src/games/smashup/ui/`
  - `public/locales/`
  - `src/games/smashup/__tests__/`
