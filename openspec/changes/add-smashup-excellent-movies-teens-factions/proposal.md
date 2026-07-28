# Change: Smash Up 动作英雄 / 返时者 / 异形变体 / 青少年 / 怨灵捕手实装

## Why

用户提供了一张包含五组 Smash Up 新派系卡图的拼图，并要求“将以上种族进行实装，按照流程”。这些派系不是单纯静态展示，包含 stasis、牌库顶打出、幽灵行动等新机制，必须按项目的新派系 intake → implementation 流程拆解。

## Approval

- 当前状态：**待批准实施**。
- 已完成 preflight：记录原图元数据、生成 10×7 总览与 70 张单槽裁图、确认本图不是当前未提交 Disney 四派系 change。
- 根据 OpenSpec 流程，批准前只维护 proposal / design / tasks / preflight evidence，不进入运行时代码、资源发布或玩法实现。

## What Changes

- 新增动作英雄（Action Heroes）、返时者（Backtimers）、异形变体（Extramorphs）、青少年（Teens）和怨灵捕手（Wraithrustlers）五个可选 faction。
- 以用户图片为主真相源，建立裁图、卡牌/基地来源合同、locale 文案、atlas 索引和 implementation handoff。
- 接入 card/base 静态数据、faction metadata、atlas catalog、critical image resolver、i18n key 与卡牌注册。
- 实现或扩展五组派系所需玩法机制，包括 stasis 生命周期、从牌库顶使用/揭示牌、幽灵行动/Wraith 结算、同数值/同类别协同和代表性动作英雄单随从链路。
- 补充对象级审计、行为测试、真实入口 E2E、截图证据、资源压缩/manifest/服务器素材主源回查。

## Source Contract

- 主真相源：
  - 路径：`C:/Users/Dqm/.codex/attachments/abf0887d-b89b-4aec-8493-d88ecbd0a3fc/image-1.png`
  - 尺寸：`5000 × 4888`
  - 文件大小：`42,388,920 bytes`
  - SHA-256：`a9714cc812f55e62d8f1e7dede010a5838dc2ecf4ef17f031a17bedd6b1cd720`
  - 用途：中文图面、中文牌名、中文规则文本、row-major 槽位顺序。
- Preflight 裁图：
  - 总览：`temp/smashup-excellent-movies-teens-intake/overview-2200w.png`
  - 网格总览：`temp/smashup-excellent-movies-teens-intake/overview-grid-2200w.png`
  - 单槽裁图：`temp/smashup-excellent-movies-teens-intake/cards/slot-00-r1c1.png` 到 `slot-69-r7c10.png`
- 初步范围判断：
  - slots `00-16`：动作英雄（Action Heroes）
  - slots `17-28`：返时者（Backtimers）
  - slots `29-40`：异形变体（Extramorphs）
  - slots `41-53`：青少年（Teens）
  - slots `54-65`：怨灵捕手（Wraithrustlers）
  - slots `66-69`：黑底空槽 / 非卡牌尾格
- 对照源候选：
  - AEG 官方 `SU_ExcellentMoviesDude_Rulebook.pdf`：Excellent Movies, Dudes! 的四派系、基地、Stasis / Stored Cards 规则；已下载到 `temp/smashup-excellent-movies-teens-intake/sources/` 并抽取文本。
  - AEG 官方 rulebook 页面：Action Heroes、Backtimers、Extramorphs、Wraithrustlers、Teens 的 canonical 名称、卡牌数量、FAQ/clarifications 对照；已下载到 `temp/smashup-excellent-movies-teens-intake/sources/aeg-*.html`。
  - Fandom 页面：尝试下载时被 Cloudflare challenge 拦截；本轮不将其作为已锁来源。
- 待 intake 锁定：
  - 每张卡的完整原文、card type、subtype、copy count、power、ability atom、运行时入口。
  - Excellent Movies 四派系的 8 张基地与 Teens 配套基地/来源口径。
  - 中文 faction 名称是否沿用图面译名，或采用项目既有中文命名体系。
  - 三个图面标题与 AEG 候选名存在 alias 风险：动作英雄 `Rescue Mission` ↔ `Hostage Rescue`、返时者 `From the Past` ↔ `Help From the Past`、青少年 `Abe Froman` ↔ `Abe Frohman`。

## Impact

- Affected specs: `smashup-faction-registry`, `smashup-ability-runtime`
- Affected code: `src/games/smashup/domain/*`, `src/games/smashup/data/*`, `src/games/smashup/abilities/*`, `src/games/smashup/ui/*`, Smash Up locale files, Smash Up tests, `evidence/smashup/*`
- Non-goals: 不改已有基础派系语义；不把当前工作区里未提交的其他 Smash Up POD 批次混入本 change；不在 proposal 批准前开始运行时代码实现。
