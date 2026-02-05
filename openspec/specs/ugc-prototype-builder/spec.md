# ugc-prototype-builder Specification

## Purpose
TBD - created by archiving change add-ugc-prototype-builder. Update Purpose after archive.
## Requirements
### Requirement: 原型制作器默认标签与提交
系统 SHALL 在创建 UGC 游戏时默认添加“原型”标签，并允许用户完成后直接提交到服务器。

#### Scenario: 创建原型游戏
- **WHEN** 用户在原型制作器创建 UGC 游戏
- **THEN** 系统 MUST 默认设置标签为 `原型` 且可直接提交发布草稿

### Requirement: 卡牌数据结构模板
系统 SHALL 提供卡牌模板结构，包含牌面、牌背、标签、效果、音效等字段，并支持多标签。

#### Scenario: 生成卡牌模板
- **WHEN** 用户创建新卡牌
- **THEN** 系统 MUST 生成包含 `face/back/tags/effects/sfx` 的模板结构

#### Scenario: 多标签支持
- **WHEN** 用户为卡牌配置多个 tag
- **THEN** 系统 MUST 允许在同一卡牌上同时生效

### Requirement: 基础组件库（原型）
系统 SHALL 提供卡牌类型、阶段组件、目标选择组件、伤害结算、抽牌堆与弃牌堆的基础组件与默认样式。

#### Scenario: 组件库可用
- **WHEN** 用户打开原型制作器的组件库
- **THEN** 系统 MUST 展示上述基础组件并可拖拽到画布

#### Scenario: 抽弃牌堆位置配置
- **WHEN** 用户拖拽抽牌堆或弃牌堆到画布
- **THEN** 系统 MUST 保存其位置与配置并提供默认视觉样式

### Requirement: 提示词与代码模板一键复制
系统 SHALL 根据用户描述生成提示词与代码模板，并提供一键复制。

#### Scenario: 效果提示词生成
- **WHEN** 用户输入卡牌效果描述
- **THEN** 系统 MUST 生成“数据结构模板 + 通用逻辑提示词”并可复制

#### Scenario: 视图模板复制
- **WHEN** 用户选择卡牌牌面/牌背模板
- **THEN** 系统 MUST 提供可复制的视图代码模板

### Requirement: 牌面绘制方式
系统 SHALL 支持多种牌面创建方式，包括画笔绘制、div+背景图、纯图片、纯div元素。

#### Scenario: 画笔绘制牌面
- **WHEN** 用户选择画笔绘制方式
- **THEN** 系统 MUST 提供 Canvas 绘制器并导出为图片资源

#### Scenario: div+背景图牌面
- **WHEN** 用户选择 div+背景图方式
- **THEN** 系统 MUST 生成对应的视图代码模板供 AI 生成

### Requirement: 模板系统（复用机制）
系统 SHALL 支持用户保存和复用已创建的卡牌/效果/视图模板。

#### Scenario: 保存模板
- **WHEN** 用户创建卡牌/效果后选择保存为模板
- **THEN** 系统 MUST 将模板存储并可在后续创建时复用

#### Scenario: 从模板创建
- **WHEN** 用户选择已有模板创建新卡牌
- **THEN** 系统 MUST 基于模板生成初始配置

### Requirement: 卡牌生命周期钩子
系统 SHALL 支持卡牌在不同生命周期阶段触发效果，包括打出、弃置、回合开始/结束等。

#### Scenario: 打出效果
- **WHEN** 卡牌被打出
- **THEN** 系统 MUST 触发卡牌的 `onPlay` 效果

#### Scenario: 弃置效果
- **WHEN** 卡牌被弃置
- **THEN** 系统 MUST 触发卡牌的 `onDiscard` 效果

#### Scenario: 回合钩子
- **WHEN** 回合开始或结束
- **THEN** 系统 MUST 触发手牌/场上卡牌的对应生命周期效果

### Requirement: 效果作为可复用组件
系统 SHALL 允许用户将效果保存为独立组件，可被多张卡牌引用复用。

#### Scenario: 创建效果组件
- **WHEN** 用户通过 AI 生成效果代码
- **THEN** 系统 MUST 允许将该效果保存为独立组件

#### Scenario: 卡牌引用效果组件
- **WHEN** 用户配置卡牌效果
- **THEN** 系统 MUST 允许引用已有效果组件而非重复定义

### Requirement: 组件库层级展开
系统 SHALL 以层级方式展示组件库，点击父机制展开子组件。

#### Scenario: 卡牌机制展开
- **WHEN** 用户点击"卡牌机制"分类
- **THEN** 系统 MUST 展开显示抽牌堆、弃牌堆、手牌区等子组件

### Requirement: 发牌动画配置
系统 SHALL 支持发牌动画自动定位手牌区或用户指定目标点。

#### Scenario: 自动定位手牌区
- **WHEN** 用户未指定发牌目标
- **THEN** 系统 MUST 自动查找手牌区组件位置作为目标

#### Scenario: 拖拽指定目标点
- **WHEN** 用户拖拽指定发牌目标位置
- **THEN** 系统 MUST 使用该位置作为动画终点

### Requirement: UGC Builder 草稿后端持久化
系统 SHALL 为已登录用户提供 UGC Builder 草稿的后端持久化能力，支持多项目管理与跨设备恢复。

#### Scenario: 保存草稿
- **WHEN** 登录用户在 UGC Builder 中触发保存或自动保存
- **THEN** 系统 MUST 将草稿数据写入后端并关联 ownerId

#### Scenario: 加载草稿
- **WHEN** 登录用户打开 UGC Builder
- **THEN** 系统 MUST 从后端加载该用户最近的草稿项目并恢复编辑状态

#### Scenario: 多项目列表
- **WHEN** 登录用户打开项目列表
- **THEN** 系统 MUST 返回该用户所有草稿项目及其更新时间

#### Scenario: 权限隔离
- **WHEN** 用户尝试访问他人的草稿项目
- **THEN** 系统 MUST 拒绝并返回权限错误

