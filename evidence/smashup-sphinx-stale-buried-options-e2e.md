# 狮身人面像 stale 埋葬牌选项 E2E 证据

## 运行命令

```bash
PW_START_SERVERS=true PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true PW_HAS_EXPLICIT_TARGET=true npx playwright test e2e/smashup-robot-hoverbot-new.e2e.ts --grep "狮身人面像埋葬牌交互遇到 stale 选项时应只保留仍存在的埋葬牌"
```

## 关键截图

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-robot-hoverbot-new.e2e\狮身人面像埋葬牌交互遇到-stale-选项时应只保留仍存在的埋葬牌\sphinx-bury-stale-options-filtered.png`

![狮身人面像 stale 埋葬牌过滤后](../test-results/evidence-screenshots/smashup-robot-hoverbot-new.e2e/狮身人面像埋葬牌交互遇到-stale-选项时应只保留仍存在的埋葬牌/sphinx-bury-stale-options-filtered.png)

## 肉眼观察结论

- 基地左下只看到 1 张可点击埋葬牌，没有出现第二张“过期埋葬牌”目标，说明 stale 选项没有继续映射到棋盘可选物。
- 交互区只剩一个 `跳过` 按钮，没有额外多出第二张卡牌按钮或重复入口，说明当前交互的候选列表已经收敛到真实状态。
- 测试环境里牌面美术未渲染，截图表现为白/深色占位卡面；但布局、可选高亮、按钮数量和交互位置都正常，足以验证 stale 目标已消失。

## 状态断言

- 出队成为 `current` 后，交互 `options` 只保留 `buried-sphinx-buried-real` 与 `skip`。
- 点击真实埋葬牌后，该牌从基地埋葬区消失并回到玩家手牌。
- 狮身人面像从 `setaside` 进入对应基地，`baseIndex=0`。
