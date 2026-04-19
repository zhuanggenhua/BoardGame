# Smash Up 拖拽箭头样式 E2E 证据

## 本轮目标
- 验证拖拽选目标时，卡牌本体仍留在手牌区，不再整张跟手遮挡棋盘。
- 验证拖拽引导改成从手牌卡位指向目标的箭头，并确认松手后随从真实落到基地。

## 执行命令
```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-local-gameplay.e2e.ts "本地模式：拖拽出牌会显示拖拽命中 UI，并在松手后真正落到基地"
```

## 环境说明
- 本次截图来自 worktree：`D:\gongzuo\webgame\BoardGame\.claude\worktrees\smashup-input-mode-preferences`
- 测试环境里部分牌面/基地美术未稳定加载，因此截图中仍有白色占位卡面。
- 本轮验收重点放在拖拽表现、箭头起点、基地高亮和松手后的落点结果。

## 截图与观察

### 1. 拖拽选择态
- 截图：`D:\gongzuo\webgame\BoardGame\.claude\worktrees\smashup-input-mode-preferences\test-results\evidence-screenshots\smashup\smashup-local-gameplay.e2e\本地模式：拖拽出牌会显示拖拽命中-UI，并在松手后真正落到基地\smashup-drag-selection-ui.png`
- 人工观察：
  - `First Mate` 仍停留在底部手牌位，没有被整张拖到棋盘中央。
  - 拖拽引导已经换成平滑的 SVG 曲线箭头，不再有前几版那种虚线/箭节感；箭体是一整条暖橙纯色曲线，末端是一个小箭头头。
  - 箭体与箭头头的衔接比上一版圆润，末端不再有明显的断口感；曲线整体更顺。
  - 箭头层已经压到手牌层下面，线条会从牌后方出去，不会覆盖或挡住底部手牌。
  - 提示条“松手打到该基地”已经恢复，放在曲线中段附近，体积较小，没有压住目标基地。
  - 左侧基地边框继续发绿，提示与箭头都没有挡住基地本身，目标识别仍然清楚。

### 2. 松手后的运行态
- 截图：`D:\gongzuo\webgame\BoardGame\.claude\worktrees\smashup-input-mode-preferences\test-results\evidence-screenshots\smashup\smashup-local-gameplay.e2e\本地模式：拖拽出牌会显示拖拽命中-UI，并在松手后真正落到基地\smashup-drag-play-resolved-ui.png`
- 人工观察：
  - 左侧基地下方已经出现一张斜放的随从卡，不是只有高亮或临时残影。
  - 该基地的战力徽记从 `0` 变为 `2`，说明落子已经进入真实运行结果。
  - 底部手牌区不再保留那张待打出的手牌，表示拖拽释放后已完成出牌结算。

## 结论
- 拖拽选目标时的视觉已改成“卡留在手牌区，箭头从卡位拉向目标”，不会再用整张卡遮挡棋盘视野。
- 引导层已经重构成平滑 SVG 箭头，并恢复了小型提示条；不会再出现虚线感、黑白描边或压住目标区的大装饰块。
- 松手后的运行态也已通过 E2E 和人工看图确认，随从真实落到目标基地。
