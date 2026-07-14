## 1. Spec Rewrite
- [x] 1.1 重写 proposal，明确本 change 从“YAML 原型”升级为“引擎式页面内 UI 场景编辑”。
- [x] 1.2 重写 design，确立 `Scene Document + Editor Session + YAML Source` 三层模型。
- [x] 1.3 重写 spec delta，补齐跟手拖拽、容器树、中文辅助 UI、资源面板与保存链路要求。
- [x] 1.4 运行 `openspec validate add-yaml-ui-scene-authoring --strict --no-interactive`，确保新 spec 合法。

## 2. Scene Document Refactor
- [x] 2.1 将当前编辑对象从 `artboard.zones` 扩展为正式 `scene node tree`。
- [x] 2.2 定义节点公共字段、容器字段、布局字段和节点元数据字典。
- [x] 2.3 建立作者侧中文元数据：节点名、字段名、分组名、提示语。
- [x] 2.4 保留 YAML 编译链，但改为 `YAML -> Scene Document -> compiled artifact`。

## 3. Editor Session & Command Pipeline
- [ ] 3.1 新建编辑会话态，承载选中、悬停、拖拽、吸附线、临时矩形和 drop target。
- [ ] 3.2 将作者操作改为命令式 mutation：`move / resize / reparent / reorder / updateProps / replaceAssetRef`。
- [ ] 3.3 将 YAML 面板从“热路径状态源”改为“节流镜像视图 + 保存出口”。
- [x] 3.4 预留撤销/重做兼容结构，至少不阻断后续接入。

## 4. Follow-Hand Interaction
- [x] 4.1 重写拖拽/缩放链路，使用 `pointer capture + artboard 坐标空间 + 逐帧预览`。
- [x] 4.2 将吸附、对齐线、容器命中高亮纳入统一交互层。
- [ ] 4.3 仅在提交点或节流点更新文档和 YAML，避免每帧重编译。
- [x] 4.4 为关键拖拽链路补最小交互测试，验证“跟手、提交、吸附”三种行为。
- [x] 4.5 支持多选组边界框、批量拖拽/缩放、主参考对象与基础对齐分布操作。
- [x] 4.6 支持方向键微调、`Shift + 方向键` 大步移动，以及 `Esc` 取消选择。

## 5. Container Layout System
- [x] 5.1 实现 `自由容器`、`纵向容器`、`横向容器`、`网格容器` 的正式 schema。
- [x] 5.2 支持容器 padding、gap、align、justify、clip 等基础属性。
- [x] 5.3 支持节点拖入容器、移出容器、容器内重排。
- [ ] 5.4 为容器布局与重挂载补编译/运行时测试。
- [x] 5.5 为容器拖放提供 inside 高亮、插入条和插入槽位反馈。

## 6. Chinese Authoring Chrome
- [x] 6.1 将当前 author UI 全部改成中文，包括工具条、层级树、属性、资源、YAML、保存状态。
- [x] 6.2 新增左侧 `层级树`，支持选中、展开、拖动排序和定位到真实节点。
- [x] 6.3 新增右侧 `属性` 面板，支持布局、外观、资源、动作分组编辑。
- [x] 6.4 保持 authoring chrome 与正式内容布局解耦，不因开启编辑态改变页面真实排版。
- [x] 6.5 将左侧、右侧与底部辅助面板改为可收起抽屉，并为画布工作区让位。

## 7. Asset Authoring
- [x] 7.1 新增 `资源` 面板，展示当前 scene 的本地素材、服务器资源素材与待上传素材。
- [ ] 7.2 支持节点/皮肤从资源面板选择资源并回写 `assetRef`。
- [ ] 7.3 接入本地发布到服务器资源主源 的作者链路，并保持上传前后逻辑引用稳定。
- [ ] 7.4 为资源注册表与上传后引用补 API/编译验证。

## 8. Home V2 Migration
- [ ] 8.1 将 Home V2 主要内容区迁移到新场景树，保留书本壳层动画宿主控制。
- [ ] 8.2 用容器重建页签区、概览区、详情区和书签区，而不是继续以 zone patch 为主。
- [x] 8.3 将现有 `?author=1` 页面升级为新的引擎式作者模式。
- [ ] 8.4 补 Home V2 最小真实链路验证，确认编辑态与正式态画面一致。

## 9. Validation
- [x] 9.1 运行 `npm run typecheck`。
- [x] 9.2 运行 `npm run i18n:check`。
- [ ] 9.3 运行相关 Vitest：scene compiler / layout / authoring session / layout service。
- [x] 9.4 运行至少 1 条 Home V2 作者态 E2E，验证选中、拖拽、保存、重新加载。
