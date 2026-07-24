# Change: Add Smash Up Marvel POD factions

## Why
两张 Marvel POD 卡图已经从用户提供的 TTS 素材中锁定，但项目尚未把这些卡图作为独立 POD 版本接入，玩家无法选择带 POD 卡图身份的漫威派系。

## What Changes
- 新增复仇者、神盾局、蜘蛛宇宙、终极战队、九头蛇、克里、邪恶大师、邪恶六人组的 POD 派系身份。
- POD 派系复用对应经典漫威派系玩法字段，使用独立派系 ID、卡牌 ID 与 POD 卡图 atlas；基地池沿用当前经典 Marvel 口径，待 Marvel 基地素材单独接入后再分离。
- 将两张 Marvel POD PNG、运行时 WebP 与资产 manifest 纳入 PR。
- 补资源合同测试，覆盖图集、manifest、POD 变体关系、文案可见性与关键图片预加载。

## Impact
- Affected specs: smashup-marvel-pod-factions, smashup-faction-registry, asset-manifest, game-asset-preloading
- Affected code: src/games/smashup/domain/**, src/games/smashup/data/**, src/games/smashup/ui/factionMeta.ts, public/locales/**/game-smashup.json, public/assets/i18n/zh-CN/smashup/cards/**
