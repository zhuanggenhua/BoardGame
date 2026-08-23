# 法师战争 Step 1 正式素材输入包

> 状态：`asset-input-package-ready / reusable-for-v8 / design-pass-not-proven`。本文件只证明 Step 1 设计稿的真实素材输入已经落盘；它本身不是设计稿，也不是人工验收图。v6 / v7 的旧 AI_PASS 已因用户反馈撤销，不能再用作设计通过证据。
> 重要限制：素材输入包本身不等于“已用素材”，也不等于“规则语义正确”。下一张 Open Design artifact 必须重新证明 `素材输入包 -> artifact 渲染来源 -> 图面主体` 连通，并通过法术书 / 已计划法术 / 弃牌堆语义审查。

## 输入包位置

| 项 | 路径 |
| --- | --- |
| 本地审计目录 | `docs/games/mage-wars/design/reference/asset-input/step1-runtime-board/` |
| Open Design 项目 | `mage-wars-ui-design` |
| Open Design 输入目录 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\refs\mage-wars-step1\` |
| 生成用 reference sheet | `refs/mage-wars-step1/step1-runtime-board-reference-sheet.png` |
| 机器清单 | `docs/games/mage-wars/design/reference/asset-input/step1-runtime-board/asset-input-manifest.json` |

## 生成用 Reference Sheet

| 文件 | 尺寸 | sha256 前 16 位 | 用途 |
| --- | ---: | --- | --- |
| `step1-runtime-board-reference-sheet.png` | `1920x1080` | `7857393c78306728` | 单图输入给 Open Design / imagegen；包含正式竞技场、法师牌、学徒法术、卡背、token、攻击骰和候选半场 overlay 作为 `visible-subject`，状态板只作为 `reference-only` 规则 / 轨道语义参考 |

## 输入项账本

| 输入文件 | 来源类型 | 正式来源 / config | 尺寸 | sha256 前 16 位 | 画面职责 |
| --- | --- | --- | ---: | --- | --- |
| `standard-arena.jpg` | 正式图片副本 / `visible-subject` | `public/assets/i18n/zh-CN/mage-wars/board/standard-arena.jpg` | `3210x2407` | `d365f1e9a99c6038` | 主棋盘 / 竞技场第一视觉主体 |
| `mage-status-board.png` | 正式图片副本 / `reference-only` | `public/assets/i18n/zh-CN/mage-wars/boards/mage-status/mage-status-board.png` | `3093x1628` | `ce186fa186e91762` | 只用于推导聚魔、法力池、生命 / 伤害轨道语义；不得在 Step 1 主界面可见 |
| `spell-card-back.jpg` | 正式图片副本 / `visible-subject` | `public/assets/i18n/zh-CN/mage-wars/cards/backs/spell-card-back.jpg` | `992x1391` | `3d51171b2794f48c` | 对手已计划法术、隐性结界、未公开法术书内容背面；禁止称为对手手牌 |
| `attack-die-texture.png` | 正式图片副本 / `visible-subject` | `public/assets/i18n/zh-CN/mage-wars/dice/attack-die-texture.png` | `1280x1280` | `3d77f99c84d3bda6` | 攻击骰视觉，不得替换成普通 D6 |
| `effect-die-d12-face.png` | 正式图片副本 / `visible-subject` | `public/assets/i18n/zh-CN/mage-wars/dice/effect-die-d12-face.png` | `329x329` | `9161c1037c5037b6` | Workshop `效果骰` / `Die_12` 正面；v55 起作为效果骰视觉，禁止回退成程序化蓝圆或普通 D12 |
| `action-marker-red-front.png` | 正式图片副本 | `public/assets/i18n/zh-CN/mage-wars/tokens/action/action-marker-red-front.png` | `86x78` | `33b4ec5d3bc4d034` | 红方行动标记 |
| `action-marker-blue-front.png` | 正式图片副本 | `public/assets/i18n/zh-CN/mage-wars/tokens/action/action-marker-blue-front.png` | `86x78` | `2b851a732d0fec46` | 蓝方行动标记 |
| `ready-token-front.png` | 正式图片副本 | `public/assets/i18n/zh-CN/mage-wars/tokens/action/ready-token-front.png` | `329x329` | `9161c1037c5037b6` | 生物 / 对象就绪状态 |
| `quickcast-marker-front.png` | 正式图片副本 | `public/assets/i18n/zh-CN/mage-wars/tokens/quickcast/quickcast-marker-front.png` | `80x80` | `73b77e91398aea7d` | 黑色快速施法标记 |
| `damage-token-front.png` | 正式图片副本 / `asset-only` | `public/assets/i18n/zh-CN/mage-wars/tokens/damage/damage-token-front.png` | `283x283` | `e5cc8921ac176ce7` | 伤害物理 token 素材存在；当前真实 Board 默认用受伤覆盖层 + 数字徽章表达伤害，不要求使用该图 |
| `channeling-token-front.png` | 正式图片副本 | `public/assets/i18n/zh-CN/mage-wars/tokens/channeling/channeling-token-front.png` | `283x283` | `eabfe1caa5d11e49` | 聚魔 token / 辅助素材 |
| `guard-token.png` | 正式图片副本 | `public/assets/i18n/zh-CN/mage-wars/tokens/status/guard-token.png` | `339x339` | `0fc78acd735cbde2` | 守卫状态 token |
| `mage-warlock-card.png` | 正式 atlas crop | `mages-core-atlas.json` frame `warlock_apprentice_card` / `2600` | `360x508` | `e5d0c7922467715c` | 邪术师法师牌 |
| `mage-wizard-card.png` | 正式 atlas crop | `mages-core-atlas.json` frame `wizard_apprentice_card` / `2603` | `360x508` | `58ecbaab10ff2886` | 巫师法师牌 |
| `mage-priestess-card.png` | 正式 atlas crop | `mages-core-atlas.json` frame `priestess_apprentice_card` / `2605` | `360x508` | `622d09cc60fc9f91` | 女祭司法师牌 |
| `mage-beastmaster-card.png` | 正式 atlas crop | `mages-core-atlas.json` frame `beastmaster_apprentice_card` / `2606` | `360x508` | `c84cfbafcbf792f6` | 兽王法师牌 |
| `spell-1700-fireball.png` | 正式 atlas crop | `apprentice-spell-atlases.json` frame `1700` / 火球术 | `310x437` | `112600b4aeec7ae3` | 攻击法术代表卡 |
| `spell-3408-heal.png` | 正式 atlas crop | `apprentice-spell-atlases.json` frame `3408` / 单体治疗 | `310x436` | `67b5b9838045fb5f` | 治疗咒语代表卡 |
| `spell-2802-creature.png` | 正式 atlas crop | `apprentice-spell-atlases.json` frame `2802` / 钢爪灰熊 | `310x436` | `8fa952d925399512` | 生物代表卡 |
| `spell-3704-equipment.png` | 正式 atlas crop | `apprentice-spell-atlases.json` frame `3704` / 奥秘法杖 | `310x436` | `d527730938797b2d` | 装备代表卡 |
| `spell-2224-conjuration.png` | 正式 atlas crop | `apprentice-spell-atlases.json` frame `2224` / 缠绕藤蔓 | `310x436` | `1c2729739b36578b` | 魔物 / 构造代表卡 |

## 断链检查

- `正式资源 -> 素材输入包`：已完成，上表每项均来自正式图片或正式 atlas config。
- `素材输入包 -> Open Design artifact`：v6 / v7 曾使用同一 `refs/mage-wars-step1/` 输入包，但这只证明资源链可用；不证明设计通过。
- `Open Design artifact -> 图面主体`：v6 / v7 旧审计结论已撤销；v8 必须重新截图、重新审计。
- 人工验收状态：`human-review-blocked`。只有 v8 或后续新稿通过 AI 图面核验后，才允许打开给用户人工验收。
