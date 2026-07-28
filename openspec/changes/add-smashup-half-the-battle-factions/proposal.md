# Change: Add Smash Up Half the Battle factions

## Why
用户提供了 `新18半场战争扩` 四个派系的本地汉化卡图素材，需要把这些派系接入 Smash Up 运行时，使其能在派系选择、卡牌/基地展示和基础牌库构建链路中出现。

## What Changes
- 新增半场战争扩四派系：忍者神龟、特种部队杰拉尔德、宇宙的巨人希曼、珍珠和幻像。
- 为四派系生成并注册独立 4x5 卡牌 atlas，以及共享 2x4 基地 atlas。
- 补齐 faction/card/base 静态数据、双语 locale、faction metadata、critical image 预加载与 intake 测试。
- 本 change 闭合 intake/静态接入、玩法 handler、对象级 L2、代表性真实入口 L3/L4 E2E，并按用户要求把 5 个源 PNG 与 5 个运行时 WebP 图集纳入 PR；服务器素材主源发布因 SSH 凭据不可用，作为生产发布 follow-up 留档。

## Impact
- Affected specs: smashup-faction-registry, game-asset-preloading
- Affected code: `src/games/smashup/domain/ids.ts`, `src/games/smashup/domain/atlasCatalog.ts`, `src/games/smashup/data/cards.ts`, `src/games/smashup/data/factions/*`, `src/games/smashup/ui/factionMeta.ts`, `public/locales/*/game-smashup.json`
- Affected assets: `public/assets/i18n/zh-CN/smashup/cards/*`, `public/assets/i18n/zh-CN/smashup/base/*`, Smash Up asset manifests
