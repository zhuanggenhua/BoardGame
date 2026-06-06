## Context

当前 `splendor` 的雪碧图顺序通过以下几部分共同维护：

- `src/games/splendor/domain/data.ts`：规则数据
- `src/games/splendor/sprites.ts`：运行时顺序数组 / noble index
- `public/assets/splendor/sprite-mapping.md`：人工校对说明

这种方式的主要问题是：

- 校对视图与运行时配置分离，人工必须在图片、文档和代码之间切换
- `sprites.ts` 里的顺序数组可维护，但不直观
- 后续如果继续调整顺序，容易出现“文档已改、代码未改”或“代码已改、人工未复核”

## Goals / Non-Goals

- Goals:
  - 提供一个页面化校对工具，把图集格子和数据模型放在同一视图中
  - 让 `splendor` 雪碧图映射拥有单一真实来源
  - 降低人工校对和后续维护成本
  - 保持运行时渲染逻辑简单稳定

- Non-Goals:
  - 本次不把工具泛化为所有游戏都可用的通用资产平台
  - 本次不引入服务端持久化或工作区文件直接写回能力
  - 本次不调整 `splendor` 卡牌规则数据本身

## Decisions

- Decision: 复用现有 `assetslicer` 作为工具承载页，而不是新增独立 devtool 路由
  - Why: 该需求本质上仍属于资源/图集校对工具，放在现有素材工具内更符合信息架构，也能复用已有 devtool 入口

- Decision: 先做 `splendor` 专用模式，不强行抽象为通用编辑器
  - Why: `splendor` 当前已经有明确的 tier 网格和贵族图需求，先把实际问题解决，再观察是否值得抽象

- Decision: 运行时映射收敛到独立配置文件，由 `sprites.ts` 读取
  - Why: 运行时代码继续只负责“读取映射并生成样式”，而不是承载人工维护真值

- Decision: 页面编辑结果支持导出与本地草稿，不直接写回仓库文件
  - Why: 浏览器页面天然不应直接修改工作区；导出结构化结果 + 本地草稿已经足够支撑人工校对流程，风险更低

## Risks / Trade-offs

- 风险: 只支持导出、不直接写回，仍然存在“页面配置结果未同步到仓库”的一步人工操作
  - Mitigation: 导出内容尽量贴近最终配置文件结构，并在文档中明确回填路径

- 风险: 如果后续多个游戏都提出类似需求，`splendor` 专用实现可能需要再抽象
  - Mitigation: 先把数据结构和 UI 状态设计成可扩展，但本次不提前做过度抽象

## Migration Plan

1. 新增独立映射配置文件
2. `sprites.ts` 改为消费该配置
3. 在 `assetslicer` 中增加 `splendor` 映射工具模式
4. 补测试、补文档

## Open Questions

- 导出格式优先使用 TS 片段还是 JSON 文件结构？
- 第一版是否需要支持“交换两个格子”快捷操作，还是先只支持单项绑定？
