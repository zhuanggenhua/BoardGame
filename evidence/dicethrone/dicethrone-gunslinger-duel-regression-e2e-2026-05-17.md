# DiceThrone 枪手 Duel 回归 E2E（2026-05-17）

## 范围

- 用户反馈 1：AI 僧侣使用“天人合一（harmony）”攻击时，枪手用 `duel` 防御后没有播放伤害浮字。
- 用户反馈 2：`duel` 的 compare-roll 展示窗第一次弹出像“弹到一半又重新弹出”。

本轮只核对真实链路：

- 僧侣 `harmony` 攻击
- 枪手 `duel` 防御
- `duel` compare-roll 获胜后选择“抵挡 1/2 进攻伤害”
- 再推进一次防御阶段完成攻击结算

## 新增回归用例

文件：[e2e/dicethrone/dicethrone-defense-selection.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/dicethrone/dicethrone-defense-selection.e2e.ts)

- `枪手 Duel 对掷展示窗首次出现时不应半弹后重开`
- `枪手 Duel 选择抵挡一半后仍应播放僧侣天人合一的伤害浮字`

## 运行结果

执行命令：

```powershell
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-defense-selection.e2e.ts "枪手 Duel"
```

结果：2 个用例通过。

## 时序日志证据

本轮不再只靠截图判定。两条用例都产出了稳定的 E2E 时序 JSON：

- [gunslinger-duel-compare-roll-audit.json](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone/dicethrone-defense-selection.e2e/枪手-Duel-对掷展示窗首次出现时不应半弹后重开/gunslinger-duel-compare-roll-audit.json)
- [gunslinger-duel-damage-float-audit.json](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone/dicethrone-defense-selection.e2e/枪手-Duel-选择抵挡一半后仍应播放僧侣天人合一的伤害浮字/gunslinger-duel-damage-float-audit.json)

这两份日志至少记录了：

- `compare-roll` overlay 的挂载次数、可见段数、连续 `boundingBox`/opacity/transform 采样
- compare-roll 交互 id 轨迹
- 手工推进 `ADVANCE_PHASE` 与关键 UI 点击 marker
- `DAMAGE_DEALT` 事件流摘要
- 最终伤害浮字 DOM 挂载与文本
- 各关键时刻的 phase / interaction / HP 快照

## 截图证据

### 1. compare-roll 首次展示

截图：
[gunslinger-duel-harmony-compare-roll-first-open.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone/dicethrone-defense-selection.e2e/枪手-Duel-对掷展示窗首次出现时不应半弹后重开/gunslinger-duel-harmony-compare-roll-first-open.png)

我实际看到：

- 对掷特写窗完整可见，左右两颗骰子本体都在画面中。
- 结果文案是“你赢得了对决，可选择后续效果”，两个按钮都可见。
- 对应 JSON 日志记录到 `compare-roll-overlay` 挂载次数为 `1`，compare-roll 交互 id 也只观测到 `1` 个，overlay 可见段数也是 `1`，没有出现“消失后再次出现”的第二段。

验收结论：

- 这条真实 `harmony -> duel` 链路里，没有复现“首次弹到一半又重新弹出一次”。

### 2. 选择“抵挡 1/2 进攻伤害”前

截图：
[gunslinger-duel-harmony-before-prevent-half.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone/dicethrone-defense-selection.e2e/枪手-Duel-选择抵挡一半后仍应播放僧侣天人合一的伤害浮字/gunslinger-duel-harmony-before-prevent-half.png)

我实际看到：

- compare-roll 特写窗内，防御方与攻击方都掷出了 `5`，因为当前是 `duel` 一级，所以防御方获胜。
- 可选按钮明确包含“抵挡 1/2 进攻伤害”。

验收结论：

- 真实对掷分支已成功进入用户反馈对应的选择点。

### 3. 伤害浮字与掉血

截图：
[gunslinger-duel-harmony-damage-float.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone/dicethrone-defense-selection.e2e/枪手-Duel-选择抵挡一半后仍应播放僧侣天人合一的伤害浮字/gunslinger-duel-harmony-damage-float.png)

我实际看到：

- 左侧枪手生命区出现红色 `-2` 伤害浮字。
- 同一位置生命值已从 `50` 变成 `48`。
- 页面阶段高亮已经进入 `6. 主要阶段(2)`，说明防御结算后攻击链路正常收口。
- 对应 JSON 日志同时记录到：事件流里存在 1 条 `sourceAbilityId=harmony` 的 `DAMAGE_DEALT`，而最终 DOM 浮字文本是 `-2`。这说明这条链路里需要区分“原始伤害事件值”和“`duel` 结算后的最终可视伤害”，不能只盯事件原值。

验收结论：

- 这条真实链路里，伤害浮字是存在的，没有复现“造成伤害但不播伤害”的问题。

## 本轮定位结论

- 当前仓库代码下，`harmony -> duel -> prevent half -> 再推进一次阶段` 这条真实链路没有复现“无伤害浮字”。
- 更关键的行为点是：`duel` 选择完分支后，当前实现会先回到 `defensiveRoll` 空闲态；要再推进一次阶段，攻击伤害才真正结算并播放浮字。
- 这轮结论不是只靠截图，而是基于“截图 + 时序 JSON”双证据：compare-roll 没有第二个可见段，伤害链里既有 `harmony` 的伤害事件，也有最终 `-2` 浮字和 `48 HP` 收口。

## 双页 compare-roll / 日志回归（2026-05-17 补充）

### 范围

- 用户反馈 1：枪手 `duel` 的对决特写不应只给自己看，对手页也应该同步看到。
- 用户反馈 2：对手页的特写不应提前消失，应等枪手真正做完分支选择再收口。
- 用户反馈 3：对手页的行为日志必须能看出这次对决发生了什么、结果是什么。

### 新增回归用例

文件：[e2e/dicethrone/dicethrone-duel-shared-compare-roll.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/dicethrone/dicethrone-duel-shared-compare-roll.e2e.ts)

- `枪手 Duel compare-roll 应对双方同时可见，且对手侧能从日志看出结果`

执行命令：

```powershell
$env:BG_HEAVY_MEMORY_MIN_FREE_GB='0.8'
$env:PW_HEADED='true'
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-duel-shared-compare-roll.e2e.ts "枪手 Duel compare-roll 应对双方同时可见，且对手侧能从日志看出结果"
```

结果：通过，`1 passed`。

### 关键截图

#### 1. 枪手自己看到对决结算特写

截图：
[枪手-Duel-compare-roll-应对双方同时可见，且对手侧能从日志看出结果-guest-gunslinger-sees-duel-compare-roll.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone/dicethrone-duel-shared-compare-roll.e2e/枪手-Duel-compare-roll-应对双方同时可见，且对手侧能从日志看出结果/枪手-Duel-compare-roll-应对双方同时可见，且对手侧能从日志看出结果-guest-gunslinger-sees-duel-compare-roll.png)

我实际看到：

- 这是枪手页直接截取的 `compare-roll-overlay` 本体，不是整页碰运气截图。
- 标题是“对决获胜：请选择结算效果”，说明当前不是失败自动确认链，而是枪手获胜后的可分支结算态。
- 画面里同时看到防御方骰子与攻击方骰子本体，结果文案明确写着“你赢得了对决，可选择后续效果。”

验收结论：

- 枪手页能稳定看到对决特写本体，而且是“待枪手选择”的获胜分支态。

#### 2. 对手页同步看到等待态，对决不会在枪手选之前提前消失

截图：
[枪手-Duel-compare-roll-应对双方同时可见，且对手侧能从日志看出结果-host-opponent-sees-duel-compare-roll.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone/dicethrone-duel-shared-compare-roll.e2e/枪手-Duel-compare-roll-应对双方同时可见，且对手侧能从日志看出结果/枪手-Duel-compare-roll-应对双方同时可见，且对手侧能从日志看出结果-host-opponent-sees-duel-compare-roll.png)

我实际看到：

- 对手页中央同样出现了对决特写，本体包含双方大骰子，不是只剩一行提示。
- 底部文案是“等待对方选择...”，说明对手页处于只读等待态，不会抢操作权。
- 右侧常规“投掷 / 确认 / 结束防御”按钮都处于禁用态，符合 compare-roll 期间由枪手独占操作权的预期。

验收结论：

- 对手页可以同步看到这次对决正在发生，而且 overlay 会持续停留到枪手完成选择为止。

#### 3. 枪手完成选择后，对手页日志能看到对决结果

截图：
[枪手-Duel-compare-roll-应对双方同时可见，且对手侧能从日志看出结果-host-opponent-action-log-shows-duel-result.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone/dicethrone-duel-shared-compare-roll.e2e/枪手-Duel-compare-roll-应对双方同时可见，且对手侧能从日志看出结果/枪手-Duel-compare-roll-应对双方同时可见，且对手侧能从日志看出结果-host-opponent-action-log-shows-duel-result.png)

我实际看到：

- 对手页行为日志中有一条明确的 compare-roll 结果记录。
- 日志正文不是空泛提示，而是包含“对掷结果：对决获胜：请选择结算效果。防守方: 6 vs 攻击方: 1。你赢得了对决，可选择后续效果。”这样的结果摘要。
- 紧接着还有“以【对决】获得 50% 伤害减免护盾”的后续结算条目，说明 compare-roll 结果和后续分支效果都能被旁观页追溯。

验收结论：

- 对手页现在可以从日志直接知道发生了什么、谁赢了对决，以及枪手后续选了什么效果。
