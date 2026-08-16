# Change: 新增 DiceThrone 女猎手角色

## Why

仓库收到女猎手（`lieren` / Huntress）的角色板、提示板、骰面、卡牌和状态图标素材，但当前 DiceThrone 运行时尚未接入该角色。素材中的妮拉是新的宠物交互对象；Open Design 候选稿保留为未通过记录，本轮运行时按用户明确授权以规则真相源和可操作性直接实施，不把候选稿标为批准。

## What Changes

- 新增 `lieren` 角色目录、角色目录项、骰面、技能、状态/Token、卡牌和资源预加载合同。
- 按女猎手正式素材建立独立卡牌图集配置、状态图集配置和逐对象中文录入合同；提示卡只登记为规则真相源，不纳入本轮服务器媒体上传。
- 复用现有 DiceThrone 通用卡牌、攻击/防御、流血和状态消费合同；新增机制必须以录入合同中的规则子句为准。
- 为妮拉宠物 UI 建立 Open Design 设计门禁记录；本轮候选稿保持未通过，用户明确豁免当前运行时实现的人工验收，不把候选稿或全局设计门禁记为通过。
- 补齐中文/英文 i18n、资源 manifest、审计 evidence、领域测试和真实入口验证；所有未完成项必须显式标记为 `blocked` 或 `scoped-debt`。

## Impact

- Affected specs: `dicethrone-hero-selection`，新增 `dicethrone-lieren-faction`。
- Affected code: `src/games/dicethrone/domain`、`src/games/dicethrone/heroes/lieren`、DiceThrone UI atlas/槽位/预加载链路和本地化文件。
- Affected assets: `public/assets/i18n/zh-CN/dicethrone/images/lieren/`；提示卡按用户指令仅记录、不上传；妮拉圆牌作为设计输入，暂不作为运行时状态图标。
- Design gate: 妮拉候选稿继续按 Open Design 记录和既有图面核验留档；本轮用户明确豁免人工验收，仅适用于当前运行时实现，不得扩展到其它任务或将候选稿记为通过。
