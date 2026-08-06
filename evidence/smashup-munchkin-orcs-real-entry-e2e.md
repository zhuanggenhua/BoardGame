# 萌奇金兽人真实入口 E2E 视觉验收

## 现场与真相源

- 当前工作区：`D:\gongzuo\webgame\BoardGame`
- 当前分支：`main`
- 真实入口：Smash Up 本地测试房间，通过 `openTestGame('smashup')` 进入
- 验收视口：`1440x900`
- 规则真相源：`public/locales/zh-CN/game-smashup.json` 中“太难了”“洗手间”“死亡之息”的正式卡牌文本；兽人保护范围合同见 `openspec/changes/add-smashup-munchkin-orcs-faction/specs/smashup-ongoing-effect-authoring/spec.md`

## 功能证据

### 太难了：真实手牌手动附着随从

1. [手牌打出前两个候选随从](D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\兽人太难了从真实手牌入口手动选择附着随从\兽人-太难了-手牌打出前两个候选随从.jpg)
   - 画面同时看见手牌中的“太难了”、两个基地、两个真实随从、牌库/弃牌堆、回合条、玩家面板和结束回合入口。
   - 这是动作前基线，不用于证明目标已选择。
2. [手动选择附着随从](D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\兽人太难了从真实手牌入口手动选择附着随从\兽人-太难了-手动选择附着随从.jpg)
   - 两个场上随从本体都可见并显示绿色可选高亮，手牌中的“太难了”保持可识别并显示选中态。
   - 没有用隐藏交互选项或中央重复弹窗替代场上随从点击。
3. [已附着到目标随从](D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\兽人太难了从真实手牌入口手动选择附着随从\兽人-太难了-已附着到目标随从.jpg)
   - “太难了”已从手牌离场，目标“第一队长”仍在原基地，其卡面上出现标准附着标记。
   - 行动额度显示为 0，结束回合入口、牌库、弃牌堆和玩家面板仍可见，没有新增遮挡。

### 洗手间：真实手牌手动附着基地

[手动选择附着基地](D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\兽人洗手间从真实手牌入口手动选择附着基地\兽人-洗手间-手动选择附着基地.jpg)

- 两个真实基地本体显示绿色可选高亮，场上随从和手牌中的“洗手间”仍可识别。
- 选择态没有遮挡阶段条、计分板、牌库/弃牌堆或结束回合入口。

### 死亡之息：过滤太难了保护目标

[过滤太难了保护目标](D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\兽人死亡之息真实入口排除附着太难了的受保护随从\兽人-死亡之息-过滤太难了保护目标.jpg)

- 顶部短提示明确当前动作是选择力量 4 或更少的随从。
- 未受保护的“侦察兵”本体高亮；带有“太难了”附着标记的“第一队长”没有高亮，玩家可以直接理解合法目标范围。
- “死亡之息”来源卡和弃牌堆仍在右下方可见，提示条没有压住基地或目标。

## AI 图面裁决

```text
verdict: PASS
score: 94/100
hard_failures: []
```

### 负向影响检查

- 目标本体：保留在基地原位，选择态高亮挂在真实随从/基地上，没有漂移或只显示内部选项。
- 手牌与牌堆：手牌来源、牌库数量、弃牌堆入口在动作前和选择态可见；结算后卡牌离开手牌，未伪造重复卡片。
- 阶段与玩家面板：回合/阶段、计分板和行动额度持续可见。
- 主动作入口：结束回合按钮没有被目标高亮、提示条或附着标记遮挡。
- 保护状态：最终附着标记落在目标随从上；死亡之息选择态把受保护目标排除，没有用文字重复解释代替真实目标过滤。
- 临时内容：没有调试日志、测试监听器、开发按钮或测试夹具名进入玩家画面。

## 功能回归

- 兽人领域测试：`19/19` 通过。
- 太难了真实手牌手动附着：`1 passed`。
- 洗手间真实手牌手动附着基地：`1 passed`。
- 死亡之息真实入口排除太难了保护目标：`1 passed`。
- 剑王真实入口：本次复跑 `1 passed`。
- 呆瓜兽人真实入口：本次复跑 `1 passed`。
- 坑洞保护真实入口：本次刷新 `1 passed`，并重新生成四张真实入口截图。

## 2026-08-05 对象级续审

### 真实入口结果

- 兽人整组真实入口筛选首次运行：`11 passed / 2 failed`。
- 两个失败均为 E2E 断言问题，不是玩法失败：粉碎者测试在隐藏调试面板后读取调试 DOM；给我！测试把被摧毁的原宿主随从弃牌误判为附着行动弃牌。
- 修正测试断言后，粉碎者：`1 passed`；给我！：`1 passed`。
- 修正断言后，兽人真实入口对象用例最终聚合为 `16 passed`。此前的 `11 passed / 2 failed` 只对应两条 E2E 断言问题；本次沿当前真实入口整组筛选 `兽人` 重跑为 `16/16 passed`。

### 对象级矩阵

| 对象 | 真实交互 / 状态证据 | 当前结论 |
| --- | --- | --- |
| 剑王 | [同基地己方获得 +1](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人剑王真实入口显示同基地己方力量加成并排除自身、对手和其他基地/兽人-剑王-同基地己方获得加成且自身对手与其他基地不加成.jpg)；自身、对手、另一基地均无加成标记 | `L2 + L3 passed` |
| 粉碎者 | [天赋可用](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人粉碎者真实入口保留手动天赋按钮并记录已使用状态/兽人-粉碎者-天赋可用.jpg)、[天赋已使用](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人粉碎者真实入口保留手动天赋按钮并记录已使用状态/兽人-粉碎者-天赋已使用.jpg) | `L2 + L3 passed` |
| 重击者 | [力量目标选择](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人重击者真实入口手动选择力量目标，单候选也不自动结算/兽人-重击者-手动选择力量目标.jpg)、结算后目标进入弃牌堆 | `L2 + L3 passed` |
| 呆瓜兽人 | [受保护目标被排除](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人呆瓜兽人真实入口排除对手行动目标但保留同基地普通随从/兽人-呆瓜兽人-对手行动排除受保护随从.jpg)、[普通随从被摧毁且呆瓜兽人保留](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人呆瓜兽人真实入口排除对手行动目标但保留同基地普通随从/兽人-呆瓜兽人-普通随从被摧毁而呆瓜兽人保留.jpg) | `L2 + L3 passed` |
| 躺下！ | [计分前响应选择](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人躺下！计分前真实响应先手动选择行动并压制其他玩家特殊能力/兽人-躺下-计分前手动选择响应.jpg)、结算后压制状态 | `L2 + L3/L4 passed` |
| 愤怒的掠夺者 | [计分前响应选择](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人愤怒的掠夺者计分前真实响应手动选择后获得-1-VP/兽人-愤怒的掠夺者-计分前手动选择响应.jpg)、结算后 VP 变化 | `L2 + L3/L4 passed` |
| 挤碎 | [基地选择](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人挤碎真实入口按基地、玩家、随从三步手动选择/兽人-挤碎-第一步手动选择基地.jpg)、[玩家选择](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人挤碎真实入口按基地、玩家、随从三步手动选择/兽人-挤碎-第二步手动选择仆从更少玩家.jpg)、[随从选择](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人挤碎真实入口按基地、玩家、随从三步手动选择/兽人-挤碎-第三步手动选择要摧毁随从.jpg) | `L2 + L3/L4 passed` |
| 死亡之息 | [力量目标过滤](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人死亡之息真实入口排除附着太难了的受保护随从/兽人-死亡之息-过滤太难了保护目标.jpg)、未受保护目标回拥有者牌库 | `L2 + L3/L4 passed` |
| 狗堆 | [先选随从](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人狗堆在计分前真实响应仍按随从再基地手动选择/兽人-狗堆-计分前手动选择随从.jpg)、[再选基地](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人狗堆在计分前真实响应仍按随从再基地手动选择/兽人-狗堆-计分前手动选择目标基地.jpg) | `L2 + L3/L4 passed` |
| 给我！ | [先选附着行动](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人给我！真实入口先选附着行动再选己方新宿主/兽人-给我-第一步手动选择附着行动.jpg)、[再选新宿主](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人给我！真实入口先选附着行动再选己方新宿主/兽人-给我-第二步手动选择己方新宿主.jpg)、转移后附着行动保留 | `L2 + L3/L4 passed` |
| 洗手间 | [手动选择保护随从](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/munchkin-new-faction-flow/兽人-洗手间-手动选择保护随从.png)、保护后挤碎继续完成；另有[手牌打出后选择基地](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人洗手间从真实手牌入口手动选择附着基地/兽人-洗手间-手动选择附着基地.jpg) | `L2 + L3/L4 passed` |
| 太难了 | [手动选择附着随从](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人太难了从真实手牌入口手动选择附着随从/兽人-太难了-手动选择附着随从.jpg)、[过滤受保护目标](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人死亡之息真实入口排除附着太难了的受保护随从/兽人-死亡之息-过滤太难了保护目标.jpg) | `L2 + L3/L4 passed` |
| 要塞 | [总力量 22 计分前](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人要塞真实计分按玩家总力量-22-门槛给两名最高玩家额外-VP/兽人-要塞-计分前总力量达到22.jpg)、结算后两名最高玩家额外 VP | `L2 + L3/L4 passed` |
| 坑洞 | [坑洞内随从受保护](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人坑洞真实入口只保护坑洞内随从不受对手行动/兽人-坑洞保护-对手行动无法摧毁坑洞随从.jpg)、[另一基地仍可手动选择并摧毁目标](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人坑洞真实入口只保护坑洞内随从不受对手行动/兽人-坑洞保护-另一基地仍可手动选择目标.jpg)、[保护链结算后对照](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人坑洞真实入口只保护坑洞内随从不受对手行动/兽人-坑洞保护-坑洞保留而另一基地目标被摧毁.jpg)；另有[总力量 16 计分与清场](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-munchkin-monster-treasure-ui.e2e/兽人坑洞真实计分达到16后清场并保留原版计分布局/兽人-坑洞-计分前总力量达到16.jpg) | `L2 + L3 passed` |

### 本轮 AI 图面裁决

```text
verdict: PASS
score: 92/100
hard_failures: []
```

- 选择态均显示真实基地、玩家目标按钮、随从或附着行动本体；没有只依赖隐藏交互选项的证据。剑王的力量标记也只挂在同基地己方随从上，不把自身、对手或另一基地误标为加成目标。
- 多步流程按真实顺序推进：挤碎是基地→玩家→随从，给我！是附着行动→新宿主，狗堆是随从→基地。
- 呆瓜兽人的选择态只高亮普通随从，结算态保留呆瓜兽人；坑洞的两座基地对照图证明保护范围只留在坑洞内，另一基地仍可手动点选目标。
- 提示条只承担当前步骤的短状态；没有把同一张来源行动卡同时复制到中央提示、场上和弃牌堆。
- 基地下方随从列、基地上方泰坦 / 持续行动槽、左下公共牌堆数量、右下弃牌堆、右侧计分板和结束回合入口均保持可读，没有重叠或被选择高亮抢占。

### 尚未外推的范围

- 移动端只覆盖 Munchkin 公共 UI 横屏压力态，不宣称 12 张兽人牌逐张完成移动端图面审计。
- 本轮复核中剑王、呆瓜兽人、坑洞保护各自 `1/1 passed`；坑洞四张截图已按本次成功运行重新复核。
