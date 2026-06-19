# Smash Up zhongguo 四派系 intake 合同

日期：2026-06-19

## 结论等级

本轮结论仅为：功夫斗士、侠义义警、卡车车神、迪厅舞王完成 L0/L1 静态接入、资源 manifest 补齐、压缩运行时资源 R2 上传与 HEAD 回查。

不得将本文件解释为“玩法完成”“对象级审计完成”或“可发布收口”。四个派系仍是实施中状态。

## 真相源与对照源

| 类型 | 路径 | 本轮用途 |
| --- | --- | --- |
| 原始卡牌图集 | `public/assets/i18n/zh-CN/smashup/cards/zhongguo.png` | 卡牌图集、派系拆分、卡牌图面顺序 |
| 压缩卡牌图集 | `public/assets/i18n/zh-CN/smashup/cards/compressed/zhongguo.webp` | 运行时卡牌图集资源 |
| 原始基地候选图集 | `public/assets/i18n/zh-CN/smashup/base/zhongguo.png` | 基地图集布局与前 8 格基地归属 |
| 压缩基地候选图集 | `public/assets/i18n/zh-CN/smashup/base/compressed/zhongguo.webp` | 运行时基地 atlas 资源 |
| 总览核对图 | `temp/smashup-zhongguo-intake/base-overview.jpg` | 判断基地 atlas 为 4x4，并裁定本轮只注册前 8 格 |

Wiki、TTS 或历史实现只可作为后续对照源。本轮没有把外部资料提升为图片文字的最终真相源。

## Atlas 合同

| atlas | 运行时图片 | 网格 | 说明 |
| --- | --- | --- | --- |
| `cards13` | `smashup/cards/zhongguo` | 7x8 | 四派系卡牌索引 0-55 |
| `base10` | `smashup/base/zhongguo` | 4x4 | 本轮只注册前 8 张基地；后 8 格暂不进入运行时 |

## 派系清单

| 中文名 | defId | 卡牌数 | 牌组拷贝数 | 状态 |
| --- | --- | ---: | ---: | --- |
| 功夫斗士 | `kung_fu_fighters` | 12 | 20 | 实施中 |
| 侠义义警 | `vigilantes` | 18 | 20 | 实施中 |
| 卡车车神 | `truckers` | 13 | 20 | 实施中 |
| 迪厅舞王 | `disco_dancers` | 13 | 20 | 实施中 |

## 基地合同

| 中文名 | defId | 派系 | atlas index | BP | VP |
| --- | --- | --- | ---: | ---: | --- |
| 时髦镇 | `base_funky_town` | 迪厅舞王 | 0 | 23 | 4/3/2 |
| 廉价小饭馆 | `base_the_greasy_spoon` | 卡车车神 | 1 | 20 | 4/2/1 |
| 卡车服务站 | `base_truck_stop` | 卡车车神 | 2 | 18 | 3/2/1 |
| 摇摆仙境 | `base_boogie_wonderland` | 迪厅舞王 | 3 | 21 | 4/2/1 |
| 藏身处 | `base_hideout` | 侠义义警 | 4 | 18 | 3/1/1 |
| 险恶街区 | `base_the_mean_streets` | 侠义义警 | 5 | 25 | 5/3/2 |
| 古道场 | `base_ancient_dojo` | 功夫斗士 | 6 | 25 | 5/4/3 |
| 比武擂台 | `base_tournament_site` | 功夫斗士 | 7 | 19 | 2/0/0 |

后 8 格不在本轮对象范围内，当前合同要求它们不得以“最像的派系”被注册到四个新增派系或旧派系中。

## 资源链验证

两层 manifest 均已包含 `zhongguo`：

- 根级语言资源清单：`public/assets/i18n/assets-manifest.json`
- Smash Up 游戏级资源清单：`public/assets/i18n/zh-CN/smashup/assets-manifest.json`

远端回查结果：

| URL | 状态 | 长度 | 类型 |
| --- | ---: | ---: | --- |
| `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/zhongguo.webp` | 200 | 835348 | `image/webp` |
| `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/zhongguo.webp` | 200 | 560560 | `image/webp` |

上传方式：未使用全量 `assets:upload`，因为当前工作区存在大量无关资源差异；本轮通过 R2 SDK 定向上传上述两个压缩 WebP。

## 验证记录

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npx eslint ... zhongguo 相关文件 ...` | 通过 | 0 errors，55 warnings；warning 来自既有大文件 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/zhongguoFactionIntake.test.ts --configLoader native` | 通过 | 11/11 |
| `node scripts/infra/vitest-cli-safe.mjs run ... zhongguoFactionIntake cardI18nIntegrity criticalImageResolver factionSelection ...` | 部分失败 | `zhongguoFactionIntake`、`criticalImageResolver`、`factionSelection` 通过；`cardI18nIntegrity` 失败在无关派系 locale / Oops POD 文本 |

## 残余范围

- 未做玩法能力：四派系卡牌和基地效果尚未建模、实现或测试。
- 未做 L2/L3/L4：没有行为级测试、真实入口 E2E、最终权威状态证据。
- 未做逐对象主裁图文案合同：当前文本可支撑 L1 接入，不能替代后续逐卡/逐基地玩法语义审计。
- `cardI18nIntegrity` 当前仍被无关对象失败阻塞，后续若要把它作为本批收口门禁，需要先处理或隔离龙、超级英雄、极客、Oops POD 的既有/并行缺口。
