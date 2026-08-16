# PC Web 看板娘 E2E 验收

## 审计范围

- PC Web 首页右下角看板娘入口。
- 看板娘气泡文案只能由用户再次点击切换，不能自动轮播。
- 看板娘气泡打开或切换文案后，5 秒自动隐藏，避免长期挡住 UI。
- 看板娘长文案必须自适应换行和缩放，不能横向撑爆气泡或长期压住首页 UI。
- 首页存在“实施中”斜向横幅时，看板娘气泡必须显示在横幅上方，不能被遮挡。
- 游戏路由不显示看板娘，避免遮挡游戏主界面。
- Android/App 壳层不渲染该入口，代码侧通过 `isAndroidShellBuildMode()` 与 `isNativeAndroidRuntime()` 双重门禁控制。

## 实现口径

- 看板娘资源：`public/assets/i18n/zh-CN/common/images/mascot/easyboardgame-kanban-girl.png`，运行时通过 `OptimizedImage` 走压缩 WebP 链路。
- PC Web 组件：`src/components/system/PcWebMascot.tsx`。
- 交互：首次点击打开气泡；气泡已打开后，每次再次点击才切换到下一条文案并重新开始 5 秒隐藏计时；等待不会自动切换文案。
- 文本布局：气泡正文允许换行，字号使用 `clamp()` 在桌面宽度内自适应；气泡宽度受控，QQ群号按钮保持不换行。
- 层级：`PC_WEB_MASCOT_Z_INDEX = UI_Z_INDEX.tooltip - 1`，高于普通页面横幅和卡片斜向“实施中”标记，低于弹窗 tooltip。

## 验证命令

```bash
npm run typecheck
npm run assets:validate
npm run test:e2e:ci:file -- e2e/pc-web-mascot.e2e.ts "PC Web 首页右下角显示看板娘且游戏页不显示"
```

`npm run assets:check` 曾尝试全量远端检查，但 3 分钟未返回并超时；随后改为只上传并回查本次新增的两个 WebP 对象。

## 2026-08-16 回归验收

验证命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/components/system/__tests__/PcWebMascot.test.tsx --configLoader native
npx eslint src/components/system/PcWebMascot.tsx src/components/system/__tests__/PcWebMascot.test.tsx e2e/pc-web-mascot.e2e.ts --max-warnings 0
npm run test:e2e:ci:file -- e2e/pc-web-mascot.e2e.ts
```

结果：

- 单测 `4 passed`；锁定 4.999 秒仍停在第一条气泡，第 5 秒自动隐藏；再次打开从第一条开始；再次点击切换文案时会重新开始 5 秒隐藏计时。
- ESLint 通过。
- Playwright E2E `1 passed`；真实首页里先确认存在“实施中”横幅，再用 `document.elementFromPoint` 抽样气泡中心和四个边内点，全部命中气泡自身，证明横幅没有盖住气泡；同时读取真实浏览器渲染结果，确认气泡正文 `white-space: normal`、`overflow-wrap: anywhere`、宽度不超过 300px、正文无横向溢出；第三次点击后等待 5.2 秒，气泡节点退场。

截图证据：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\首页看板娘-第一次点击显示QQ群气泡且未被实施中横幅遮挡.jpg`
  - 我实际看到：首页游戏卡片上仍有“实施中”斜向横幅；看板娘气泡显示 QQ 群内容并位于右下角人物左侧，气泡没有被横幅压住。
  - 是否达标：达到“实施中横幅不挡住气泡”的验收标准。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\首页看板娘-第二次点击切到卡死提示.jpg`
  - 我实际看到：第二次点击后气泡文案变成“遇到卡死时，悬浮球可以强制结束阶段。”，QQ群按钮退场。
  - 是否达标：达到“每次点击对话气泡内容不一样”的第二条文案验收标准。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\首页看板娘-第三次点击切到视角提示且文本自适应换行.jpg`
  - 我实际看到：第三次点击后气泡文案变成“点击对手分数/头像可以切换视角，可以看弃牌堆。”；长文案收进两行，气泡宽度没有撑到卡片区，也没有横向溢出。
  - 是否达标：达到“继续点击继续切换文案、不是自动轮播”和“长文本自适应，不撑爆气泡”的验收标准。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\首页看板娘-气泡5秒后自动隐藏.jpg`
  - 我实际看到：等待 5 秒后，只剩右下角看板娘本体，左侧气泡已经退场，首页游戏卡片与“实施中”横幅不再被气泡占用。
  - 是否达标：达到“气泡自动隐藏，不一直挡住 UI”的验收标准。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\游戏页看板娘隐藏.jpg`
  - 我实际看到：进入 `/play/tictactoe` 游戏路由后，画面中没有看板娘浮层。
  - 是否达标：保留既有“不遮挡游戏主界面”合同。

最终给用户看的标记图组：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\_labeled-for-pureref\00-sequence-index.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\_labeled-for-pureref\01-labeled-首页看板娘-第一次点击显示QQ群气泡且未被实施中横幅遮挡.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\_labeled-for-pureref\02-labeled-首页看板娘-第二次点击切到卡死提示.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\_labeled-for-pureref\03-labeled-首页看板娘-第三次点击切到视角提示且文本自适应换行.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\pc-web-mascot.e2e\PC-Web-首页右下角显示看板娘且游戏页不显示\_labeled-for-pureref\04-labeled-首页看板娘-气泡5秒后自动隐藏.png`

## 历史截图证据

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
