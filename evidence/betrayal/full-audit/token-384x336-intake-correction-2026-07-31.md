# 384x336 token 录入纠错证据（2026-07-31）

## 前提锁定

| 项 | 当前锁定 |
| --- | --- |
| 问题对象 | 用户点名的 31 张 384x336 小黑屋 token 图片，以及由这段旧错名暴露出来的 Rebecca / Darryl token 纠错 |
| 真相来源 | 用户本地图包 `Mods\Images`、`images-manifest.csv`、本轮核图联系表和正式运行时资源目录 |
| 目标入口/环境 | 当前工作区 `D:\gongzuo\webgame\BoardGame`；正式资源树 `public/assets/i18n/zh-CN/betrayal` |
| 验收口径 | 每张图必须有源文件、语义化运行时路径、压缩产物、manifest / 资源索引记录；错名资源必须回到正确源图 |

## 结论

用户指出的这一段此前没有完整录入：用户点名范围共 31 张，旧 `runtime-resource-map.json` 只登记了 4 张；其中 2 张还被错误命名成 Rebecca / Darryl 的探索者 token。本轮已把 31 张全部落到 `tokens/monsters` 语义路径，并把 Rebecca / Darryl 改回探索者 token 源图。

这次补的是 3e 的怪物 / Stunned token 组，不是木乃伊大怪物 token。`mummy-token-source-search-2026-07-31.md` 的“本地图包未发现木乃伊 token / portrait”结论不变。

## 用户点名范围覆盖矩阵

| # | 源文件尾段 | 图面语义 | 正式目标 | 旧索引状态 | 本轮状态 |
| ---: | --- | --- | --- | --- | --- |
| 01 | EE7C83DC.png | Jack's Spirit / 杰克之灵 | `tokens/monsters/jacks-spirit.png` | 旧索引未映射 | pass |
| 02 | 73AA9E96.png | Jack's Spirit Stunned side / 杰克之灵击晕面 | `tokens/monsters/jacks-spirit-stunned.png` | 旧索引未映射 | pass |
| 03 | 8DC162FB.png | Head of the House / 宅邸之首 | `tokens/monsters/head-of-the-house.png` | 旧索引未映射 | pass |
| 04 | 43F7C806.png | Head of the House Stunned side / 宅邸之首击晕面 | `tokens/monsters/head-of-the-house-stunned.png` | 旧索引未映射 | pass |
| 05 | 4C8A58AD.png | Demon / 恶魔 | `tokens/monsters/demon.png` | 旧索引未映射 | pass |
| 06 | CBB7096E.png | Demon Stunned side / 恶魔击晕面 | `tokens/monsters/demon-stunned.png` | 旧索引未映射 | pass |
| 07 | 6DA0171F.png | Dark Queen / 黑暗女王 | `tokens/monsters/dark-queen.png` | 旧索引未映射 | pass |
| 08 | 1F227831.png | Dark Queen Stunned side / 黑暗女王击晕面 | `tokens/monsters/dark-queen-stunned.png` | 旧索引未映射 | pass |
| 09 | AC13D135.png | Ghost Shark / 幽灵鲨 | `tokens/monsters/ghost-shark.png` | 旧索引未映射 | pass |
| 10 | BCACC4A9.png | Ghost Shark Stunned side / 幽灵鲨击晕面 | `tokens/monsters/ghost-shark-stunned.png` | 旧索引未映射 | pass |
| 11 | EC5A31FC.png | Construct / 构装体 | `tokens/monsters/construct.png` | 旧索引未映射 | pass |
| 12 | 06AB53C7.png | Construct Stunned side / 构装体击晕面 | `tokens/monsters/construct-stunned.png` | 旧映射到 `tokens/explorers/rebecca-allen.png` | pass |
| 13 | 8EDF6B9A.png | Bakeneko / 化猫 | `tokens/monsters/bakeneko.png` | 旧映射到 `tokens/explorers/darryl-highla.png` | pass |
| 14 | F979DAA6.png | Bakeneko Stunned side / 化猫击晕面 | `tokens/monsters/bakeneko-stunned.png` | 旧索引未映射 | pass |
| 15 | DA421BCC.png | Giant Wasp / 巨蜂 | `tokens/monsters/giant-wasp.png` | 旧索引未映射 | pass |
| 16 | A4DDCDA3.png | Giant Wasp Stunned side / 巨蜂击晕面 | `tokens/monsters/giant-wasp-stunned.png` | 旧索引未映射 | pass |
| 17 | 8C7D3520.png | Demon Dog / 恶魔犬 | `tokens/monsters/demon-dog.png` | 旧索引未映射 | pass |
| 18 | 2C183E7F.png | Demon Dog Stunned side / 恶魔犬击晕面 | `tokens/monsters/demon-dog-stunned.png` | 旧索引未映射 | pass |
| 19 | 9AE2A3BF.png | Werewolf / 狼人 | `tokens/monsters/werewolf.png` | 旧映射到 `tokens/monsters/werewolf.png` | pass |
| 20 | 0D0AF963.png | Werewolf Stunned side / 狼人击晕面 | `tokens/monsters/werewolf-stunned.png` | 旧索引未映射 | pass |
| 21 | 82507BFB.png | Vampire / 吸血鬼 | `tokens/monsters/vampire.png` | 旧索引未映射 | pass |
| 22 | 45BAB5A0.png | Vampire Stunned side / 吸血鬼击晕面 | `tokens/monsters/vampire-stunned.png` | 旧索引未映射 | pass |
| 23 | CD029FDC.png | Faceless Man / 无面人 | `tokens/monsters/faceless-man.png` | 旧索引未映射 | pass |
| 24 | AA7188C6.png | Faceless Man Stunned side / 无面人击晕面 | `tokens/monsters/faceless-man-stunned.png` | 旧索引未映射 | pass |
| 25 | F7FCEBC3.png | Ghost / 幽灵 | `tokens/monsters/ghost.png` | 旧映射到 `tokens/monsters/ghost.png` | pass |
| 26 | 68469009.png | Ghost Stunned side / 幽灵击晕面 | `tokens/monsters/ghost-stunned.png` | 旧索引未映射 | pass |
| 27 | 551C0564.png | Troll Right Hand / 巨魔右手 | `tokens/monsters/troll-right-hand.png` | 旧索引未映射 | pass |
| 28 | 8165413E.png | Troll Right Hand Stunned side / 巨魔右手击晕面 | `tokens/monsters/troll-right-hand-stunned.png` | 旧索引未映射 | pass |
| 29 | 97361F05.png | Giant Hair Monster / 巨型毛发怪 | `tokens/monsters/giant-hair-monster.png` | 旧索引未映射 | pass |
| 30 | 27F3C860.png | Giant Hair Monster Stunned side / 巨型毛发怪击晕面 | `tokens/monsters/giant-hair-monster-stunned.png` | 旧索引未映射 | pass |
| 31 | 442F4782.png | Troll Left Hand / 巨魔左手 | `tokens/monsters/troll-left-hand.png` | 旧索引未映射 | pass |

## 探索者错名纠正

| 探索者 | 正确源文件尾段 | 正式目标 | 旧 target 状态 | 本轮状态 |
| --- | --- | --- | --- | --- |
| Rebecca Allen / 丽贝卡·艾伦博士 | 5BA7EE92.png | `tokens/explorers/rebecca-allen.png` | 旧 target 源图为 06AB53C7.png | pass |
| Darryl Highla / 达里尔·海拉 | 54384393.png | `tokens/explorers/darryl-highla.png` | 旧 target 源图为 8EDF6B9A.png | pass |

## 资源落盘校验

| 项 | 结果 |
| --- | --- |
| 用户范围源文件数 | 31 / 31 |
| 正式怪物 token PNG | 31 / 31 |
| 探索者纠错 PNG | 2 / 2 |
| PNG 尺寸 | 全部 384x336；正式对局素材保持源尺寸 |
| 资源索引 | 已写回 `docs/games/betrayal/sources/image-index/runtime-resource-map.json` |
| 压缩产物 | 已运行 `npm run compress:images -- public/assets/i18n/zh-CN/betrayal/tokens/monsters` 和 `npm run compress:images -- public/assets/i18n/zh-CN/betrayal/tokens/explorers`；正式素材 runtime 模式，不降采样 |
| manifest | 已运行 `node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id betrayal` 并通过 `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id betrayal` |
| 路径闭合抽查 | 本轮 `sharp` 脚本核对 33/33 个目标：PNG 均为 384x336，WebP 与 PNG 同尺寸，`assets-manifest.json` 同时存在源 PNG key 与 `compressed/*.webp` key |

## 远端抽样回查

本轮对正式资源域做抽样下载回查，确认返回来自服务器并与本地压缩产物字节一致：

| 对象 | HTTP | 资源来源 | 本地/远端字节 | MD5 是否一致 |
| --- | ---: | --- | ---: | --- |
| `tokens/monsters/compressed/jacks-spirit.webp` | 200 | `server` | 47384 / 47384 | pass |
| `tokens/monsters/compressed/bakeneko.webp` | 200 | `server` | 51458 / 51458 | pass |
| `tokens/monsters/compressed/troll-left-hand.webp` | 200 | `server` | 51532 / 51532 | pass |
| `tokens/explorers/compressed/rebecca-allen.webp` | 200 | `server` | 33764 / 33764 | pass |

## 文件哈希抽样

| 对象 | SHA-256 |
| --- | --- |
| Jack's Spirit / 杰克之灵 | `caae6aee3a2c4301499281ffdfd8c38d2d23ed7c16e6e53998c90999278fdb17` |
| Bakeneko / 化猫 | `37ad637078bca7971f97b30b502445f0482cc6d22943cadc297bb3109de8255c` |
| Troll Left Hand / 巨魔左手 | `93de0a4bcc51128d967dbff2547d68f1838fa958358e58460b7539592b8195ad` |
| Rebecca Allen / 丽贝卡·艾伦博士 | `c0cd4b2de0039d46da9ac5b8e71ea86144818735ea4d05902ff1835ecfab5c89` |
| Darryl Highla / 达里尔·海拉 | `603fc76b59557ab908fe427b2b37da891eee5e528d32973e4e05e19879915f6a` |
