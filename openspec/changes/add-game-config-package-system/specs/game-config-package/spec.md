## ADDED Requirements
### Requirement: 游戏配置包作为静态配置真相源
系统 SHALL 提供可复用的游戏配置包能力，用于承载游戏静态事实，包括游戏元数据、派系、卡牌/单位/事件/建筑、牌组构成、起始部署、素材引用和能力绑定。运行时不得直接消费未校验的原始配置文本。

#### Scenario: 加载有效配置包
- **GIVEN** 某个游戏提供符合 schema 的配置包
- **WHEN** 系统加载该配置包
- **THEN** 系统 MUST 完成 schema 校验
- **AND** 输出运行时可消费的强类型配置对象
- **AND** 输出对象 MUST 保留配置包版本与来源信息

#### Scenario: 拒绝无效配置包
- **GIVEN** 某个配置包缺少必填字段、包含重复对象 ID 或字段类型错误
- **WHEN** 系统加载该配置包
- **THEN** 系统 MUST 拒绝该配置包
- **AND** 错误信息 MUST 指向具体对象和字段路径

### Requirement: 官方配置包统一使用严格 JSON
系统 SHALL 将严格 JSON 作为新游戏配置包的官方仓库真相源。JSONC、YAML、XLSX 或现有 TypeScript 配置只能通过导入工具或旧游戏只读 adapter 转换为配置包视图，而不是进入运行时默认解析链路。

#### Scenario: 文本配置作为官方真相源
- **WHEN** 新游戏提供官方静态配置
- **THEN** 系统 MUST 使用 schema 化严格 JSON 作为仓库真相源
- **AND** 该真相源 MUST 可被 Git diff 和代码审查直接检查

#### Scenario: 非 JSON 格式作为导入导出格式
- **WHEN** 用户或开发者通过 JSONC、YAML 或 XLSX 导入配置
- **THEN** 系统 MUST 先将内容转换为严格 JSON 配置包结构后再校验
- **AND** 系统 MUST NOT 将 JSONC、YAML 或 XLSX 文件作为官方仓库真相源或运行时唯一真相源

#### Scenario: 现有代码配置渐进接入
- **GIVEN** 某个现有游戏仍使用 TypeScript 配置对象
- **WHEN** 该游戏接入配置包系统
- **THEN** 系统 MAY 提供只读 adapter 将现有配置物化为配置包视图
- **AND** 该 adapter MUST NOT 要求一次性迁移原游戏全部配置源

### Requirement: 表格审查视图必须与运行时同源
系统 SHALL 从配置包物化结果生成表格审查视图，使玩家看到的配置与运行时实际使用的配置同源。

#### Scenario: 玩家查看单位表格
- **GIVEN** 某个游戏的配置包已加载成功
- **WHEN** 玩家打开配置审查表
- **THEN** 表格 MUST 展示该游戏当前可运行配置中的单位、事件、建筑或等价对象
- **AND** 表格数据 MUST 来自配置包物化结果

#### Scenario: 防止展示数据分叉
- **GIVEN** 某个对象在运行时配置中发生变化
- **WHEN** 系统重新生成表格审查视图
- **THEN** 表格 MUST 反映同一份配置源的变化
- **AND** 系统 MUST NOT 维护一份独立的仅展示用卡牌配置

### Requirement: 特殊效果通过能力绑定到代码实现
系统 SHALL 允许配置包声明能力 ID 与参数，但特殊效果的执行 MUST 由代码中的能力或规则 Module 实现。

#### Scenario: 能力绑定成功
- **GIVEN** 配置包中的某张卡声明 `abilityId` 和参数
- **WHEN** 系统校验并物化该配置包
- **THEN** 系统 MUST 验证该 `abilityId` 存在
- **AND** 系统 MUST 验证参数符合该能力的参数合同
- **AND** 运行时 MUST 通过能力注册表或等价 Module 解析实际行为

#### Scenario: 能力缺少代码实现
- **GIVEN** 配置包声明了一个需要代码支持但未实现的能力
- **WHEN** 系统加载配置包
- **THEN** 系统 MUST 报告该能力未实现
- **AND** 表格审查视图 MUST 能显示该对象需要代码支持

#### Scenario: 禁止玩家提交可执行代码
- **WHEN** 玩家提交配置修正提案
- **THEN** 系统 MUST NOT 接受任意可执行规则代码作为配置值
- **AND** 玩家提案只能修改 schema 允许的字段或建议能力绑定

### Requirement: 玩家配置修正提案复用反馈式体验
系统 SHALL 允许玩家从配置表格中提交结构化配置修正提案，并以类似反馈的方式保存、展示和流转。

#### Scenario: 提交字段级修正
- **GIVEN** 玩家在配置表格中发现某个字段实现不正确
- **WHEN** 玩家提交修正
- **THEN** 系统 MUST 保存游戏 ID、配置版本、对象 ID、字段路径、当前值、建议值、说明和可选证据
- **AND** 该提案 MUST 进入待审状态

#### Scenario: 提案保留上下文
- **WHEN** 系统保存配置修正提案
- **THEN** 提案 MUST 保留提交来源页面、语言环境和相关对象上下文
- **AND** 审查者 MUST 能从提案回到对应配置表格位置

### Requirement: AI 审查配置修正提案
系统 SHALL 支持对玩家配置修正提案进行 AI 首轮审查，并将审查结论作为提案状态和后续人工处理依据。

#### Scenario: AI 建议接受
- **GIVEN** 玩家提交的建议值与配置 schema、规则证据和现有实现一致
- **WHEN** AI 审查完成
- **THEN** 系统 MUST 将提案标记为建议接受
- **AND** 审查结果 MUST 说明它依据的配置字段与规则证据

#### Scenario: AI 认为需要代码支持
- **GIVEN** 玩家提案涉及当前没有实现的特殊效果
- **WHEN** AI 审查完成
- **THEN** 系统 MUST 将提案标记为需代码支持
- **AND** 审查结果 MUST 说明该提案不能仅通过配置修改完成

#### Scenario: AI 不直接合入官方配置
- **WHEN** AI 对配置修正提案给出建议接受
- **THEN** 系统 MUST NOT 自动修改官方配置真相源
- **AND** 正式合入 MUST 继续经过人工确认或正式发布流程

### Requirement: 新游戏默认使用配置包系统
系统 SHALL 要求新游戏的静态配置默认通过配置包系统建模；如果跳过，proposal 或 design 必须说明原因、影响和后续补齐计划。

#### Scenario: 新游戏声明配置包
- **WHEN** 新游戏建立 OpenSpec foundation change
- **THEN** proposal 或 design MUST 说明该游戏的静态配置是否使用配置包系统
- **AND** 使用配置包时 MUST 声明数据源格式、schema 和表格审查范围

#### Scenario: 新游戏临时跳过配置包
- **WHEN** 新游戏因范围或技术限制暂不使用配置包系统
- **THEN** proposal 或 design MUST 记录跳过原因
- **AND** tasks MUST 记录后续迁移或补齐项

### Requirement: 现有游戏接入配置包必须是显式选择
系统 SHALL 允许现有游戏继续沿用当前配置方案；接入配置包系统、建立只读 adapter 或迁移官方配置源必须是该游戏后续任务中的显式选择。

#### Scenario: 现有游戏保持当前方案
- **GIVEN** 某个现有游戏已经有可运行的静态配置方案
- **WHEN** 系统新增配置包能力
- **THEN** 该游戏 MUST NOT 被要求立即迁移
- **AND** 该游戏当前运行时 MUST 不因配置包能力缺失而失效

#### Scenario: 现有游戏选择接入审查表
- **GIVEN** 某个现有游戏明确需要统一配置审查表或结构化修正提案
- **WHEN** 该游戏建立接入任务
- **THEN** proposal 或 tasks MUST 说明接入范围
- **AND** 接入可以使用只读 adapter，而不要求同时迁移官方配置真相源
