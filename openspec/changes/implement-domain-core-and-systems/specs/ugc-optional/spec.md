## ADDED Requirements (Optional - Phase 2)

> UGC 能力作为可选扩展，不阻塞核心引擎化。第一阶段先完成核心引擎，UGC 能力后续接入。

### Requirement: UGC 规则代码仅服务端执行
系统 SHALL 限制 UGC 规则代码只在服务端沙箱中执行，不允许在客户端执行。

#### Scenario: UGC 规则加载
- **GIVEN** 用户上传的 UGC 规则模块
- **WHEN** 系统加载该模块
- **THEN** 模块在服务端沙箱（如 `isolated-vm`）中执行，客户端不加载规则代码

### Requirement: UGC 沙箱隔离
系统 SHALL 在沙箱中禁用危险能力，包括但不限于 `require`、`fs`、`net`、`child_process`、`process.env`。

#### Scenario: 禁止文件系统访问
- **WHEN** UGC 规则代码尝试访问 `fs` 模块
- **THEN** 沙箱抛出权限拒绝错误，代码执行终止

#### Scenario: 禁止网络访问
- **WHEN** UGC 规则代码尝试发起网络请求
- **THEN** 沙箱抛出权限拒绝错误，代码执行终止

### Requirement: UGC 资源限制
系统 SHALL 对 UGC 规则执行施加资源限制。

#### Scenario: 执行超时
- **GIVEN** 配置的超时阈值（如 100ms）
- **WHEN** UGC 规则执行超过阈值
- **THEN** 系统终止执行并返回超时错误

#### Scenario: 内存限制
- **GIVEN** 配置的内存上限（如 64MB）
- **WHEN** UGC 规则内存使用超过上限
- **THEN** 系统终止执行并返回内存溢出错误

### Requirement: UGC 模块仅暴露 Domain Core 契约
系统 SHALL 限制 UGC 模块只能实现 Domain Core 接口。

#### Scenario: UGC 模块导出验证
- **WHEN** 系统验证 UGC 模块
- **THEN** 仅允许导出 `commands`、`reducer`、`view`、`schemaVersion`、`migrate` 等契约函数

---

### Requirement: UGC 通用 UI（第一阶段不开放自定义组件）
系统 SHALL 在第一阶段提供平台通用 UI 组件，UGC 游戏通过数据驱动这些组件。

#### Scenario: 渲染 UGC 游戏界面
- **GIVEN** UGC 游戏的领域状态
- **WHEN** 系统渲染游戏界面
- **THEN** 使用平台通用组件（卡牌区、骰子区、计分轨、Prompt 面板、目标选择器）

#### Scenario: 禁止自定义 React 组件
- **WHEN** UGC 模块尝试导出 React 组件
- **THEN** 系统拒绝该导出，仅接受数据定义

---

### Requirement: UGC 资产绘制（无需上传图片）
系统 SHALL 提供 Canvas 绘制编辑器，允许用户直接绘制卡牌、Token 等素材。

#### Scenario: 绘制卡牌素材
- **GIVEN** 用户在绘制编辑器中
- **WHEN** 用户使用卡牌框模板 + 文字/图形工具绘制
- **THEN** 系统生成可用的卡牌素材

#### Scenario: 导出绘制结果
- **WHEN** 用户完成绘制
- **THEN** 系统将结果导出为 SVG/PNG，存储为资产 hash

#### Scenario: 裁切参数数据化
- **WHEN** 用户调整素材显示区域
- **THEN** 系统保存裁切参数 `{ crop: { x, y, scale }, assetId }`，而非生成新图片

---

### Requirement: Effect DSL（效果数据驱动）
系统 SHALL 提供 Effect Schema，允许卡牌/技能效果通过配置数据定义，而非代码。

#### Scenario: 定义伤害效果
- **GIVEN** Effect Schema 支持 `damage` 类型
- **WHEN** 用户/AI 配置 `{ type: 'damage', target: 'opponent', value: 3 }`
- **THEN** 系统验证配置合法，并由 EffectSystem 解释执行

#### Scenario: AI 生成效果配置
- **GIVEN** 用户的自然语言描述
- **WHEN** AI 解析描述并生成配置 JSON
- **THEN** 系统验证配置合法性，拒绝无效配置

#### Scenario: 效果模板库
- **GIVEN** 平台提供的效果模板库
- **WHEN** 用户选择模板并填充参数
- **THEN** 系统生成完整效果配置
