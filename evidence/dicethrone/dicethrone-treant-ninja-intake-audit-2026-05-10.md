# DiceThrone Treant / Ninja 新英雄接入审计与 E2E 证据（2026-05-10 修订版）

> 2026-06-05 当前有效口径：本文只保留 2026-05-10 这一轮 Treant / Ninja 新英雄 intake 的历史快照，不再代表当前“新派系补审”总状态。当前总范围已按四位新英雄（枪手、武士、树精、忍者）统一重审；Treant / Ninja 的升级技能对象级 `L3` 与关键 `L4` 已在后续补审中大幅补齐，当前残余不能再读成“这两个英雄还有一批对象级未实现”，而应读作批次级 `L4` 判等治理、旧 evidence / rule 统一回写与最终发布口径统一。现行总汇总以 `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md`、`evidence/dicethrone/dicethrone-new-factions-reaudit-wiki-diff-2026-05-17.md` 与 `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 为准。

## 2026-05-16 Treant 旧结论再次失效

本文件此前把 `treant` 写成 `passed`，但 2026-05-16 用户实测又发现一组旧漏项：

- `quiet-cultivation` 被错误落在普通技能共享槽语义里，导致被动区出现“可选/高亮”；
- `rooted` 被错误挂到 `calm`，防御阶段高亮到了倒数第二个技能；
- 先是数据录入阶段没有把“玩家板槽位合同”建成正式录入口径；随后审计虽然拿到了 Treant 玩家板主图和压缩图，但也没有把这份合同缺口拦下来，而是继续沿用了旧共享槽位语义。

因此，本文件中关于 `treant` 的“数据录入 / 审计 / E2E / 最终 passed”结论已经失效，不能继续作为 Treant 全面审计完成证明。下列文档只应用作“首轮失效说明 / 槽位专项 / 当时修复证据”；Treant 当前主线状态应统一回到“单英雄主审计 + 升级重审 + 现行 rule 矩阵”三层现行阅读入口：

- `evidence/dicethrone/dicethrone-treant-slot-audit-2026-05-16.md`
- `evidence/dicethrone/dicethrone-treant-full-audit-2026-05-16.md`
- `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
- `src/games/dicethrone/rule/treant录入核对.md`

其中：

- `dicethrone-treant-slot-audit-2026-05-16.md` 只负责槽位 / 图面合同专项证据，不能单独充当当前现行阅读入口。
- `evidence/dicethrone/dicethrone-treant-full-audit-2026-05-16.md`
  - 负责把图面合同、技能、token、专属卡与 shared seam 放回单英雄主审计口径。
- `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
  - 负责升级技能对象级回写与批次级 `L4` 治理口径。
- `src/games/dicethrone/rule/treant录入核对.md`
  - 负责现行录入矩阵与批次级 `L4` 判等入口。
- `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts`
- `e2e/dicethrone/dicethrone-treant-slot-mapping.e2e.ts`

## 2026-05-14 旧结论再次失效

本文件在 2026-05-10 修订版中仍把 Ninja 若干机制写成已收口，但 2026-05-14 用户复核发现四项漏审：

- `poison-blade` 小顺子与 `death-blossom` 左下角技能使用了旧共享槽位语义，未按 Ninja v2 玩家面板真实贴图槽位映射。
- `blink` 防御技能的 `rollDie` effect 时机错误，导致真实防御结算无效果。
- 忍术 6 点选择“不可防御”后，攻击结算仍继续执行已挂载防御技能。
- `ninja-card-knife-fan`（刀扇）被误录为投掷阶段攻击修正，实际应为主要阶段行动牌。

因此，本文件中关于 Ninja 的“当前发布口径已收口 / passed”只能作为 2026-05-10 当时代表链证据，不能再作为 Ninja 全面审计完成证明。下列文档只应用作“首轮回归修复 / 当时降级证据”；Ninja 当前主线状态应统一回到“单英雄主重审 + 升级重审 + 现行 rule 矩阵”三层现行阅读入口：

- `evidence/dicethrone/dicethrone-ninja-regression-audit-2026-05-14.md`
- `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md`
- `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
- `src/games/dicethrone/rule/ninja录入核对.md`

其中：

- `dicethrone-ninja-regression-audit-2026-05-14.md` 只负责那一轮回归修复与当时证据，不能单独充当当前现行阅读入口。
- `dicethrone-ninja-full-flow-reaudit-2026-05-15.md`
  - 负责单英雄历史重审轨迹与对象级回写门禁。
- `dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
  - 负责升级技能对象级回写与批次级 `L4` 治理口径。
- `src/games/dicethrone/rule/ninja录入核对.md`
  - 负责现行录入矩阵与批次级 `L4` 判等入口。
- `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts`
- `e2e/dicethrone/dicethrone-ninja-regression.e2e.ts`

## 旧结论失效说明

本文件修订前曾把“选角可进入对局 + 静态资源可显示 + 少量 smoke 测试”写成接入完成。该结论现已失效：旧 E2E 只证明 `treant` / `ninja` 可被选择并进入游戏，不证明新增英雄的 token、被动、奖励骰、伤害修正等真实机制在 UI 链路中可触发、可展示、可收口。

本修订版按当前仓库实际使用的新增派系 / 新英雄 workflow（`.windsurf/skills/add-new-faction/SKILL.md`、`.windsurf/skills/game-audit-workflow/SKILL.md` 与 `.spec/skills/dicethrone-hero-intake/SKILL.md`）回写历史证据。需要强调的是：这些 workflow 在 2026-06-05 的现行口径下已经明确“新增批次默认全面审计留档、不再追问”，因此本文只能作为 2026-05-10 当轮 intake 证据快照，不能再被外推成当前默认收口范围。

## 范围

- 工作树：`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja`
- 新英雄：`treant`（树精）、`ninja`（忍者）
- 主真相源目录：
  - `public/assets/i18n/zh-CN/dicethrone/images/treant`
  - `public/assets/i18n/zh-CN/dicethrone/images/ninja`
- 参考实现：旧英雄注册链路、`gunslinger` / `samurai` 的 v2 玩家面板、图集与复合升级接线。

## 批次矩阵

> 2026-06-05 当前阅读门禁：下表保留的是这份 2026-05-10 intake 文档在后续被推翻后留下的**历史批次状态快照**，作用是说明“这份旧 intake 文档整体已失效，应改看哪些新文档”。它不是 2026-06-05 当前四位新英雄总补审的正式矩阵，也不是当前 `treant / ninja` 的残余清单。当前实时范围与未完成项应以总汇总、单英雄主审计与升级重审主文档为准。

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
|---|---|---|---|---|---|---|
| `treant` | 旧结论失效 | 旧结论失效 | 旧结论失效 | 旧结论失效 | 旧结论失效 | 当前现行阅读入口改读 `dicethrone-treant-full-audit-2026-05-16.md` + `dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` + `treant录入核对.md`；`slot-audit` 仅保留槽位专项子证据 |
| `ninja` | 旧结论失效 | 旧结论失效 | 旧结论失效 | 旧结论失效 | 旧结论失效 | 当前现行阅读入口改读 `dicethrone-ninja-full-flow-reaudit-2026-05-15.md` + `dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` + `ninja录入核对.md`；`ninja-regression` 仅保留历史回归子证据 |

## 数据录入与真相源文档

已复核并修订：

- `src/games/dicethrone/rule/treant真相源表.md`
- `src/games/dicethrone/rule/treant录入核对.md`
- `src/games/dicethrone/rule/treant卡牌录入核对.md`
- `src/games/dicethrone/rule/ninja真相源表.md`
- `src/games/dicethrone/rule/ninja录入核对.md`
- `src/games/dicethrone/rule/ninja卡牌录入核对.md`

当前文档明确使用 L0-L4 分层：

- L1：静态数据 / i18n / 图片索引 / 资源图集接入。
- L2：领域行为单测或等价逻辑验证。
- L3：真实 UI / E2E 正路径验证。
- L4：复杂响应窗 / 奖励骰 / finalState / reaction session 或等价闭环验证。

关键修订：

- Treant 木苗树灵抽牌分支、生命源泉主阶段奖励骰治疗、Divine beforeDamageDealt +3、防负面状态等不再写成“待补测”的旧口径；已分别落到 L2/L3 证据。
- Ninja 忍术奖励骰 1-3/+1、4-5/+2、6 点选择分支，以及慢性中毒 / 烟雾弹相关语义已按 L2/L3 分层记录。
- 旧“只完成静态接入即可收口”的结论已从当前证据口径中移除。

## 素材 / 图集 / 资源链

- 两个新英雄的 `ability-cards.png` 均按独立图集处理，不复用旧 `ability-cards-common.atlas.json`。
- 新增专属图集配置：
  - `src/assets/atlas-configs/dicethrone/ability-cards-treant.atlas.json`
  - `src/assets/atlas-configs/dicethrone/ability-cards-ninja.atlas.json`
  - 同步副本：`public/assets/atlas-configs/dicethrone/ability-cards-*.atlas.json`
- 合同：运行时 ability cards 图为 `900x2048`，按 `5 列 x 8 行` row-major frame 接入。
- `player-board` / `tip` / `dice` / `status-icons-atlas` 均保留逻辑路径，运行时走 `compressed/*.webp`，代码不硬编码 `compressed/`。
- atlas JSON 按项目现有规则走本地 `/assets/atlas-configs/**`，上传脚本只上传压缩媒体 / SVG / 音频，不上传 JSON。

资源命令结果：

- `npm run assets:manifest`：通过，已重建 atlas-configs/common/i18n/splendor manifest。
- `npm run assets:validate`：通过，4 个 manifest 校验通过。
- `npm run assets:upload`：通过，找到 24 个本轮相关文件，上传 0、跳过 24、删除 0、失败 0（远端已同内容）。

远端内容回查：Treant / Ninja 的 `player-board`、`tip`、`ability-cards`、`dice`、`status-icons-atlas` 以及 Common `background`、`character-portraits` 全部 `200 image/webp`，远端 SHA-256 与本地一致。

## 机制实现结论

本轮新增 / 修正的关键机制证据：

- `src/games/dicethrone/Board.tsx`
  - 修复被动面板点击处理：`custom` 被动动作现在与 `drawCard` 一样直接派发 `USE_PASSIVE_ABILITY`。
  - 旧问题：树精生命源泉按钮可用但点击后无命令，导致真实 UI 路径无法触发奖励骰治疗。
- `src/games/dicethrone/domain/reduceCombat.ts`
  - 修复 `TOKEN_USED` 的 `beforeDamageDealt` token 加伤同步：现在同时更新 `pendingDamage.currentDamage` 与 `pendingAttack.bonusDamage`。
  - 旧问题：Treant Divine / Ninja 类 beforeDamageDealt token 已改变 pendingDamage，但攻击总伤害状态未同步。
- `src/games/dicethrone/domain/customActions/treant.ts`
  - 生命源泉：消耗 `life_sap`，掷 1 颗奖励骰，按向上取半治疗，生成展示结算并应用治疗。
  - 木苗树灵：主阶段治疗 + CP / 花费 CP 抽牌分支。
- `src/games/dicethrone/domain/customActions/ninja.ts`
  - 忍术：beforeDamageDealt 消耗 token，掷 1 颗奖励骰；1-3 加 1，4-5 加 2，6 点进入慢性中毒 / 不可防御选择链。

L2 验证：

- `npx eslint src/games/dicethrone/domain/reduceCombat.ts src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/__tests__/ninja-token-mechanics.test.ts` -> 0 errors
- `npx vitest run src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/__tests__/ninja-token-mechanics.test.ts --reporter=dot` -> 2 files / 12 tests passed

## 真实入口 E2E

命令：

```powershell
$env:PW_PORT='6481'
$env:PW_E2E_FRONTEND_PORT='6481'
$env:PW_GAME_SERVER_PORT='20308'
$env:GAME_SERVER_PORT='20308'
$env:PW_API_SERVER_PORT='21308'
$env:API_SERVER_PORT='21308'
$env:PW_WORKERS='1'
npm run test:e2e:ci -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts
```

最新结果：10 passed（2026-05-10 复跑整文件，隔离端口 6481 / 20308 / 21308）。

2026-05-13 追补复跑结果：10 passed（隔离端口 6481 / 20308 / 21308）。本次复跑补充了烟雾弹使用后关闭特写并回到主界面的截图，避免只用中间特写作为免伤收口证据。

覆盖路径：

1. 真实在线双玩家入口选择 Treant / Ninja，并进入 DiceThrone 对局。
2. Treant 生命源泉：主阶段持有 `life_sap`，通过真实被动面板点击触发奖励骰治疗，HP 从 35 变 38，关闭后回到可继续推进状态。
3. Treant 木苗树灵：主阶段两个按钮使用短文案 `治疗+CP` / `抽牌`，分别完成治疗+CP 与抽牌结算。
4. Treant 幼种树灵：掷骰阶段进入真实重掷选择，点击真实骰子按钮完成重掷并消耗 token。
5. Treant 神圣 +3：beforeDamageDealt 响应窗使用 `divine` 后当前伤害 6 -> 9，并能继续推进。
6. Treant 神圣防负面：防御阶段结算后阻止负面状态写入。
7. Treant 刺藤：阶段推进中真实反伤并消耗 token。
8. Ninja 忍术 4-5：伤害前 token 响应窗使用 `ninjutsu`，奖励骰加伤 6 -> 8，收口后进入后续阶段。
9. Ninja 忍术 6：真实选择窗覆盖慢性中毒分支与不可防御分支；慢性中毒在回合结束链路中真实扣血并归零。
10. Ninja 烟雾弹：防御方响应窗使用 `smoke_bomb` 后清空 pendingDamage，防御者 HP 不下降。

补充 UI 标记验证：2026-05-10 当时，Treant / Ninja 在选角卡片上显示唯一的 `实施中` 斜向覆盖横幅；不再存在第二套小胶囊 / pill UI；该横幅不禁用选角，只作为状态提示。该结论现仅保留为历史 UI 快照，不能外推成 2026-06-05 当前主线状态。

## 截图核验

### Treant / 生命源泉

入口截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精生命源泉应在主阶段触发奖励骰治疗并收口\01-life-sap-entry-before-use.png`

肉眼观察：

- 当前处于主阶段 1，中央玩家面板是 `TREANT / 树精`，右侧提示板和树精 token 说明可见。
- 左侧 HP 为 35，CP 为 2；生命源泉 token 图标位于左侧资源区，证明入口态具备触发条件。
- 真实手牌、玩家板、提示板、骰子区同时可见，截图来自真实对局入口。

奖励骰截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精生命源泉应在主阶段触发奖励骰治疗并收口\02-life-sap-bonus-die-overlay.png`

肉眼观察：

- 点击生命源泉后，画面上方出现白色奖励骰 / 骰子展示本体，证明奖励骰路径实际触发。
- HP 仍处于动画结算前显示，说明这是触发后的中间态截图，不单独作为最终治疗证明。
- 该截图与下一张收口截图构成连续证据链。

收口截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精生命源泉应在主阶段触发奖励骰治疗并收口\03-life-sap-after-close.png`

肉眼观察：

- 奖励骰展示已关闭，页面回到主对局视图。
- 左侧 HP 从 35 更新为 38，并显示绿色 `+3` 治疗跳字；达到“治疗结果已写入并反馈给玩家”的验收标准。
- 生命源泉 token 已消耗，流程未卡在 pending 特写或响应窗。

### Treant / 木苗树灵按钮排版与结算

入口截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精木苗树灵两个主阶段按钮应短文案展示并真实结算\01-sapling-short-buttons-before-use.png`

肉眼观察：

- 右侧树精按钮已从长描述压缩为短动作文案：`治疗+CP` / `抽牌`；代价仍以第二行小字展示，没有继续把提示板已有描述塞进按钮。
- 两个动作在同一“木苗树灵”分组下并排展示，未明显挤压右侧阶段按钮与提示板。
- 该截图直接回应“树精按钮排版是否要优化、文字不用这么多”的反馈，达到当前验收口径。

治疗+CP 后截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精木苗树灵两个主阶段按钮应短文案展示并真实结算\02-sapling-heal-cp-after-use.png`

肉眼观察：

- HP 从 35 到 36，CP 从 1 到 2，木苗树灵从 2 到 1。
- 证明按钮不只是视觉优化，真实结算已写入状态。

抽牌后截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精木苗树灵两个主阶段按钮应短文案展示并真实结算\03-sapling-draw-after-use.png`

肉眼观察：

- 木苗树灵归零，CP 回到 1，手牌数量增加 1。
- 流程仍停留在主界面可继续推进。

### Treant / 幼种树灵重掷

触发前截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精幼种树灵应通过真实骰子按钮完成重掷\01-seedling-reroll-before-select.png`

肉眼观察：

- 掷骰阶段右侧可见幼种树灵按钮，骰盘存在可操作骰子，满足真实重掷入口条件。
- 当前截图包含树精玩家板、骰盘和右侧 token 操作区，不是独立预览页。

选择模式截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精幼种树灵应通过真实骰子按钮完成重掷\02-seedling-reroll-selection-mode.png`

肉眼观察：

- 使用幼种树灵后进入骰子选择模式，按钮区变为确认/取消语义。
- 重掷不是直接改状态，而是进入真实 UI 选择链。

重掷后截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精幼种树灵应通过真实骰子按钮完成重掷\03-seedling-reroll-after-die-click.png`

肉眼观察：

- 右侧骰盘本体可见，被点击骰子的点数已变为 6。
- 幼种树灵 token 已从可用列表中消耗，流程仍在掷骰阶段可继续操作。
- 该截图达到“通过真实骰子按钮完成重掷”的验收标准。

### Treant / 神圣 +3

使用前截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精神圣 +3 应在真实攻击方响应窗中结算\01-divine-token-response-before-use.png`

肉眼观察：

- 响应窗标题为“响应（攻击方）”，原始伤害与当前伤害均为 6。
- `divine` token 显示可用并有真实“使用”按钮。

加伤后截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精神圣 +3 应在真实攻击方响应窗中结算\02-divine-after-use-damage-plus-three.png`

肉眼观察：

- 当前伤害从 6 更新到 9，响应窗显示“没有可用标记”，证明神圣已消耗并加伤。
- 这是真实响应窗中的玩家可见结果，不是后台状态断言。

收口截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精神圣 +3 应在真实攻击方响应窗中结算\03-divine-after-response-close.png`

肉眼观察：

- 攻击方响应窗已关闭，对局回到阶段推进链。
- 神圣加伤没有卡住响应窗。

### Treant / 神圣防负面

防负面前截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精神圣应在阶段推进中阻止负面状态\01-divine-prevent-debuff-before-advance.png`

肉眼观察：

- 进入防御推进前，攻击与状态路径已就绪。
- 截图作为防负面链路的前态证据。

防负面后截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精神圣应在阶段推进中阻止负面状态\02-divine-prevent-debuff-after-advance.png`

肉眼观察：

- 进入防御掷骰阶段后，Treant 防御者未获得预期应被阻止的负面 token。
- 右侧和玩家状态区仍可见真实对局 UI；神圣防负面链路达标。

### Treant / 刺藤

结算前截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精刺藤应在阶段推进中真实反伤并消耗\01-thorn-before-resolve-attack.png`

肉眼观察：

- 结算前仍可见刺藤 token 条件和攻击收口入口。
- 该截图作为反伤前态，不单独代表反伤完成。

结算后截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精刺藤应在阶段推进中真实反伤并消耗\02-thorn-after-resolve-attack.png`

肉眼观察：

- 攻击结算后 HP 变为 28，刺藤反伤链路已经写入状态。
- 右侧攻击阶段按钮转入后续阶段，刺藤 token 已消耗。
- 截图达到“真实反伤并消耗”的验收标准。

### Ninja / 忍术 4-5 加伤

入口截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者忍术应在伤害前掷骰加伤并回到可收口状态\01-ninjutsu-token-response-before-use.png`

肉眼观察：

- 真实响应窗标题为“响应（攻击方）”，说明当前是伤害结算前攻击方 token 响应阶段。
- 原始伤害 6、当前伤害 6，忍术 token 卡片显示“1 可用”并提供“使用”按钮。
- 这是 Ninja 忍术的真实 UI 入口，不是直接改状态后的静态断言。

加伤截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者忍术应在伤害前掷骰加伤并回到可收口状态\02-ninjutsu-bonus-die-overlay.png`

肉眼观察：

- 使用忍术后，响应窗当前伤害从 6 更新为 8，证明本次奖励骰结果按 `4-5 => +2` 分支写入了伤害。
- 界面显示“没有可用标记”，说明忍术 token 已消耗，不能重复使用。
- 该截图达到“忍术奖励骰加伤结果已进入玩家可见响应 UI”的验收标准。

收口截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者忍术应在伤害前掷骰加伤并回到可收口状态\03-ninjutsu-after-bonus-closeout.png`

肉眼观察：

- 响应窗已关闭，页面回到对局主视图。
- 当前阶段已推进到防御掷骰阶段，说明伤害前 token 响应链没有卡住。
- 右侧可见结束攻击 / 骰子区与手牌区，证明流程回到可继续操作状态。

### Ninja / 忍术 6 点慢性中毒分支

触发前截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者忍术6点应弹出分支选择并能施加慢性中毒\01-ninjutsu-6-token-response-before-use.png`

肉眼观察：

- Ninja 在伤害前响应窗中拥有忍术 token，进入 6 点分支前态成立。

选择窗截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者忍术6点应弹出分支选择并能施加慢性中毒\02-ninjutsu-6-choice-modal.png`

肉眼观察：

- 使用忍术后弹出“忍术 6 点效果”选择窗，能看到慢性中毒 / 不可防御两个分支入口。
- 该截图证明 6 点没有被错误自动结算为单一路径。

慢性中毒选择后截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者忍术6点应弹出分支选择并能施加慢性中毒\03-ninjutsu-6-poison-after-choice.png`

肉眼观察：

- 选择慢性中毒后目标玩家状态区出现对应 token。
- 选择窗已关闭，分支链路写入状态并收口。

### Ninja / 烟雾弹

入口截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者烟雾弹应在防御方响应窗中真实免除伤害\01-smoke-bomb-token-response-before-use.png`

肉眼观察：

- 防御方响应窗中可见烟雾弹 token，当前存在待接收伤害。
- 该截图是使用前态，不作为免伤完成证明。

免伤后截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者烟雾弹应在防御方响应窗中真实免除伤害\02-smoke-bomb-after-use-evaded.png`

肉眼观察：

- 使用烟雾弹后出现技能特写，说明真实 token 链路已触发玩家可见反馈。
- 防御者 HP 保持 30，pendingDamage 已清空；达到“真实免除伤害”的验收标准。

2026-05-13 追补收口截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者烟雾弹应在防御方响应窗中真实免除伤害\03-smoke-bomb-after-closeout.png`

肉眼观察：

- “继续”特写已关闭，页面回到真实对局主界面。
- 左侧生命值仍为 30，烟雾弹 token 已消耗，pendingDamage 不再阻塞后续阶段。
- 该截图补足烟雾弹链路的收口证据：不只证明响应窗可用，也证明免伤后能回到可继续推进状态。

### Ninja / 不可防御分支与慢性中毒回合结束

不可防御前截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者6点不可防御分支和慢性中毒回合结束应真实收口\01-ninjutsu-6-undefendable-before-use.png`

肉眼观察：

- 使用前响应窗可见忍术 token 和当前伤害，满足 6 点不可防御分支入口。

不可防御选择窗：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者6点不可防御分支和慢性中毒回合结束应真实收口\02-ninjutsu-6-undefendable-choice-modal.png`

肉眼观察：

- 选择窗中可见“不可以防御/不可防御”分支，证明该分支有真实 UI 入口。

不可防御选择后截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者6点不可防御分支和慢性中毒回合结束应真实收口\03-ninjutsu-6-undefendable-after-choice.png`

肉眼观察：

- 选择不可防御后，攻击链路继续推进，防御相关入口被跳过或置为不可用。
- 该截图达到“不可防御分支真实收口”的验收标准。

慢性中毒回合结束前截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者6点不可防御分支和慢性中毒回合结束应真实收口\04-delayed-poison-before-turn-end.png`

肉眼观察：

- 目标玩家身上可见慢性中毒 token，HP 处于扣血前状态。
- 该截图只作为回合结束扣血前态。

慢性中毒回合结束后截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者6点不可防御分支和慢性中毒回合结束应真实收口\05-delayed-poison-after-turn-end.png`

肉眼观察：

- 回合结束后目标 HP 从 20 到 14，慢性中毒 token 计数归零。
- 页面回到主阶段，流程没有卡住；达到“慢性中毒回合结束扣血并收口”的验收标准。

### 选角 UI / 实施中斜向覆盖横幅

> 2026-06-05 当前阅读门禁：本节只记录 2026-05-10 当时选角页 still 挂 `implementation_in_progress` 的历史截图观察，不代表树精 / 忍者当前仍保留该横幅。当前若要判断选角状态，应以当前代码与后续主文档为准。

选角截图：
`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-ninja-selection.png`

肉眼观察：

- Treant 与 Ninja 均可在真实选角界面选择，并分别出现玩家标记。
- 这是 2026-05-10 当时的历史截图：两张英雄卡只显示一套 `实施中` 斜向覆盖横幅；未看到左上角小胶囊 / pill 形态，横幅不覆盖点击区、不禁用选角。
- 该截图用于证明当时“实施中 UI 组件”唯一形态为斜向覆盖横幅，是状态提示，而不是将新增英雄重新锁死；它不能再反向证明 2026-06-05 当前仍保留该状态。


## 2026-05-13 追补修订：规则核对与 UI / 头像收口

本次追补用于消除主审计文档与规则核对表之间的不一致：四份规则核对表中旧的 `待 L3`、`仍不能写成 L3/L4 完成`、`真实入口卡牌 UI/机制 L3 仍待` 口径，已在 2026-05-13 当时回写为该轮可发布口径；这些表述现在只能作为当轮历史快照，不再自动代表 2026-06-05 的现行总状态。

- `src/games/dicethrone/rule/treant录入核对.md`：幼种树灵、木苗树灵、神性树灵、生命源泉、刺藤均已绑定到对应 L3/L4 真实入口证据链。
- `src/games/dicethrone/rule/ninja录入核对.md`：慢性中毒、忍术、烟雾弹均已绑定到对应 L4 响应窗 / 奖励骰 / 回合结束证据链。
- `src/games/dicethrone/rule/treant卡牌录入核对.md` 与 `src/games/dicethrone/rule/ninja卡牌录入核对.md`：不再把“逐卡真实打出 E2E”误写成当前发布阻塞；当前结论限定为专属卡静态/i18n/图集 L1 全量核对完成，专属 token/状态后续机制通过代表性 L2/L3/L4 链路覆盖。
- 头像追补证据：2026-05-13 当时曾尝试把 Common `characterhead2.png` 中第 3 个忍者、第 14 个树精裁入 `character-portraits` 图集；该方案后来已被判定为错误方案。当前应以 `evidence/dicethrone/dicethrone-treant-ninja-portrait-atlas-fix-2026-05-13.md` 为准：老角色继续使用旧 `character-portraits`，Treant / Ninja 单独分流到 `characterhead2`。
- 实施中 UI 追补证据：`evidence/dicethrone/dicethrone-implementation-status-ribbon-e2e-test.md`。该文档现在只保留 2026-05-12 当时“只剩单一 overlay 形态”的历史 UI 收敛证据，不能再当作树精 / 忍者当前仍处于实施中状态的证明。
- 2026-05-13 复跑验证：
  - `npx vitest run src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/__tests__/ninja-token-mechanics.test.ts src/games/dicethrone/__tests__/treant-ninja-intake.test.ts --reporter=dot`：3 files / 16 tests passed。
  - `npm run typecheck`：passed。
  - `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts`：10 passed。
  - `npm run test:e2e:ci:file -- e2e/dicethrone/character-selection.e2e.ts "树精和忍者应该能够选角并进入游戏"`：1 passed。

审计边界声明：2026-05-10 当时的发布口径没有要求逐张专属卡都从手牌真实打出一遍；这条边界现在只能作为该轮 intake 历史说明，不能再外推成 2026-06-05 的“新派系默认范围”。按现行 skill / workflow，新英雄默认交付已经包含对象级全面审计留档，不需要再次追问是否补审。

## 审计维度

本轮命中并覆盖的通用审计维度：

- D1 / D2：静态数据与真相源逐项对齐，卡牌、技能、token、图集均有核对文档。
- D6：资源链一致性，正式资源、压缩资源、manifest、R2/CDN URL 分层核对。
- D12 / D13：响应时机与强制 / 可选语义，Treant Divine / Ninja Ninjutsu / Smoke Bomb 均在对应响应窗触发并收口。
- D18：状态字段归属，pendingDamage / pendingAttack / pendingBonusDiceSettlement / token 消耗不混进纯 UI 临时字段。
- D21：回合结束延迟状态，慢性中毒在回合结束扣血并归零。
- D24：UI 真实入口验证，E2E 从真实在线对局入口触发，不用伪造独立预览页。
- D31：重掷 / 骰子选择链路，幼种树灵通过真实骰子按钮完成重掷。
- D37 / D40：交互链和显示层深审，旧“按钮可见即完成”结论失效；本轮补足真实点击、状态变化、截图链。
- D45：资源上传后外部目标回查，远端媒体 SHA 与本地一致。
- 但该版审计漏掉了后来被单独抽出的通用维度：**权威可视合同一致性**。也就是“有图时，是否逐槽核对玩家板/可交互区/故意留空区/共享语义覆盖风险”。Treant 这次漏审就落在这里。

## 最终结论

下列“最终结论”已经失效，保留仅作 2026-05-10 当时证据快照，不再代表当前有效收口状态。

Treant / Ninja 新英雄在 2026-05-10 当时的阶段性结论快照如下：

- 数据录入：2026-05-10 当时判定 `passed`
- 资源压缩 / manifest / 上传 / 远端回查：2026-05-10 当时判定 `passed`
- 机制实现与 L2 单测：2026-05-10 当时判定 `passed`
- 真实入口 E2E 与截图链：2026-05-10 当时判定 `passed`（10 条机制 E2E + 选角 UI 斜向横幅验证）
- 审计 evidence 与规则核对表回写：2026-05-10 当时判定 `passed`
- 选角 UI：2026-05-10 当时已验证 Treant / Ninja 显示唯一 `实施中` 斜向覆盖横幅，仍可选择并进入对局；第二套 pill UI 已删除。该条现在只保留为历史快照，不代表 2026-06-05 当前主线仍保留该横幅。

### 2026-06-05 后的当前有效口径

- `treant`：本文件旧结论失效。原因不是“没测试到 token / 卡牌效果”，而是“录入阶段没先建立玩家板槽位合同，审计阶段也没把这个缺口拦住”。当前不应只回到槽位专项文档，而应以 `src/games/dicethrone/rule/treant真相源表.md`、`src/games/dicethrone/rule/treant录入核对.md`、`evidence/dicethrone/dicethrone-treant-full-audit-2026-05-16.md` 与 `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 的现行矩阵为准。
- 2026-05-16 继续全面审计后，Treant 失效范围进一步扩大：不只是槽位合同漏审，还新增命中提示板 / 玩家板 / 专属卡图的批量语义冲突，包括 `养成树灵` 领域合同缺失、`每回合每种树灵仅限花费1次` 未实现、神性树灵防负面自动触发、刺藤上限缺失，以及多张基础技能 / 专属卡错录。Treant 当前现行阅读入口应改看单英雄主审计文档与升级重审主文档，而不是只看首轮槽位专项。
- `ninja`：本文件旧结论同样失效。当前不应再把 `dicethrone-ninja-regression-audit-2026-05-14.md` 当作现行阅读入口，而应以 `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md`、`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 与 `src/games/dicethrone/rule/ninja录入核对.md` 的现行矩阵为准。
- 进一步到 2026-06-05，Treant / Ninja 升级技能对象级 `L3` 与关键 `L4` 已在后续补审中大幅补齐；因此，当前残余不能再读成“这两个英雄仍有一批升级技能对象级未完成”，而应读作批次级 `L4` 判等治理、旧文档统一回写与最终发布口径统一。
- 因此，这份 2026-05-10 主审计文档不能再作为 Treant / Ninja 的全面审计完成证明；它只能证明当时已覆盖的那批代表链，不证明后续新增发现的槽位合同、共享语义错位、升级技能对象级补审、旧结论降级与批次治理尾项都已包含在内。
- 同时也不能再把本文里的 `passed`、当轮 E2E 通过或旧 workflow 边界，外推成 2026-06-05 当前“新英雄默认范围已完成/可发布”。当前若还要判断是否存在未完成项，只能回到现行总汇总和单英雄主审计文档逐项核对。
