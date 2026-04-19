# 大杀四方持续行动与泰坦布局四图证据

## 验证命令

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-alien-terraform.e2e.ts "二人局下 1 张与 5 张持续行动在有无泰坦时的布局截图"
```

## 截图与观察

### 1. 1 张持续行动，无泰坦

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\二人局下-1-张与-5-张持续行动在有无泰坦时的布局截图\01-2p-one-ongoing-no-titan.png`

人工观察：
- 单张持续行动现在贴左侧基地边缘摆放，不再以基地中线为锚点。
- 基地上方只保留一张行动卡，没有额外空 rail，也没有被推到右侧基地上方。

### 2. 5 张持续行动，无泰坦

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\二人局下-1-张与-5-张持续行动在有无泰坦时的布局截图\02-2p-five-ongoings-no-titan.png`

人工观察：
- 5 张持续行动整排贴左侧基地边缘展开，已经收口到“无泰坦就左对齐”的语义。
- 最左侧第一张仍是 `Flame Trap`，顺序没有被翻转，中间也没有多余空洞。

### 3. 1 张持续行动，有泰坦

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\二人局下-1-张与-5-张持续行动在有无泰坦时的布局截图\03-2p-one-ongoing-with-titan.png`

人工观察：
- 泰坦位于左侧基地正上方中线，单张持续行动落在泰坦左侧，没有把泰坦挤歪。
- 泰坦与持续行动之间仍保持独立的上下层次，视觉上能一眼分出“泰坦在中间、行动在侧边”。

### 4. 5 张持续行动，有泰坦

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\二人局下-1-张与-5-张持续行动在有无泰坦时的布局截图\04-2p-five-ongoings-with-titan.png`

人工观察：
- 泰坦保持在基地正上方中线，左右两侧都有持续行动，不再变成单侧展开。
- 最左侧第一张仍是 `Flame Trap`，左侧顺序没有被 reverse。
- 右侧还有持续行动延展，说明 5 张卡的“围绕泰坦左右分布”语义已经恢复。
