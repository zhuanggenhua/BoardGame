# Change: 实装大杀四方迪士尼四派系

## Why

用户提供了一张中文卡牌 contact sheet，要求将图中的大杀四方迪士尼派系按项目流程推进到可推送作者的程度。

当前图片实际识别为以下四个派系：

- 阿拉丁（Aladdin）
- 美女与野兽（Beauty and the Beast）
- 圣诞夜惊魂（The Nightmare Before Christmas）
- 无敌破坏王（Wreck-It Ralph）

这些派系在当前 `main` 工作树中尚未注册。由于这是新增派系与完整玩法能力，必须先建立 OpenSpec proposal、数据录入合同、资源链、玩法实现、审计证据和 E2E 验收闭环。

## Approval

- 当前状态：**已批准实施**（用户本轮明确回复“批准实施”）。
- 本 proposal 已完成范围拆解、来源口径和验收门禁；后续按 OpenSpec Stage 2 顺序推进 intake、资源、玩法、测试和发布准备。

## What Changes

- 新增阿拉丁、美女与野兽、圣诞夜惊魂、无敌破坏王四个可选择派系。
- 以用户提供图片作为本轮中文图面、中文名称、中文规则文本和图片顺序的主真相源。
- 用 Smash Up Wiki / 规则页作为对照源，补齐图片未承载的 canonical 英文名、张数、英文规则文本、基地名、基地 breakpoint / VP 与 FAQ 语义。
- 在正式实现前生成完整单卡裁图，并建立真相源表、切图表、逐卡核对合同表、对照表、冲突待裁定表、可视合同表和 implementation handoff 包。
- 接入正式运行时 card/base atlas、faction/card/base 静态数据、双语 locale、faction metadata、critical image preload 与 manifest。
- 按单派系顺序完成玩法实现：阿拉丁 → 美女与野兽 → 圣诞夜惊魂 → 无敌破坏王。
- 每个派系必须补齐 L2 行为测试、真实入口 L3/L4 E2E、对象级 evidence 和剩余风险声明。
- 资源链必须完成压缩、manifest、服务器素材主源上传与代表 URL `HEAD 200` 回查；若环境阻塞，必须明确列出未发布资源与运行态风险。

## Source Contract

- 主真相源：
  - 路径：`C:/Users/Dqm/.codex/attachments/67e9d7da-8fe2-4353-af7e-9a2788c33140/image-1.png`
  - 尺寸：`4888 x 4096`
  - 文件大小：`39,745,874 bytes`
  - SHA-256：`d156b6428665ffc1f4182cc955fd7aa7d35d7638e0e6d593e238a9b3b02674cc`
  - 获取时间：`2026-07-25 22:41:18 +08:00`
  - 用途：派系范围识别、中文图面、中文名称、中文规则文本、图片顺序。
- 对照源：
  - Smash Up Wiki 派系页：`Aladdin`、`Beauty and the Beast`、`The Nightmare Before Christmas`、`Wreck-It Ralph`
  - 对照用途：canonical 英文名、张数、英文文本、基地名、基地数值、FAQ / clarification。
- 初步范围判断：
  - 图片包含上述四个迪士尼派系的卡牌正面；未在该 contact sheet 中直接看到标准基地版式。
  - 基地信息不得从图片猜造；必须通过对照源锁定，或标为 `blocked`。
- 待 intake 锁定：
  - 每张卡的完整单卡裁图路径、可读性、名称、类型、力量、数量、效果原文与原子子句。
  - 每个基地的主真相源、英文/中文名、breakpoint、VP、效果和运行时图像来源。
  - 图片文本与对照源文本的所有差异。

## Coordination

- 当前实施已另起干净 worktree：`D:/GA/BoardGame-smashup-disney-20260725`
- 当前分支：`codex/smashup-disney-four-factions-20260725`
- 原工作区 `codex/smashup-pod-card-art` 存在未提交 POD 变更；本 change 不吸收、不重排、不提交那些改动。
- 本 change 的文件和证据必须独立落在 `add-smashup-disney-aladdin-beauty-nightmare-ralph` / `evidence/smashup/*disney*`，共享注册文件只允许增量追加。

## Impact

- Affected specs:
  - `smashup-disney-factions`（新增）
  - `smashup-faction-batch-workflow`
  - `smashup-faction-registry`
  - `game-asset-preloading`
  - `asset-manifest`
- Affected code and assets after approval:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/data/factions/`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/data/bases.ts` or existing base registry files
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
