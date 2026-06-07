# PC Web 看板娘 E2E 验收

## 审计范围

- PC Web 首页右下角看板娘入口。
- 游戏路由不显示看板娘，避免遮挡游戏主界面。
- Android/App 壳层不渲染该入口，代码侧通过 `isAndroidShellBuildMode()` 与 `isNativeAndroidRuntime()` 双重门禁控制。

## 实现口径

- 看板娘资源：`public/assets/i18n/zh-CN/common/images/mascot/easyboardgame-kanban-girl.png`，运行时通过 `OptimizedImage` 走压缩 WebP 链路。
- PC Web 组件：`src/components/system/PcWebMascot.tsx`。
- 交互：点击看板娘只触发 `pc-web-mascot-scale` 缩放动画，不改变路由和业务状态。
- 层级：`z-index: 3`，低于系统齿轮、弹窗、HUD 等高优先级 UI。

## 验证命令

```bash
npm run typecheck
npm run assets:validate
npm run test:e2e:ci:file -- e2e/pc-web-mascot.e2e.ts "PC Web 首页右下角显示看板娘且游戏页不显示"
```

`npm run assets:check` 曾尝试全量远端检查，但 3 分钟未返回并超时；随后改为只上传并回查本次新增的两个 WebP 对象。

## 截图证据

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\PC-Web-首页右下角显示看板娘且游戏页不显示-desktop-visible.png`
  - 我实际看到：看板娘以透明底贴在 PC 首页右下角，人物从头到脚完整可见，未出现浅色整块背景。
  - 是否达标：达到“PC Web 右下角显示”的验收标准；右下角系统齿轮保持在上层，看板娘未抢占更高层 UI。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\PC-Web-首页右下角显示看板娘且游戏页不显示-desktop-click-scale.png`
  - 我实际看到：点击后看板娘仍停留在右下角，测试断言捕获到 `pc-web-mascot-scale` 缩放动画。
  - 是否达标：达到“点击就一个缩放效果”的验收标准，没有出现弹窗、导航或其它额外交互。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\PC-Web-首页右下角显示看板娘且游戏页不显示-game-route-hidden.png`
  - 我实际看到：进入 `/play/tictactoe` 游戏路由后，画面中没有看板娘浮层。
  - 是否达标：达到“不挡住游戏”的验收标准，游戏加载界面没有被右下角装饰层覆盖。

## 未覆盖风险

- 当前 E2E 覆盖 PC Web 首页与一个游戏路由入口；未覆盖所有游戏页面。
- 已完成本次新增 WebP 对象的 R2 目标上传与 `HeadObject` 回查：`official/i18n/zh-CN/common/images/mascot/compressed/easyboardgame-kanban-girl.webp`、`official/common/images/mascot/compressed/easyboardgame-kanban-girl.webp`，回查大小均为 `190484` bytes。
