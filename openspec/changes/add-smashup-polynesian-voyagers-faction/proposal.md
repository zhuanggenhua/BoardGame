# Change: 实装大杀四方波利尼西亚航海者

## Why

用户提供了波利尼西亚航海者（Polynesian Voyagers）的 3 行 × 4 列中文卡牌图集，希望将该种族实装到当前 Smash Up 项目中，并把图集作为 PR 内容一并上传给作者。

当前仓库已经存在该派系的 faction id、card atlas id、共享《文化冲击》基地 atlas id 与基地资源清单痕迹，但 `evidence/smashup/SMASHUP-CARD-COUNT-AUDIT.md` 仍标记波利尼西亚航海者未实现。本次变更需要把这条半接入状态补成正式可玩，而不能把已有基地 atlas 重复注册或覆盖其它文化冲击派系。

## Approval

- 当前状态：**待批准实施**。
- 本 proposal 只完成范围、来源和门禁定义；根据 OpenSpec 流程，批准后才进入运行时代码、资源复制、测试、上传和 PR 实施。

## What Changes

- 新增/补齐 `POLYNESIAN_VOYAGERS` 作为独立、可选择、可初始化、可结算的 Smash Up 派系。
- 将用户提供的卡牌图集接入正式 card atlas 资源路径，生成 runtime WebP，刷新游戏级与根级 asset manifest，并确保图集随 PR 进入提交范围。
- 复用仓库已有的共享《文化冲击》基地 atlas：`SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_BASES` / `smashup/base/polynesian_voyagers/atlas`，只补波利尼西亚航海者的 3 个基地定义与槽位映射，不新增重复基地 atlas。
- 录入 12 个唯一卡面，按数量构成 20 张牌：莫艾 4、蒂基 3、寻路者 2、毛伊人 1、8 种行动牌合计 10。
- 录入 3 个基地：岛链、岛峰、热带天堂。
- 补齐 card/base 静态定义、locale 文案、faction metadata、ability 注册、critical image preload、测试与 evidence。
- 按对象级矩阵实现移动到无己方随从基地、额外基地、+1 力量指示物、打在随从身上的行动、持续力量修正、计分后特殊保留与基地能力。
- 资源链完成压缩、manifest、服务器素材主源上传与代表 URL `HEAD 200` 回查；若环境阻塞，必须明确列出未上传对象和运行态风险。
- 最终提交、推送并打开 PR，PR 范围必须包含本轮代码、OpenSpec/evidence、卡牌 atlas 源图、压缩产物和 manifest 改动。

## Source Contract

- 主真相源（卡牌图集）：
  - 路径：`C:/Users/Dqm/.codex/attachments/edfb15a2-6220-4da3-b98b-0e9be4fd8690/image-1.png`
  - 尺寸：`1944 x 2048`
  - 文件大小：`11,247,201 bytes`
  - SHA-256：`97299d31a0a98eba7e00411e75a612ad8cf3611fb1c25fec3349a73901b677d8`
  - 用途：中文图面、中文名称、中文规则文本、card atlas row-major 顺序。
- 已存在共享基地 atlas：
  - 源图路径：`public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/atlas.png`
  - 尺寸：`2100 x 1126`
  - 文件大小：`4,793,419 bytes`
  - SHA-256：`253dda49b347392e8657fdb2cda21a7b6ea4cfa667421e44b821d38756c6e0be`
  - 压缩图：`public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/compressed/atlas.webp`
  - 压缩图 SHA-256：`31f4179b388ed1063b20c65f9cb6c5eeb95474b352321fac756939712fa468b0`
  - 用途：波利尼西亚航海者基地与其它文化冲击派系共享基地 atlas。
- 对照源：
  - AEG Smash Up rulebook: `https://smashup-rulebook.alderac.com/wiki/Polynesian_Voyagers`
  - 用途：英文 canonical 名称、英文规则文本、牌张数量、基地 breakpoint/VP/正文对照。
- 初步 atlas 合同：
  - 卡牌图集：`rows=3, cols=4`，row-major 槽位 `0-11` 对应用户图中的 12 张唯一卡面。
  - 基地图集：`rows=3, cols=4`，row-major 槽位 `8=Island Chain`、`9=Island Peak`、`10=Tropical Paradise`。
- 待 implementation 前锁定：
  - 每张卡完整单卡裁图、可读性、名称、类型、力量、数量、效果原文与原子子句。
  - 中文 faction 显示名最终采用 `波利尼西亚航海者` 还是既有 `波利尼西亚人` 的兼容口径。
  - 每个效果的共享机制复用点与仍需扩展的 domain/helper。

## Coordination

- 当前 worktree 位于 `codex/smashup-pod-card-art`，工作区已有大量 Smash Up POD/其它派系未提交改动。
- 本 change 的文件和证据必须独立落在 `add-smashup-polynesian-voyagers-faction` / `evidence/smashup/*polynesian-voyagers*`，共享注册文件只允许增量追加，不回滚、不重排、不覆盖现有 POD 和文化冲击改动。
- 现有 `SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_CARDS`、`SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_BASES` 与 `SMASHUP_FACTION_IDS.POLYNESIAN_VOYAGERS` 优先作为既有合同复用；若当前 diff 里这些 ID 归属其它未提交任务，实施前必须先做共享文件 diff 锁定。
- 因用户明确要求 PR，本轮最终需要提交、推送并开 PR；但提交范围必须只纳入本 change 及用户明确允许随本 PR 一起带上的已有改动。

## Impact

- Affected specs:
  - 新增 `smashup-polynesian-voyagers-faction`
  - `smashup-faction-registry`
  - `smashup-faction-batch-workflow`
  - `game-asset-preloading`
  - `asset-manifest`
- Affected code and assets after approval:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/data/factions/polynesian_voyagers.ts`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/abilities/polynesian_voyagers.ts`
  - `src/games/smashup/abilities/index.ts`
  - `src/games/smashup/ui/factionMeta.ts`
  - `src/games/smashup/criticalImageResolver.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/i18n/zh-CN/smashup/cards/polynesian_voyagers.*`
  - `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
  - `public/assets/i18n/assets-manifest.json`
  - `src/games/smashup/__tests__/`
  - `e2e/smashup/`
  - `evidence/smashup/`
