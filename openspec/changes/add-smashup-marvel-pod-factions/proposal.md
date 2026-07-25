# Change: Add Smash Up Marvel POD factions

## Why
两张 Marvel POD 卡图已经从用户提供的 TTS 素材中锁定，但项目尚未把这些卡图作为独立 POD 版本接入，玩家无法选择带 POD 卡图身份的漫威派系。

## What Changes
- 新增复仇者、神盾局、蜘蛛宇宙、终极战队、九头蛇、克里、邪恶大师、邪恶六人组的 POD 派系身份。
- POD 派系复用对应经典漫威派系玩法字段，使用独立派系 ID、卡牌 ID 与 POD 卡图 atlas；基地池沿用当前经典 Marvel 口径，待 Marvel 基地素材单独接入后再分离。
- 将两张 Marvel POD PNG、运行时 WebP 与资产 manifest 纳入 PR。
- 补资源合同测试，覆盖图集、manifest、POD 变体关系、文案可见性与关键图片预加载。

## Impact
- Affected specs:
  - openspec/changes/add-smashup-marvel-pod-factions/specs/smashup-marvel-pod-factions/spec.md
  - openspec/changes/add-smashup-marvel-pod-factions/specs/smashup-faction-registry/spec.md
  - openspec/changes/add-smashup-marvel-pod-factions/specs/asset-manifest/spec.md
  - openspec/changes/add-smashup-marvel-pod-factions/specs/game-asset-preloading/spec.md
- Affected code:
  - src/games/smashup/domain/ids.ts:20
  - src/games/smashup/domain/atlasCatalog.ts:32
  - src/games/smashup/domain/variantBindings.ts:29
  - src/games/smashup/domain/variantBindingValidation.ts:1
  - src/games/smashup/data/cards.ts:89
  - src/games/smashup/data/factions/avengers_pod.ts:1
  - src/games/smashup/data/factions/hydra_pod.ts:1
  - src/games/smashup/data/factions/kree_pod.ts:1
  - src/games/smashup/data/factions/masters_of_evil_pod.ts:1
  - src/games/smashup/data/factions/shield_pod.ts:1
  - src/games/smashup/data/factions/sinister_six_pod.ts:1
  - src/games/smashup/data/factions/spider_verse_pod.ts:1
  - src/games/smashup/data/factions/ultimates_pod.ts:1
  - src/games/smashup/ui/factionMeta.ts:235
  - public/locales/en/game-smashup.json:1926
  - public/locales/zh-CN/game-smashup.json:1909
  - public/assets/i18n/assets-manifest.json:13258
  - public/assets/i18n/zh-CN/smashup/assets-manifest.json:763
