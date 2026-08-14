# Change: 补齐《七大恨》正式主循环与教程规则覆盖

## Why

《七大恨》当前已经具备可运行的正式棋盘、联机视角隔离、剧本前置和一批真实教程截图，但这还不等于“新游戏收工”。

当前存在两类未完成缺口，而且都已经被运行态证据证明：

1. 正式局主循环缺口  
   - 规则书要求的同层一级动作是：`手牌上限弃牌 -> 转动轮盘 -> 执行一次手牌行动及轮盘行动（顺序由玩家决定）`
   - 其中 `执行事件 / 升级军备 / 势力行动` 属于 `手牌行动` 内部的并列一级入口
   - 但当前正式局只有 `势力行动`、部分已识别 `事件牌/军备牌`、以及轮盘相关入口具备局部真实承接；正式开局大多数手牌仍是低保真对象，不能稳定承接“打出哪张牌”
   - 同时 `selectedRegionId` 仍混用了“默认聚焦 / 已锁来源 / 当前目标 / 展示锚点”，导致正式局持续偏向“先选地区，再做动作”的错误心智
   - 目前还未证明的正式规则面包括：`正式开局真实手牌对象`、`事件牌一级入口`、`军备牌一级入口`、`玩家可自行决定手牌行动/轮盘行动先后`

2. 教程规则覆盖缺口  
   - 当前教程已能证明基础回合、部分轮盘分支、事件、军备、野战、撤退、攻城、外交、跨年与朝鲜特例的局部链路
   - 但仍缺少对关键规则面的真实章节覆盖与真实截图证据，例如：中立入侵、水路移动、战术牌、避战/劫掠、守城宣告、骑兵城战减值、朝鲜朝贡/朝鲜耗损等
   - 因此当前教程还不能作为“玩家已经能看懂这游戏怎么运作”的完整规则证明
   - 目前还未证明的章节连续性包括：`基础章完整主循环`、`轮盘发展主章与隐藏续章的玩家心智连续性`、`攻城章与地图特例章的真实规则近景证据`

这批问题已经超出 `update-qidahen-board-interaction-shell` 的范围。那条 change 解决的是壳层、CTA、截图命名和常驻提示约束；当前要继续推进的是正式规则入口、状态建模和教程规则覆盖，必须新开 change。

## What Changes

- 为《七大恨》新增正式主循环能力约束，补齐规则书级 `手牌行动 / 轮盘行动` 一级入口合同。
- 为《七大恨》补正式手牌对象真相，确保正式开局和摸牌阶段能稳定得到规则级卡牌身份，而不是大量 `unknown` 预览壳。
- 拆分正式流程中的地区状态语义，禁止继续用单一 `selectedRegionId` 混承默认聚焦、已锁来源、当前目标和展示锚点。
- 重构教程章节与证据门槛，让教程从正式开局出发，能真实带玩家走过一个完整主循环，并补齐关键规则面的章节与截图证据。
- 明确本轮不是只补文案或截图，而是同时收口：正式规则入口、教程覆盖、联机视角边界和验收证据。

## Impact

- Affected specs:
  - 新增 `qidahen-formal-core-loop`
  - 新增 `qidahen-tutorials`
- Affected code:
  - `src/games/qidahen/Board.tsx`
  - `src/games/qidahen/tutorial.ts`
  - `src/games/qidahen/tutorialSetup.ts`
  - `src/games/qidahen/domain/handCardState.ts`
  - `src/games/qidahen/domain/initialCoreSetup.ts`
  - `src/games/qidahen/domain/selectionBuilders.ts`
  - `src/games/qidahen/domain/dispatchSelectionBuilders.ts`
  - `src/games/qidahen/domain/selectedActionFollowUp.ts`
  - `src/games/qidahen/domain/turnActionInteractionBuilders.ts`
  - `public/locales/{zh-CN,en}/game-qidahen.json`
  - `e2e/qidahen/qidahen-closeout.e2e.ts`
  - `docs/games/qidahen/records/qidahen-primary-interaction-audit.md`
  - `docs/games/qidahen/records/qidahen-tutorial-coverage-matrix.md`
