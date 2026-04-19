# SmashUp 派系版本切换 E2E 证据

## 测试目标

验证派系选择页把普通版 / POD 版合并为同一个派系入口后：

- 详情面板顶部出现版本切换按钮
- 点击版本切换按钮后，右侧牌库预览同步切换到对应版本
- 当前激活版本的状态标签与按钮高亮同步更新

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts "PC 派系详情中可切换原版与 POD 版本预览"
```

## 截图

- 基础版截图：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\PC-派系详情中可切换原版与-POD-版本预览\16-desktop-faction-variant-base.png`
- POD 版截图：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\PC-派系详情中可切换原版与-POD-版本预览\17-desktop-faction-variant-pod.png`

## 人工观察结论

### 16-desktop-faction-variant-base.png

- 左侧“卡牌版本”区域显示两个按钮，`原版` 为深色高亮，`POD` 为浅色未激活态。
- 版本标签显示为 `原版`，说明详情面板当前绑定的是基础版数据。
- 右侧牌库预览中第三张随从显示为 `骚气女仆`，底部多张行动卡仍是中文版牌面，说明当前预览确实是基础版牌库。

### 17-desktop-faction-variant-pod.png

- 左侧按钮高亮切换为 `POD`，原版按钮退回浅色未激活态，版本标签也同步变成 `POD`。
- 右侧牌库预览第三张随从从基础版的 `骚气女仆` 切成了 `Cut Lass`，同一位置牌面明显发生变化。
- 右侧多张行动卡从中文版说明切成英文版说明，说明变更不是只改了左侧标签，右侧整组牌库预览已经切到 POD 版本。

## 结果

- E2E 通过
- 截图人工复核通过
