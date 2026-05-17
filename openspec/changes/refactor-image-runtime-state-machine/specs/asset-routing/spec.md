## ADDED Requirements
### Requirement: 图片候选运行时状态单一来源
系统 SHALL 为运行时图片提供统一候选状态契约，负责解析候选 URL、记录真实成功候选、记录失败推进状态，并向图片渲染组件暴露当前推荐 URL。

#### Scenario: fallback 成功后重新挂载
- **GIVEN** 逻辑图片资源的 primary 候选加载失败
- **AND** 后续 fallback 候选加载成功
- **WHEN** 同一逻辑资源在相同 locale 与资源基址下重新挂载
- **THEN** 系统 MUST 优先使用已成功的 fallback 候选
- **AND** 系统 MUST NOT 先重新请求已失败的 primary 候选

#### Scenario: 资源环境变化重新解析
- **GIVEN** 某逻辑图片资源已有成功候选记录
- **WHEN** locale、资源基址或版本 hash 发生变化
- **THEN** 系统 MUST 重新解析候选链
- **AND** 系统 MUST NOT 复用与当前环境不匹配的旧候选 URL

#### Scenario: 多组件共享同一资源
- **GIVEN** 多个组件同时请求同一逻辑图片资源
- **WHEN** 其中一个组件或预加载流程完成真实图片加载
- **THEN** 其他组件 MUST 能通过统一状态契约读取该成功结果
- **AND** 系统 SHOULD 复用同一个 in-flight 加载请求，避免重复网络请求

### Requirement: 图片消费组件不得自建全局 fallback 状态机
系统 SHALL 要求关键图片消费组件复用共享图片候选运行时；组件本地状态只可表示 DOM 加载生命周期、占位展示和组件卸载清理。

#### Scenario: OptimizedImage 渲染普通图片
- **WHEN** `OptimizedImage` 渲染逻辑图片资源
- **THEN** 它 MUST 从共享图片运行时读取候选 URL 与成功候选
- **AND** 它 MUST 将加载成功的真实 URL 回灌到共享运行时

#### Scenario: CardPreview 渲染图集
- **WHEN** `CardPreview` 渲染 atlas 类型预览
- **THEN** 它 MUST 使用共享图片运行时解析与加载图集图片候选
- **AND** 裁切逻辑 MUST 基于共享运行时返回的真实成功图片尺寸与 URL
