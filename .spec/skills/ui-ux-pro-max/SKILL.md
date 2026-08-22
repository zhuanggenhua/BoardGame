---
name: ui-ux-pro-max
description: 'UI/UX 专家入口。用于布局、组件、设计系统、排版、颜色、可访问性、响应式、交互、动画和图表。'
---

# UI/UX Pro Max

本 skill 是项目内 UI/UX 检索入口：用本地数据表和 `scripts/search.py` 生成设计系统、补充栈指引和做交付前检查。它不是 BoardGame 桌游 UI 的唯一主源；游戏运行时 UI 仍先看 [`ui-ux`](../../knowledge/standards/ui-ux.md)、[`ui-change-gates`](../../knowledge/standards/ui-change-gates.md) 和对应游戏 / workflow skill。

## 触发

用于：

- 新页面、新组件、仪表盘、落地页或移动端界面设计。
- 选择产品风格、颜色、字体、图标、图表和动效。
- UI/UX review、截图审计前的通用专业检查。
- 需要按具体技术栈补实现约束。

不用于替代规则驱动桌游 UI 前置门禁；生图设计稿走 [`boardgame-ui-imagegen`](../boardgame-ui-imagegen/SKILL.md)。

## 优先级

1. **可访问性**：对比度、焦点、键盘、表单 label、图像 alt、icon-only aria。
2. **交互**：触控命中区、hover/tap 语义、加载态、错误反馈、cursor、状态控件命名。
3. **布局与响应式**：视口、最小字号、横向溢出、z-index、固定元素避让、内容不被遮挡。
4. **性能**：图片优化、懒加载、减少布局跳动、`prefers-reduced-motion`。
5. **排版与颜色**：行高、行宽、字体气质、明暗模式对比。
6. **动效**：150-300ms 微交互，优先 transform / opacity。
7. **风格选择**：产品类型和行业匹配；不用 emoji 当图标。
8. **图表**：图表类型匹配数据，并提供可读表格替代。

## 使用方式

先确认本地 Python 可执行；不可用时报告阻塞，不在项目规范里指导安装系统软件。

生成设计系统：

```bash
python .spec/skills/ui-ux-pro-max/scripts/search.py "<product type> <industry> <style keywords>" --design-system -p "<Project Name>"
```

持久化设计系统：

```bash
python .spec/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "<Project Name>"
```

补充专项检索：

```bash
python .spec/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> -n <max_results>
```

补充技术栈约束：

```bash
python .spec/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack <stack>
```

默认栈是 `html-tailwind`。常用栈包括 `react`、`nextjs`、`vue`、`svelte`、`shadcn`、`react-native`、`flutter`、`swiftui` 和 `jetpack-compose`。

## 检索域

| Domain | 用途 |
| --- | --- |
| `product` | 产品类型建议 |
| `style` | 视觉风格、效果和情绪 |
| `typography` | 字体搭配 |
| `color` | 产品类型配色 |
| `landing` | 落地页结构和 CTA |
| `chart` | 图表类型 |
| `ux` | UX 规则和反模式 |
| `react` / `web` | 前端实现和 Web 界面规则 |
| `prompt` | 生成提示词关键词 |

## 设计系统落盘

需要跨会话继承设计语言时，使用 `--persist`：

- `design-system/MASTER.md` 承载全局设计真相。
- `design-system/pages/<page>.md` 只写页面级覆盖。
- 页面文件存在时优先页面覆盖；不存在时只使用 MASTER。

不要把同一套设计规则复制到多个 README、任务卡或 evidence；这些文件只能引用设计系统。

## 常见专业规则

- 图标用一致 SVG 图标库，优先 Lucide / Heroicons / Simple Icons；不要用 emoji 当 UI 图标。
- icon + text 默认用 `inline-flex items-center gap-* leading-none`；图标贴文字时优先 `h-[1em] w-[1em]`，先查 line-height 和 SVG viewBox，再用微小视觉偏移。
- 点击目标要有 `cursor-pointer`、hover / focus / disabled / loading 状态；状态按钮和 segmented controls 必须写清影响对象。
- 明暗模式分别检查文字、边框和透明层；浅色模式不能沿用低透明白玻璃。
- 固定导航、浮层和边栏必须给内容留空间；移动端不得横向滚动。
- 用户界面不要展示验收条款、实现证明、测试标签或内部 QA 文案。
- 图表先按数据关系选型：趋势用线，比较用柱，组成用堆叠 / 份额，流程用漏斗或时间线。

## 交付前检查

交付 UI 代码或设计稿前至少确认：

- 主要交互元素可键盘访问，焦点可见。
- 正常文本对比度达到 4.5:1。
- 移动端可读、可点、无横向滚动。
- hover / loading / error / empty / disabled 状态完整。
- 图标、字号、间距和容器宽度一致。
- 动效尊重 `prefers-reduced-motion`。
- 截图中没有内容重叠、按钮文字溢出、固定元素遮挡正文。
- 需要品牌 logo 时使用可查证来源，不手画猜测。

## 汇报

最终说明：

- 使用了哪个检索域或技术栈。
- 生成或更新了哪份设计系统文件。
- 哪些规则成为本轮刚性约束，哪些只是风格参考。
- 仍未验证的屏幕尺寸、模式或交互状态。
