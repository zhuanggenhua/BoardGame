# SmashUp 阵营选择残留阶段起手重抽 E2E 证据

## 测试目标

验证大杀四方在 `core.factionSelection` 已清空、`sys.phase` 仍残留为 `factionSelect` 时，页面不会卡在空白选阵营页，而是继续渲染起手重抽交互。

## 执行命令

```bash
npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "阵营选择已清空但 phase 残留时，仍应显示起手重抽交互"
```

## 结果

测试通过。

页面表现：
- 未渲染选阵营视图 `su-faction-select`
- 正常显示起手重抽弹层
- 可见按钮“保留手牌”和“重抽一次”

## 证据截图

截图路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\阵营选择已清空但-phase-残留时，仍应显示起手重抽交互\阵营选择已清空但-phase-残留时，仍应显示起手重抽交互-stuck-faction-select-mulligan-visible.png`

截图说明：
- 左上角仍显示 `Draft`，说明这是 phase 残留场景
- 中央已出现“起手无随从：是否重抽一次？（只能重抽一次）”弹层
- 下方两个操作按钮完整可见，证明 UI 没有被空白选阵营页吞掉
