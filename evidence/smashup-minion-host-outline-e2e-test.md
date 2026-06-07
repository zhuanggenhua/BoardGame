# 大杀四方宿主随从已选中描边 E2E 证据

## 执行命令

`npm run test:e2e:ci:file -- e2e/smashup/smashup-minion-host-outline.e2e.ts`

## 关键截图

1. 默认态整屏截图  
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-minion-host-outline.e2e\宿主随从已选中时只有卡面描边，内部角标与附着预览不复用高亮\01-host-neutral-board.png`

2. 宿主已选中态整屏截图  
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-minion-host-outline.e2e\宿主随从已选中时只有卡面描边，内部角标与附着预览不复用高亮\02-host-selected-board.png`

## 我实际看到的现象

### 01-host-neutral-board.png

- 目标随从处于普通态，外层没有绿色高亮框。
- 力量角标、附着角标都只是普通信息标记，没有借到宿主卡的高亮语义。
- 整张截图是完整战场，不是局部裁图，能看到同基地其他牌和全局参照物。

### 02-host-selected-board.png

- 目标随从已经进入已选中态，底部明确出现“已选 1 / 2”和“确认选择”按钮，说明这不是候选态。
- 只有目标随从外层卡面出现绿色高亮，描边落在宿主卡本体。
- 力量角标仍然贴在卡面左上，但没有再出现额外白边/绿边高亮感。
- 紫色附着角标和右上计数角标仍然是子元素，但没有复用宿主卡的描边。
- 右侧展开的附着行动预览卡显示为中性边框，不再是默认绿色高亮态。
- 宿主卡旁边的附着预览仍跟随交互正常展开，说明这次不是通过隐藏子元素来“遮问题”。

## 验收结论

- 本轮问题位点已按“宿主随从已选中时，只有卡面自己描边”收口。
- 宿主随从进入已选中态后，内部角标和右侧附着预览不再复用宿主卡的高亮描边语言。
