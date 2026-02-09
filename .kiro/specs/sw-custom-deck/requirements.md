# Requirements Document

## Introduction

为召唤师战争（Summoner Wars）游戏添加自定义牌组功能。玩家可以在阵营选择界面通过抽屉式面板，从不同阵营中挑选卡牌构建自定义牌组，并将牌组保存到数据库。此功能仅对已登录用户开放。

## Glossary

- **Deck_Builder**：自定义牌组构建系统，包含前端抽屉 UI、牌组验证逻辑和后端持久化
- **Custom_Deck**：用户自定义构建的牌组，包含召唤师、城门、起始单位、史诗事件、标准事件、冠军单位和普通单位
- **Deck_Drawer**：从屏幕底部向上滑出的抽屉式面板，用于牌组构建交互
- **Faction_Panel**：抽屉左侧的阵营列表面板，展示所有可用阵营
- **Card_Pool_Panel**：抽屉中间的卡牌池面板，展示选中阵营的所有卡牌
- **My_Deck_Panel**：抽屉右侧的我的牌组面板，展示已选卡牌及数量
- **Deck_Symbol**：牌组符号，用于牌组构建验证（每张卡牌至少需要1个符号与召唤师匹配）
- **Faction_Selection_View**：阵营选择界面，玩家在此选择预构筑阵营或自定义牌组
- **Deck_Validation_Engine**：牌组验证引擎，负责校验牌组是否符合构建规则

## Requirements

### Requirement 1: 自定义牌组入口

**User Story:** As a 已登录玩家, I want to 在阵营选择界面看到自定义牌组入口, so that I can 进入牌组构建流程。

#### Acceptance Criteria

1. WHEN Faction_Selection_View 加载完成, THE Faction_Selection_View SHALL 在阵营列表末尾显示一个"自定义牌组"占位卡
2. WHEN 已登录用户点击"自定义牌组"占位卡, THE Deck_Builder SHALL 从屏幕底部向上展开 Deck_Drawer
3. WHEN 未登录用户（游客）查看 Faction_Selection_View, THE Faction_Selection_View SHALL 隐藏"自定义牌组"占位卡
4. WHEN 用户已保存过自定义牌组, THE Faction_Selection_View SHALL 在占位卡上显示已保存牌组数量

### Requirement 2: 抽屉面板布局

**User Story:** As a 玩家, I want to 在抽屉面板中浏览阵营和卡牌, so that I can 方便地挑选卡牌构建牌组。

#### Acceptance Criteria

1. WHEN Deck_Drawer 展开, THE Deck_Drawer SHALL 显示三栏布局：左侧 Faction_Panel、中间 Card_Pool_Panel、右侧 My_Deck_Panel
2. WHEN 用户在 Faction_Panel 中选择一个阵营, THE Card_Pool_Panel SHALL 展示该阵营的所有卡牌（按类型分组：召唤师、冠军、普通、事件）
3. WHEN Card_Pool_Panel 展示卡牌, THE Card_Pool_Panel SHALL 显示每张卡牌的名称、类型、费用和牌组符号
4. WHEN My_Deck_Panel 展示已选卡牌, THE My_Deck_Panel SHALL 显示每张卡牌的名称和已选数量
5. WHEN 用户点击 Deck_Drawer 外部区域或关闭按钮, THE Deck_Drawer SHALL 向下收起并关闭

### Requirement 3: 召唤师选择

**User Story:** As a 玩家, I want to 选择一个召唤师作为牌组核心, so that I can 确定牌组的符号匹配范围。

#### Acceptance Criteria

1. WHEN 用户在 Card_Pool_Panel 中点击一个召唤师卡, THE Deck_Builder SHALL 将该召唤师设为当前牌组的召唤师
2. WHEN 召唤师被选定, THE Deck_Builder SHALL 自动将该召唤师的起始单位和史诗事件加入牌组
3. WHEN 召唤师被选定, THE Deck_Builder SHALL 自动将1个十生命城门和3个五生命城门加入牌组
4. WHEN 用户选择新的召唤师替换已有召唤师, THE Deck_Builder SHALL 清空当前牌组中与旧召唤师绑定的起始单位和史诗事件，并加入新召唤师的对应卡牌
5. WHEN 召唤师被选定, THE Card_Pool_Panel SHALL 对不满足符号匹配规则的卡牌进行视觉标记（灰显）

### Requirement 4: 卡牌添加与移除

**User Story:** As a 玩家, I want to 向牌组中添加和移除卡牌, so that I can 自由构建牌组。

#### Acceptance Criteria

1. WHEN 用户在 Card_Pool_Panel 中点击一张符合符号匹配规则的卡牌, THE Deck_Builder SHALL 将该卡牌添加到 My_Deck_Panel
2. WHEN 用户尝试添加一张不满足符号匹配规则的卡牌, THE Deck_Builder SHALL 拒绝添加并显示提示信息
3. WHEN 用户在 My_Deck_Panel 中点击一张非自动填充的卡牌, THE Deck_Builder SHALL 将该卡牌的数量减少1，数量为0时移除该卡牌
4. WHEN 标准事件卡数量已达到2张上限, THE Deck_Builder SHALL 阻止继续添加同名标准事件卡
5. WHEN 冠军单位数量已达到1张上限, THE Deck_Builder SHALL 阻止继续添加同名冠军单位
6. WHEN 普通单位数量已达到4张上限, THE Deck_Builder SHALL 阻止继续添加同名普通单位

### Requirement 5: 牌组验证

**User Story:** As a 玩家, I want to 在保存前知道牌组是否合法, so that I can 修正不符合规则的牌组。

#### Acceptance Criteria

1. THE Deck_Validation_Engine SHALL 验证牌组包含恰好1个召唤师
2. THE Deck_Validation_Engine SHALL 验证牌组包含恰好1个十生命城门和3个五生命城门
3. THE Deck_Validation_Engine SHALL 验证牌组包含召唤师指定的2个起始单位
4. THE Deck_Validation_Engine SHALL 验证牌组包含召唤师指定的2个史诗事件
5. THE Deck_Validation_Engine SHALL 验证牌组包含恰好6张标准事件
6. THE Deck_Validation_Engine SHALL 验证牌组包含恰好3个冠军单位
7. THE Deck_Validation_Engine SHALL 验证牌组包含恰好16个普通单位
8. THE Deck_Validation_Engine SHALL 验证每张卡牌至少有1个 Deck_Symbol 与召唤师的 Deck_Symbol 匹配
9. WHEN 牌组不满足任一验证规则, THE Deck_Builder SHALL 在 My_Deck_Panel 中显示具体的缺失或超出信息
10. WHEN 牌组满足所有验证规则, THE Deck_Builder SHALL 启用"保存"按钮

### Requirement 6: 牌组持久化

**User Story:** As a 已登录玩家, I want to 保存和管理自定义牌组, so that I can 在未来的对局中使用。

#### Acceptance Criteria

1. WHEN 用户点击"保存"按钮且牌组验证通过, THE Deck_Builder SHALL 将牌组数据发送到后端 API 并持久化到数据库
2. WHEN 牌组保存成功, THE Deck_Builder SHALL 显示成功提示并更新牌组列表
3. WHEN 用户打开 Deck_Drawer, THE Deck_Builder SHALL 从后端 API 加载该用户已保存的牌组列表
4. WHEN 用户选择一个已保存的牌组, THE Deck_Builder SHALL 将牌组内容加载到编辑区域
5. WHEN 用户删除一个已保存的牌组, THE Deck_Builder SHALL 从数据库中移除该牌组并更新列表
6. IF 后端 API 请求失败, THEN THE Deck_Builder SHALL 显示错误提示并保留当前编辑状态

### Requirement 7: 自定义牌组用于对局

**User Story:** As a 玩家, I want to 使用自定义牌组进行对局, so that I can 体验自己构建的牌组策略。

#### Acceptance Criteria

1. WHEN 用户在 Deck_Drawer 中选择一个已保存的合法牌组并确认, THE Faction_Selection_View SHALL 将该自定义牌组标记为玩家的选择
2. WHEN 玩家使用自定义牌组准备就绪, THE Faction_Selection_View SHALL 在玩家状态卡上显示"自定义牌组"标识和召唤师信息
3. WHEN 游戏开始且玩家使用自定义牌组, THE Deck_Builder SHALL 根据自定义牌组数据生成与预构筑牌组相同结构的牌组对象

### Requirement 8: 牌组数据序列化

**User Story:** As a 开发者, I want to 牌组数据能正确序列化和反序列化, so that I can 确保数据在前后端传输和存储中不丢失。

#### Acceptance Criteria

1. THE Deck_Builder SHALL 将 Custom_Deck 序列化为 JSON 格式用于 API 传输和数据库存储
2. THE Deck_Builder SHALL 将 JSON 数据反序列化为 Custom_Deck 对象用于前端展示和游戏初始化
3. FOR ALL 合法的 Custom_Deck 对象, 序列化后再反序列化 SHALL 产生等价的 Custom_Deck 对象（往返一致性）
