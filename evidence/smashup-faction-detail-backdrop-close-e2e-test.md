# 大杀四方派系详情空白关闭 E2E 证据

## 范围

- 游戏：`smashup`
- 场景：移动端横屏派系选择页中的派系详情弹层
- 目标：
  - 移动端派系详情应与 PC 一致，支持点击空白/backdrop 关闭
  - 关闭后不应把点击穿透到底层选派区，避免误触或状态串扰

## 本轮命令

```bash
npm run test:e2e:ci:file -- e2e/smashup-4p-layout-test.e2e.ts "横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌"
```

结果：通过

## 关键截图与肉眼观察

### 1. 海盗派系详情顶部

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌\11-mobile-landscape-faction-detail-top.png`

我实际看到：
- 海盗派系详情弹层居中显示，周围底层选派卡已被明显暗化和虚化，说明现在存在真实 backdrop，而不是只把面板浮在原页面上。
- 关闭按钮在右上角可见，详情左栏和右侧预览卡区都完整显示，没有被移动端裁掉。
- 该截图达到“详情已打开且 backdrop 生效”的验收标准。

### 2. 海盗派系详情底部滚动后状态

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌\12-mobile-landscape-faction-detail-bottom.png`

我实际看到：
- 右侧卡牌预览区滚动后，底部卡牌仍在弹层内完整可见，没有掉出弹层边界。
- 底层选派区仍保持暗化虚化，说明滚动详情时没有丢 backdrop。
- 该截图达到“移动端详情仍可完整浏览”的验收标准。

### 3. 点击空白/backdrop 后的主状态

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌\12a-mobile-landscape-faction-detail-blank-close.png`

我实际看到：
- 海盗详情弹层已经完全消失，画面回到派系选择主界面。
- 主界面中的派系卡重新清晰显示，不再有暗化虚化遮罩残留。
- 没有出现“点空白后误开另一张派系详情”或“关闭后界面还停留半透明遮罩”的现象。
- 该截图达到“移动端点击空白可以关闭，且不会穿透成异常状态”的验收标准。

### 4. 关闭后再次打开外星人派系详情

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌\13-mobile-landscape-faction-detail-no-titan.png`

我实际看到：
- 在海盗详情关闭后，重新打开了外星人派系详情，说明关闭后的交互链路恢复正常。
- 外星人详情左栏里的“泰坦暂未接入 / POD”占位信息可见，说明关闭后再次进入其他派系详情没有状态污染。
- 该截图达到“关闭后可继续正常打开别的派系详情”的验收标准。

## 结论

- 本轮已证明：移动端派系详情现在支持点击空白/backdrop 关闭。
- 本轮已证明：关闭后不会把点击穿透成底层误操作，且可继续正常打开其他派系详情。
- 本轮验收标准：已达到。

## 相关实现

- `src/games/smashup/ui/FactionSelection.tsx`
- `e2e/smashup-4p-layout-test.e2e.ts`

## 残余风险

- 本轮直接验证的是移动端横屏主链路；若后续又改动派系选择页的 overlay 层级、z-index 或缩放壳结构，需要优先回归这一条用例。
