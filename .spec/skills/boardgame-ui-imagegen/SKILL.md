---
name: boardgame-ui-imagegen
description: "BoardGame 桌游 UI 设计稿前置门禁与 imagegen/Open Design artifact 路线裁决。用于新游戏 UI、生图返工、规则书/主棋盘素材设计；先拆真实 UI 元素。"
---

# Boardgame UI Imagegen

把“规则 + 素材”转成可执行的 UI 设计稿前置包，并裁定走 imagegen 位图、Open Design artifact 导出图，还是阻塞 brief。本 skill 不定义 UI 美学原则、资源链或截图验收；这些主源分别在 [`ui-ux`](../../knowledge/standards/ui-ux.md)、[`ui-change-gates`](../../knowledge/standards/ui-change-gates.md) 和 [`asset-pipeline`](../../knowledge/standards/asset-pipeline.md)。

## 适用边界

- 用户要“设计稿 / 效果稿 / 生图 / 视觉稿 / 先看图”时，默认交付图片型设计稿，不交 HTML、运行页或前端实现。
- imagegen 不可用但 Open Design 可用时，可走 Open Design artifact 候选稿；必须导出 PNG/JPG/WebP 或等价图片并完成 AI 图面核验后，才可给用户看。
- HTML / CSS / React mockup 只允许辅助校准空间关系和素材输入，不得冒充设计稿。
- 新增游戏时同时遵守 [`create-new-game`](../create-new-game/SKILL.md)；需要创建、切换或派生分支 / worktree 时，必须先取得用户当轮明确授权。
- 已进入正式方案、布局不变量或任务拆分时，UI 结论要回写 OpenSpec；本 skill 不把产品方案正文留在这里。

## 必读输入

出稿前至少读取并消费：

- 当前项目入口和本 skill 关联标准：`AGENTS.md`、[`ui-ux`](../../knowledge/standards/ui-ux.md)、[`ui-change-gates`](../../knowledge/standards/ui-change-gates.md)、[`asset-pipeline`](../../knowledge/standards/asset-pipeline.md)。
- 本轮规则真相源：优先 `docs/games/<gameId>/rule/**`、`docs/games/<gameId>/intake/**` 或已有设计前置矩阵；没有时回到规则 PDF / OCR / 素材来源。
- 正式素材来源：主棋盘、地图、角色板、卡牌、牌背、token、骰子、状态板、atlas crop 或其它当前画面主体。
- 专项 UI workflow：复杂新页面或游戏 UI 设计要叠加 [`ui-design-pipeline`](../ui-design-pipeline/SKILL.md)、[`game-design`](../game-design/SKILL.md) 和 [`ui-audit-loop`](../ui-audit-loop/SKILL.md)。

不能说明“刚刚读了哪份规则”和“画面主体来自哪份素材账本”时，不得生成 prompt、Open Design artifact、HTML 预览或 AI PASS 结论。

## 前置证据块

每份准备进入 imagegen、Open Design、HTML 预览、AI 核图或人工验收的 artifact，必须在同一个前置包、prompt brief 或随图审计中写出：

- **规则读取**：本轮实际读取的规则文件 / 页段，以及至少三条会改变画面的规则对象结论。
- **规则到画面**：每条规则结论对应的画面主体、设计决策和禁止项。
- **素材账本**：每个可见主体的正式资源路径或 atlas/frame、素材状态、artifact 中的呈现方式和是否允许出现。
- **输入链路**：正式资源如何进入生成或渲染链，例如输入包、reference sheet、Open Design 项目相对路径、atlas crop 或运行时渲染来源。
- **禁止替代**：哪些对象不得用文字壳、CSS 形状、相似图标、临时裁图或纯 prompt 重画替代。
- **验收状态**：默认 `human-review-not-allowed`；只有 AI 图面核验 PASS 后，才允许进入用户验收展示。

只在旧矩阵、交接摘要、旧 PASS 或对话里存在上述信息，不算通过。

## 素材裁决

素材状态必须先裁定：

- `visible-subject`：正式素材必须承担画面主语。
- `reference-only`：只能作规则、比例、风格或 reference sheet 来源，不得复现成主界面主体。
- `approved-programmatic`：允许用程序化对象表达，但要有规则 / 素材来源。
- `approved-programmatic-runtime-ui`：只用于生命、资源、冷却、短状态、临时增减等动态读数；不得替代棋盘、卡牌、牌背、token、骰子、角色板等物理主体。
- `blocked` / `temp-only` / 未登记：不得画成完成态对象。

素材优先不是把所有物理件硬贴进主 UI；它要求正式素材承担应承担的主语，动态读数用清晰、贴近对象且来源可解释的运行态 UI 承接。

## 设计流程

默认四步走，前一步未通过不得进入下一步：

1. **规则提炼 UI**：从规则和素材提炼必要元素、主次关系、玩家关注点、隐藏信息和基础布局；默认先做运行时主界面。
2. **布局收敛 UI**：收成一张可执行布局定稿；只有用户明确要求多版比较时才做裂变。
3. **风格统一 UI**：在已选布局上统一风格；不得借换风格改主结构。
4. **分界面 UI**：在同一风格下扩展角色选择、运行时、结算等界面。

用户明确只要某一步时，只做该步；用户只说“继续”不等于批准当前设计步进入实现或下一阶段。

## 布局门槛

生图前必须写清：

- 玩家第一眼先看哪里。
- 当前可点击 / 可选择对象在哪里。
- 当前动作如何结束、取消或提交。
- 当前最大承载量：主棋盘、当前来源、当前目标、结算浮层、可浏览集合、归档入口、玩家资源各能容纳多少。
- 规则命名区的真实名称、可见性、流转关系和操作入口；不得把规则没有的概念写进 UI 名称、class、aria、审计或汇报。
- 固定区域 / 格子 / 地图房间 / 战场格 / 基地等空间单位的对象锚点、容量、堆叠、token 贴附和高亮规则。
- 若出现确认 / 取消 / 下一步，必须说明玩家确认前还能改什么、确认后系统发生什么、为什么不能点击对象本体直接完成。

答不上来时，先补规则和空间问责表，不生成图。

## 生成路线裁决

- **imagegen 位图路线**：用户明确要生图、效果稿或视觉稿且 imagegen 可用时使用。
- **Open Design artifact 候选稿**：imagegen 不可用或不能承接正式素材，但 Open Design 可用时使用；必须把正式素材导入项目相对路径或输入包，并导出图片验收。
- **辅助 mockup**：只用于比例、空间和素材缺口核对；不得作为正式设计稿交付。
- **blocked brief**：所有正式设计工具都无法承接素材、参考图或规则前提时输出；不能用无素材 HTML、线框、拼贴图或旧截图冒充完成态设计稿。

任何路线都必须继承同一份前置证据块。

## Prompt 合同

生成 prompt 按顺序写：

1. 当前步骤：Step 1 / Step 2 / Step 3 / Step 4。
2. 画布原则：主素材是否完整使用、是否允许裁剪、是否允许拆分。
3. 必须保留的素材 UI 和已有印刷信息。
4. 主动作模型、当前来源、当前目标和结算层。
5. 层级模型：背景、棋盘 / 地图、物理对象、交互 overlay、结算 overlay、边缘 HUD。
6. 允许重叠和必须保护对象。
7. 控件授权：确认 / 取消 / 下一步的规则或系统依据。
8. 风格口径：默认单一风格、与素材统一、前端可复刻。
9. 禁止项：本轮不允许出现的重复控件、解释句、未登记对象、厚框体或不可复刻材质。
10. 复刻边界：哪些是前端刚性结构，哪些只是可降级氛围。

默认 prompt 偏向 `2D printed board game UI concept`、`printed card language`、`implementable runtime layout`；避免把正式运行时稿推向摄影感、3D 实物渲染或重材质概念图。

## AI 图面核验

生成后必须看图并给出 PASS / REVISE。以下任一项命中即 REVISE：

- 图中主要对象无法回查到规则结论和素材账本。
- 正式素材被文字壳、CSS 形状、相似图标、临时裁图或抽象占位替代。
- `reference-only`、`blocked`、`temp-only` 或未登记对象被画成完成态主体。
- UI 重复素材已有职责，例如第二套主行动指示器、第二套牌库 / 弃牌、第二套流程轨。
- 当前来源、目标、确认和结果被拆到多个无关位置，玩家第一眼不知道下一步点哪里。
- 当前结算主体被降级到边栏、日志或仪表盘，而不是锚定来源、目标或主动作链路。
- 框体、分栏、底板、仪表盘比桌游对象更像主视觉。
- 主界面出现规则说明句、教程句或解释按钮含义的常驻文字。
- 关键对象、卡牌、格子、区域、token 或印刷信息被遮挡到不可读。
- 画面只能靠不可控纹理、摄影光、雕花、旧化材质成立，去掉这些后结构不成立。

不合格时更新前置证据、素材输入或 prompt 后重生；不得把失败图交给用户验收。

## 文案限制

主 UI 常驻文字只允许：

- 规则真实对象名。
- 动作名。
- 短状态。
- 数字和短字段。

禁止常驻规则说明句、教程句、“点击这里”式指令、按钮功能解释，以及规则不存在的资源栏或系统名。需要解释时用 tooltip、帮助入口、临时说明浮层或规则页。

## 阶段和实现边界

- 设计稿阶段不得启动真实页面、写 `Board.tsx`、扩展 HUD 或用运行页截图冒充设计稿。
- 固定构图类桌游的 PC 设计稿 / 桌面真页是主基线；PC 基线未过时，不进入移动端验收图或移动 E2E 收口。
- 当生图后续用于前端实现，必须说明哪些部分是刚性结构合同，哪些只是概念气质参考；前端不承诺复刻随机纹理、摄影光影或不可控笔触。

## 单游戏规则下沉

通用 skill 不写单个游戏的专有机制名、地名、势力名、控件名或案例。若当前设计依赖某个游戏的主板结构特例，先保留本 skill 的共性门槛，再读取该游戏专项文档；不要把专项提醒反写回通用 skill。
