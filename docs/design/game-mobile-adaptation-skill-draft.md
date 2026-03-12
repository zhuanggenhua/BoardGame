# 游戏层移动适配 Skill 结构草案

## 目标

把“单个游戏如何接入 PC 为主、移动端补适配的现有框架”沉淀成独立 skill，供后续开发者复用。

这个 skill 只负责游戏层接入流程，不替代框架层设计，也不擅自扩展用户尚未确认的移动交互需求。
框架层权威来源仍然是当前 OpenSpec 提案：

- [proposal.md](../../openspec/changes/add-pc-first-mobile-adaptation-framework/proposal.md)
- [design.md](../../openspec/changes/add-pc-first-mobile-adaptation-framework/design.md)
- [tasks.md](../../openspec/changes/add-pc-first-mobile-adaptation-framework/tasks.md)

## 推荐命名

最正确方案：`adapt-game-mobile`

理由：

- 动作导向明确，表达“把某个游戏接入移动适配框架”
- 不和框架层本身混名
- 适合在 skill 列表中被稳定命中

备选：

- `game-mobile-adapter`
- `game-landscape-adaptation`

## 关键前提

### 先核对真实需求

这个 skill 在任何实现、提案、改交互之前，必须先和用户核对真实需求，禁止默认按“移动端最佳实践”自行扩展。

必须先确认至少这些点：

- 目标游戏是不是仍然 `PC 为主`
- 移动端是补适配还是首发主平台
- 目标设备是手机横屏、手机竖屏、平板，还是只要求 WebView 容器可跑
- 当前要解决的是布局问题、输入问题，还是分发问题
- 用户要的是“最小可用方案”还是“完整触控重做”

如果用户已经明确给出约束，skill 必须优先收敛到该约束，不能擅自升级为更重的方案。

### 案例使用原则

项目里的具体游戏案例只能作为参考材料提供思路，不能写成 skill 的特殊处理逻辑。

约束如下：

- skill 的主流程必须对所有游戏通用
- 具体案例只能放在 `references/*.md` 中作为样例
- 不得因为某个案例的现状，把它固化成 skill 的默认交互结论
- 如果用户已经明确给出约束，skill 只复述并沿用该约束，不从案例中额外推导更多需求

例如当前对话中，`dicethrone` 的“长按看预览大图”只能作为一个已核对案例，说明“如何在需求已收敛时输出最小方案”，而不是 skill 内置的特殊规则。

## 触发场景

建议在 skill frontmatter 的 `description` 中覆盖这些触发条件：

- 用户要求“给某个游戏做移动端适配”
- 用户要求“把某个游戏接入横屏适配框架”
- 用户要求“评估某个游戏能否进 WebView / PWA / 小程序 web-view”
- 用户要求“审查某个游戏里哪些点阻碍移动端适配”
- 用户明确提到“王权骰铸移动适配”“游戏层适配”“移动端接入清单”“横屏接入”

## 边界

### Skill 负责

- 先核对真实需求，再开始审查
- 识别游戏属于哪种移动支持 profile
- 审查游戏层现有布局与交互问题
- 指导填写 manifest 移动字段
- 指导接入通用移动壳
- 标注游戏层必须处理的例外点
- 输出最小改造步骤与验收项

### Skill 不负责

- 设计新的框架层 runtime 能力
- 决定框架层最终真相
- 在未核对需求前，自行发明更重的移动交互方案
- 直接把 WebView 当成“已完成移动适配”

## 目录结构草案

```text
adapt-game-mobile/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    ├── manifest-fields.md
    ├── checklist.md
    └── dicethrone-pilot.md
```

## 各文件职责

### `SKILL.md`

只保留高层工作流和导航，不堆大量细节。

建议包含：

- skill 用途和触发条件
- 先核对真实需求的前置步骤
- 标准工作流
- 什么时候读哪个 reference
- 输出要求

### `references/manifest-fields.md`

来源：本次 OpenSpec 提案

内容建议：

- `mobileProfile` 定义
- `preferredOrientation` 定义
- `mobileLayoutPreset` 定义
- `shellTargets` 定义
- PC 为主、横屏优先、缩放仅兜底等原则

### `references/checklist.md`

内容建议：

- 检查 `hover` 依赖
- 检查拖拽是否可被点击或长按替代
- 检查固定宽高与溢出
- 检查常驻信息区和关键操作入口
- 检查关键操作是否始终可触达
- 检查是否适合进 `app-webview` / `mini-program-webview`

### `references/dicethrone-pilot.md`

内容建议：

- 王权骰铸试点中遇到的真实问题
- 已核对的真实需求和非需求
- 哪些点适合框架层解决
- 哪些点必须游戏层修正
- 推荐改造手法和反模式
- 仅作案例参考，不提供特殊处理分支

## `SKILL.md` 建议骨架

```md
---
name: adapt-game-mobile
description: 为单个游戏接入项目现有的 PC 为主、移动端补适配框架。用于先核对真实需求，再审查游戏层 hover、拖拽、固定布局问题，填写 manifest 移动字段，接入通用移动壳，并评估是否适合进入 PWA、App WebView 或小程序 web-view。
---

# 适配游戏移动端

## 快速流程

1. 先核对真实需求，不确认前不进入实现
2. 读取 `references/manifest-fields.md`
3. 审查目标游戏：读 manifest、Board、关键交互组件
4. 按 `references/checklist.md` 识别游戏层例外
5. 输出接入方案、最小改造项和验收结论

## 案例参考

当目标游戏复杂度接近 `dicethrone` 时，优先参考：
`references/dicethrone-pilot.md`

注意：这里只是案例材料，不代表 skill 对 `dicethrone` 有特殊分支。

## 输出要求

- 明确 `mobileProfile`
- 明确 `shellTargets`
- 明确是否需要游戏层例外处理
- 明确当前已核对的真实交互需求
- 明确最小改造步骤
```

## 标准工作流草案

### 0. 先核对需求

必须先输出“已确认需求 / 未确认需求 / 禁止擅自扩展项”。

最少要核对：

- 目标平台优先级
- 横屏还是竖屏
- 是否只要最小可用
- 是否允许改交互语义
- hover 依赖到底要替换成什么

如果用户没有明确说明，就只提出问题，不进入具体实现细节。

### 1. 读取契约

- 读取移动适配 OpenSpec 提案摘要
- 读取游戏 manifest
- 确认目标是 `PC 为主` 还是 `移动优先`

### 2. 审查游戏层

至少检查：

- `Board.tsx`
- 关键交互组件
- 手牌区
- 状态说明区
- 阶段 / 日志 / 操作栏
- 角色选择或特殊 UI

### 3. 分类问题

把问题拆成三类：

- 框架层应该解决
- 游戏层必须接入
- 当前不建议支持

### 4. 输出结论

必须输出：

- 推荐的 `mobileProfile`
- 推荐的 `shellTargets`
- 游戏层例外处理点
- 已核对的真实交互结论
- 验收方式

## Hover 替代的默认约束

这个 skill 不得默认把 hover 替代写成复杂交互树。

默认规则：

- 先复述用户明确要求的替代方式
- 如果用户只说“长按看预览大图”，就按这个最小方案输出
- 未经确认，不要额外扩展为点击选中、动作菜单、二次确认流
- 案例里的做法只能提供思路，不能自动提升为 skill 默认方案

## 第一版验收标准

- 能先核对需求，再开始审查
- 能稳定审查单个游戏目录
- 能输出 manifest 建议字段
- 能列出游戏层必须修改的最小点位
- 能说明是否适合进 `app-webview` / `mini-program-webview`
- 能把王权骰铸作为首个真实案例引用
