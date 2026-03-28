# mobile-support-framework Specification

## Purpose
TBD - created by archiving change add-pc-first-mobile-adaptation-framework. Update Purpose after archive.
## Requirements
### Requirement: manifest 驱动的移动支持解析
系统 SHALL 基于游戏 manifest 的移动端元数据统一解析移动支持配置，而不是让页面层自行猜测。

#### Scenario: 运行时归一化移动支持配置
- **GIVEN** 某个游戏只声明了部分移动端字段
- **WHEN** 运行时解析该游戏的移动支持配置
- **THEN** 系统 MUST 返回归一化后的 `mobileProfile`、`preferredOrientation`、`mobileLayoutPreset` 和 `shellTargets`

### Requirement: 对局页暴露统一的移动支持数据属性
系统 SHALL 在游戏对局页根节点暴露统一的数据属性，供方向提示、布局壳层和 CSS 兜底消费。

#### Scenario: 在线或本地对局页渲染
- **GIVEN** 用户进入任意游戏对局页
- **WHEN** 页面根节点渲染
- **THEN** 系统 MUST 输出 `data-game-page`
- **AND** 当存在游戏 manifest 时，系统 MUST 输出与移动支持配置对应的数据属性

### Requirement: 通用方向提示基于 manifest 生效
系统 SHALL 基于 manifest 与当前 viewport 判断是否展示横竖屏提示或不支持提示。

#### Scenario: 横屏游戏在手机竖屏中打开
- **GIVEN** 某个游戏声明 `preferredOrientation = 'landscape'`
- **WHEN** 用户在手机竖屏中打开该游戏页
- **THEN** 系统 MUST 显示旋转到横屏的提示

#### Scenario: 未适配手机的游戏在手机中打开
- **GIVEN** 某个游戏声明 `mobileProfile = 'none'`
- **WHEN** 用户在手机视口中打开该游戏页
- **THEN** 系统 MUST 显示当前不推荐手机端的提示

### Requirement: 通用 board-shell 容器承接移动端外层布局
系统 SHALL 提供通用的 board-shell 容器，用于承接游戏主体之外的顶部、侧边和底部区域，而不是要求游戏重写独立移动端 Board。

#### Scenario: 对局页使用通用壳层
- **GIVEN** 游戏页需要在移动端继续复用现有 Board 主体
- **WHEN** 页面渲染通用壳层
- **THEN** 系统 MUST 允许通过统一容器承接顶部 rail、侧边 dock 和底部 rail
- **AND** 游戏主体 Board MUST 仍可作为壳内主画布渲染

### Requirement: board-shell 缩放仅作为条件化兜底
系统 SHALL 仅在符合 board-shell 条件时启用缩放兜底，不得把全局缩放当作移动适配完成的判断标准。

#### Scenario: 横屏 board-shell 页面启用缩放兜底
- **GIVEN** 某个游戏声明 `mobileProfile = 'landscape-adapted'` 且 `mobileLayoutPreset = 'board-shell'`
- **WHEN** 用户在手机横屏视口中打开该页面
- **THEN** 系统 MAY 启用 board-shell 缩放兜底
- **AND** 该兜底 MUST 不影响非 board-shell 页面

