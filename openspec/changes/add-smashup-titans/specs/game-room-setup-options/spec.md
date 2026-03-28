## ADDED Requirements

### Requirement: 房间创建必须支持 manifest 声明的多选扩展字段
系统 MUST 允许游戏通过 manifest 声明多选 setup 字段，并在创建房间时以统一 UI 渲染这些字段。

#### Scenario: 多选字段默认全选
- **GIVEN** 某游戏的 manifest 声明了一个多选 setup 字段
- **AND** 该字段未显式给出默认值
- **WHEN** 玩家打开创建房间弹窗
- **THEN** UI 必须默认选中该字段的全部选项

#### Scenario: 已选项必须以可移除标签回显
- **GIVEN** 玩家在创建房间弹窗中选中了一个或多个扩展选项
- **WHEN** UI 渲染该字段的当前值
- **THEN** 每个已选项必须显示为带关闭按钮的标签
- **AND** 点击标签上的关闭按钮后必须立即取消对应选项

#### Scenario: 房主可以关闭全部扩展
- **GIVEN** 某多选 setup 字段的所有选项当前均为已选
- **WHEN** 房主逐项取消所有标签或在下拉面板中取消全部选项
- **THEN** 系统必须允许该字段最终为空数组
- **AND** 不能强制保留至少一个扩展

#### Scenario: 房间创建 payload 必须保留多选字段结果
- **GIVEN** 房主已经在创建房间弹窗中完成 setup 选择
- **WHEN** 客户端提交创建房间请求
- **THEN** `setupData` 必须包含该多选字段对应的字符串数组
- **AND** 游戏初始化必须能够读取该结果
