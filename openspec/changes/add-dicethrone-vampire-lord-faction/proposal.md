# Change: 新增 DiceThrone 吸血鬼领主角色

## Why

仓库收到吸血鬼领主（`vampire_lord` / Vampire Lord）的玩家板、提示卡、骰子、能力卡和状态图标素材，当前 DiceThrone 运行时尚未接入该角色。用户要求参考上一个派系正确命名并上传素材；随后明确要求新增 `hidden` 状态：实施完毕并审计过之前，吸血鬼领主必须对玩家隐藏，不能直接进入玩家可见的实施中展示阶段。

## What Changes

- 新增 `vampire_lord` 内部角色目录、角色目录项、骰面、状态 / Token、卡牌、角色板槽位和资源预加载合同。
- 素材目录保留用户给定 `xixuegui`，运行时用 `vampire_lord -> xixuegui` 目录映射，避免把中文拼音当正式角色 ID。
- 新增吸血鬼领主卡牌 atlas、状态 atlas、中文/英文 i18n、规则录入文档和定向 intake 测试。
- 角色完整目录保留 `vampire_lord`；实施完毕且当前范围审计过前使用 `setupOptionStatus: 'hidden'` 对玩家隐藏，审计通过但尚有发布级残余时可切入 `setupOptionStatus: 'in_progress'` 并复用现有 `implementation_in_progress` 标记，完成 closeout 后移除该标记。
- 旧“吸血鬼领主已进入完成态并可选”的结论曾因嗜血之爪相同数字奖励漏审而失效；本轮又发现鲜血之力四档成本、累计门槛和每回合限制未完整录入，已补实现、领域测试、真实入口证据和审计证据；当前锁定范围审计已完成，但尚未收到真人明确完成态批准，角色保持 `in_progress`，玩家可选而 AI 继续过滤。
- 重建 manifest，使用带 `--asset-prefix` 的资源脚本上传 `xixuegui` 目录并回查代表 URL。

## Impact

- Affected specs: `dicethrone-hero-selection`，新增 `dicethrone-vampire-lord-faction`。
- Affected code: `src/games/dicethrone/domain`、`src/games/dicethrone/heroes/vampire_lord`、DiceThrone UI atlas / 槽位 / 预加载链路和本地化文件。
- Affected assets: `public/assets/i18n/zh-CN/dicethrone/images/xixuegui/` 与 `public/assets/atlas-configs/dicethrone/ability-cards-vampire_lord.atlas.json`。
