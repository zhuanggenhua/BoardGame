# DiceThrone 手机阶段栏回归与适配方向核查

> 2026-10-19 更正：用户否决修后手机外观。本报告的“已修复 / 手机视觉 PASS”结论已撤销，下面测量、截图及命令结果只保留为历史失败候选事实，不能作为验收依据。本轮新增的字号下限、自然宽度、压缩留白和替代比例断言均已撤掉并归档到 `mobile-hud-20261018-withdrawn-candidate.patch`。继续定位见 `mobile-hud-20261019-regression.md`。

## 目标与历史锚点

- 用户原话：HUD 变小，例如左上角；先截图，再修复对比；参考商业平台和游戏引擎，确认面向一百个游戏的适配方向。
- 当前代码基线：`9ab21e243`，本轮不提交、推送或部署。
- 首次改变尺寸的已定位提交：`0286bf1f8`（2026-09-10）。它把移动画布从宽 940 改为 2340×1080，并将阶段项 `clamp(12px,0.9vw,15px)` 改为 1920 参考单位的 0.75 倍后随壳层缩放。
- 历史代码可证明字号下限及换算变化；不把当前截图冒充历史正常截图。
- 修复前同源实拍：本轮真实测试牌桌的 936×432 整屏，阶段项实际测得约 5.73 CSS 像素，已在改源码前保留，不是旧逻辑重放。
- 验收入口：现有 DiceThrone TestHarness 正式测试入口，复用真实 Board 和素材，固定天使对蛮族、主要阶段一。状态夹具用于复现常态与压力态，不声称覆盖线上房间、真实手机或完整对局流程。

## 商业平台与引擎的一手依据

- [BGA 移动端开发文档](https://en.doc.boardgamearena.com/Your_game_mobile_version)：游戏内容和外围界面分别缩放；大固定画布的整页缩放会让文字和控制变小，不能代替窄屏布局适配。
- [Tabletopia 移动发布手册](https://help.tabletopia.com/knowledge-base/tabletopia-mobile-beta-publishers-manual/)：共享平台下仍需按游戏配置移动 setup、桌面组件布局和相机。本轮只参考其职责分工，不引用手册中的客户端版本与限制作为当前产品事实。
- [Unity Canvas Scaler](https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/script-CanvasScaler.html) 与 [多分辨率 UI](https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/HOWTO-UIMultiResolution.html)：参考分辨率缩放与锚点配合，需检查不同宽高比；统一缩放本身不会自动保证文字最终可读。
- [Cocos 多分辨率适配](https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/engine/multi-resolution.html)：Canvas、Widget 对齐、Label 排版共同承担适配职责。
- [Phaser Scale Manager](https://docs.phaser.io/phaser/concepts/scale-manager)：提供 FIT、RESIZE、ENVELOP 等策略；固定构图与可变视窗应选择不同策略。

据此给本项目的判断：保留一套运行时、manifest、布局 preset 和同源 UI 的方向；按固定牌桌、地图和竖屏流式布局复用策略。统一坐标映射不能替代文字、按钮与阅读层的最终尺寸约束。面向一百个游戏，框架集中处理 viewport、安全区、缩放和坐标转换，游戏声明实际构图和锚点；每个游戏仍需代表状态验收。本轮没有实施全平台架构重构，也没有宣称其他游戏已验收。

## 改动范围

- `PhaseIndicator.tsx`、`PhaseIndicator.css`：保留阶段顺序、七项、当前高亮和左上锚点；仅手机横屏恢复阶段文字 12px、标题 13px 下限，以自然文本宽度避免省略；调整阶段项内部留白，保护下方状态槽位。桌面保留原字号与行高。
- 现有移动 E2E：将透明命中区与可见按钮分开测量；以最终文字尺寸和文案完整性替代“字体必须随棋盘缩小”的错误约束，保留数量、空间、视口边界、状态图标尺寸和中央板比例检查；改为无损 PNG 取证。
- 没有改规则、状态、manifest、共享缩放公式、PC 布局或其他游戏。

## 验证与失败事实

命令：

```text
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/LeftSidebar.test.tsx src/games/dicethrone/ui/__tests__/compatLayout.test.tsx src/games/dicethrone/ui/__tests__/compatSource.test.ts src/hooks/ui/__tests__/useRuntimeViewport.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-left-sidebar-mobile-regression.e2e.ts "阶段提示沿用 PC 单列比例，并覆盖无 Token 常态与 Token 压力态"
node node_modules/eslint/bin/eslint.js src/games/dicethrone/ui/PhaseIndicator.tsx e2e/dicethrone/dicethrone-left-sidebar-mobile-regression.e2e.ts
```

- 定向 Vitest：4 文件、31 项通过。既有 OptimizedImage act 警告未影响通过结果。
- 红测：修源码前新增可读性断言实际失败，要求至少 11.8px，收到 5.73146px。
- 首跑还暴露旧按钮测量对象错误：旧测试拿 44px 透明按钮盒当作可见圆形；本轮改测已有 `dicethrone-hand-visibility-visual`，44px 命中区仍单独断言。
- 首个字体候选在压力态没有留下阶段/状态区间距；随后按实际空间收紧内部留白，未删阶段或状态。
- 一次工程断言通过后的私有逐图审查发现长阶段名称省略，候选被退回；最终改为自然文本宽度，并增加 `scrollWidth/clientWidth` 文案完整检查。
- 新增的中央板不相交检查只约束本轮发生横向扩容的手机分支。桌面既有阶段框与玩家板外矩形约有 5px 交叠，修前/后几何完全相同；本轮没有把这个原有框界关系当作新增移动缺陷改写桌面。
- 最终 E2E：1 项通过（34.5 秒，实际用例 18.4 秒），覆盖 1920×1080、936×432、812×375，各无状态常态与六标记四状态压力态。
- 定向 ESLint 与 `git diff --check` 通过。

## 最终几何

完整原始测量见 `mobile-hud-20261018-metrics.json`。

| 目标 | 阶段项最终字大小 | 阶段名称截断 | 阶段/状态压力态间距 |
| --- | --- | --- | --- |
| 修前手机 936×432 | 约 5.73px | 本次目标首先表现为过小 | 无状态基线 |
| 修后手机 936×432 | 约 11.91px | 无 | 约 26.32px |
| 修后手机 812×375 | 约 12.03px | 无 | 约 7.66px |
| 桌面 1920×1080 | 修前/后 CSS 字号均为 14.4px | 无 | 约 91.09px |

桌面阶段栏修前/后矩形同为 x=47.984、y=41.578、width=268.812、height=329.719。两个手机视口均保留七阶段、一个当前高亮、压力态六标记与四状态，阶段栏未覆盖中央板或底部资源/牌堆。

## 媒体边界

修复前整屏是用户明确要求的缺陷对比参考，产品状态保持 REVISE；它的证据真实性不能改称产品 UI 通过。修后媒体的视觉结论由独立逐图报告负责。图组是回归前后及多视口代表态对照，不冒充一条连续玩家对局流程。截图没有覆盖其他游戏、其他语言、竖屏、真机 App 或线上版本；本轮结果仅在本地工作区生效。
