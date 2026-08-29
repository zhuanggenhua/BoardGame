# Change: 新增 DiceThrone 吸血鬼领主角色

## Why

仓库收到吸血鬼领主（`vampire_lord` / Vampire Lord）的玩家板、提示卡、骰子、能力卡和状态图标素材，当前 DiceThrone 运行时尚未接入该角色。用户要求参考上一个派系正确命名并上传素材；随后明确要求新增 `hidden` 状态：实施完毕并审计过之前，吸血鬼领主必须对玩家隐藏，不能直接进入玩家可见的实施中展示阶段。

## What Changes

- 新增 `vampire_lord` 内部角色目录、角色目录项、骰面、状态 / Token、卡牌、角色板槽位和资源预加载合同。
- 素材目录保留用户给定 `xixuegui`，运行时用 `vampire_lord -> xixuegui` 目录映射，避免把中文拼音当正式角色 ID。
- 新增吸血鬼领主卡牌 atlas、状态 atlas、中文/英文 i18n、规则录入文档和定向 intake 测试。
- 角色完整目录保留 `vampire_lord`，当前玩家可见状态为 `setupOptionStatus: 'hidden'`；玩家选角 UI、直接玩家命令和 AI 自动选角均不得暴露它。
- 只有吸血鬼领主实施完毕且当前范围审计过后，才允许切入玩家可见的 `in_progress` 阶段并复用现有 `implementation_in_progress` 标记；复杂血力、催眠和复合卡机制缺口在此之前只作为内部收口事项。
- 重建 manifest，使用带 `--asset-prefix` 的资源脚本上传 `xixuegui` 目录并回查代表 URL。

## Impact

- Affected specs: `dicethrone-hero-selection`，新增 `dicethrone-vampire-lord-faction`。
- Affected code: `src/games/dicethrone/domain`、`src/games/dicethrone/heroes/vampire_lord`、DiceThrone UI atlas / 槽位 / 预加载链路和本地化文件。
- Affected assets: `public/assets/i18n/zh-CN/dicethrone/images/xixuegui/` 与 `public/assets/atlas-configs/dicethrone/ability-cards-vampire_lord.atlas.json`。
