# 大杀四方首个随从布局动画 E2E 证据

## 本轮目标
- 验证大杀四方基地列在“首个随从进入基地”时，不再是空占位直接硬切到最终高度。
- 重点检查首列分数条是否存在多个中间纵向位置，而不是单帧跳变。

## 执行命令
```powershell
$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'
npm run test:e2e:ci:file -- e2e/smashup-local-gameplay.e2e.ts "本地模式：首个随从进入基地时分数条应平滑下移而不是单帧跳变"
```

## 运行结果
- 运行日期：2026-04-04
- 结果：`1 passed`
- 采样摘要：
  - 采样帧数：`41`
  - 分数条纵向离散位置：`350.2, 350.4, 364.6, 365.1, 367.5, 371, 374.2, 377.1, 379.9, 382.1, 384, 385.4, 386.4, 386.7`
  - 总位移：`36.5px`
- 结论：分数条在首个随从入场过程中出现了多个中间位置，说明现在是连续布局过渡，不是单次硬跳。

## 截图与人工观察

### 1. 首个随从进入前
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：首个随从进入基地时分数条应平滑下移而不是单帧跳变\smashup-first-minion-layout-before.png`
- 人工观察：
  - 当前取图范围是基地玩家列本身，不再是整块基地卡面。
  - 虚线空槽仍然可见，说明这一列还没有真实随从进场。
  - 红色力量徽记仍位于空槽下方，属于“首个随从尚未落位”的起点状态。

### 2. 首个随从进入后
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：首个随从进入基地时分数条应平滑下移而不是单帧跳变\smashup-first-minion-layout-after.png`
- 人工观察：
  - 虚线空槽已经被首张随从牌替换，说明这不是仅靠样式切换的假动画。
  - 红色力量徽记仍然位于该列底部，证明徽记跟随真实牌列一起结算。
  - 连续位移的证据主要来自上方采样数据：这两张图负责证明“空槽 → 实牌”的真实状态切换。

## 关联改动
- [`src/games/smashup/ui/BaseZone.tsx`](D:\gongzuo\webgame\BoardGame\src\games\smashup\ui\BaseZone.tsx)
  - 玩家列、随从堆容器、分数条增加 `framer-motion` 的 `layout` 过渡。
  - 补充 `su-base-player-column-*`、`su-base-empty-slot-*`、`su-base-score-*` 等观测用 `data-testid`。
- [`e2e/smashup-local-gameplay.e2e.ts`](D:\gongzuo\webgame\BoardGame\e2e\smashup-local-gameplay.e2e.ts)
  - 新增本地模式专项用例，直接在 TestHarness 中触发首个随从打出，并用 `requestAnimationFrame` 采样分数条位移。

## 风险与说明
- 这次证据证明的是“空列切到首个随从时的布局跳变”已经被平滑化。
- 还没有单独证明卡面首次解码、atlas 首次命中这条链完全没有首帧抖动；如果用户仍能感到首帧迟滞，下一步应继续追 `CardPreview` / atlas 首次渲染链。
