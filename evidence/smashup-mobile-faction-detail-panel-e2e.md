# SmashUp 横屏移动端派系详情面板适配验证

## 结论

已按大杀四方 manifest 的 `preferredOrientation: 'landscape'` 进行横屏移动端验证。

当前已验证大杀四方派系选择页在横屏移动端打开派系详情弹层后：

- 顶部标题、简介和“确认选择”按钮能完整显示
- 右侧/下方卡牌预览区存在独立滚动能力
- 可以滚动到更多卡牌，不再只露出第一排
- 横屏主验证下不会出现“建议旋转至横屏”之类的错误方向提示

## 验证方式

执行命令：

```bash
npm run test:e2e:ci -- e2e/smashup-4p-layout-test.e2e.ts
```

结果：

- `4 passed`

新增验证用例位置：

- `e2e/smashup-4p-layout-test.e2e.ts`
- 用例名：`横屏移动端打开派系详情时应完整显示并可滚动查看全部卡牌`

## 截图证据

顶部状态：

![横屏移动端派系详情顶部](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/横屏移动端打开派系详情时应完整显示并可滚动查看全部卡牌/11-mobile-landscape-faction-detail-top.png)

滚动后状态：

![横屏移动端派系详情滚动后](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/横屏移动端打开派系详情时应完整显示并可滚动查看全部卡牌/12-mobile-landscape-faction-detail-bottom.png)

## 观察

- 顶部截图中，详情头部和确认按钮没有被卡牌区挤出屏幕
- 滚动后截图中，卡牌预览区已发生滚动，说明卡牌区域是独立滚动容器
- 结合用例中的 `scrollHeight > clientHeight` 断言，可以确认该区域在横屏移动端具备真实滚动能力，而不是被父层裁切
- 该验证不再使用竖屏作为主证据，避免和游戏自身方向约束冲突
