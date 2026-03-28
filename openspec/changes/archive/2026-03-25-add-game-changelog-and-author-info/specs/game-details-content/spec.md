## ADDED Requirements

### Requirement: 游戏详情作者信息入口
系统 SHALL 在游戏详情弹窗中展示电子化作者入口，作者名来自游戏注册表中的 `authorName`，未声明时回退为“佚名”。

#### Scenario: 缺省作者名称回退
- **WHEN** 当前游戏没有声明 `authorName`
- **THEN** 游戏详情弹窗中的作者入口 MUST 显示“佚名”
- **AND** 用户仍然可以点击该入口查看作者信息弹窗

#### Scenario: 点击作者入口打开通用弹窗
- **WHEN** 用户点击游戏详情弹窗中的作者入口
- **THEN** 系统 MUST 打开作者信息弹窗
- **AND** 弹窗 MUST 展示作者名称与当前游戏名称的通用说明

### Requirement: 游戏详情独立更新标签
系统 SHALL 在游戏详情弹窗中提供独立的“更新”标签，用于展示该游戏已发布的更新日志。

#### Scenario: 切换到更新标签
- **WHEN** 用户在游戏详情弹窗中切换到“更新”标签
- **THEN** 系统 MUST 请求该游戏的公开更新日志接口
- **AND** MUST 只渲染已发布日志

#### Scenario: 更新日志为空
- **WHEN** 当前游戏没有任何已发布更新日志
- **THEN** “更新”标签页 MUST 显示空状态说明

#### Scenario: 更新日志加载失败
- **WHEN** 更新日志公开接口请求失败
- **THEN** “更新”标签页 MUST 显示错误状态
- **AND** MUST 记录错误日志
