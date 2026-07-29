# 半场战争扩四派系 intake 合同（2026-07-27）

## 结论等级

本文件记录 **L0/L1 静态 intake**：半场战争扩四派系已接入 faction / card / base 静态数据、双语 locale、atlas 注册、critical image 预热、manifest 与 Vitest 合同测试。2026-07-28 已追加对象级 L2 与真实入口 L3/L4 代表链验证，见 `evidence/smashup/2026-07-28-half-the-battle-gameplay-representative-validation.md`。用户已明确要求把图件随 PR 一起传，因此 PR 范围纳入 5 个源 PNG 图集与 5 个运行时 `compressed/*.webp` 图集；服务器素材主源发布仍因 SSH 凭据不可用而作为生产发布 follow-up 留档。

## 真相源分工

| 字段 | 主来源 | 对照来源 | 本轮状态 |
| --- | --- | --- | --- |
| 中文派系名 / 卡牌名 / 基地名 | 用户本地素材目录文件名与卡图 | 代码 defId 命名 | `passed` |
| 图片、copy order、atlas row-major 槽位 | 用户本地素材目录；重复 `副本` 文件按实体拷贝保留 | 生成后的 4x5 / 2x4 atlas | `passed` |
| `count / power / breakpoint / vp` | Smash Up Wiki MediaWiki API；本轮执行 `npm run smashup:wiki:crawl` | 本地图片文件拷贝数 | `passed` |
| 英文 canonical 名称与规则正文 | Smash Up Wiki MediaWiki API 缓存 `temp/smashup-wiki-kb/pages.json` | 本地中文卡图 / 文件名 | `passed` |
| zh-CN 规则文本 | 英文规则正文保守翻译 + 本地中文名 | 后续可做逐卡 OCR 复核 | `scoped_debt:未逐卡 OCR 锁定中文图面正文` |

## 来源与资源

素材根目录：

```text
C:\Users\Dqm\Downloads\大杀四方全种族图包(by 刹那的永恒)\大杀四方\单面长8.7宽6.2\新18半场战争扩
```

源文件计数（含重复拷贝与基地）：

| 文件夹 | 源图文件数 |
| --- | ---: |
| 忍者神龟 | 22 |
| 特种部队杰拉尔德 | 22 |
| 宇宙的巨人希曼 | 22 |
| 珍珠和幻像 | 22 |

正式 runtime atlas：

| 资源 | 尺寸 | bytes | sha256 前缀 |
| --- | ---: | ---: | --- |
| `cards/half_the_battle_geckos.png` | 4320x4864 | 22,800,669 | `59e0eb702c9e4ef3` |
| `cards/compressed/half_the_battle_geckos.webp` | 4320x4864 | 4,776,586 | `7ee82396fde20681` |
| `cards/half_the_battle_gerald.png` | 4320x4864 | 22,101,189 | `5674b78fa3b27177` |
| `cards/compressed/half_the_battle_gerald.webp` | 4320x4864 | 5,157,030 | `d27c4a0eed0cb9a1` |
| `cards/half_the_battle_cosmos.png` | 4320x4864 | 24,294,207 | `585e59539514f2ba` |
| `cards/compressed/half_the_battle_cosmos.webp` | 4320x4864 | 4,299,216 | `23b9084f3ac4518e` |
| `cards/half_the_battle_pearl_images.png` | 4320x4864 | 17,679,181 | `8a25cc8893363c33` |
| `cards/compressed/half_the_battle_pearl_images.webp` | 4320x4864 | 3,935,812 | `e782a65443b55157` |
| `base/half_the_battle_bases.png` | 4864x1728 | 10,812,801 | `b2ebf074e8c1a085` |
| `base/compressed/half_the_battle_bases.webp` | 4864x1728 | 1,710,948 | `fd8047133071ede8` |

## Atlas 槽位合同

四张卡牌 atlas 均为 `4x5`，cell `864x1216`，row-major；共享基地 atlas 为 `2x4`，cell `1216x864`，row-major。

### 忍者神龟（adolescent_epic_geckos）

| index | defId | count |
| ---: | --- | ---: |
| 0 | `geckos_hokusai` | 1 |
| 1 | `geckos_kandinsky` | 1 |
| 2 | `geckos_monet` | 1 |
| 3 | `geckos_van_gogh` | 1 |
| 4 | `geckos_june` | 4 |
| 8 | `geckos_breaking_news` | 1 |
| 9 | `geckos_flip_kick` | 1 |
| 10 | `geckos_gecko_blimp` | 1 |
| 11 | `geckos_gecko_power` | 1 |
| 12 | `geckos_gecko_rap` | 1 |
| 13 | `geckos_lasagna_party` | 2 |
| 15 | `geckos_now_you_know_bullying` | 1 |
| 16 | `geckos_masters_teachings` | 2 |
| 18 | `geckos_kc_smith` | 2 |

### 特种部队杰拉尔德（gi_gerald）

| index | defId | count |
| ---: | --- | ---: |
| 0 | `gi_gerald_viscount` | 1 |
| 1 | `gi_gerald_go_gerald` | 1 |
| 2 | `gi_gerald_now_you_know_home_safety` | 1 |
| 3 | `gi_gerald_mowat` | 1 |
| 4 | `gi_gerald_obstruction` | 1 |
| 5 | `gi_gerald_sawbones` | 1 |
| 6 | `gi_gerald_ski_lift` | 1 |
| 7 | `gi_gerald_can_do` | 2 |
| 9 | `gi_gerald_mabel_lean` | 2 |
| 11 | `gi_gerald_shellback` | 2 |
| 13 | `gi_gerald_dice_ninja` | 3 |
| 16 | `gi_gerald_rosie` | 4 |

### 宇宙的巨人希曼（rulers_of_the_cosmos）

| index | defId | count |
| ---: | --- | ---: |
| 0 | `rulers_cosmos_gal_woman` | 1 |
| 1 | `rulers_cosmos_guy_man` | 1 |
| 2 | `rulers_cosmos_andko` | 2 |
| 4 | `rulers_cosmos_man_with_arms` | 2 |
| 6 | `rulers_cosmos_frogga` | 2 |
| 8 | `rulers_cosmos_young_noble` | 2 |
| 10 | `rulers_cosmos_armor_of_battle` | 1 |
| 11 | `rulers_cosmos_dolts_halfwits_fools_morons` | 1 |
| 12 | `rulers_cosmos_fearless_friend` | 2 |
| 14 | `rulers_cosmos_magic_weapon` | 1 |
| 15 | `rulers_cosmos_myaaah` | 1 |
| 16 | `rulers_cosmos_mystic_transference` | 1 |
| 17 | `rulers_cosmos_now_you_know_toxic_waste` | 1 |
| 18 | `rulers_cosmos_powerful_sword` | 1 |
| 19 | `rulers_cosmos_sword_thats_powerful` | 1 |

### 珍珠和幻像（pearl_and_the_images）

| index | defId | count |
| ---: | --- | ---: |
| 0 | `pearl_images_pearl` | 1 |
| 1 | `pearl_images_crystal` | 2 |
| 3 | `pearl_images_ruby` | 3 |
| 6 | `pearl_images_topaz` | 4 |
| 10 | `pearl_images_alls_right_with_the_world` | 1 |
| 11 | `pearl_images_dressing_room` | 1 |
| 12 | `pearl_images_jam_all_night_long` | 2 |
| 14 | `pearl_images_love_unites_us` | 1 |
| 15 | `pearl_images_now_you_know_bike_safety` | 1 |
| 16 | `pearl_images_shes_got_the_power` | 2 |
| 18 | `pearl_images_truly_outstanding` | 1 |
| 19 | `pearl_images_were_up_youre_down` | 1 |

### 基地

| index | 中文名 | defId | breakpoint | VP | faction |
| ---: | --- | --- | ---: | --- | --- |
| 0 | 下水道隐蔽处 | `base_sewer_hideout` | 21 | 4/2/1 | 忍者神龟 |
| 1 | 科技球 | `base_technoball` | 22 | 4/2/1 | 忍者神龟 |
| 2 | 杰拉尔德基地 | `base_gi_geralds_base` | 22 | 5/3/2 | 特种部队杰拉尔德 |
| 3 | 美国海军旗帜号 | `base_uss_banner` | 20 | 4/2/1 | 特种部队杰拉尔德 |
| 4 | 力量城堡 | `base_power_castle` | 20 | 4/2/1 | 宇宙的巨人希曼 |
| 5 | 粘液池 | `base_slime_pool` | 20 | 3/2/1 | 宇宙的巨人希曼 |
| 6 | 音乐会场地 | `base_concert_venue` | 20 | 3/1/1 | 珍珠和幻像 |
| 7 | 录音室 | `base_recording_studio` | 23 | 4/2/1 | 珍珠和幻像 |

## 命名裁定

| 本地中文图名 | canonical English / defId 口径 | 裁定 |
| --- | --- | --- |
| 爱普莉尔·奥尼尔 | `June` / `geckos_june` | 中文保留本地图名，英文与 defId 用 Wiki canonical |
| 希瑞 | `Gal-Woman` / `rulers_cosmos_gal_woman` | 中文保留本地图名，英文与 defId 用 Wiki canonical |
| 希曼 | `Guy-Man` / `rulers_cosmos_guy_man` | 中文保留本地图名，英文与 defId 用 Wiki canonical |
| 偏激者 | `Can-Do` / `gi_gerald_can_do` | 中文保留本地图名，英文与 defId 用 Wiki canonical |
| 封面女郎 | `Mabel Lean` / `gi_gerald_mabel_lean` | 中文保留本地图名，英文与 defId 用 Wiki canonical |

## 批次矩阵

| 对象 | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 忍者神龟 | `passed` | `passed:PR 随带源 PNG + 运行时 WebP；server upload 为 deployment_followup` | `passed:L2_object_level` | `passed:L2_object_level + representative_only:L3/L4` | `representative_only:派系选择页真实入口卡图/详情面板已验证` | `pr_ready_with_followup` |
| 特种部队杰拉尔德 | `passed` | `passed:PR 随带源 PNG + 运行时 WebP；server upload 为 deployment_followup` | `passed:L2_object_level` | `passed:L2_object_level + representative_only:L3/L4` | `representative_only:派系选择页真实入口卡图/详情面板已验证` | `pr_ready_with_followup` |
| 宇宙的巨人希曼 | `passed` | `passed:PR 随带源 PNG + 运行时 WebP；server upload 为 deployment_followup` | `passed:L2_object_level` | `passed:L2_object_level + representative_only:L3/L4` | `representative_only:希瑞真实天赋入口已验证` | `pr_ready_with_followup` |
| 珍珠和幻像 | `passed` | `passed:PR 随带源 PNG + 运行时 WebP；server upload 为 deployment_followup` | `passed:L2_object_level` | `passed:L2_object_level + representative_only:L3/L4` | `representative_only:玩乐一整夜真实持续战术入口已验证` | `pr_ready_with_followup` |

## 验证记录

通过：

```text
npm run smashup:wiki:crawl
npm run assets:manifest
node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\halfTheBattleFactionIntake.test.ts src\games\smashup\__tests__\criticalImageResolver.test.ts --configLoader native
node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\cardI18nIntegrity.test.ts --configLoader native
openspec validate add-smashup-half-the-battle-factions --strict --no-interactive
node scripts\assets\upload-to-server.js --check --asset-prefix public/assets/i18n/zh-CN/smashup/cards/compressed/half_the_battle_*.webp（逐对象执行）
node scripts\assets\upload-to-server.js --check --asset-prefix public/assets/i18n/zh-CN/smashup/base/compressed/half_the_battle_bases.webp
npm run test:e2e:ci:file -- e2e/smashup/smashup-half-the-battle-four-factions.e2e.ts
```

测试结果：

```text
halfTheBattleFactionIntake.test.ts: 12 passed
criticalImageResolver.test.ts: 17 passed
cardI18nIntegrity.test.ts: 25 passed
OpenSpec: Change 'add-smashup-half-the-battle-factions' is valid
smashup-half-the-battle-four-factions.e2e.ts: 3 passed；截图已人工核对，派系卡图/详情面板/希瑞/玩乐一整夜有效
```

阻塞 / 未通过：

```text
npm run test -- src/games/smashup/__tests__/halfTheBattleFactionIntake.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts
结果：误触发仓库全量 test 脚本并在 124s 超时；已改用 vitest safe wrapper 定向通过。

npm run assets:validate
结果：失败于既有 atlas-configs/dicethrone/ability-cards-gunslinger.atlas.json hash/bytes 不一致；非半场战争扩资源 key。

node scripts\assets\upload-to-server.js --skip-android-package-publish --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_geckos.webp --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_gerald.webp --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_cosmos.webp --asset-prefix i18n/zh-CN/smashup/cards/compressed/half_the_battle_pearl_images.webp --asset-prefix i18n/zh-CN/smashup/base/compressed/half_the_battle_bases.webp
结果：300s timeout，无完成输出。

ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=20 -o ServerAliveCountMax=1 -o StrictHostKeyChecking=yes admin@8.148.71.102 echo ok
结果：Permission denied (publickey,gssapi-keyex,gssapi-with-mic)；本机默认 `id_ed25519` 被服务器拒绝。

curl.exe -I --max-time 20 https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/half_the_battle_geckos.webp
curl.exe -I --max-time 20 https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/half_the_battle_bases.webp
结果：404 Not Found；远端素材未发布完成。
```

## implementation 交接清单

- 四派系均已在 `SMASHUP_IN_PROGRESS_FACTION_IDS` 与 `FACTION_METADATA` 标记 `in_progress`。
- 静态字段只作为 L1 intake 合同；2026-07-28 已补代表性 `ability/trigger/interaction` handler、L2 测试与 L3/L4 真实入口代表链，但仍未完成全卡/全基地对象级收口。
- 高风险机制：融合卡双面执行、第一/第二张战术判定、打在随从上的战术转移、天赋复制、计分前/计分后 special、其他玩家战力提升触发。
- 当前 PR-scope 已补对象级 L2、代表性 L3/L4、5 个源 PNG 图集与 5 个运行时 WebP 图集；服务器 SSH 发布权限恢复后，再完成素材主源上传与远端 HEAD 200 作为生产发布跟进项。
