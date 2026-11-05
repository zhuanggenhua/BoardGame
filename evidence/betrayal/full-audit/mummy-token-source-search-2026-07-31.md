# 木乃伊大怪物 token 源素材搜索记录（2026-07-31）

> 2026-09-19 当前裁定：本文件保留 2026-07-31 至 2026-09-18 的历史来源搜索记录，但当前木乃伊 portrait 按用户决定直接使用，不再标记为“临时占位”，也不再作为小黑屋牌效审计阻塞。当前资源索引状态以 `runtime-user-accepted` 为准。

## 前提锁定

| 项 | 当前锁定 |
| --- | --- |
| 问题对象 | 第 1 剧本「木乃伊横行」要求的「木乃伊怪物标记(大)」与木乃伊怪物图面 |
| 真相来源 | 旧版 / 基础版中文叛徒书正文、当前本地图包、运行时资源目录、资源索引和当前代码引用 |
| 目标入口/环境 | 当前工作区 `D:\gongzuo\webgame\BoardGame`；本地图包 `D:\gongzuo\webgame\gameasset\山屋惊魂(小黑屋)第三版（渣图汉化自用)\Mods\Images` |
| 验收口径 | 只有能从正式素材源追溯到源图、压缩产物、manifest / 索引 key，并在地图真实显示该对象，才算木乃伊 token 图面完成 |

## 规则要求

旧版 / 基础版中文叛徒书写明：拿出「木乃伊怪物标记(大)」。因此木乃伊不是普通小型怪物 1-6，也不能用狼人、幽灵、怪物卡、文字壳、红色占位或其它 token 顶替。

## 当前运行态事实

| 项 | 结论 |
| --- | --- |
| 运行态木乃伊对象 | 已存在；木乃伊移动、攻击、偷取、胜负等行为链已有代表证据 |
| 当前代码引用 | `portraitAsset: 'betrayal/monsters/mummy'`；`tokenAsset: 'betrayal/tokens/monsters/mummy.svg'` |
| 当前正式资源 | 地图 token `tokens/monsters/mummy.svg` 已存在，来源为 Openclipart 324162；`monsters/mummy.png` 与压缩图按用户裁定直接作为当前运行时图面使用；旧 `large-monster-front` 文件只保留为历史占位，不是当前木乃伊地图 token |
| 当前 manifest / 索引 | `assets-manifest.json` 与 `runtime-resource-map.json` 已登记 `tokens/monsters/mummy`；`monsters/mummy` 当前登记为 `runtime-user-accepted`；旧 `large-monster-front` 标为 `legacy-placeholder-not-current-runtime` |

## 本地图包搜索范围

| 搜索面 | 结果 |
| --- | --- |
| 文字搜索 | 在本地山屋图包目录中搜索 `mummy`、`木乃伊`、`large monster`、`monster token`、`standee`、`figure`；只命中规则书 / PDF 文本，没有命中图片文件名或 Workshop 对象名 |
| 384x336 token 组 | 共 51 张；图面包含探索者 token、符号 marker、Jack's Spirit、Head of the House、Demon、Dark Queen、Ghost Shark、Construct、Bakeneko、Giant Wasp、Demon Dog、Werewolf、Vampire、Faceless Man、Ghost、Troll Right Hand、Giant Hair Monster、Troll Left Hand 和多张 Stunned 面；未发现木乃伊 |
| 450x450 marker 组 | 共 28 张；为数字、祭坛、祝福、血、契约、食物、隐藏、知识、力量、巢穴、障碍、传送门、神志、已搜索、速度、开关、属性、录像带等标记；未发现木乃伊 |
| 小型怪物双面组 | 已登记小型怪物 1-6 与正面裁片；它们不是木乃伊大怪物 token |
| 怪物卡 / 怪物板 | 已核狼人、魔爪响叮当、精灵等图面；未发现木乃伊怪物卡或木乃伊 portrait |
| 其它候选尺寸 | 核过 1004x1004、404x406、1507x1441、1577x1508、1800x1800、2048x2048 等候选 contact sheet；未发现木乃伊图面 |

## TTS Workshop 脚本复核

2026-07-31 追加复核 `D:\gongzuo\webgame\gameasset\山屋惊魂(小黑屋)第三版（渣图汉化自用)\Mods\Workshop\3420850553.json`，避免只看 `Mods\Images` 漏掉脚本内对象线索。

| 搜索面 | 结果 |
| --- | --- |
| TTS 存档对象树 | 顶层 `ObjectStates` 共 172 个，展开对象 528 个；对象名、昵称、描述、脚本字段中未命中 `mummy`、`木乃伊`、`coffin`、`sarcophagus`、`large monster`、`standee` 等木乃伊相关线索 |
| 袋子清单 | 存在 `大型怪物标志物` 袋（GUID `e82075`，16 个对象），但其 16 个 `Custom_Token` 均为 3e 普通怪物 token URL：杰克之灵、宅邸之首、恶魔、黑暗女王、幽灵鲨、构装体、化猫、巨蜂、恶魔犬、狼人、吸血鬼、幽灵、巨魔右手、巨型毛发怪、巨魔左手、无面人；未包含木乃伊 |
| 未命名立体棋子 | TTS 中只有 4 个 `Figurine_Custom`，均位于扩展包袋 `圣诞扩` / `血月扩`；已下载正反面 8 张图并生成 contact sheet `evidence/betrayal/full-audit/assets/mummy-tts-figurine-candidates-2026-07-31.png`；图面分别为羊角恶魔、触手怪、狼人、普通人形，不是木乃伊 |
| 资源 URL 盘点 | TTS 存档内可解析图像/牌组/模型相关对象 392 个，唯一资源 URL 193 个；可命名对象和可疑立体棋子均未提供木乃伊大怪物 token 或木乃伊 portrait |

## Models / Assetbundles 复核

2026-07-31 追加复核 `Mods\Models` 和 `Mods\Assetbundles`，用于回答“木乃伊是否藏在 model 文件夹”。

| 搜索面 | 结果 |
| --- | --- |
| `Mods\Models` 文件清单 | 只有 5 个 `.obj`：圆环模型、`MonsterToken.blend` 小怪物圆片模型、`MonsterTokenCollision.blend` 碰撞体、通用 cube / tile 模型、桌面/棋盘平面模型；没有以 mummy / 木乃伊 / coffin / sarcophagus / 大型怪物命名的模型文件 |
| `Custom_Model` 脚本引用 | TTS 存档中共有 95 个 `Custom_Model`，按 `MeshURL + DiffuseURL + ColliderURL` 聚类后为 23 组；其中 20 组是 `Small Monster 1` 到 `Small Monster 20` 的小型怪物圆片贴图，另有 48 个空昵称通用模型和 25 个无贴图圆环模型；没有木乃伊命名或木乃伊图面 |
| 模型贴图复核 | 已把全部 21 个唯一模型贴图生成拼图 `evidence/betrayal/full-audit/assets/mummy-model-diffuse-candidates-2026-07-31.png`；图面为小型怪物 1-20 与通用空白贴图，不是「木乃伊怪物标记(大)」 |
| `Mods\Assetbundles` 文件清单 | 有 17 个 `.unity3d`；TTS 对应对象为桌子、桌柜、桌面扩展，以及 12 个探索者 3D 角色模型（如神父梁沃伦、杰登·琼斯、奥利弗·斯威夫特等）；没有怪物或木乃伊对象 |
| 二进制文本搜索 | 在 `Images`、`Models`、`Assetbundles`、`Workshop` 中搜索 `mummy`、`木乃伊`、`coffin`、`sarcophagus`、`tomb`、`crypt`、`large monster`、`大型怪物`；除 Workshop JSON 中的袋子名「大型怪物标志物」外，没有任何模型、AssetBundle 或图片文件命中 |

## 裁定

当前本地 3e 图包、TTS Workshop 存档、`Models` 和 `Assetbundles` 都没有可确认的木乃伊正式 portrait 源素材。地图 token 的缺口已由 Openclipart 324162 SVG 收掉，并已接入当前代码、manifest 和资源索引；用户点名的 384x336 怪物 / Stunned token 范围已在 `token-384x336-intake-correction-2026-07-31.md` 中完成正式录入，这些都不解除 portrait 源图缺失结论。

2026-07-31 用户批准先占位后，已新增明确写有「临时占位 / 缺正式源图」的运行时占位资源：

- `public/assets/i18n/zh-CN/betrayal/tokens/monsters/large-monster-front.png`
- `public/assets/i18n/zh-CN/betrayal/tokens/monsters/compressed/large-monster-front.webp`
- `public/assets/i18n/zh-CN/betrayal/monsters/mummy.png`
- `public/assets/i18n/zh-CN/betrayal/monsters/compressed/mummy.webp`

其中 `large-monster-front` 只解决历史运行时缺图 / 404，当前不再是木乃伊地图 token；`mummy.png` / 压缩图只解决 portrait 运行时缺图 / 404，不等于正式 portrait 完成。`runtime-resource-map.json` 已把旧 token 标为 `legacy-placeholder-not-current-runtime`，把 portrait 标为 `temporary-runtime-placeholder`，最终 P0 仍必须回到正式 portrait 源图补录。

本地与远端验证：

| 验证项 | 结果 |
| --- | --- |
| JSON / manifest | `runtime-resource-map.json` 与 `assets-manifest.json` 可解析；manifest 已登记当前 `tokens/monsters/mummy` 和仍占位的 `monsters/mummy`，旧 `large-monster-front` 只作历史兼容 |
| manifest 校验 | `node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id betrayal --validate` 通过 |
| 图片尺寸 | 当前地图 token `mummy.svg` 为公开 SVG；`mummy.png/webp` 为 1004x1004 的临时 portrait 占位 |
| 代码预加载 | 当前地图 token 使用 `betrayal/tokens/monsters/mummy.svg`，portrait 使用 `betrayal/monsters/mummy`；`npx eslint src/games/betrayal/criticalImageResolver.ts` 0 errors |
| 服务器运行时对象 | 已发布 `official/i18n/zh-CN/betrayal/tokens/monsters/compressed/large-monster-front.webp` 与 `official/i18n/zh-CN/betrayal/monsters/compressed/mummy.webp`；公开回查均为 `200 OK`、`X-Asset-Source: server`，大小分别为 10764 / 28934 bytes |

## 2026-09-18 修订记录

- 地图 token 已改为 `public/assets/i18n/zh-CN/betrayal/tokens/monsters/mummy.svg`，来源 `https://openclipart.org/download/324162`，并已写入 `runtime-resource-map.json`、`assets-manifest.json` 和 `monsterDefinitions.ts`。
- 旧 `large-monster-front` 保留为历史占位记录，不再作为当前木乃伊运行时 token，也不能作为正式素材完成证据。
- 木乃伊 portrait 仍使用明确标注的临时占位；本轮没有找到可确认正式 portrait 源图，因此整体素材阻塞没有解除。

## 2026-09-18 外部来源复核

- 复核了公开可检索的官方规则 PDF / 叛徒书资料，以及“替换木乃伊 token”类公开页面；这些资料能证明木乃伊规则对象或展示替换件照片，但没有提供可直接纳入本项目正式资源链的、可追溯来源与授权信息的 portrait 源文件。
- 替换件页面照片不是项目源图，不能直接裁进 `public/assets/` 冒充正式素材；未获用户批准的通用公共域 mummy clipart 也只能保留为候选，不能自动替代游戏 portrait。
- 因此本次外部复核没有解除 `betrayal/monsters/mummy` 的 `temporary-runtime-placeholder`，也没有把候选图写入运行时。

## 2026-09-19 当前裁定回写

- 上述外部来源搜索结论继续保留为历史记录：当时没有找到可确认的正式 portrait 源图。
- 当前不再要求把 portrait 替换成另一份源图；用户已明确接受现有运行时图面，当前审计按 `runtime-user-accepted` 处理。
- 因此本文件不再提出“找到正式 portrait 源图”作为本轮小黑屋牌效审计的解阻条件；后续只有用户要求换图或出现资源回归时才重新启动素材来源审计。

历史最小解阻动作（当前不再阻塞牌效审计）：

1. 提供或定位正式旧版 / 基础版木乃伊 portrait 源图。
2. 将确认后的源图落到 `public/assets/i18n/zh-CN/betrayal/monsters/mummy.png`。
3. 按正式素材流程生成 `compressed/mummy.webp`，更新 manifest / 资源索引。
4. 回到真实怪物详情 / 地图入口验证 portrait 使用正式源图，不能继续把临时占位当完成证据。
