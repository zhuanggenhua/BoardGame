## ADDED Requirements

### Requirement: Builder 使用锚点布局模型
系统 SHALL 在 UGC Builder 中以 `anchor/pivot/offset` 作为布局组件的当前编辑模型，并在加载遗留草稿时把旧 `x/y` 布局迁移到该模型后再进入编辑态。

#### Scenario: 加载旧草稿时迁移布局
- **WHEN** Builder 读取仅包含旧 `x/y` 定位字段的布局组件
- **THEN** 系统 MUST 在进入编辑流程前补齐 `anchor/pivot/offset` 并继续以锚点模型工作

#### Scenario: 编辑操作回写锚点模型
- **WHEN** 用户在画布中创建、拖拽、缩放或调整布局组件
- **THEN** 系统 MUST 回写 `anchor/pivot/offset` 与尺寸字段，而不是依赖独立的绝对坐标状态

### Requirement: Builder 提供对齐与分布工具
系统 SHALL 为 UGC Builder 提供多选布局组件的对齐与分布能力。

#### Scenario: 对齐选中组件
- **WHEN** 用户对当前选中组件执行左/中/右或上/中/下对齐
- **THEN** 系统 MUST 依据当前选择范围或画布边界更新组件位置

#### Scenario: 等距分布选中组件
- **WHEN** 用户对三个及以上选中组件执行水平或垂直分布
- **THEN** 系统 MUST 保持组件顺序并重新计算等距间隔

### Requirement: Builder 提供吸附与参考线
系统 SHALL 在 UGC Builder 画布中提供网格吸附、边缘吸附、中心吸附和参考线提示，并将相关编辑器偏好持久化。

#### Scenario: 网格与吸附偏好持久化
- **WHEN** 用户调整网格显示、网格大小、吸附开关或吸附阈值
- **THEN** 系统 MUST 将这些偏好保存到编辑器 `uiLayout` 配置

#### Scenario: 拖拽或缩放时显示参考线
- **WHEN** 用户拖拽或缩放组件并触发边缘或中心吸附
- **THEN** 系统 MUST 显示对应参考线并把吸附后的结果写回布局模型
