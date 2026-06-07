# 大杀四方移动端计分板隐藏与四人布局验收

日期：2026-05-15

## 范围

- 给右上角记分板增加隐藏/恢复入口，行为与结束回合区域的隐藏入口一致。
- 优化手机端四人局主战区、基地、随从和手牌的几何单位，避免外层 `board-shell` 缩放后内部继续使用裸 `vw` 造成二次缩小。
- 四人局活动基地必须是 5 个（玩家数 + 1）。本轮曾用“三基地”测试夹具作为手机截图基线，该口径失效；已改为五基地夹具。
- VP 获得动画要能直接看出归属者，不能只在屏幕中央飘一个抽象 `+VP`。

## 验证命令

```powershell
npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts "移动端横屏应保持四人局布局可用，并支持手牌长按看牌"
npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts "四人局五基地中三处同时到达断点时，正确弹出多基地选择交互"
npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts "四人局五基地中三处同时计分会按选择顺序依次结算并更新四名玩家VP"
npx eslint src/games/smashup/Board.tsx src/games/smashup/ui/BaseZone.tsx src/games/smashup/ui/HandArea.tsx src/games/smashup/ui/layoutConfig.ts e2e/smashup/smashup-4p-layout-test.e2e.ts --max-warnings 999
npm run typecheck
npm test -- src/games/smashup/__tests__/smashup.smoke.test.ts src/games/smashup/__tests__/factionSelection.test.ts
node -e "JSON.parse(require('fs').readFileSync('public/locales/zh-CN/game-smashup.json','utf8')); JSON.parse(require('fs').readFileSync('public/locales/en/game-smashup.json','utf8')); console.log('locales ok')"
```

结果：

- E2E：移动端五基地布局用例通过；五基地三处同时计分的交互弹窗用例通过；五基地三处按顺序结算并更新 VP 用例通过。
- ESLint：0 errors，71 warnings；warnings 为现有 `any`、hook dependency、React purity 等警告，本轮没有新增 error。
- TypeScript：通过。
- 领域/选派系单测：2 个文件、176 个用例通过；其中已有断言覆盖 `bases.length === PLAYER_IDS.length + 1`。
- i18n JSON：通过。

## 截图验收

### 移动端四人局主态

路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\04-mobile-landscape-layout.png`

我实际看到：

- 五个活动基地完整出现在手机横屏主态中：左起第 1-3 个为到达断点/有随从的基地，第 4-5 个为空基地但仍有基地牌本体、断点徽章和玩家列槽位。
- 五个基地和四名玩家的随从列居中铺开，没有只缩在左上角一块；HUD 与主内容仍在同一视觉坐标系。
- 顶部左侧回合信息、右上记分板、右侧结束回合区域、底部手牌在同一视觉坐标系内，没有互相遮挡。
- 手牌宽度、基地宽度和附着行动卡可见尺寸明显大于之前二次缩放后的状态。

是否达标：达标。该图证明移动端四人局主态已经是规则正确的 5 基地，同时摆脱 `vw + shell scale` 的二次缩小问题；这不是 PC 窄布局路线。

### 记分板隐藏态

路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\04aa-mobile-scoreboard-hidden.png`

我实际看到：

- 右上角记分板主体已经消失，只保留一个圆形恢复按钮。
- 主战区、结束回合按钮、底部手牌没有因为记分板隐藏发生跳位或遮挡。

是否达标：达标。隐藏后保留恢复入口，符合“类似回合结束那种”的交互目标。

### 记分板恢复态

路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\04ab-mobile-scoreboard-restored.png`

我实际看到：

- 点击恢复后右上角记分板重新出现，四名玩家分数球和派系图标仍在原位置。
- 恢复过程中没有把战场、手牌或右侧操作区挤出屏幕。

是否达标：达标。恢复链路可用，隐藏按钮没有破坏原本的记分/对手视角入口位置。

### VP 获得动画

路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\四人局五基地中三处同时计分会按选择顺序依次结算并更新四名玩家VP\02a-vp-gain-feedback.png`

我实际看到：

- 屏幕中部出现黄色 VP 横幅，文字直接写着 `P1 获得 +5 VP`，不是单纯的 `+5 VP`，也没有重复显示第二个 `+5 VP`。
- 横幅左侧有 P1 的颜色圆标，能把这次加分和具体玩家绑定起来。
- 下方还能隐约看到另一条较淡的 VP 横幅，说明多玩家分 VP 时会按序播放，而不是瞬间糊成一团。

是否达标：达标。这个动画持续时间比原来的分数球弹一下更长，且能直接看出谁获得了 VP。

### PC 恢复态回归

路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\13a-desktop-scoreboard-restored.png`

我实际看到：

- PC 宽屏下记分板可隐藏后恢复，恢复后仍在右上角 HUD 区域。
- 结束回合隐藏/恢复截图仍能生成，说明新增记分板隐藏没有破坏已有右侧控制区。

是否达标：达标。新增入口没有造成桌面端明显回归。

## 结论

本轮可以收口：移动端四人局主态是 5 个活动基地，未再缩在左上角；记分板支持右上隐藏/恢复；桌面端记分板恢复和结束回合控制区未出现截图可见回归。VP 获得动画已经改成可读的获胜者横幅，截图里能直接看出 `P1 获得 +5 VP`。
