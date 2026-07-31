# 山屋惊魂作祟 3「灰尘」普通攻击致死真实入口证据

> 证据状态：通过。  
> 范围：只证明作祟 3「灰尘」中“普通攻击造成致死伤害 -> 受伤玩家先分配伤害 -> 确认后永久叛徒死亡变狂热病患 -> 全员感染或死亡触发叛徒终局”的代表链，不代表灰尘完整作祟完成。

## 规则真相源

- 项目子账本：`docs/games/betrayal/haunts/03-the-dust.md`。
- 灰尘合同子句：探索者死亡时，若该探索者已经是灰尘叛徒，应掩埋其物品和预兆，并用狂热病患替代；叛徒目标是所有探索者都成为叛徒或死亡。
- 本轮修复点：普通攻击这类通用伤害来源也必须先进入玩家伤害分配；不能在攻击事件当下提前把探索者死亡、生成狂热病患或触发终局。

## 自动化验证

- 领域回归：`node scripts\infra\vitest-cli-safe.mjs run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts --configLoader native -t "灰尘普通攻击致死|灰尘永久叛徒因普通攻击伤害死亡|灰尘普通伤害死亡后若所有探索者"`，3 passed / 285 skipped。
- 真实入口 E2E：`node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-ordinary-attack-death.e2e.ts "普通攻击"`，1 passed。
- 真实入口 E2E（整文件）：`npm run test:e2e:file -- e2e/betrayal/the-dust-ordinary-attack-death.e2e.ts`，2 passed；覆盖普通攻击致死分配链和胸针非强制物理伤害代表链。
- ESLint：`npx eslint e2e/betrayal/the-dust-ordinary-attack-death.e2e.ts e2e/betrayal/betrayalTestHelpers.ts`，0 errors。

## 截图核验

| 截图 | 绝对路径 | 实际看到 | 验收结论 |
| --- | --- | --- | --- |
| 普通攻击前 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-ordinary-attack-death\01-普通攻击前.jpg` | 牌桌处于剧本 3「灰尘」；顶部进度条显示研究、疾病标记、本人疾病和“永久感染”；门厅内可见行动玩家杰登与目标丽贝卡同房；底部主动作显示“攻击灰尘”。 | 达标：从真实牌桌主动作和同房玩家 token 进入，不是直接注入伤害分配态。 |
| 攻击后伤害分配面板 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-ordinary-attack-death\02-攻击后伤害分配面板.jpg` | 画面仍在牌桌上方显示“伤害分配 / 攻击”；受伤者是丽贝卡，伤害为 `4 点物理伤害`；仅力量 / 速度可选，未选满时确认按钮不可用。 | 达标：普通攻击致死没有立即终局，而是先等待受伤玩家分配物理伤害。 |
| 确认分配后叛徒胜利 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-ordinary-attack-death\03-确认分配后叛徒胜利.jpg` | 终局页进入结局朗读，正文为“狂热病患冲出房屋，在镇上肆虐。尘归尘，土归土。”，并提供“查看结果报告”；状态断言锁定作祟为 `the-dust`、结果为叛徒获胜。 | 达标：分配确认后才死亡、生成狂热病患并触发叛徒终局；页面不再依赖“灰尘”标题文本作为唯一证据。 |
| 普通攻击胸针通用伤害分配面板 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-ordinary-attack-death\04-普通攻击胸针通用伤害分配面板.jpg` | 受伤玩家真实页面显示胸针开关已开启，伤害从 `4 点物理伤害` 改为 `4 点一般伤害`；力量、速度、知识、神志四项都可分配。 | 达标：非强制普通攻击物理伤害入口中，玩家可以从真实页面声明胸针并改为通用伤害。 |
| 普通攻击胸针通用伤害结算反馈 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-ordinary-attack-death\05-普通攻击胸针通用伤害结算反馈.jpg` | 确认分配后回到牌桌，攻击投骰复盘仍显示普通攻击造成 4 点伤害；状态断言证明待分配伤害清空、目标仍持有胸针，知识轨按 4 点通用伤害扣减。 | 达标：胸针改写不是只在面板预览，确认后会落到真实结算状态并回到牌桌。 |

## 不外推

- 本切片不证明所有死亡保护组合。
- 本切片不证明所有其它伤害来源都会生成狂热病患。
- 本切片不证明灰尘英雄治愈胜利、全员感染交换链或完整死亡叛徒怪物化全排列。
- 胸针新增切片只证明灰尘普通攻击这一条非强制物理伤害真实入口；不证明精神伤害真实入口、更多伤害来源、减伤叠加、死亡保护或其它作祟伤害组合。
