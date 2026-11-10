> 本报告的修复结论已撤销：用户纠正：变小的是整体，左上角只是举例。字号和阶段栏局部补偿的目标锁定错误，局部PASS不能证明原始整体缩放问题已修复。

# DiceThrone 移动 HUD 回归修复与对比

范围：本地网页与安卓 App 共用的 HUD、共享视口单位；验收现场为同源网页。未提交、未部署、未验安卓实际安装包，未对全部游戏作视觉验收。

## 原因与修复

9 月 10 日提交 `0286bf1f8` 将旧视口字号迁移成棋盘参考单位。DiceThrone 外壳设计宽为 2340，内部参考宽为 1920，迁移后普通 HUD 字号额外乘了 1920/2340；阶段栏还丢失旧 clamp，936×432 下阶段项实际仅约 5.73px。完整历史源码回放和失败记录见 `mobile-hud-20261019-regression.md`、`mobile-hud-20261019-history-review.json`。

共享运行时增加可选的可视画布宽度单位，由同一壳层负责换算与离开移动模式时清理。DiceThrone 的资源、对手、操作、牌堆等 HUD 字体接入；棋盘参考坐标、缩放算法和各游戏 manifest 不变。其它游戏没有接入新单位，不能据此宣称它们均修复或均有问题。

阶段栏同时调整字体与条带宽度、留白、边框和高亮比例，不再采用昨天只把文字放大挤在原条带里的方案。宽度约占画布 14%，七阶段及主要阶段序号完整。9 月 9 日历史版本虽然字大，但牌堆在压力态出屏，因此只恢复目标字号和宽度职责，没有整套恢复旧布局。

## 验收与证据

- `mobile-hud-20261019-metrics.json`：三种视口各常态、六标记四状态压力态的六份现场指标，含字体、边界、间距、遮挡、截断检查。
- 手机 936×432：阶段项约 11px，阶段栏约 131×163px；手机 812×375：阶段项约 9.54px，阶段栏约 114×142px。压力态与状态区域分别保留约 6.91px、6.21px 间距。
- PC 1920×1080：阶段栏尺寸与修复前一致；字号仍为 14.4 CSS px。
- 七个阶段名称及序号无截断。状态、资源、牌堆、中央玩家板保持可见；其它 HUD 的实际字号按画布宽度恢复到原视口字号比例。
- 真实浏览器等待关键图片加载和手牌自然翻面完成后拍摄，无损 PNG 整屏取证。使用现有 TestHarness 准备常态/压力态，并非连续完整对局。
- 独立视觉报告：`mobile-hud-20261019-visual-review.json`。最终九图账本包括原始缺陷参考、被用户否决的旧候选、六张新图和原 PC 对照；失败参考仅为对比证据，不改判产品通过。

实际运行：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/LeftSidebar.test.tsx src/games/dicethrone/ui/__tests__/compatLayout.test.tsx src/games/dicethrone/ui/__tests__/compatSource.test.ts src/games/dicethrone/ui/__tests__/PassiveAbilityPanel.test.tsx src/hooks/ui/__tests__/useRuntimeViewport.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-left-sidebar-mobile-regression.e2e.ts "阶段提示沿用 PC 单列比例，并覆盖无 Token 常态与 Token 压力态"
```

Vitest：5 文件 33 项通过（`.tmp/dt-hud-20261019-vitest.log`）。E2E：1 项通过，14.8s（`.tmp/dt-hud-20261019-e2e.log`）。定向 ESLint 无错误，保留 OpponentHeader 已有未使用参数警告；本轮源码 `git diff --check` 通过。

E2E 不再把“小字随棋盘缩小”当正确断言，改为检查历史字号、完整名称、历史宽度比例、其它 HUD 的视口比例及原有容量/不遮挡约束。截图过渡帧不通过视觉交付，等待真实动画完成后重新取证，未关闭或修改产品动画。

商业平台与引擎的一手资料和职责映射见前一天验证记录；那些资料只用于核对适配方向，不用于替代本次现场证据。回归规范未更新，既有规则足以约束本次问题，主要纠正执行与验收边界。
