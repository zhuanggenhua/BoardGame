## Context

首页 V2 当前已经验证了三件事：

1. 用户要的是“直接打开真实页面编辑”，不是另开一个近似页面的编辑器壳。
2. YAML 作为 AI 与人工共编格式是对的，但不能把 YAML 文本同步放在交互热路径中心。
3. 如果没有容器树、层级树、属性面板、资源面板和跟手交互，这套能力最多只是技术演示，不是能长期使用的编辑系统。

因此，本次设计不再继续把 `src/ui-scene/**` 当成一套“补齐几个面板就能上线”的轻量方案，而是明确将其升级为“引擎式页面内场景编辑”：

- 像游戏引擎一样有正式的场景树
- 像低代码平台一样有容器、布局、资源、属性编辑
- 像设计工具一样要求拖拽、缩放、吸附能跟手
- 仍然保持“真实页面就是最终页面”的 WYSIWYG 原则

## Goals / Non-Goals

- Goals:
  - 让真实页面内编辑具备接近游戏引擎/低代码平台的基本作者体验。
  - 让拖拽、缩放、吸附、重排从交互上真正跟手。
  - 让容器成为正式模型，支持层级树与重挂载。
  - 保持 YAML 作为长期真源，同时把交互热路径迁出 YAML 文本层。
  - 建立统一中文辅助 UI，避免作者模式继续停留在技术调试面板。
  - 将资源管理纳入作者模式，统一处理本地、服务器资源和上传链路。
  - 让首页 V2 先完成这套模式的第一轮落地，再考虑更泛化的平台化扩展。
- Non-Goals:
  - 本次不做一个脱离真实页面的独立“可视化编辑器网站”。
  - 本次不允许 YAML 内嵌任意脚本或任意 React/JSX。
  - 本次不追求一次覆盖所有营销页/活动页的高级组件。
  - 本次不把 UGC Builder 作为主复用目标。

## Core Decisions

### Decision: 采用三层模型，而不是“页面状态 = YAML 文本 = 运行时状态”

正式模型分三层：

1. `Scene Document`
   - 面向编译与运行时的结构化场景文档。
   - 包含节点树、容器、资源引用、样式引用、动作绑定。
2. `Editor Session`
   - 面向交互热路径的编辑会话态。
   - 包含选中态、悬停态、拖拽态、吸附线、临时矩形、未提交事务。
3. `YAML Source`
   - 面向持久化与 AI 共编的长期真源。
   - 由 `Scene Document` 序列化得到，不直接承担高频交互状态。

裁决：

- 页面拖拽过程中优先更新 `Editor Session`
- 渲染层从 `Editor Session + Scene Document` 读取当前视图
- 在提交点或节流点同步回 `Scene Document`
- 再由 `Scene Document` 异步镜像回 YAML

这样才能保证拖拽跟手，而不是每一帧都在回写 YAML 再重编译。

### Decision: 场景正式模型是“场景树”，不是“区域矩形列表”

第一阶段必须把场景建模成可编辑场景树，而不是只编辑 artboard zones。

最小树模型：

- 根节点
- 容器节点
- 内容节点
- 插槽节点

节点必须拥有：

- 稳定 `id`
- `nodeType`
- 父子关系
- 排序索引
- 样式/皮肤引用
- 布局模式或布局输入

这样才能支持：

- 层级树
- 节点插入
- 节点重挂载到别的容器
- 容器内重排
- 后续 AI patch 只改局部节点而不是整页大串 YAML

### Decision: 容器是一等公民，第一阶段至少支持三类布局容器

第一阶段必须有正式容器语义，而不是靠一堆绝对定位拼出“像容器”的效果。

容器最小集合：

- `自由容器`
  - 子节点可自由定位
  - 适合书本书签、装饰、热点、悬浮按钮
- `纵向容器 / 横向容器`
  - 适合列表、工具条、标题区、按钮组
  - 支持间距、对齐、内边距、主轴/交叉轴策略
- `网格容器`
  - 适合卡片入口、宫格导航、信息卡片编排
  - 支持列数、行间距、列间距、自动填充

容器还必须支持：

- 内边距
- 对齐
- 可选裁剪
- 子项顺序调整
- 节点拖入/拖出

作者 UI 必须允许“把节点设为容器”以及“把节点移动到某个容器下”。

### Decision: 跟手拖拽必须采用编辑会话热路径 + 逐帧渲染

要达到“像游戏引擎那样跟手”，拖拽不能继续走“onPointerMove -> 改 YAML -> 重新编译全量文档”的链路。

正式要求：

- 使用 `pointer capture`
- 在统一交互平面上计算坐标变换
- 以 artboard 坐标作为编辑空间
- 使用逐帧刷新或等价轻量热路径更新临时矩形
- 仅在提交点更新文档和 YAML

热路径至少区分三类数据：

- `实时预览矩形`
- `已提交文档矩形`
- `YAML 镜像文本`

提交策略：

- `pointermove` 期间更新实时预览
- `pointerup` 时提交最终结果
- 如需中途镜像，可采用节流同步，而不是每帧回写 YAML

### Decision: 编辑态与正式态继续共用同一渲染器，但辅助 UI 独立为 authoring chrome

必须继续坚持“真实页面就是最终页面”，所以：

- 正式态与编辑态共用同一内容渲染器
- 作者辅助 UI 通过 overlay/portal 叠加
- 辅助 UI 不得改变真实内容布局

辅助 UI 最小集合：

- 顶部工具条
- 左侧层级树
- 右侧属性面板
- 资源面板
- YAML 面板
- 画布辅助层（选框、手柄、吸附线、容器高亮）

### Decision: 作者辅助 UI 面向人使用，必须直接用中文

这不是内部调试面板，辅助 UI 必须直接使用中文。

要求：

- 面板名、分组名、字段名、按钮文案、提示语一律中文
- 不接受作者界面里继续出现 “Inspector / Author YAML / Node / Layout” 这类默认英文
- 节点类型内部 ID 可以保留英文，但作者看到的标签必须是中文，例如：
  - `frame` -> `自由容器`
  - `stack` -> `纵向容器` / `横向容器`
  - `grid` -> `网格容器`
  - `text` -> `文字`
  - `image` -> `图片`
  - `button` -> `按钮`

建议建立一份作者元数据字典，为节点与字段提供：

- `labelZh`
- `groupZh`
- `hintZh`

### Decision: YAML 是持久化真源，但不是交互热路径真源

YAML 仍然是长期真源，理由不变：

- 人工能读
- AI 能改
- diff 友好
- 可审查

但交互热路径不能继续直接操作 YAML 文本。

所以必须改成：

- 加载时：`YAML -> Scene Document`
- 编辑时：`Scene Document + Editor Session`
- 保存时：`Scene Document -> YAML`

YAML 面板是作者视图和 AI 协作接口，不是拖拽计算核心。

### Decision: 保存链路使用命令式提交，不使用隐式文本重建

作者动作应先变成编辑命令，再统一提交：

- 移动节点
- 缩放节点
- 修改容器方向
- 调整 gap/padding
- 重排层级
- 替换资源

建议第一阶段使用命令式 mutation：

- `moveNode`
- `resizeNode`
- `reparentNode`
- `reorderNode`
- `updateNodeProps`
- `replaceAssetRef`

优势：

- 便于撤销/重做扩展
- 便于 AI patch 复用同一条变更语义
- 便于保存前做 schema 校验

### Decision: 资源面板必须进入作者模式，而不是只保留 YAML 写路径

用户已经明确要求资源管理必须考虑本地与服务器资源。

因此作者模式必须有正式资源面板，至少支持：

- 浏览当前 scene 可用资源
- 查看资源来源：本地 / 已发布服务器资源 / 待上传
- 选择资源替换当前节点/皮肤
- 新资源发布到服务器资源主源
- 上传后继续使用同一 `assetRef`

资源系统分三层：

1. `Asset Registry`
   - 逻辑资源引用
   - 资源来源状态
2. `Asset Resolver`
   - 解析为本地或远端运行时 URL
3. `Asset Authoring`
   - 面板浏览、选择、上传、更新注册表

### Decision: 继续限制受控节点，不开放任意 JSX

即便这次是引擎式重构，也不能让边界失控。

第一阶段仍使用受控节点白名单，但能力上要比当前原型更接近编辑器：

- 自由容器
- 纵向容器
- 横向容器
- 网格容器
- 面板
- 文字
- 图片
- 按钮
- 插槽

必要时允许“宿主插槽节点”挂接真实 React 内容，但仍然通过受控节点表达，不直接把任意 JSX 写进 YAML。

### Decision: 首页 V2 采用“书本壳层 + 可编辑内容树”双层结构

首页 V2 当前已有书本壳层动画与翻页逻辑，这部分不必强行纳入第一阶段可视编辑。

裁决：

- 书本开场、翻页、镜头式壳层仍可暂由宿主页面控制
- 书页内真实内容区全部迁移到可编辑场景树
- 作者模式先把主要编辑区域落在书页内容区、页签区、详情区、书签区

这样能保证：

- 不把第一阶段卡死在动画壳层编辑上
- 同时又真正把用户关心的 UI 区域纳入场景编辑

## Target UX

作者进入 `?author=1` 后，页面应表现为：

- 顶部有中文工具条：`选择`、`移动`、`容器`、`吸附`、`资源`、`YAML`、`保存`
- 左侧有 `层级树`
- 右侧有 `属性`
- 需要时打开 `资源` 面板和 `YAML` 面板
- 鼠标点到真实页面元素时出现选框
- 拖拽元素时实时跟手，吸附线即时出现
- 拖到容器边界时可高亮目标容器并完成插入/重挂载

## Suggested Module Split

建议将当前原型重构为以下模块：

```text
src/ui-scene/
  document/
    scene-document.ts
    node-metadata.ts
  authoring/
    session/
      editor-session.ts
      interaction-state.ts
      commands.ts
    chrome/
      AuthorToolbar.tsx
      HierarchyPanel.tsx
      PropertiesPanel.tsx
      AssetPanel.tsx
      YamlPanel.tsx
    overlay/
      SelectionOverlay.tsx
      GizmoOverlay.tsx
      SnapGuideOverlay.tsx
      DropTargetOverlay.tsx
  layout/
    frame-layout.ts
    stack-layout.ts
    grid-layout.ts
  compiler/
    parseYaml.ts
    compileScene.ts
    serializeYaml.ts
  runtime/
    SceneRenderer.tsx
    SkinSurface.tsx
    slots/
```

## Migration Plan

1. 保留现有 YAML parser/compiler 基础，但把 `authoring` 从“直接改 zone + 回写 YAML”重构为“编辑会话态 + 命令式提交”。
2. 把编辑对象从 `artboard.zones` 扩展到正式 `scene node tree`。
3. 增加容器节点和层级树。
4. 把现有英文技术原型面板替换为中文辅助 UI。
5. 增加资源面板和 服务器资源发布入口。
6. 最后将 Home V2 的关键内容区全部迁移到新场景树。

## Risks / Trade-offs

- 架构会比当前原型重，但这是必要复杂度，不做这步就不会有真正可用的编辑体验。
- 如果继续让 YAML 文本参与高频交互，短期省事，但拖拽跟手问题不会真正解决。
- 如果不把容器和层级树做成正式能力，后面只会继续在绝对定位上堆补丁。
- 如果辅助 UI 不统一中文，后续用户和 AI 协作时会持续出现概念错位。

## Open Questions

- 首页 V2 第一阶段是否需要“容器模板插入”，还是先只做空容器与节点拖入。
- 资源面板第一版是否需要缩略图墙，还是先做列表 + 预览。
- 第二阶段是否引入撤销/重做；本 proposal 先确保命令模型兼容该能力，但不要求首波必须完成。
