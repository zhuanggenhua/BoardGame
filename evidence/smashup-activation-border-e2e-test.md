# 大杀四方可用边框回归核对

## 最终结论

- 这轮最终没有保留任何自创边框层。
- `src/games/smashup/ui/BaseZone.tsx` 已回到 git 里的旧高亮类实现。
- 真正根因不在 `BaseZone.tsx` 类名，而在全局 Tailwind ring 默认变量缺失。

## 根因

旧高亮类本身一直在：

- 基地：`ring-4 ring-amber-400`
- 随从：`ring-2 ring-amber-400`
- 泰坦：`ring-2 ring-amber-400`

但运行态里 `--tw-ring-offset-width` 没有默认值，导致 `ring-4` / `ring-2` 规则里的：

- `calc(... + var(--tw-ring-offset-width))`

计算失效，`--tw-ring-shadow` 变成空值，所以 DOM 虽然带着旧类名，实际外圈黄色边框没有画出来。

## 最小修复

- 文件：`src/index.css`
- 修复：补回 Tailwind ring 默认变量
  - `--tw-ring-offset-width: 0px;`
  - `--tw-ring-offset-color: #fff;`

本轮没有保留任何新的 `VisibleHighlightBorder` 或额外实体外圈层。

## 对照基线

- 旧实现基线：`9c9dd78d`
- 触控分支改动：`67e1f100`

## 本轮代码落点

- `src/index.css`
- `e2e/smashup-zombie-lord.e2e.ts`
- `e2e/smashup-4p-layout-test.e2e.ts`
- `e2e/smashup-alien-terraform.e2e.ts`

## 端到端核对

### 1. 基地

- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup-zombie-lord.e2e.ts "僵尸领主：弃牌堆选随从后直接点击基地部署"`
- 断言：
  - DOM class 包含 `ring-4 ring-amber-400`
  - 计算样式 `boxShadow` 包含黄色 ring
- 结果：通过
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-zombie-lord\02a-selectable-base-card.png`

### 2. 随从

- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup-4p-layout-test.e2e.ts "有\+1力量指示物的怪物发动天赋"`
- 断言：
  - DOM class 包含 `ring-2 ring-amber-400`
  - 计算样式 `borderColor` 包含黄色值
- 结果：通过
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端有+1力量指示物的怪物发动天赋后会移除指示物并提示额外随从机会\12a-monster-with-counter-card-before-activation.png`

### 3. 泰坦

- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup-alien-terraform.e2e.ts "克苏鲁泰坦天赋可在分支选择后抽 1 张疯狂卡"`
- 断言：
  - DOM class 包含 `ring-2 ring-amber-400`
  - 计算样式 `borderColor` 包含黄色值
- 结果：通过
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-alien-terraform\cthulhu-titan-talent-ready-card.png`

## 当前事实

- 现在黄色边框已经重新实际画出来，不再是“类名在但视觉没出”。
- 修复点是全局 ring 默认变量，不是再发明一套新边框实现。
