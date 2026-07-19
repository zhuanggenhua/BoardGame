# Pretty Pretty Smash Up POD 接入证据

日期：2026-07-08

## 范围

本次接入 Pretty Pretty Smash Up 的官方 POD 版本内容：

- `kitty_cats_pod`
- `mythic_horses_pod`
- `fairies_pod`
- `princesses_pod`

明确不纳入 `huluwawa`，因为该派系属于 DIY 内容，不是本次官方 POD 范围。

## 图源与资源

图源来自用户提供的 5 张卡图：

- Pretty Pretty POD 基地图：`pretty_pretty_pod`，2 x 4，8 张基地。
- Kitty Cats POD 卡图：`kitty_cats_pod`，4 x 5，20 张卡。
- Mythic Horses POD 卡图：`mythic_horses_pod`，4 x 5，20 张卡。
- Fairies POD 卡图：`fairies_pod`，4 x 5，20 张卡。
- Princesses POD 卡图：`princesses_pod`，4 x 5，20 张卡。

运行时压缩资源已生成：

- `public/assets/i18n/zh-CN/smashup/base/compressed/pretty_pretty_pod.webp`
- `public/assets/i18n/zh-CN/smashup/cards/compressed/kitty_cats_pod.webp`
- `public/assets/i18n/zh-CN/smashup/cards/compressed/mythic_horses_pod.webp`
- `public/assets/i18n/zh-CN/smashup/cards/compressed/fairies_pod.webp`
- `public/assets/i18n/zh-CN/smashup/cards/compressed/princesses_pod.webp`

## 静态数据接入

新增派系数据文件：

- `src/games/smashup/data/factions/kitty_cats_pod.ts`：12 个唯一卡定义，20 张卡。
- `src/games/smashup/data/factions/mythic_horses_pod.ts`：12 个唯一卡定义，20 张卡。
- `src/games/smashup/data/factions/fairies_pod.ts`：12 个唯一卡定义，20 张卡。
- `src/games/smashup/data/factions/princesses_pod.ts`：15 个唯一卡定义，20 张卡。

接入点：

- `src/games/smashup/domain/ids.ts` 增加 4 个 POD 派系 ID 与 5 个 POD 图集 ID。
- `src/games/smashup/domain/atlasCatalog.ts` 增加 4 个 POD 卡图图集与 1 个 POD 基地图集。
- `src/games/smashup/data/cards.ts` 注册 4 个 POD 派系卡组，并增加 8 个 Pretty Pretty POD 基地 override。
- `src/games/smashup/ui/factionMeta.ts` 增加 4 个 POD 派系选择元数据。
- `src/games/smashup/data/englishAtlasMap.json` 增加 8 个 Pretty Pretty POD 基地的本地图集映射。
- `public/locales/en/game-smashup.json` 与 `public/locales/zh-CN/game-smashup.json` 增加派系、卡牌与基地文案。

## 玩法能力实装

本次已把四个官方 Pretty Pretty POD 派系从“静态图文接入”推进到关键 POD 差异能力可执行：

### Kitty Cats POD

- `kitty_cats_muffin_pod`：可控制力量 `<=3` 的其他玩家随从。
- `kitty_cats_can_has_cheeseburger_pod`：计分前窗口可选择同基地其他玩家力量 `<=3` 的随从。
- `kitty_cats_nine_lives_pod`：消灭己方随从后授予额外随从额度，而不是基础版额外行动。
- `kitty_cats_whiskers_pod`：授予额外行动后消灭己方随从。

### Mythic Horses POD

- `mythic_horses_seastar_pod`：同基地已有其他己方随从时授予额外随从额度。
- `mythic_horses_super_future_space_armor_power_pod`：自动给同基地有友军的己方随从临时 `+2`，不弹单目标 prompt，也不授予牌面未写的销毁/移动/影响保护。
- `mythic_horses_sharing_power_pod`：只在回合结束、来源基地有至少两个己方随从时抽 1；已阻断基础版回合开始触发的 POD 自动映射。
- `mythic_horses_starlyte_pod`：自身按同基地其他己方随从数获得力量；已阻断基础版 Starlyte 给其他己方随从加成的 POD 继承。
- `mythic_horses_encouragement_power_pod`：附着宿主按同基地其他己方随从数获得力量；已阻断基础版 Encouragement 只给 `+1` 的 POD 继承。

### Fairies POD

- `fairies_titania_pod`：回手分支只允许选择对手随从。
- `fairies_leaf_armor_pod`：天赋给附着宿主临时 `+2`，不再继承基础版持续 `+1`。
- `fairies_glymmer_pod`：目标分支最低力量钳制为 `0`，并在你的下回合开始恢复。

### Princesses POD

- `princesses_skillet_pod`：消灭力量 `<=2` 的随从后只抽 1 张牌。
- `princesses_fairy_godmother_pod`：可选抽 2 张牌，或给目标临时 `+3`。
- `princesses_woodland_helpers_pod`：只响应刚打出的标准行动，不响应 ongoing 行动。
- `princesses_griselda_pod`：可从弃牌堆取回 Heirloom，或选择额外行动分支；额外行动事件已改用可被 reducer 消费的 `limitType: 'action'` 路径。

## 基地图集索引

`SMASHUP_ATLAS_IDS.PRETTY_PRETTY_POD_BASES` 对应 `smashup/base/pretty_pretty_pod`：

| index | base id | English name | faction |
|---:|---|---|---|
| 0 | `base_enchanted_glade_pod` | Enchanted Glen | `fairies_pod` |
| 1 | `base_fairy_ring_pod` | Fairy Ring | `fairies_pod` |
| 2 | `base_house_of_nine_lives_pod` | The House of Nine Lives | `kitty_cats_pod` |
| 3 | `base_cat_fanciers_alley_pod` | Cool Cat's Alley | `kitty_cats_pod` |
| 4 | `base_land_of_balance_pod` | Equaria | `mythic_horses_pod` |
| 5 | `base_pony_paradise_pod` | Pony Land | `mythic_horses_pod` |
| 6 | `base_beautiful_castle_pod` | Beautiful Castle | `princesses_pod` |
| 7 | `base_castle_of_ice_pod` | Ice Castle | `princesses_pod` |

## 验证

已通过：

- `npm run compress:images -- public/assets/i18n/zh-CN/smashup`
- `npm run assets:manifest`
- `npm run assets:validate`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/cardI18nIntegrity.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/factionSelection.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/kitty-cats.test.ts src/games/smashup/__tests__/abilities/mythic-horses.test.ts src/games/smashup/__tests__/abilities/fairies.test.ts src/games/smashup/__tests__/abilities/princesses.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- `npm run assets:check`
- `npm run test:e2e:ci:file -- e2e/smashup/smashup-image-loading.e2e.ts "Pretty Pretty POD 本地对局应正常显示 POD 图集与手牌卡图"`

定向测试结果：

- 四族 POD 行为测试：4 个测试文件通过，65 个测试用例通过。
- 静态接入 / i18n / 图片解析 / 派系选择：3 个测试文件通过，77 个测试用例通过。
- 真实浏览器 E2E：1 个 Chromium 用例通过，覆盖 `kitty_cats_pod,mythic_horses_pod` vs `fairies_pod,princesses_pod` 跳过选包进局、POD 手牌卡图渲染、POD 基地图集请求、玩家派系状态回查，以及 POD 英文卡图悬浮中文覆盖层（`松饼` 标题与效果文本）。
- E2E 截图证据：`test-results/evidence-screenshots/smashup/smashup-image-loading.e2e/Pretty-Pretty-POD-本地对局应正常显示-POD-图集与手牌卡图/Pretty-Pretty-POD-本地对局应正常显示-POD-图集与手牌卡图-pretty-pretty-pod-local-board.png`
- Pretty Pretty POD 基地映射缺口已补齐，图集注册警告已消除。
- 资源检查：5 个 Pretty Pretty POD 新资源已上传后不再显示新增；仍剩 1 个非本轮资源差异 `official/i18n/zh-CN/smashup/cards/compressed/pretty_pretty.webp`，本轮未触碰、未上传。

## R2 / CDN 上传

已定向上传并回查 `HEAD 200`：

- `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/pretty_pretty_pod.webp`
- `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/fairies_pod.webp`
- `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/kitty_cats_pod.webp`
- `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/mythic_horses_pod.webp`
- `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/princesses_pod.webp`

## 剩余风险

- 本次已覆盖四个官方 Pretty Pretty POD 派系的静态数据、资源、i18n、派系选择、关键图片解析、重点 POD 差异能力的 L2 行为测试，以及代表性真实浏览器对局链路 L3 截图证据。
- 真实浏览器 E2E 属于代表链：已证明四个 POD 派系可跳过选包进入本地对局并渲染 POD 手牌/基地资源，且 POD 英文卡图在中文环境下可通过悬浮显示中文标题与效果文本；未逐张卡执行 UI 操作链，逐卡语义仍以 L2 行为测试为主证据。
- `assets:check` 仍报告非本轮资源 `official/i18n/zh-CN/smashup/cards/compressed/pretty_pretty.webp` 本地/远端 hash 差异；为避免扩大范围，本轮未上传该旧资源。
