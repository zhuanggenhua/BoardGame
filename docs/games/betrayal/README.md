# 山屋惊魂 3 版资料 intake

本目录记录 `gameId = betrayal` 的首轮资料录入结果。

## 当前结论

- 当前执行现场：`D:\gongzuo\webgame\BoardGame`
- 分支：`main`
- 用户本地图片是本轮主真相源，优先用于资源命名、对象识别和后续实现合同。
- 用户本地 PDF 都是扫描型 PDF，现有自动抽取只能得到空文本，暂时不能直接当“可读规则文本”。
- 已经从 `Mods\Images` 中挑出 59 个可直接进入运行时的明确资源。
- 首批运行时资源已经同步到 `public/assets/i18n/zh-CN/betrayal/`；`public/assets/betrayal/` 继续保留为 intake 暂存层，不删旧入口。

## 已落地内容

- 资源总表：`docs/games/betrayal/sources/image-index/runtime-resource-map.json`
- 图片尺寸与分组索引：`docs/games/betrayal/sources/image-index/`
- PDF 空转证据：`docs/games/betrayal/sources/pdf-text/`
- 英文规则书文本：`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md`
- 英文求生者剧本书文本：`docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md`
- 英文叛徒剧本书文本：`docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md`
- 首轮 intake 合同：`docs/games/betrayal/intake-contract.md`
- foundation 实施映射：`docs/games/betrayal/foundation-implementation-map.md`
- 正式资源迁移清单：`docs/games/betrayal/resource-migration-plan.md`
- 资源缺口审计：`docs/games/betrayal/resource-gap-audit.md`
- 需求对齐表：`docs/games/betrayal/requirement-alignment.md`
- 架构审查：`evidence/betrayal/betrayal-architecture-review-2026-06-16.md`
- UI 设计规范：`design-system/games/betrayal.md`
- 位图设计稿索引：`docs/games/betrayal/design/README.md`
- 第一剧本完成度审计：`docs/games/betrayal/workflows/betrayal-first-scenario-completion.md`
- 主 spec 视角与当前缺口：`docs/games/betrayal/master-spec-view.md`
- 回主分支合并口径：`docs/games/betrayal/workflows/betrayal-merge-back-to-main.md`
- 运行时页面级布局合同：`docs/games/betrayal/style-b-screen-contract.md`（历史文件名保留，当前记录的是 `v4` 实现合同，不再代表独立风格分叉）
- 当前运行时实现基线：`docs/games/betrayal/design/generated/betrayal-runtime-prehaunt-board-v4.png`
- `v8-v12`：历史继续稿，统一记录为过程参考；当前不再视为候选，因为用户本轮已要求回到 `v4` 实施
- `v5`：`docs/games/betrayal/design/generated/betrayal-runtime-prehaunt-board-v5.png`，记录为 3D 跑偏继续稿
- `v6`：`docs/games/betrayal/design/generated/betrayal-runtime-prehaunt-board-v6.png`，记录为 2D 纠偏但有说明正文的问题稿
- `v7`：`docs/games/betrayal/design/generated/betrayal-runtime-prehaunt-board-v7.png`，记录为仍未守住 `v4` 版式纪律的失败稿
- 当前角色选择实现基线：`docs/games/betrayal/design/generated/betrayal-character-select-style-b.png`
- 当前终局实现基线：`docs/games/betrayal/design/generated/betrayal-endgame-style-b.png`
- 历史误方向试稿：`docs/games/betrayal/design/generated/betrayal-foundation-ui-mockup-v3.png`

## 首批运行时资源范围

- `ui/`
  - 标题横幅
  - 0-9 数字轨道
- `thumbnails/`
  - `cover.png`
- `cards/`
  - 事件 / 物品 / 预兆 / 叛徒 / 怪物牌背
  - 英文与中文玩家参考卡
  - 中文叛徒参考卡
  - 中文怪物参考卡
  - 1 张蓝色中文参考卡
- `explorers/`
  - 13 张已识别的探索者角色牌
- `monsters/`
  - 3 张已识别的怪物/特殊角色卡
- `markers/`
  - 28 个数字 / 状态 / 资源标记

## 资源落点结论

- 当前候选资源暂存目录：`public/assets/betrayal/`
- 正式运行时目录：`public/assets/i18n/zh-CN/betrayal/`
- 依据：
  - `create-new-game` skill 6.6 明确要求新游戏图片默认落到 `public/assets/i18n/zh-CN/<gameId>/...`
  - `ManifestGameThumbnail` 与 `AssetLoader` 现有测试合同默认从 `i18n/zh-CN/<gameId>/...` 解析缩略图与本地化图片
- 因此，当前 intake 已完成“对象识别与候选资源筛出”，并已完成首轮“正式运行时资源落盘收口”。

## 当前未进入运行时的素材

- 大尺寸拼版房间图
- 大尺寸拼版标记图
- 扫描页类 JPG / PNG
- 含黑底拼接的参考页
- 无法唯一判断运行时语义的 candidate 图

这些素材继续保留在 `docs/games/betrayal/sources/` 作为真相源或候选源，不混入 `public/assets/`。

## 已接入的 TTS 派生素材

- TTS 山屋 0/1/2 骰子 3D 模型已经找到并接入为运行时骰面图：真相源在 `Mods\Workshop\3420850553.json`，本地模型在 `Mods\Models\httpssteamusercontentaakamaihdnetugc8369528783806126162444D3E2AC5B69A7939369B3566A0941C2D881C9.obj`，本地近白材质图在 `Mods\Images\httpssteamusercontentaakamaihdnetugc310636117333783900D4349CB7B7A59D4F8DF84D5A8FB0D723953A466.jpg`。
- 当前运行时资源为 `public/assets/i18n/zh-CN/betrayal/dice/house-die-0.png`、`house-die-1.png`、`house-die-2.png` 及对应 `compressed/*.webp`；教程 / 终局页用这些骰面贴图渲染山屋专属 3D 房屋骰，并复用 `DiceBoxPhysicsSource` / `@3d-dice/dice-box-threejs` 作为物理源，不再使用 CSS 点数方块或单纯 2D 骰面图代替。
- 事件牌正面图集已作为正式运行时素材接入：`public/assets/i18n/zh-CN/betrayal/cards/event-front-atlas.jpg` 是 `6076x6376` 的 `9x5` 图集，最后一列 / 最后一行承接 `1px` 余数；当前教程发现牌截图已验证 `外星几何` 使用图集第 `24` 格，不再用旧占位事件或错误大格裁切。

## 下一步建议

1. 当前十二条最小真实流程 / 边界链路都已通过项目标准 E2E 入口验证，并且本轮已在当前 `main` 现场重新串行复核通过：
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/basic-flow.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-traitor-victory.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-corpse-loot.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-jack-spirit-revive.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-jack-spirit-post-revive-attack.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/omen-atlas.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/inventory-density.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/monster-runtime.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/explore-unknown-room.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-core-interactions.e2e.ts`
   其中：
   - `basic-flow` 覆盖“角色选择确认到恶兆前运行时”；
   - `first-scenario` 覆盖“真实 haunt 运行时到幸存者终局收尾”；
   - `first-scenario-traitor-victory` 覆盖“真实 haunt 运行时到叛徒终局收尾”；
   - `betrayal-tutorial` 覆盖“真实角色选择 -> 真实教程章节 -> 第一剧本英雄线收尾 / 叛徒最小攻击收尾 -> 真实终局”；
   - `omen-atlas` 覆盖“预兆持有区使用正式正面图集”；
   - `inventory-density` 覆盖“持有区高密度物品与预兆仍能渲染”；
   - `monster-runtime` 覆盖“玩家、队友与怪物同场的真实运行时”；
   - `explore-unknown-room` 覆盖“真实牌桌里点击探索、选择未知门位并翻开新房间”；
   - `first-scenario-core-interactions` 覆盖“真实牌桌里交易、调查杰克、研究法阵、英雄攻击叛徒”。
2. 第一剧本三条关键 haunt 边界真实页面证据也已经成立：
   其中：
   - `first-scenario-corpse-loot` 覆盖“同房间尸体搜刮”的正式动作入口、回合内消耗与二次搜尸限制；
   - `first-scenario-jack-spirit-revive` 覆盖“Jack's Spirit 回尸体房间后通过正式结束回合触发叛徒复活”；
   - `first-scenario-jack-spirit-post-revive-attack` 覆盖“叛徒复活后通过正式房间焦点入口继续攻击同房间英雄”。
3. 当前规则真相已明确三条：恶兆前正式 domain setup 以 `Entrance Hall` 为探索者共同起点；起始 ground 拓扑必须显式保留 `Ground Floor Staircase / Hallway / Entrance Hall` 三个房间节点，且 `Basement Landing <-> Ground Floor Staircase <-> Upper Landing` 的特殊连接必须按规则存在；`haunt roll` 必须按“所有玩家当前持有的恶兆总数”掷骰，而不是按历史抽牌次数偷算。
4. 首剧本当前已补真的关键规则包括：`Study the Exorcism` 失败造成 `2 Mental damage`，`Exorcise Jack's Spirit` 失败对每个英雄造成 `1 Physical damage`，`Knowledge of Jack` 的调查改成真实知识投骰，叛徒揭示时会先回满属性再获得 `+2 Might / +2 Speed`，死掉的叛徒会改由 `Jack's Spirit` 接管回合，且此后攻击英雄时会按 `Jack's Spirit` 的房间与 `Might 5` 结算；当 `Jack's Spirit` 回到尸体所在房间时，叛徒会恢复肉身并移除 spirit。交易、调查杰克、研究法阵和英雄攻击叛徒也已补真实页面 E2E，不再只停留在领域单测或命令注入。
5. `HAUNT_ATTACK` 也已经从“命中即秒杀”改成正式对攻：英雄打叛徒、叛徒打英雄都按 `Might` 对掷，按点差造成 `Physical damage`，平手不受伤；`Knowledge of Jack` 的 `+2` 只在英雄攻击叛徒时生效。
6. 当前 `game.ts` 已从 `START_FIRST_SCENARIO / COMPLETE_FIRST_SCENARIO` 收成通用 `START_SCENARIO / COMPLETE_SCENARIO` 入口；后续第二个及更多剧本必须继续走同一条配置通道，不再回退到首剧本专名命令。
7. 教程第一轮已经接入标准教程链，并已通过真实教程 E2E；本轮又对“发现牌揭示 / 骰面 / 参考页”做了当前现场复核：
   - `src/games/betrayal/tutorial.ts` 已导出 `TutorialCollection`
   - 默认教程是 `basic-setup-and-turn`
   - 当前可见教程已压成 3 个章节：`basic-setup-and-turn`、`haunt-actions-and-finish`、`traitor-path`
   - `move-explore-use`、`crimson-jack-objective` 仅保留为隐藏兼容入口，分别指向基础回合和驱魔章节
   - `src/games/manifest.client.generated.tsx` 已生成 `loadTutorial3`
   - `Board.tsx` 已把角色选择、动作区、持有区、房间区、帮助入口和终局挂上真实 `data-tutorial-id`
   - `e2e/betrayal/betrayal-tutorial.e2e.ts` 已通过，截图证据位于 `evidence/betrayal-tutorial/`
   - `14-山屋惊魂-教程-探索后发现牌.jpg`：发现牌居中作为主结果，底部确认条只保留“下一步”按钮，不复读牌面标题、正文或“已抽到/已翻开”说明。
   - `06-山屋惊魂-教程-终局页.jpg`：驱魔投骰骰面在终局主结果区域可见，不再只有一行文字结果。
   - `evidence/betrayal-first-scenario/02-山屋惊魂-玩家参考卡-帮助面板.jpg`：第一剧本参考页使用正式参考卡素材，不在旁边复读规则正文。
   - 教程 / 生命周期 / 教程阶段运行时相关单测也已重新通过：
     - `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/tutorial.test.ts src/games/betrayal/__tests__/tutorialIds.test.ts src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx src/pages/__tests__/matchRoomTutorialStageRuntime.test.tsx --configLoader native`
     - 结果：`4 passed / 34 passed`
8. 当前教程仍是“首轮基础教程”，不是完整规则书：
   - 已覆盖真实角色选择、恶兆前主循环、第一剧本英雄目标、英雄线收尾，以及第一剧本叛徒视角的最小攻击 / 终局收尾
   - 更复杂 haunt 分支、更多剧本与完整规则书式教学仍留待后续子教程
9. 首剧本里的 `Stalk the Prey` 已按规则补到“本回合未攻击前才能用、每回合只能用一次、且不消耗普通移动”；后续若别的剧本继续复用更复杂的 line-of-sight 语义，再继续抽成共享正式规则，不允许回退到提示层或注入绕过。
10. 当前正式发现池已经收口到 42 间房、12 张物品、9 张预兆；事件牌已锁定 23 张官方合同，正式运行事件牌堆当前也接入 23 张。`一瓶微尘`、`大宅饿了`、`说“茄子”！`已经分别能进入作祟剧本 3「灰尘」、12「大宅饿了 / 援手」、33「魔法相机」代表链；其中 12 目前只承认官方 setup / 奇异护符控制权 / 巨魔手初始放置切片，巨魔手合击、偷牌替代伤害、完整怪物行动和真实入口 E2E 仍需后续补齐。阁楼因当前房间正面图集没有独立图面，已从运行时发现池移除。发现池 / 效果审计当前发布口径已收口：15 个房间效果、27 个无房间文字效果或 frame-note 房间、12 张物品、9 张预兆、23 张正式运行事件均已有当前范围验证证据。后续重点不再是补发现池审计，而是继续补更多作祟剧本、房间背面 / 楼层板资源合同以及新增对象的独立审计。事件牌不能再用旧占位事件凑数；新增事件只能来自已锁定合同和对应引擎能力。
11. 再处理扫描 PDF 的 OCR 或人工录入，把规则文本沉淀成可实现的结构化文档。
12. 最后进入更多 haunt / 多剧本的正式玩法实现。
