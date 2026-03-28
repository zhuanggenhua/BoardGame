# game-asset-preloading Specification (delta)

## ADDED Requirements
### Requirement: 关键图片门禁
系统 SHALL 在进入内置游戏对局前完成关键图片预加载，并在完成前显示加载界面。

#### Scenario: 内置游戏进入对局
- **WHEN** 用户进入内置游戏对局页面
- **THEN** 系统 MUST 在关键图片加载完成前显示 LoadingScreen，并在完成后渲染棋盘

### Requirement: 暖加载后台预取
系统 SHALL 在关键图片加载完成后以非阻塞方式预取暖资源图片。

#### Scenario: 进入对局后加载暖资源
- **WHEN** 关键图片预加载完成
- **THEN** 系统 MUST 在后台开始暖资源加载且不阻塞对局渲染

### Requirement: 动态关键图解析器
系统 SHALL 允许游戏注册动态解析器以基于对局状态输出关键/暖图片列表，并与清单静态列表合并。

#### Scenario: 动态解析器返回列表
- **WHEN** 游戏注册解析器且对局状态可用
- **THEN** 系统 MUST 使用解析器输出并合并静态清单生成最终预加载列表

### Requirement: 失败容忍与降级
系统 SHALL 在单个图片加载失败时继续进入对局，并在解析器不可用时退回仅使用静态清单。

#### Scenario: 单张图片加载失败
- **WHEN** 关键图片预加载中出现单个资源失败
- **THEN** 系统 MUST 继续完成门禁流程并允许进入对局

#### Scenario: 解析器不可用
- **WHEN** 游戏未注册解析器或解析器执行失败
- **THEN** 系统 MUST 仅使用清单静态列表继续预加载流程

### Requirement: UGC 对局跳过门禁
系统 SHALL 对 UGC 对局跳过关键图片门禁，仅保持现有加载流程。

#### Scenario: 进入 UGC 对局
- **WHEN** 用户进入 UGC 对局页面
- **THEN** 系统 MUST 不阻塞对局渲染并沿用现有加载流程
