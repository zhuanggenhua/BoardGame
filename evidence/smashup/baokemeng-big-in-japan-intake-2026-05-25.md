# SmashUp baokemeng / Big in Japan intake 证据

## 范围

- 本轮新增图集：`public/assets/i18n/zh-CN/smashup/cards/baokemeng.png`
- 本轮新增基地：`public/assets/i18n/zh-CN/smashup/base/baokemeng.png`
- 派系：`itty_critters`、`kaiju`、`magical_girls`、`mega_troopers`
- 当前结论等级：L0/L1 静态接入通过；玩法 handler、对象级 L2/L3/L4 尚未完成。

## 真相源与对照源

| 类型 | 来源 | 用途 | 结论 |
| --- | --- | --- | --- |
| 主真相源 | 本地中文图集 `baokemeng.png` | 图集几何、中文图面、slot 顺序、基地数值 | 已采用 |
| 对照源 | Smash Up Fandom API：`Itty_Critters`、`Kaiju`、`Magical_Girls`、`Mega_Troopers`、`Bases` | 英文 canonical 名称、卡牌拷贝数、英文描述、基地英文文本 | 已采用为对照 |
| 运行时资源 | `compressed/baokemeng.webp` | 客户端实际加载 | 已上传并 HEAD 200 |

## Atlas 合同

| 图集 | 尺寸 | 网格 | 运行时 atlas | 说明 |
| --- | --- | --- | --- | --- |
| cards/baokemeng.png | `3748x4096` | `7 rows x 9 cols` | `SMASHUP_ATLAS_IDS.CARDS10` | 63 个图块，row-major |
| base/baokemeng.png | `4096x1458` | `2 rows x 4 cols` | `SMASHUP_ATLAS_IDS.BASE8` | 8 个基地，row-major |

备注：旧临时裁图 `temp/smashup-baokemeng-intake/cards/slot-*.webp` 按 `7x10` 生成，已证明会切到两张牌中间，判定为无效中间产物。有效核对图是 `temp/smashup-baokemeng-intake/cards-index-sheet-7x9.jpg` 与 `temp/smashup-baokemeng-intake/cards-grid-7x9/slot-*.webp`。

## 派系与基地合同

| 派系 | 基地 | slot | BP | VP |
| --- | --- | ---: | ---: | --- |
| Magical Girls | Akihabara High / 秋叶原 | 0 | 20 | 3/2/1 |
| Magical Girls | Q Point | 1 | 25 | 5/4/3 |
| Kaiju | Tokyo / 东京 | 2 | 25 | 5/3/2 |
| Kaiju | Kaiju Island / 怪兽岛 | 3 | 22 | 4/2/1 |
| Itty Critters | Critter Combat Club / 宠物战斗俱乐部 | 4 | 23 | 4/3/1 |
| Itty Critters | Itty City / 小城市 | 5 | 20 | 3/1/1 |
| Mega Troopers | Moon Dumpster / 月亮垃圾站 | 6 | 24 | 4/2/2 |
| Mega Troopers | Juice Bar / 果汁吧 | 7 | 20 | 3/2/1 |

## 卡牌 slot 合同

| 派系 | slots | 运行时 unique defs | deck copies | 说明 |
| --- | --- | ---: | ---: | --- |
| Itty Critters | 0-15 | 16 | 20 | `Critter Coach` 3 张，其余按对照源数量 |
| Mega Troopers | 16-30 | 15 | 20 | `Beta 6` 4 张 |
| Magical Girls | 31-47 | 17 | 20 | `Rainbow Girl`、`Celestial Teleport`、`Coordination` 各 2 张 |
| Kaiju | 48-62 | 14 | 20 | slot 62 是 `Kaijookey` 重复图块，运行时不绑定独立 def |

## 已完成实现

- `ids.ts`：新增 `CARDS10`、`BASE8`，四派系列入 in-progress。
- `atlasCatalog.ts`：新增 `smashup/cards/baokemeng` `7x9` 与 `smashup/base/baokemeng` `2x4`。
- `data/factions/*`：新增四派系卡牌静态数据。
- `data/cards.ts`：注册四派系卡牌与 `BASE_CARDS_BIG_IN_JAPAN`。
- `factionMeta.ts`：派系选择 metadata 已接入，均标记 `implementationStatus: 'in_progress'`。
- `game-smashup.json`：中英文 faction/card/base 文案已补齐。
- `public/assets/i18n/assets-manifest.json`：新增 baokemeng PNG/WebP manifest 条目。

## 验证

| 命令 | 结果 |
| --- | --- |
| `node -e "JSON.parse(...)"` | `zh-CN` / `en` i18n JSON 解析通过 |
| `npx eslint <本轮 TS 文件>` | 0 error；`cards.ts` 仅保留既有 warning |
| `npx eslint src/games/smashup/__tests__/baokemengFactionIntake.test.ts` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run i18n:check` | 通过，无 missing keys |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baokemengFactionIntake.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts --configLoader native` | 3 files / 44 tests passed |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityRegistry.test.ts src/games/smashup/__tests__/abilityInteractionRegistry.test.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --configLoader native` | Vitest 实际发现并运行 2 files / 21 tests passed（`abilityBehaviorAudit` 未被当前配置发现） |
| `npm run assets:manifest` | 通过，生成增量 manifest |
| `npm run assets:validate` | 初次 manifest 生成后通过；去除无关 manifest 漂移后重跑失败，阻塞点为本地忽略资源 `atlas-configs/dicethrone/ability-cards-gunslinger.atlas.json.json` 与仓库 manifest 的既有哈希/bytes 不一致，非本轮 baokemeng 资源 |
| baokemeng manifest 定向检查 | 4 个 `baokemeng` PNG/WebP 条目存在，bytes 与本地文件一致 |

## 资源上传与远端回查

| 资源 | R2 key | HEAD |
| --- | --- | --- |
| cards compressed atlas | `official/i18n/zh-CN/smashup/cards/compressed/baokemeng.webp` | `200 image/webp length=1126378` |
| base compressed atlas | `official/i18n/zh-CN/smashup/base/compressed/baokemeng.webp` | `200 image/webp length=313540` |

CDN URL:

- `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/baokemeng.webp`
- `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/baokemeng.webp`

## 剩余范围

- 玩法 implementation 尚未完成，不能宣称四派系可玩收口。
- 需要按单派系继续推进：Itty Critters → Kaiju → Magical Girls → Mega Troopers。
- 需要逐卡/逐基地拆子句，映射到 ability/base handler、行为测试、E2E 与最终审计。
- 当前中英文描述存在“中文图片原文 vs 英文 errata”差异点，玩法实现前需逐张裁定是否跟随中文图面或英文勘误，不能在 handler 中隐式混用。
- 全量 `assets:validate` 当前受非本任务本地忽略资源漂移阻塞；本轮 baokemeng manifest 条目与远端 WebP 已单独验证。
