# Change: 实装大杀四方 Cease and Desist 四派系

## Why

用户提供了一张明确属于大杀四方 `Cease and Desist` 扩展的中文卡牌 atlas，希望将其中的新派系加入游戏。结构化核对已确认该图同时承载四个完整派系：

- 宇宙武士（`astroknights`）
- 卑劣封臣（`ignobles`）
- 星际旅者（`star_roamers`）
- 百变机兵（`changerbots`）

当前仓库尚未注册这四个派系的完整牌组、基地与派系玩法，但已存在卑劣封臣的漫步山丘（`ignobles_the_hill_that_strolls`）和百变机兵的合体机器人（`changerbots_mergacon`）泰坦运行时。本次变更需要按项目规定先完成图片 intake、来源合同和 OpenSpec 审批，再逐派系完成正式玩法，不得把卡图可见或派系可选误报成完成。

## Approval

- 当前状态：**已批准实施**。
- 用户于 `2026-07-10` 在当前任务中明确回复“批准四派系整体实施”。
- 批准范围为图片承载的宇宙武士、卑劣封臣、星际旅者、百变机兵四派系完整 intake、资源接入、玩法实现、审计与真实入口 E2E。

## What Changes

- 新增宇宙武士、卑劣封臣、星际旅者、百变机兵四个可选择、可初始化、可完整结算的派系。
- 接入用户提供的 `8 x 7` 中文卡牌 atlas：
  - `0-17`：宇宙武士，18 个唯一牌图。
  - `18-29`：卑劣封臣，12 个唯一牌图。
  - `30-42`：星际旅者，13 个唯一牌图。
  - `43-54`：百变机兵，12 个唯一牌图。
  - `55`：宇宙武士展示图，仅作 display-only，不得录成运行时卡牌。
- 接入配套 `2 x 4` 基地 atlas，共 8 张基地，并按 TTS deck 元数据锁定派系归属与 breakpoint。
- 复用当前已存在的漫步山丘和合体机器人泰坦定义、交互与测试；本 change 只补四派系正式联动与对象级证据，不重复实现泰坦。
- 补齐派系 ID、atlas catalog、卡牌/基地静态数据、双语 locale、派系 metadata、关键图片预加载、manifest、R2/CDN 发布、能力处理、领域测试、真实入口 E2E 与 evidence。
- 按单派系闭环顺序实施：intake 锁定后，一次只完成一个派系的配置复用、机制扩展、UI/E2E 和 evidence，再推进下一个派系。

## Source Contract

- 中文卡牌图面、中文派系显示名、中文效果文本与 row-major 索引：
  - 用户提供的 `CAB18606A3248EE1EE6E115EB54E0A55712A111D.png`
  - SHA-256：`4A09DAEC2938CDF54417DE3C5AA27EA138C2DFD51A6B8B5999888B4F1E1F144B`
- 中文基地图面与基地 row-major 索引：
  - 本地 Mod 图片 `C2FB43B67A3A289E39BBF4D7487EFACBF973A34D.png`
  - SHA-256：`CE1B3446CA94AF3ABE3C0A3E88D14B7DD5228A408BC05D9F2EFDB7D3507E4B00`
- 泰坦图面：
  - 本地 Mod 图片 `8C94C46F97554D53D42E3FEFAEC5EA120A22109B.png`
  - SHA-256：`0584DE5873D93E19292EC60A346CEB4EFBE73F42766645F2D34036BCAA60F981`
- 派系 canonical 英文名、实体牌数量、CardID、基地归属、breakpoint 与泰坦归属：
  - `Mods/Workshop/2833984701.json`
- 英文 canonical 效果文本、勘误和限定词：
  - implementation 前按项目 Smash Up 专用抓取流程回访 Wiki/权威文本并写入 intake 合同。

## Coordination

- 当前 worktree 同时承载其他 Smash Up 新派系批次的未提交改动。本 change 必须采用增量追加，不回滚、不重排、不覆盖其他批次。
- `src/games/smashup/data/cards.ts`、`domain/ids.ts`、`domain/atlasCatalog.ts`、`ui/factionMeta.ts`、locale 与 manifest 是共享接线点；实施时只允许最小上下文补丁。
- `add-smashup-titans` 与当前代码已覆盖漫步山丘和合体机器人运行时。本 change 将它们登记为复用依赖，并验证与新派系牌组联动，不建立第二套泰坦逻辑。
- 根 `task_plan.md / findings.md / progress.md` 正在服务《七大恨》长期任务，本批次状态改存于独立的 `evidence/smashup/2026-07-10-cease-and-desist-intake-plan.md`。

## Impact

- Affected specs:
  - `smashup-faction-registry`
  - `game-asset-preloading`
  - `asset-manifest`
- Affected code and assets after approval:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/data/factions/`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/abilities/`
  - `src/games/smashup/domain/baseAbilities.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/ui/factionMeta.ts`
  - `src/games/smashup/criticalImageResolver.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/i18n/zh-CN/smashup/`
  - `src/games/smashup/__tests__/`
  - `e2e/smashup/`
  - `evidence/smashup/`
