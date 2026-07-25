# Change: 实装大杀四方迪士尼四派系

## Why

用户提供了一张大杀四方风格的中文卡牌 contact sheet，希望将图中四个迪士尼派系按项目新增派系流程做到可推送作者的程度。

图中可识别为四个 15 张牌组：

- 超能陆战队（Big Hero 6）
- 冰雪奇缘（Frozen）
- 狮子王（The Lion King）
- 花木兰（Mulan）

当前仓库尚未注册这四个派系。本次变更需要先按图片录入流程锁定来源合同、逐卡裁图与规则子句，再进入静态接入、玩法实现、审计、E2E 和资源发布收口；不得把缩略图识别、卡图可见或派系可选误报成玩法完成。

## Approval

- 当前状态：**已批准实施**。
- 用户已批准 `add-smashup-disney-four-factions`，并要求新建干净 worktree 实施；本轮以 `D:/GA/BoardGame-smashup-disney-four-factions-clean-20260725` 为唯一实现现场。
- 发布目标为“可推送作者审查的本地分支 / handoff 包”；实际 push 或 PR 仍需用户后续明确口令。

## What Changes

- 新增 `BIG_HERO_6`、`FROZEN`、`LION_KING`、`MULAN` 四个可选择派系。
- 以用户提供图片为本轮中文图面、中文名称、中文规则文本和 row-major 顺序的主真相源。
- 先把整图按四派系各 15 张切成完整单卡主裁图；缩略 contact sheet 只用于范围识别，不用于定稿费用、力量、效果限定词或索引。
- 建立真相源表、切图表、逐卡核对合同表、对照表、冲突待裁定表、可视合同表和 implementation handoff 包。
- 接入正式运行时 card atlas、faction/card 静态数据、双语 locale、faction metadata、critical image preload 与 manifest。
- 若缺少配套基地 atlas，本轮不得猜造基地；必须先登记为 `blocked` 或明确采用用户批准的临时基地口径。
- 按单派系顺序完成玩法实现：超能陆战队 → 冰雪奇缘 → 狮子王 → 花木兰。
- 每个派系必须补齐 L2 行为测试、真实入口 L3/L4 E2E、对象级 evidence 和剩余风险声明。
- 资源链必须完成压缩、manifest、服务器素材主源上传与代表 URL `HEAD 200` 回查；若环境阻塞，必须明确列出未发布资源与运行态风险。

## Source Contract

- 主真相源：
  - 路径：`C:/Users/Dqm/.codex/attachments/11666c73-73f5-40e1-ad6c-9d72601bd77c/image-1.png`
  - 尺寸：`4888 x 4096`
  - 文件大小：`41,387,810 bytes`
  - SHA-256：`4e28237e91b60a3a4faa48aa57b6c0404574cdd372017fa5104781219e1216b0`
  - 用途：派系范围识别、中文图面、中文名称、中文规则文本、row-major 顺序。
- 初步范围判断：
  - 整图可按 `10 x 6` 网格切分，共 `60` 格，每格约 `489 x 683`。
  - `slot 0-14`：超能陆战队，15 张卡。
  - `slot 15-29`：冰雪奇缘，15 张卡。
  - `slot 30-44`：狮子王，15 张卡。
  - `slot 45-59`：花木兰，15 张卡。
- 审批前 feasibility 产物：
  - `temp/smashup-disney-four-factions-intake/overview-2200w.png`
  - `temp/smashup-disney-four-factions-intake/cards/slot-00-r1c1.png` 至 `slot-59-r6c10.png`
  - `temp/smashup-disney-four-factions-intake/source-and-grid-feasibility.json`
- 待 intake 锁定：
  - 每张卡的完整单卡裁图路径、可读性、名称、类型、力量、数量、效果原文与原子子句。
  - canonical 英文名和英文效果文本的对照源。
  - 是否存在基地图、基地归属、breakpoint 和 VP。

## Coordination

- 实施 worktree：`D:/GA/BoardGame-smashup-disney-four-factions-clean-20260725`。
- 实施分支：`codex/smashup-disney-four-factions-clean-20260725`。
- 根目录 `D:/GA/BoardGame-upstream-main-dev-20260601` 和其他 worktree 的 POD / Marvel / 其他 Smash Up 改动均不属于本轮实现真相源。
- 本 change 的文件和证据必须独立落在 `add-smashup-disney-four-factions` / `evidence/smashup/*disney*`；共享注册文件只允许为本批四派系做增量追加，不回滚、不重排、不吸收其他 worktree 的无关改动。

## Impact

- Affected specs:
  - 新增 `smashup-disney-factions`
  - `smashup-faction-registry`
  - `game-asset-preloading`
  - `asset-manifest`
- Affected code and assets after approval:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/data/factions/`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/abilities/`
  - `src/games/smashup/ui/factionMeta.ts`
  - `src/games/smashup/criticalImageResolver.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/i18n/zh-CN/smashup/`
  - `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
  - `public/assets/i18n/assets-manifest.json`
  - `src/games/smashup/__tests__/`
  - `e2e/smashup/`
  - `evidence/smashup/`
