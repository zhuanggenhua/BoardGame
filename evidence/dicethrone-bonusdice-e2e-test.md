# DiceThrone 万箭齐发与武僧奖励骰端到端截图证据

## 验证范围

- 本轮只验证 DiceThrone 牌桌内两条奖励骰链路：月精灵“万箭齐发”和武僧“雷霆万钧”。
- 真实入口为 Playwright 专用测试模式下的 DiceThrone 游戏页，使用代表态直接进入攻击/奖励骰关键位点。
- 规则真相源来自现有卡牌/技能实现：月精灵“万箭齐发”会打出卡牌后投 5 颗奖励骰并按弓面加伤、施加缠绕；武僧“雷霆万钧”会由三掌技能触发 3 颗奖励骰，可花 2 太极重掷 1 颗后按最终点数结算伤害。

## 运行命令

```powershell
node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e.ts
```

结果：2 条用例通过，截图时间为 2026-07-21 00:12 左右。

## AI 核图结论

- 万箭齐发链路包含 4 张：打牌前手牌可见、打出后卡牌特写展示五颗奖励骰和结果描述、特写关闭后攻击修正仍留在结算前、伤害与缠绕落地收口。
- 武僧雷霆万钧链路包含 5 张：三掌骰面技能可选、技能触发进入攻击结算、防御后奖励骰面板出现且可花太极重掷、重掷一颗后太极耗尽且骰面更新、确认后按重掷后点数造成伤害收口。
- 已确认“取消骰子特写”没有误删卡牌特写：万箭齐发第 2 张能看到卡牌特写本体与五颗奖励骰同屏；武僧第 3-4 张则使用右侧/阻塞式奖励骰面板承接重掷交互。
- 未发现只给单张中间产物的问题；这组图覆盖触发、展示、关键交互和最终收口。

## 截图观察

| 步骤 | 原始截图 | 肉眼观察 | 结论 |
| --- | --- | --- | --- |
| 万箭齐发 01 | `test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/月精灵万箭齐发从打牌到五颗奖励骰展示再到伤害收口/01-万箭齐发-打牌前攻击已选且手牌可见.jpg` | 月精灵面板、攻击阶段、手牌中的“万箭齐发”均可见，右侧骰盘和结算入口在场。 | 达标，证明起点不是中间态截图。 |
| 万箭齐发 02 | `test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/月精灵万箭齐发从打牌到五颗奖励骰展示再到伤害收口/02-万箭齐发-卡牌特写展示五颗奖励骰和结果描述.jpg` | 中央显示“万箭齐发”卡牌特写，右侧同屏展示 5 颗奖励骰和结果说明。 | 达标，卡牌特写保留，且奖励骰结果可读。 |
| 万箭齐发 03 | `test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/月精灵万箭齐发从打牌到五颗奖励骰展示再到伤害收口/03-万箭齐发-特写关闭后攻击修正留在结算前.jpg` | 卡牌特写已关闭，牌桌回到结算前状态，右侧仍显示可推进的攻击结算入口。 | 达标，证明特写退场后链路没有断。 |
| 万箭齐发 04 | `test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/月精灵万箭齐发从打牌到五颗奖励骰展示再到伤害收口/04-万箭齐发-伤害和缠绕已落地流程收口.jpg` | 进入主要阶段二，对方身上可见缠绕状态，流程回到牌桌稳定态。 | 达标，证明结算收口。 |
| 雷霆万钧 01 | `test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/武僧雷霆万钧从技能触发到奖励骰重掷再到结算收口/01-雷霆万钧-三掌骰面已确认技能可选.jpg` | 武僧面板和三掌骰面可见，技能槽处于可选状态。 | 达标，证明技能触发前提成立。 |
| 雷霆万钧 02 | `test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/武僧雷霆万钧从技能触发到奖励骰重掷再到结算收口/02-雷霆万钧-技能已触发进入攻击结算.jpg` | 技能已进入攻击结算，牌桌仍保持武僧视角和攻击阶段上下文。 | 达标，证明不是直接注入最终奖励骰面板。 |
| 雷霆万钧 03 | `test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/武僧雷霆万钧从技能触发到奖励骰重掷再到结算收口/03-雷霆万钧-奖励骰面板出现且可花太极重掷.jpg` | 奖励骰面板出现，3 颗骰子可见，确认伤害按钮和可重掷语义同屏可见。 | 达标，证明奖励骰交互窗口没有被跳过。 |
| 雷霆万钧 04 | `test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/武僧雷霆万钧从技能触发到奖励骰重掷再到结算收口/04-雷霆万钧-重掷一颗后太极耗尽骰面更新.jpg` | 第一颗奖励骰已变化，界面显示达到重掷上限/太极耗尽，仍保留确认伤害入口。 | 达标，证明重掷实际改变结算基准。 |
| 雷霆万钧 05 | `test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/武僧雷霆万钧从技能触发到奖励骰重掷再到结算收口/05-雷霆万钧-确认后按重掷后点数造成伤害收口.jpg` | 奖励骰面板已关闭，回到主要阶段二，对方生命已按重掷后的总点数结算。 | 达标，证明最终收口。 |

## 交付

- 本地原图已一次性打开到 PureRef；PureRef 新开进程 `302716`，原已有进程为 `231980`。
- 服务器相册已发布并校验 HTTP 200：`http://8.148.71.102:18080/#/boardgame/dicethrone-bonusdice-e2e`
- 远端健康检查通过：`http://127.0.0.1:18080/health` 返回 `{"status":"ok"}`。
