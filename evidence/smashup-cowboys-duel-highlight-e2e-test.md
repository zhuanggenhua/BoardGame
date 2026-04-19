# Smash Up Cowboys 决斗随从高亮 E2E 证据

## 范围

- 游戏：`Smash Up / 大杀四方`
- 派系/链路：`Cowboys` 决斗 UI
- 目标：决斗开始后，参与决斗的双方随从必须在卡本体上持续显示决斗态提示，当前实现为“保留原棕色边框 + 外发光 + 卡片中上 `决斗中` 标签”；决斗结算后提示必须消失

## 运行命令

```bash
npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算"
```

## 结果

- 结果：通过
- 用例：`Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算`

## 关键截图

### Pinkerton 阶段

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-pinkerton-prompt.png`

相对引用：

![Pinkerton 阶段](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-pinkerton-prompt.png)

人工观察：

- 左侧基地上的 `Gunfighter` 和敌方 `Microbot Alpha` 同时保留原本棕色卡边，但卡外都有一圈明显暖棕色发光。
- 两张卡的中上位置都能看到 `决斗中` 标签，没有压住左上的力量徽章。
- 当前交互只是 `Pinkerton` 放置指示物，不是随从选择步骤，说明这层发光和标签不是“可选态误亮”，而是独立的决斗标记。

### 决斗牌阶段

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-card-prompt.png`

相对引用：

![决斗牌阶段](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-card-prompt.png)

人工观察：

- 切到“决斗牌：从手牌选择 1 张要用于这场决斗的牌，或跳过”后，两张场上决斗随从仍保持外发光和中上 `决斗中` 标签，没有在阶段切换时丢失。
- 手牌里的 `Deputy` 正常显示在底部，发光和标签只落在场上的决斗双方，没有误标到手牌。

### Deputy 选目标阶段

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-deputy-target-prompt.png`

相对引用：

![Deputy 选目标阶段](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-deputy-target-prompt.png)

人工观察：

- `Gunfighter` 既是当前可选目标，又仍然保留决斗发光和中上标签，说明“可选态”和“决斗态”可以并存，不会互相覆盖掉。
- 敌方 `Microbot Alpha` 依旧保留决斗发光，即使这一步并不是它可点击，也能继续明确它仍在本场决斗里。

### 决斗结算后

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-after-resolve.png`

相对引用：

![决斗结算后](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-after-resolve.png)

人工观察：

- 顶部决斗横幅已经消失，说明 UI 已退出决斗态。
- 场上只剩 `Pinkerton` 与被强化后的 `Gunfighter`，敌方决斗失败者已离场。
- 剩下的 `Gunfighter` 不再保留额外的决斗发光与 `决斗中` 标签，证明决斗提示会在结算后及时清理，而不是残留到后续回合。

## 自动断言补充

- E2E 现在会显式断言 `gun-1`、`enemy-1` 在 `Pinkerton`、`决斗牌`、`Deputy 选目标` 三个阶段都带 `data-duel-participant="true"`。
- 结算完成后，E2E 会断言页面上 `data-duel-participant="true"` 数量为 `0`。
