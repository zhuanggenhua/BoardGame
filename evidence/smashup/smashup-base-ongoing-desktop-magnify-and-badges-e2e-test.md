# Smash Up 基地 Ongoing 卡 PC 放大镜与徽章层级 E2E 证据

## 范围

- 游戏：`smashup`
- 目标：
  - 基地上的 ongoing 行动卡在黄色高亮（天赋可用）时，PC 端也有放大镜入口
  - 力量增加徽章与力量指示物徽章在可用态摇晃时保持同层，不再脱层
  - 黄色高亮只作用于卡牌本体，不把力量徽章也误当成高亮描边目标
  - 放大镜位置与正常卡面 hover 锚点保持一致

## 执行

- 命令：

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts "PC 基地 ongoing 天赋高亮时显示放大镜且力量徽章同层摇晃"
```

- 结果：通过

## 截图与观察

### 1. Hover 后卡面局部

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-desktop-base-ongoing-talent-hover.png`
- 我实际看到：
  - 黑底放大镜按钮贴在 ongoing 卡右上角，位置和常规卡面 hover 时的卡角锚点一致，不再像上一版那样脱离卡体几何。
  - 左上绿色 `+2` 与左侧琥珀色 `+2` 仍贴着卡体一起移动，按钮没有把其中任何一个挤走或改到别的层。
- 是否达到验收标准：达到。PC 端放大镜入口直接可见，且锚点回到正常位置。

### 2. 高亮态卡面局部

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-desktop-base-ongoing-talent-highlight.png`
- 我实际看到：
  - 黄色描边只包住 ongoing 卡牌本体，两个 `+2` 徽章没有被黄色 ring 套进去。
  - 两个徽章仍固定在卡体左侧并保持相对堆叠，没有出现一个跟卡晃、另一个脱层的情况。
- 是否达到验收标准：达到。高亮语义已经收敛到卡牌视觉层，徽章层级保持统一。

### 3. 点击放大镜后的整页截图

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\PC-基地-ongoing-天赋高亮时显示放大镜且力量徽章同层摇晃\13a-desktop-base-ongoing-talent-magnify-open.png`
- 我实际看到：
  - 中央已打开 `Sacred Circle / 宗教圆环` 的放大层。
  - 左上原位仍能看到那张小的基地 ongoing 卡，说明触发源就是这张高亮卡。
  - 放大层成功打开，证明 PC 放大镜不仅显示，而且可点击生效。
- 是否达到验收标准：达到。放大镜入口可用，放大链路完整收口。

## 额外验证

- 用例内还校验了两个徽章中心点相对位移在连续采样中保持稳定，作为“同层一起摇晃”的自动化证据。

## 风险

- 本轮只验证了 PC 端基地 ongoing 卡的高亮放大镜与两枚徽章层级。
- 没有额外扩跑移动端全文件回归；移动端既有手势链路未改语义，只复用了独立放大镜按钮模式。
