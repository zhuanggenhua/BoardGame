# 移动端方向提示条 E2E 证据

## 范围

- 统一方向提示组件 `src/components/common/MobileOrientationGuard.tsx`
- 验证目标：
  - 错方向时不再出现整屏转向遮挡
  - 只保留顶部提示条
  - 提示条可点叉关闭
  - 竖屏/横屏切换后的已有流程仍可继续

## 执行命令

```bash
node scripts/infra/vitest-cli-safe.mjs run src/components/common/__tests__/MobileOrientationGuard.test.tsx --configLoader native
npm run test:e2e:ci:file -- e2e/dicethrone/mobile-orientation-banner.e2e.ts
npm run test:e2e:ci:file -- e2e/tictactoe/tictactoe-mobile-layout.e2e.ts
```

## 关键截图

- 竖屏手机进入横屏主界面游戏，顶部只剩提示条：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\mobile-orientation-banner.e2e\手机竖屏下进入横屏主界面游戏时只显示可关闭提示条，不再整屏遮挡\手机竖屏下进入横屏主界面游戏时只显示可关闭提示条，不再整屏遮挡-dicethrone-phone-portrait-orientation-banner.png`
- 同一页面点击叉号后，提示条消失，页面内容继续保留：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\mobile-orientation-banner.e2e\手机竖屏下进入横屏主界面游戏时只显示可关闭提示条，不再整屏遮挡\手机竖屏下进入横屏主界面游戏时只显示可关闭提示条，不再整屏遮挡-dicethrone-phone-portrait-orientation-banner-dismissed.png`
- 竖屏游戏切到横屏后只显示提示条，不再整屏拦截：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\tictactoe\tictactoe-mobile-layout.e2e\手机竖屏下棋盘应保持正方形，横屏时只显示可关闭方向提示条\手机竖屏下棋盘应保持正方形，横屏时只显示可关闭方向提示条-tictactoe-mobile-landscape-orientation-banner.png`
- 错方向出现提示条后切回正确方向，已有对局继续：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\tictactoe\tictactoe-mobile-layout.e2e\手机端切到错方向后显示提示条，切回竖屏后仍可继续当前对局\手机端切到错方向后显示提示条，切回竖屏后仍可继续当前对局-tictactoe-mobile-portrait-after-second-move.png`

## 看图结论

- `dicethrone-phone-portrait-orientation-banner.png`
  - 顶部只是一条窄提示条，右侧有明确叉号。
  - 角色选择内容仍在屏内可见，没有被整屏黑罩替换。
  - 这张图证明“错方向只提示，不拦截页面主体”已经成立。
- `dicethrone-phone-portrait-orientation-banner-dismissed.png`
  - 叉号点击后顶部提示条完全消失。
  - 页面主体位置保持不变，没有被再次替换成遮挡层。
  - 这张图证明“提示可关闭，关闭后继续操作页面”已经成立。
- `tictactoe-mobile-landscape-orientation-banner.png`
  - 横屏错误方向下仍能看到顶部提示条和下方棋盘区域。
  - 旧的整屏 gate 文案和整屏挡板不再出现。
- `tictactoe-mobile-portrait-after-second-move.png`
  - 切回正确方向后，先前落子的棋盘状态仍在。
  - 对局还能继续推进，不是靠刷新重开恢复。

## 备注

- `verify:open-image` 已实际打开 DiceThrone 两张竖屏手机关键截图。
