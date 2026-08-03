# 动作英雄 / 返时者 / 异形变体 / 青少年 / 怨灵捕手收口证据

日期：2026-08-03

## 当前结论

- 玩法实现：五派系能力与 10 个基地能力已做到本地可游玩；定向 Vitest、typecheck、OpenSpec、manifest 校验、assets 校验与真实入口 E2E 均通过。
- 静态数据：五个派系、66 张卡牌定义、10 个基地定义、卡牌 atlas preview、基地 atlas preview、双语卡牌/基地/提示 key 已接入。
- 本地资源链：卡牌 PNG/WebP 与基地 PNG/WebP 均存在，根级 i18n manifest 与 `zh-CN/smashup` game-level manifest 已写入并校验通过。
- 基地美术口径：10 个基地现在使用照片源运行时 atlas；其中青少年 2 张来自 Fandom 高清图，Excellent Movies Dudes 8 张来自 `dudetakeyourturn.ca` 低分辨率无遮挡照片。该 atlas 可支持本地运行时游玩和截图验收，但后续仍建议替换为高清扫描源。
- 本轮收口口径：用户已澄清线上素材包原本就存在，本轮目标是玩法修复/可玩性收口；因此服务器素材主源发布状态只作为观察记录，不作为本轮玩法完成门禁。

## 完成矩阵

| 范围 | 状态 | 证据 / 说明 |
| --- | --- | --- |
| 数据录入 | Passed | `EXCELLENT_MOVIES_TEENS_CARDS` 覆盖五派系 66 张卡牌，`EXCELLENT_MOVIES_TEENS_BASES` 覆盖 10 个基地。 |
| 玩法实现 | Passed | 动作英雄、返时者、异形变体、青少年、怨灵捕手能力与 10 个基地能力已在定向测试覆盖；早午餐帮多段效果已修正为移动后给仍留在原基地的 3 力己方随从加力。 |
| i18n | Passed for this batch | 五派系新增 key 与基地 prompt key 已补齐；全局 `i18n:check` 仍被 Goblins / Round Table Knights 既有缺口阻塞。 |
| 卡牌资源本地链 | Observed / not gameplay gate | 本地 PNG/WebP 存在并进入 manifest；远端公开对象状态记录在下方“远端资源观察”，不作为本轮玩法修复 blocker。 |
| 基地资源本地链 | Passed local / quality debt | 本地 PNG/WebP 存在并进入 manifest；8 张 Excellent Movies Dudes 基地来自低分辨率无遮挡网页照片，后续可替换高清扫描源。 |
| manifest / assets validate | Passed | 根级 `public/assets/i18n/assets-manifest.json`、game-level `public/assets/i18n/zh-CN/smashup/assets-manifest.json` 均校验通过；`npm run assets:validate` 通过。 |
| 真实入口 E2E | Passed / representative L3-L4 | 派系选择页详情链现在断言五派系卡牌与基地图集可见；异形变体蛋田真实交互链可从页面进入、选择并完成权威状态变化。 |
| 服务器发布 | Out of scope for gameplay fix | 用户澄清本轮修复的是玩法；服务器素材主源状态保留为远端资源观察项，不阻塞本轮玩法结论。 |

## 对象覆盖

- 派系：动作英雄、返时者、异形变体、青少年、怨灵捕手。
- 卡牌：66 个 distinct card definitions，卡牌 `previewRef` 使用 `SMASHUP_ATLAS_IDS.EXCELLENT_MOVIES_TEENS_CARDS`。
- 基地：10 个 base definitions，基地 `previewRef` 使用 `SMASHUP_ATLAS_IDS.EXCELLENT_MOVIES_TEENS_BASES`。
- 基地 atlas 槽位：
  - 动作英雄：楼顶 `0`、丛林营地 `1`
  - 返时者：另类现在 `2`、时间旅行汽车 `3`
  - 异形变体：古代坠毁飞船 `4`、育巢 `5`
  - 青少年：林中小屋 `6`、蒙特里奇高中 `7`
  - 怨灵捕手：屋顶传送门 `8`、怨灵捕手总部 `9`
- 代表性基地能力：楼顶、丛林营地、另类现在、时间旅行汽车、古代坠毁飞船、育巢、林中小屋、蒙特里奇高中、屋顶传送门、怨灵捕手总部均有定向行为测试。

## 验证记录

| 命令 / 检查 | 结果 |
| --- | --- |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 120000` | Passed：1 file / 53 tests |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/excellentMoviesTeensIntegration.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 120000` | Passed：1 file / 4 tests |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/bases/excellent-movies-teens-bases.test.ts src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts src/games/smashup/__tests__/excellentMoviesTeensIntegration.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 120000` | Passed：3 files / 68 tests |
| `npm run typecheck` | Passed |
| `openspec validate add-smashup-excellent-movies-teens-factions --strict --no-interactive` | Passed |
| `node scripts/assets/generate_asset_manifests.js --validate --id i18n` | Passed |
| `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup` | Passed |
| `npm run assets:validate` | Passed |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-excellent-movies-teens-five-factions.e2e.ts` | Passed：2 tests；隔离端口 frontend=6273 / game=20100 / api=21100。runtime label 仍受当前 gitdir 异常显示为 20260601，但执行 cwd 与 Playwright 目标为 20260731。 |
| `npm run i18n:check` | Failed on unrelated existing Goblins / Round Table Knights items：2 missing keys + 4 zh-CN English-text warnings；本批五派系无新增 i18n 缺口。 |
| `node scripts/assets/upload-to-server.js --check --skip-android-package-publish --asset-prefix public/assets/i18n/zh-CN/smashup/cards/compressed/excellent_movies_teens.webp` | 待发布：1 个对象 |
| `node scripts/assets/upload-to-server.js --check --skip-android-package-publish --asset-prefix public/assets/i18n/zh-CN/smashup/base/compressed/excellent_movies_teens_bases.webp` | 待发布：1 个对象 |
| `node scripts/assets/upload-to-server.js --asset-prefix public/assets/i18n/zh-CN/smashup/cards/compressed/excellent_movies_teens.webp --asset-prefix public/assets/i18n/zh-CN/smashup/base/compressed/excellent_movies_teens_bases.webp --skip-android-package-publish` | Failed：找到 2 个本地对象并进入 1 个服务器发布批次；SSH 发布阶段返回 `Permission denied (publickey,gssapi-keyex,gssapi-with-mic).` |
| `ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=5 -o ServerAliveCountMax=1 -o StrictHostKeyChecking=yes admin@8.148.71.102 true` | Failed：`Permission denied (publickey,gssapi-keyex,gssapi-with-mic).` |

## 真实入口截图

- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\派系选择页可看到五个已完成派系，并能显示卡牌与基地详情\动作英雄派系详情面板.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\派系选择页可看到五个已完成派系，并能显示卡牌与基地详情\返时者派系详情面板.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\派系选择页可看到五个已完成派系，并能显示卡牌与基地详情\异形变体派系详情面板.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\派系选择页可看到五个已完成派系，并能显示卡牌与基地详情\青少年派系详情面板.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\派系选择页可看到五个已完成派系，并能显示卡牌与基地详情\怨灵捕手派系详情面板.jpg`
  - 确认五派系详情面板可见，且 E2E 同步断言每个派系的两个基地卡都使用 `smashup:excellent-movies-teens-bases` 与正确 atlas index，并加载 `data-card-atlas-img="true"`。
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\异形变体蛋田天赋在真实页面中创建牌库额外随从提示，并能打出抱胸怪\异形变体蛋田选择牌库额外随从.jpg`
  - 确认真实页面出现“立刻打出一个额外随从，或放弃这次机会”提示。
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\异形变体蛋田天赋在真实页面中创建牌库额外随从提示，并能打出抱胸怪\异形变体蛋田打出抱胸怪后.jpg`
  - 确认异形变体蛋田到抱胸怪的真实交互链可操作，并在最终状态中清空 interaction / responseWindow。

## 规则书 / 基地素材检查

- 检查来源：`D:\GA\BoardGame-upstream-main-dev-20260601\temp\smashup-excellent-movies-teens-intake\sources\SU_ExcellentMoviesDude_Rulebook.pdf`。
- PDF 页数：20 页；已渲染并人工查看 `D:\GA\BoardGame-upstream-main-dev-20260731\temp\pdf-base-check\pages-01-05-contact.png`、`pages-06-10-contact.png`、`pages-11-16-contact.png`、`pages-17-20-contact.png`。
- 结论：第 1-5 页为封面、目录、卡牌/基地示意和 setup 示例；第 6-10 页为规则正文；第 11-16 页为规则术语与卡牌 clarifications；第 17-20 页为规则提醒、派系简介、制作名单与基础规则摘要。未发现可裁成 10 张完整基地卡图的正式基地 atlas。
- PDF 内嵌大图抽取结果：`D:\GA\BoardGame-upstream-main-dev-20260731\temp\pdf-base-check\extracted-images-contact.png` 显示最大内嵌对象为重复规则书背景图，另一个为封面插图；不是基地卡源。
- 追加照片源：
  - `D:\GA\BoardGame-upstream-main-dev-20260731\temp\excellent-movies-base-web-sources\teens-bases-fandom.jpg`：Fandom 青少年两张基地合图，2160×3840。
  - `D:\GA\BoardGame-upstream-main-dev-20260731\temp\excellent-movies-base-web-sources\excellent-movies-dudes-bases-fandom.jpg`：Fandom Excellent Movies Dudes 八张基地合图，3840×2160；因卡片重叠遮挡，仅作为对照，不直接裁运行时 atlas。
  - `D:\GA\BoardGame-upstream-main-dev-20260731\temp\excellent-movies-base-web-sources\blog-original-1.jpg`、`blog-original-2.jpg`：`dudetakeyourturn.ca` 八张无遮挡基地照片，约 501px 宽；已用于当前运行时基地 atlas，质量残余是分辨率偏低。
- 当前运行时 atlas 构建产物：`D:\GA\BoardGame-upstream-main-dev-20260731\temp\excellent-movies-base-atlas-build-v4\excellent_movies_teens_bases.png`。

## 远端资源观察（非本轮玩法门禁）

本地运行时资源：

| 文件 | Bytes | MD5 | SHA256 |
| --- | ---: | --- | --- |
| `public/assets/i18n/zh-CN/smashup/cards/excellent_movies_teens.png` | 57,778,043 | `2221e542d091321016419392c50f10bc` | `62a150f66f95e4fafc84d5cfbc22dfe57783511d19ad4a7ea8f8e49948ab07ad` |
| `public/assets/i18n/zh-CN/smashup/cards/compressed/excellent_movies_teens.webp` | 8,659,584 | `ad918e4e1b1d95c3aa54e9d03310a600` | `56fe667dcd95ac16a94304f7362a1fd1c6c13e3b094532e21f678dee13569daf` |
| `public/assets/i18n/zh-CN/smashup/base/excellent_movies_teens_bases.png` | 15,527,208 | `9b9ab4ff58ddf275a0197c3b910e57a2` | `7482f58e74fe014eb496d401ea661c3b3602a95ec8cce0664a1c1abf51bbbdee` |
| `public/assets/i18n/zh-CN/smashup/base/compressed/excellent_movies_teens_bases.webp` | 2,559,806 | `a5f015f6d27a71f3533884529ea1b259` | `8324058bbf9904c1974fd154d1f30a4e27a2c0a3ba24608b9dffb0256289ab4b` |

manifest entries:

- Root i18n manifest:
  - `zh-CN/smashup/cards/excellent_movies_teens`
  - `zh-CN/smashup/cards/compressed/excellent_movies_teens`
  - `zh-CN/smashup/base/excellent_movies_teens_bases`
  - `zh-CN/smashup/base/compressed/excellent_movies_teens_bases`
- Game-level manifest:
  - `cards/excellent_movies_teens`
  - `cards/compressed/excellent_movies_teens`
  - `base/excellent_movies_teens_bases`
  - `base/compressed/excellent_movies_teens_bases`

发布检查（观察项）：

```text
待发布: official/i18n/zh-CN/smashup/cards/compressed/excellent_movies_teens.webp (8659584 bytes, md5=ad918e4e1b1d95c3aa54e9d03310a600)
检查完成：待发布 1 个对象

待发布: official/i18n/zh-CN/smashup/base/compressed/excellent_movies_teens_bases.webp (2559806 bytes, md5=a5f015f6d27a71f3533884529ea1b259)
检查完成：待发布 1 个对象
```

SSH 状态（观察项）：

```text
admin@8.148.71.102: Permission denied (publickey,gssapi-keyex,gssapi-with-mic).
```

真实上传尝试观察：

```text
找到 2 个符合条件的本地文件
路径过滤：i18n/zh-CN/smashup/cards/compressed/excellent_movies_teens.webp, i18n/zh-CN/smashup/base/compressed/excellent_movies_teens_bases.webp
分批发布服务器对象：1 批，每批最多 200 个
发布服务器对象批次 1/1: 2 个
Error: 服务器主源发布 失败，exit=255: admin@8.148.71.102: Permission denied (publickey,gssapi-keyex,gssapi-with-mic).
```

## 非本轮事项 / scoped debt

1. 若后续要做“资源发布闭环”专项，需要素材服务器 SSH 凭据，或由有权限的发布执行者发布 `excellent_movies_teens.webp` 与 `excellent_movies_teens_bases.webp`，再复核公开 `HEAD` bytes/hash；这不是本轮玩法修复门禁。
2. 基地 atlas 已可本地运行，但 8 张 Excellent Movies Dudes 基地来自低分辨率照片源；若发布标准要求高清扫描源，需要后续替换 atlas 并重跑压缩、manifest、E2E 与发布。
3. 全局 `i18n:check` 仍有 Goblins / Round Table Knights 历史债；本批五派系没有新增对应缺口。

## 2026-08-03 12:16 +08:00 远端资源观察复核（非本轮玩法门禁）

- `ssh -o BatchMode=yes ... admin@8.148.71.102 true` 仍失败：`Permission denied (publickey,gssapi-keyex,gssapi-with-mic).`
- `upload-to-server --check` 仍显示卡牌 WebP 待发布：`official/i18n/zh-CN/smashup/cards/compressed/excellent_movies_teens.webp (8659584 bytes, md5=ad918e4e1b1d95c3aa54e9d03310a600)`。
- `upload-to-server --check` 仍显示基地 WebP 待发布：`official/i18n/zh-CN/smashup/base/compressed/excellent_movies_teens_bases.webp (2559806 bytes, md5=a5f015f6d27a71f3533884529ea1b259)`。
- 公开 HEAD 仍未闭合：卡牌 URL 返回 `200` 但 `Content-Length=5032252`，仍是旧对象；基地 URL 返回 `404`。
