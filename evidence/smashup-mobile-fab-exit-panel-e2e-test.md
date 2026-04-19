# 大杀四方移动端横屏悬浮球与退出面板 E2E 证据

## 测试命令

```bash
npm run test:e2e:ci -- e2e/smashup-4p-layout-test.e2e.ts
```

## 证据截图

### 1. 横屏主状态图

![横屏主状态图](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/04-mobile-landscape-layout.png)

本图只在以下条件满足后才允许截取：

- 主界面不再显示 `ui.*` / `phases.*` 这类 i18n fallback key
- `Loading match resources...` 已消失
- 结束回合真实按钮本体已可见

结论：

- 这张图现在才可作为“主状态正常”的证据，不再接受半加载状态首图。
- 此前同名截图曾出现 `ui.you_short`、`ui.score_sheet`、`phases.playCards` 和结束回合按钮肉眼异常，那一版是无效证据，原因是截图时机过早。
- 我已重新人工查看当前仓库中的 `04-mobile-landscape-layout.png`，这张现存图片本身没有再带出旧版 `Exit` tooltip，可继续作为有效主状态图。

### 2. 退出悬浮面板

![退出悬浮面板](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/04a-mobile-exit-fab-panel.png)

结论：

- `exit` 悬浮球在移动端横屏下已缩到更紧凑尺寸。
- 点击后弹出的退出面板仍完整落在当前视口内，没有再溢出到屏幕外。
- 这张图只证明“退出面板布局正常”，不能替代主状态图。

### 3. 旧版 tooltip 残影仍不能混入最终证据

当前仓库里仍保留：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`

我已重新人工查看这张图，确认右侧仍残留旧版 `Exit` hover tooltip。
因此这张图只能说明“第一次点击会展开附着行动卡”，不能再作为“当前 FAB 最终视觉状态”的证据。

## 实现与测试收口

- [e2e/smashup-4p-layout-test.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/smashup-4p-layout-test.e2e.ts)
  - 新增首图前的 UI 就绪等待，禁止在 i18n key fallback 阶段截主状态图
  - 保留悬浮球尺寸断言与退出面板视口内断言
- [src/components/system/FabMenu.tsx](/D:/gongzuo/webgame/BoardGame/src/components/system/FabMenu.tsx)
  - 移动端悬浮球缩小
  - 面板最大宽高按当前位置与安全区动态限制
- [src/components/common/overlays/ConfirmModal.tsx](/D:/gongzuo/webgame/BoardGame/src/components/common/overlays/ConfirmModal.tsx)
  - 小屏安全区与纵向按钮堆叠保护

## 本次修正要点

- “第一个截图不对”不是退出逻辑顺序被改，而是首图在主界面文本和布局尚未稳定时就被截了。
- 现在 E2E 会先拦住这种半加载状态，再产出 `04`。
- 当前环境仍然无法在本沙箱里重跑 Playwright，阻塞原因为 `fork -> spawn EPERM`；所以本轮对 `04 / 04a / 05` 的判断是基于现有仓库截图的人工复查，而不是新生成一轮截图。

## 2026-03-15 环境复查

命令：

```bash
npm run check:child-process:e2e
```

结果：

- 失败阶段：`fork`
- 错误：`spawn EPERM`
- 说明：退出悬浮球与退出面板这组截图当前只能继续基于仓库现有产物复核，不能在本沙箱里补一轮新截图。
