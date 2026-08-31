# 法师战争首轮运行时素材命名与落点计划

> 状态：`foundation-runtime-assets-pass / server-and-android-verified`。OpenSpec `add-mage-wars-foundation` 已获批准；首轮可见素材已按语义路径复制到正式资源目录，并完成运行时压缩、manifest、学徒 atlas config、`CardPreview` 注册、`criticalImageResolver` 预加载、真实 Board 页面消费、服务器素材主源回查和 Android 游戏素材包回查。完整证据见 `docs/games/mage-wars/foundation-completion-self-audit.md` 与 `docs/games/mage-wars/design/generated/runtime-resource-chain-audit.md`。

## 2026-07-29 完成快照

| 项 | 当前结论 |
| --- | --- |
| 本地正式资源 | `public/assets/i18n/zh-CN/mage-wars/**` 已落盘并压缩；首轮素材使用语义路径，不沿用 URL 随机名。 |
| 运行时代码引用 | `Board.tsx` 通过 `OptimizedImage`、`CardPreview`、正式 atlas config 和 `criticalImageResolver` 消费竞技场、法师、学徒法术、卡背、token 和攻击骰。 |
| 真实页面验证 | `node scripts/infra/run-e2e-single.mjs default e2e/mage-wars/foundation-board-runtime.e2e.ts` 于 2026-07-29 03:22-03:24 +08:00 复跑通过，桌面和移动横屏截图重新落盘，文件时间分别为 03:23:54 与 03:24:00。 |
| 服务器 / App 资源链 | 服务器公开资源、atlas JSON、游戏级 manifest、Android file-index 和完整 ZIP 回查通过；详见 `runtime-resource-chain-audit.md`。 |
| 仍不在范围 | 全 322 张法术、自由构筑、四人模式、豪华竞技场、扩展法师、完整 AI、教程、行动日志 UI 和撤回 UI。 |

## 命名原则

- 正式资源使用小写 kebab-case，不沿用 Steam/Tumblr/ax1x 随机 URL 文件名。
- 大型 atlas 保留为 atlas 源图，先建立裁切合同和 frame 命名；不把整张 atlas 当单卡运行时素材。
- 所有正式图片默认落到 `public/assets/i18n/zh-CN/mage-wars/...`。
- 代码引用时使用逻辑路径，例如 `mage-wars/board/standard-arena`，不写 `/assets/`、`compressed/`、`.webp`。

## 首轮素材计划

| 规则对象 | 源文件 | 拟正式名 | 拟正式落点 | 运行时用途 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| 标准竞技场 | `httpcloud3steamusercontentcomugc1702910670704188662A394920C000036951DA1D3F7A636CC61ECFC9445.jpg` | `standard-arena.jpg` | `public/assets/i18n/zh-CN/mage-wars/board/standard-arena.jpg` | 主棋盘底图；后续叠加 12 区域命中区 | local-asset-ready |
| 法师状态板 | `httpcloud3steamusercontentcomugc16274784517920313953F5AE90D6DBBD8CCA4F25724A93E2ECD386561E2.png` | `mage-status-board.png` | `public/assets/i18n/zh-CN/mage-wars/boards/mage-status/mage-status-board.png` | 法师生命、法力池、聚魔、伤害轨道底板；规则 p6-p7 | local-asset-ready |
| 红 / 黑状态方块 | Workshop 内置 `BlockSquare`；红色 `ColorDiffuse r=0.856,g=0.099998,b=0.093998`；黑色 `ColorDiffuse r=0.0980377,g=0.0980377,b=0.0980377` | 程序化方块 | 不落图片；坐标合同见 `docs/games/mage-wars/design/implementable/board-coordinate-contract.md` | 状态板聚魔、法力池、生命、伤害轨道标记 | source-locked-programmatic |
| 法师牌 atlas | `httpcloud3steamusercontentcomugc162747851276256917931A9A1D74C791E1674ECB5D2262EBBBA79674D32.png` | `mages-core-atlas.png` | `public/assets/i18n/zh-CN/mage-wars/cards/mages/mages-core-atlas.png` | 邪术师、巫师、女祭司、兽王等法师牌裁片源 | local-asset-ready |
| 法师牌补充 atlas | `httpcloud3steamusercontentcomugc1627478512762575428D041ADFAE99C7BE7669CDE898547D216E424BED5.png` | `mages-supplement-atlas.png` | `public/assets/i18n/zh-CN/mage-wars/cards/mages/mages-supplement-atlas.png` | 战神等后续法师牌裁片源；首轮默认不使用 | planned-out-of-scope |
| 通用卡背 | `httpcloud3steamusercontentcomugc1725416402719671791BB79007C02B5E0E42D97FF6D1CF78BA3C79EF9C4.jpg` | `spell-card-back.jpg` | `public/assets/i18n/zh-CN/mage-wars/cards/backs/spell-card-back.jpg` | 法术书未知内容、已计划法术背面、隐性结界和弃牌堆翻看入口背面 | local-asset-ready |
| 横向卡背 | `httpcloud3steamusercontentcomugc1725416402719847600782167FB0498E3E21CD711683F78E4B1B642E606.jpg` | `wall-card-back.jpg` | `public/assets/i18n/zh-CN/mage-wars/cards/backs/wall-card-back.jpg` | 墙体/横向卡背；是否首轮使用由学徒清单裁定 | local-asset-ready |
| 攻击骰贴图 | `https40mediatumblrcomc6fcb742b9b66d90bef404852e09a317tumblrnvh8swsaWv1uhjh6fo11280png.png` | `attack-die-texture.png` | `public/assets/i18n/zh-CN/mage-wars/dice/attack-die-texture.png` | 攻击骰视觉；优先 2D 骰面或简化骰子 | local-asset-ready |
| 效果骰 | Workshop 内置 `Die_12`；蓝色 `ColorDiffuse r=0.117999949,g=0.53,b=1` | 程序化 12 面骰 | 不落图片；坐标/物件合同见 `board-coordinate-contract.md` | 效果骰视觉与结果显示；不得用普通 D6 或文本替代 | source-locked-programmatic |
| 就绪标记正面 | `httpcloud3steamusercontentcomugc1627478451792267951C0E7FD1247835F627FE138F5BD8C025497D167CC.png` | `ready-token-front.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/action/ready-token-front.png` | 就绪/冷却标记正面 | local-asset-ready |
| 就绪标记背面 | `httpcloud3steamusercontentcomugc1627478451792268407C6C14ADDD086BE07EA7E31DC28F7C33138B80DF8.png` | `ready-token-back.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/action/ready-token-back.png` | 就绪/冷却标记背面 | local-asset-ready |
| 红色行动标记正面 | `https40mediatumblrcomfa20e01096137870a08f4613138420d6tumblro1kwvyH7gl1uhjh6fo3100jpg.jpg` | `action-marker-red-front.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/action/action-marker-red-front.png` | 两人设置红方行动标记正面；规则 p7 | local-asset-ready |
| 红色行动标记背面 | `https40mediatumblrcomb262b5afef1cb60d5393aead5e640db1tumblro1kwvyH7gl1uhjh6fo4100jpg.jpg` | `action-marker-red-back.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/action/action-marker-red-back.png` | 两人设置红方行动标记背面；规则 p7 | local-asset-ready |
| 蓝色行动标记正面 | `https41mediatumblrcom3a827079f5d1b080f678145ec577775atumblro1kwvyH7gl1uhjh6fo1100jpg.jpg` | `action-marker-blue-front.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/action/action-marker-blue-front.png` | 两人设置蓝方行动标记正面；规则 p7 | local-asset-ready |
| 蓝色行动标记背面 | `https41mediatumblrcom9b24dabe7472a7c79008d81642c76989tumblro1kwvyH7gl1uhjh6fo2100jpg.jpg` | `action-marker-blue-back.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/action/action-marker-blue-back.png` | 两人设置蓝方行动标记背面；规则 p7 | local-asset-ready |
| 快速施法标记正面 | `httpcloud3steamusercontentcomugc16939036219658095369DD80C0825ED7F6166BB7FA96DFAED1C9A746938.png` | `quickcast-marker-front.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/quickcast/quickcast-marker-front.png` | 黑色快速施法标记白色符号面；规则 p7 | local-asset-ready |
| 快速施法标记背面 | `https40mediatumblrcom3bbf7d9a48e1077d961a4e6b7444ad12tumblro1kxldjgqh1uhjh6fo2100jpg.jpg` | `quickcast-marker-back.jpg` | `public/assets/i18n/zh-CN/mage-wars/tokens/quickcast/quickcast-marker-back.jpg` | 黑色快速施法标记冷却面；规则 p7 | local-asset-ready |
| 伤害标记正面 | `httpcloud3steamusercontentcomugc16274784517922581910C488293AA7FF65FA3618166528783082704A008.png` | `damage-token-front.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/damage/damage-token-front.png` | 伤害标记正面 | local-asset-ready |
| 伤害标记背面 | `httpcloud3steamusercontentcomugc16274784517922585215001DAAE6CDF3978EBD8C3C28B76C2F97D8769AD.png` | `damage-token-back.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/damage/damage-token-back.png` | 伤害标记背面 | local-asset-ready |
| 聚魔标记正面 | `httpcloud3steamusercontentcomugc1627478451792264709AB582815315524A6BCFA8507AEB4580ED0ED318D.png` | `channeling-token-front.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/channeling/channeling-token-front.png` | 聚魔标记正面；Workshop `聚魔` 袋 / deck `203` | local-asset-ready |
| 聚魔标记背面 | `httpcloud3steamusercontentcomugc16274784517922651900947861533658EC9F4DF7B7ABCEA6B40D48BC501.png` | `channeling-token-back.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/channeling/channeling-token-back.png` | 聚魔标记背面；Workshop `聚魔` 袋 / deck `203` | local-asset-ready |
| 守卫 | `httpcloud3steamusercontentcomugc162747845179219110241FD9978DBED6A7FA3C3773D64C9B7BB20728A93.png` | `guard-token.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/status/guard-token.png` | 守卫状态 | local-asset-ready |
| 燃烧 | `httpcloud3steamusercontentcomugc1627478451792809358FAAFDD8C9A05EB031CB4859CB28B04948152A3C6.png` | `burn-token.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/status/burn-token.png` | 燃烧状态 | local-asset-ready |
| 腐化 | `httpcloud3steamusercontentcomugc1627478451792831015544503F2A35FEE1042B4E82F6B7DDBC41783AABD.png` | `rot-token.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/status/rot-token.png` | 腐化状态 | local-asset-ready |
| 眩晕 | `httpcloud3steamusercontentcomugc16274784517928368401B6E7C37FA07F89E5B381B349D82D94FC17F2DED.png` | `daze-token.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/status/daze-token.png` | 眩晕状态 | local-asset-ready |
| 昏迷 | `httpcloud3steamusercontentcomugc16274784517928052134B3C4713E6E0B51D63AFCBC9C4244037FF2F611E.png` | `stun-token.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/status/stun-token.png` | 昏迷状态 | local-asset-ready |
| 沉睡 | `httpcloud3steamusercontentcomugc162747845179285712670BD653127F21E74664F4EDC30C8B1264F56873E.png` | `sleep-token.png` | `public/assets/i18n/zh-CN/mage-wars/tokens/status/sleep-token.png` | 沉睡状态 | local-asset-ready |

## 本轮落盘与验证证据

| 项目 | 证据 |
| --- | --- |
| 正式源图落盘 | `public/assets/i18n/zh-CN/mage-wars/**` 下已复制 34 张首轮素材源图 |
| 运行时压缩 | `npm run compress:images -- public/assets/i18n/zh-CN/mage-wars`，处理 34 张，输出 WebP 约 75.18 MB |
| 尺寸核验 | 源图与 `compressed/*.webp` 批量比对；新增法师状态板为 `3093x1628 -> 3093x1628`，快速施法标记为 `80x80 -> 80x80`、`86x78 -> 86x78`，未降采样 |
| 游戏资源 manifest | `node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id mage-wars` 已生成 `public/assets/i18n/zh-CN/mage-wars/assets-manifest.json` |
| atlas-config manifest | `node scripts/assets/generate_asset_manifests.js --root public/assets --id atlas-configs` 已更新 `public/assets/atlas-configs/assets-manifest.json` |
| 法师 atlas config | `public/assets/atlas-configs/mage-wars/mages-core-atlas.json`，8 个 frame，覆盖四名学徒法师牌和肖像 |
| 学徒法术 atlas config | `public/assets/atlas-configs/mage-wars/apprentice-spell-atlases.json`，91 个 frame，覆盖 deck `17/18/19/22/28/29/34/35/36/37` |

## Atlas / 配置计划

| Atlas | 计划配置 | 阻塞点 |
| --- | --- | --- |
| `mages-core-atlas` | 已建 `public/assets/atlas-configs/mage-wars/mages-core-atlas.json`，记录四名学徒法师牌和肖像 frame，并由 `src/games/mage-wars/ui/cardAtlas.ts` 注册为 `CardPreview` 图集 | runtime-preview-wired |
| `spell-apprentice-*` | 已建 `public/assets/atlas-configs/mage-wars/apprentice-spell-atlases.json`，按 91 张学徒法术字段合同建立 frame，并追加首批来源卡 `2218` / `2908` frame；由 `src/games/mage-wars/ui/cardAtlas.ts` 注册为 `CardPreview` 图集 | runtime-preview-wired / first-batch-source-card-frames |
| `status-tokens` | 小图已直接落盘并压缩；暂不强制合并 atlas | 需要确认法力指示物、效果骰等剩余对象；聚魔 token、红/蓝行动标记、快速施法标记已 local-asset-ready |
| `board-coordinate-contract` | 已建 `docs/games/mage-wars/design/implementable/board-coordinate-contract.md`，记录完整标准竞技场 `4x3` 坐标、状态板三轨道、红 / 黑状态方块和效果骰内置来源 | 半场模式不再作为运行时前置；独立法力指示物仍不进入完成态主 UI |

## 压缩与 manifest 计划

1. 已复制 `local-asset-ready` 素材到正式资源目录。
2. 已运行 `npm run compress:images -- public/assets/i18n/zh-CN/mage-wars`。
3. 已生成游戏资源 manifest 和 atlas-config manifest。
4. 已新增 `src/games/mage-wars/ui/cardAtlas.ts`，通过正式 atlas config 注册法师和学徒法术牌 `CardPreview`。
5. 已新增 / 更新 `src/games/mage-wars/criticalImageResolver.ts`，将标准竞技场、法师状态板、法师 atlas、法术卡背、攻击骰和基础 token 放入 `critical`，将 10 个学徒法术 atlas、墙背和状态 token 放入 `warm`。
6. 后续 Board 运行时代码只允许通过 `OptimizedImage`、`getOptimizedImageUrls`、`CardPreview` 或现有 atlas loader 引用逻辑路径。
7. 已完成真实 Board 页面消费、服务器素材主源回查和 Android 游戏素材包回查；当前 foundation 资源链可按 `runtime-resource-chain-audit.md` 收口。

## 当前不能宣称完成的点

- 不能宣称完整 Mage Wars 素材链完成；全 322 张法术、完整自由构筑、四人模式、豪华竞技场和扩展法师属于后续 change。
- 不能把历史学徒半场重新带回运行时；当前 Board 只锁完整 `4x3` / `12` 区域映射。
- 不能把独立法力指示物画成已完成素材；主 UI 法力读数走用户已批准的自制运行态 HUD。
- 不能把 Open Design v6 / v7 视觉稿写成用户已批准或当前可验收；旧 AI_PASS 已撤销，下一步必须重出 v8。
