# 大杀四方选择派系页移动端对照验收证据

## 范围

- 页面：`smashup` 选择派系页
- 目标：
  - 移动端继续复用 `board-shell` 的整页等比缩放，不重写一套手机稿
  - 手机横屏主态保持和 PC 同构的五列三行构图
  - 中下当前玩家卡、右侧非当前玩家卡保持同一套竖向玩家卡语义，不再出现“一边正常一边贴片”
  - 间距、占比、PC 居中都要做对照核验，不只看“有没有出屏”

## 本轮实现

- `src/games/smashup/Board.tsx`
  - 将 `factionSelect` 阶段的 shell 设计宽从 `1580` 收回到 `1500`，避免整页被缩得过头。
- `src/games/smashup/ui/FactionSelection.tsx`
  - 手机横屏下保留同一套桌面式五列卡阵，但把派系卡最大宽度调到 `160px`，避免 shell 放大后第三行重新挤爆。
  - 底部玩家区改为同一套竖向玩家卡 token：
    - 当前玩家：`128px`
    - 非当前玩家：`124px`
    - 两边都保留头像 + 派系槽位 + 玩家标识的同构结构
  - 玩家区 gap 调整为 `gap-5`，避免底部两张卡再次挤成一团。
- `e2e/smashup-faction-selection-spacing.e2e.ts`
  - 继续保留 PC/移动端双端对照。
  - 收紧验收阈值：
    - `playerCardToFactionCardRatio >= 0.44`
    - `otherPlayerCardAspectRatio >= 1.1`
    - `playerCardWidthDeltaRatio <= 0.1`
    - `playerRailGapRatio >= 0.055`
    - `mobile playerCardToFactionCardRatio >= desktop * 0.62`

## 执行命令

```powershell
$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'
npm run test:e2e:ci:file -- e2e/smashup-faction-selection-spacing.e2e.ts
```

## 量化结果

> 数据来自本轮同一条 E2E 的实际采样。

### 手机横屏 `800x450`

- `contentCenterOffsetRatio = 0.0000055`
- `playerCardToFactionCardRatio = 0.4508`
- `playerRailHeightRatio = 0.1772`
- `playerCardAspectRatio = 1.1630`
- `otherPlayerCardAspectRatio = 1.1135`
- `playerCardWidthDeltaRatio = 0.0319`
- `playerRailGapRatio = 0.0604`

### PC 对照 `1920x1080`

- `contentCenterOffsetRatio = 0.0000041`
- `playerCardToFactionCardRatio = 0.7177`
- `playerRailHeightRatio = 0.1537`
- `playerCardAspectRatio = 1.0888`
- `otherPlayerCardAspectRatio = 0.9682`
- `playerCardWidthDeltaRatio = 0.0929`
- `playerRailGapRatio = 0.0863`

## 截图证据与人工观察

### 1. 手机横屏主态

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-spacing\mobile-landscape-800x450.png`

人工观察：

- 五列三行还在，同一页没有被拆成“上半部分缩放、下半部分另算”的两套体系。
- 中下当前玩家卡仍明显比 PC 小，但已经不是之前那种只剩一个色块或图标贴片；头像、两个派系槽、玩家标识都还能直接辨认。
- 右侧非当前玩家卡和左侧当前玩家卡现在是同一套竖卡结构，只保留轻微宽度和状态差异，不再是一边像卡、一边像碎片。
- 底部两张卡之间有明确缝隙，不再贴死；同时 gap 也没有散到破坏中轴。
- 第三行派系卡完整可见，底部没有再把下半块裁掉。

### 2. PC 主态对照

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-spacing\desktop-reference-1920x1080.png`

人工观察：

- 主卡阵仍保持居中，未出现之前那种整体偏左的回归。
- 标题、卡阵、中下玩家区的纵向关系仍是桌面原构图，没有被移动端修复带坏。
- PC 底部玩家卡仍比移动端更大，但移动端已经回到“桌面同构缩小版”的感觉，不是另画一套状态条 UI。

## 结论

- 这轮已经从“硬改手机稿”拉回到“PC 权威 + 整页同构缩放”的方向。
- 用户前面反复指出的几类问题，这次有对应证据：
  - 当前玩家卡不再小到接近看不见
  - 右侧玩家卡不再和左侧用两套完全不同的结构
  - 玩家区间距已做量化并卡住下限
  - PC 主卡阵继续保持居中
- 当前版本仍然是“移动端缩小版”，不会和 PC 一样大；但从截图和量化值看，已经脱离此前“不合格”的状态。
