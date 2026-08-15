# Action Heroes POD 接入证据

## 范围

本记录只覆盖 Smash Up 动作英雄（Action Heroes）POD 派系：卡牌静态数据、派系/变体注册、POD 基地身份、卡牌图集、本地化、预加载和真实派系选择预览。基础版动作英雄的既有规则文本与能力实现不是本次改写范围。

## 来源契约

- 用户原图：`C:\Users\Dqm\.codex\attachments\3826936a-f2e6-4dc1-a679-35fd96f8bd8e\image-1.png`
- SHA-256：`EDA3C17D9C5483E0930AB5D8CDFB3AE632C6D1004699C98B79298302D21954BC`
- 尺寸：`1876 x 2100`
- 网格：4 行 x 5 列，row-major
- 名义单格：`1876/5 x 2100/4 ≈ 375.2 x 525 px`
- 实体牌组：14 张战术牌 + 6 张随从牌，共 20 张；运行时为 17 个唯一定义

## 槽位映射

| Index | 卡牌 | 数量口径 |
| ---: | --- | ---: |
| 0 | All Out of Bubblegum | 第 1 张；定义 count=2 |
| 1 | All Out of Bubblegum | 第 2 张 |
| 2 | Get to the Choppa! | 1 |
| 3 | Slo-Mo Attack | 1 |
| 4 | Final Stand | 1 |
| 5 | Hostage Rescue | 第 1 张；定义 count=2 |
| 6 | Hostage Rescue | 第 2 张 |
| 7 | Walk Away... Slowly | 1 |
| 8 | Lone Wolf | 第 1 张；定义 count=2 |
| 9 | Lone Wolf | 第 2 张 |
| 10 | Friends Through Eternity | 1 |
| 11 | Pushing the Limit | 1 |
| 12 | The Right Person | 1 |
| 13 | Collateral Damage | 1 |
| 14 | Gracie Brones | 1 |
| 15 | Commandbro | 1 |
| 16 | Kickboxbro | 1 |
| 17 | Robobro | 1 |
| 18 | Warbro | 1 |
| 19 | Rumbro | 1 |

重复实体牌沿用项目约定：运行时定义只引用第一张对应图格，因此 Bubblegum、Hostage Rescue、Lone Wolf 的 preview index 分别为 0、5、8。

## 资源

| 资源 | 尺寸 | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `public/assets/i18n/en/smashup/cards/action_heroes_pod.png` | 1876 x 2100 | 7,080,408 | `EDA3C17D9C5483E0930AB5D8CDFB3AE632C6D1004699C98B79298302D21954BC` |
| `public/assets/i18n/en/smashup/cards/compressed/action_heroes_pod.webp` | 1876 x 2100 | 1,877,054 | `AC94CE38B8E1522F01A2544DCEEB91284199BE50B446D866C5EF88030DC0C721` |

增量 manifest key：

- `en/smashup/cards/action_heroes_pod`
- `en/smashup/cards/compressed/action_heroes_pod`

定向 manifest 校验证明两个条目的 bytes 与 SHA-256 均和本地文件一致。

资源上传 dry-run 精确命中一个运行时对象：

- `official/i18n/en/smashup/cards/compressed/action_heroes_pod.webp`
- `1,877,054 bytes`
- MD5：`e7bb993465b71764751b06608e2a4b25`

公开 URL：
`https://assets.easyboardgame.top/official/i18n/en/smashup/cards/compressed/action_heroes_pod.webp`

当前发布状态：上传脚本两次超时，环境中无可用资产服务上传凭据，SSH fallback 被拒绝；最终 HEAD 仍为 `404 Not Found`。因此本 PR 已包含 PNG、WebP 和 manifest，但不能宣称资源服务器发布完成。

## 数据与变体

- POD 派系：`action_heroes_pod`
- POD 图集：`smashup:action-heroes-pod-cards`
- POD 基地：
  - `base_building_rooftop_pod`
  - `base_jungle_camp_pod`
- 两个 POD 基地沿用 `smashup:excellent-movies-teens-bases` 的 index 0/1。
- POD 卡牌使用独立 `_pod` ID、独立图集与独立基地池。
- 图面规则文本与基础版一致，因此 ability、interaction、ongoing、baseAbility、powerModifier 显式共享；basePool 保持独立。

## 验证

- POD 定向 Vitest：7 个文件、116 个测试通过。
- `npm run typecheck`：通过。
- `npm run i18n:check`：无缺失 key；仅保留既有 1 条 warning baseline。
- `openspec validate add-smashup-action-heroes-pod --strict --no-interactive`：通过。
- `git diff --check`：通过（仅有工作区 CRLF 提示）。
- Action Heroes POD 单条 Playwright E2E：1/1 通过。
  - 真实派系选择页打开基础版分组后切换 POD。
  - 17 个 `smashup:action-heroes-pod-cards` 预览节点全部出现。
  - 每个节点均存在完成加载且 `naturalWidth > 0` 的 `img[data-card-atlas-img]`。
  - 无 `atlas-shimmer`。
  - 确认后 `action_heroes_pod` 写入选秀/玩家状态。
  - 截图：`test-results/evidence-screenshots/smashup/smashup-action-heroes-pod-atlas.e2e/派系选择详情应加载-Action-Heroes-POD-卡牌图集/action-heroes-pod-faction-preview-atlas.jpg`
- 全量 `npm run assets:validate` 未通过，阻塞来自本次范围外的既有 atlas-config drift：
  - `atlas-configs/dicethrone/ability-cards-gunslinger.atlas.json`
  - `atlas-configs/dicethrone/ability-cards-tianshi.atlas.json`
  - `atlas-configs/mage-wars/apprentice-spell-atlases.json`

## 收口状态

- 代码、静态数据、本地化、本地图集、压缩图集、manifest、定向测试和真实选择页渲染：已完成。
- PR 图集纳入：提交时需对被 `.gitignore` 忽略的 PNG/WebP 使用显式 force-add。
- 资源服务器发布：未完成，当前公开对象仍为 404；需要有效发布凭据或由维护者在合并/部署流程中发布。
