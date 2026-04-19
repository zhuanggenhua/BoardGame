# DiceThrone 攻击修正 UI E2E 证据

## 用例
- 文件: e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts
- 用例: selected attack should show visible attack-modifier ui above the dice tray
- 命令: $env:NODE_ENV='test'; npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "selected attack should show visible attack-modifier ui above the dice tray"
- DOM/盒模型校验：测试里额外读取 `active-modifier-badge` 与 `dice-tray` 的 `boundingBox()`，要求两者水平中心偏差 `<= 2px`

## 关键截图
- D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\selected-attack-should-show-visible-attack-modifier-ui-above-the-dice-tray\08-attack-modifier-ui-visible.png
- D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\selected-attack-should-show-visible-attack-modifier-ui-above-the-dice-tray\08-attack-modifier-ui-visible-crop.png
- D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\selected-attack-should-show-visible-attack-modifier-ui-above-the-dice-tray\08-attack-modifier-ui-rolling.png

## 目视结论
1. 右侧骰盘上方可见“攻击修正 +2”徽章，徽章主体位于骰子列正上方，没有再偏向右侧按钮区。
2. 截图里徽章与五颗骰子的纵向列保持同一中心线；同时 E2E 已用 DOM `boundingBox()` 约束该中心偏差不得超过 `2px`。
3. 骰子列近景（crop）里，骰面四角为原始圆角幅度，外框为深色立体边缘；未再出现黄色直角或叠加方形底图。
4. 旋转截图中骰子仍为 3D 立体框体（边缘与阴影仍在），滚动动画正常显示。
5. 本截图未展示 hover 提示条，仅验证徽章与骰盘列的相对位置和骰面外观。

## 结论
- E2E 用例通过；攻击修正徽章既有目视证据，也有 DOM 盒模型中心线校验，同时骰面四角黄边已在截图中消失。
