# Change: 新增 DiceThrone 炽天使派系

## Why

仓库已经收到炽天使（`tianshi` / Seraph）的角色板、提示板、骰子与卡牌素材，但当前 DiceThrone 角色目录和运行时没有接入该角色。需要按现有近期角色的配置、图集、状态和真实入口合同，把它接成可选、可初始化、可进入对局的角色。

## What Changes

- 新增 `tianshi` 角色目录、角色目录项、骰子定义、技能与卡牌定义。
- 接入炽天使角色板、提示板、骰子、卡牌和状态图标资源，并建立独立的卡牌图集合同；通用卡继续通过共享注入函数映射。
- 复用现有“净化”Token 和既有“神圣祝福”致死保护结算路径；新增炽天使专属的飞行、眩光、神圣降临等状态/标记及其规则消费。
- 按炽天使玩家板图面建立新版 v2 技能槽映射、升级覆盖映射和状态图标映射。
- 补齐中文 i18n、角色规则真相源表、录入核对表、对象级审计 evidence、领域回归和真实入口 E2E/截图验收。

## Impact

- Affected specs: `dicethrone-hero-selection`，新增 `dicethrone-tianshi-faction`。
- Affected code: `src/games/dicethrone/domain`、`src/games/dicethrone/heroes/tianshi`、DiceThrone UI atlas/槽位/预加载链路、`public/locales/zh-CN/game-dicethrone.json`。
- Affected assets: `public/assets/i18n/zh-CN/dicethrone/images/tianshi/` 与对应 manifests；临时裁片只保留在 `temp/dicethrone-intake/tianshi/`。
- Shared-path risk: 炽天使使用现有净化和神圣祝福消费路径；任何共享路径修改都必须保留僧侣、圣骑士回归证据。
