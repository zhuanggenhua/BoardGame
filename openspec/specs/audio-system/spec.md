# audio-system Specification

## Purpose
TBD - created by archiving change refactor-audio-common-layer. Update Purpose after archive.
## Requirements
### Requirement: 单一通用音频注册表
系统 SHALL 仅从 common 音频配置注册 SFX/BGM，作为所有游戏的唯一音频来源。

#### Scenario: 启动注册
- **WHEN** 系统初始化音频
- **THEN** 仅注册 common 注册表中的音效与 BGM

### Requirement: 通用音效键集合
系统 SHALL 提供稳定的通用 soundKey 集合与分类（如 ui/card/dice/status/token/stinger/system）。

#### Scenario: 查询通用 soundKey
- **WHEN** 任意模块请求通用 soundKey
- **THEN** 必须命中 common 注册表中的定义

### Requirement: 事件音频元数据驱动
系统 SHALL 支持事件携带 audioKey 或 audioCategory，并据此解析并播放对应通用音效。

#### Scenario: 事件携带 audioKey
- **WHEN** 事件包含 audioKey
- **THEN** 系统 MUST 播放对应通用音效

#### Scenario: 事件携带 audioCategory
- **WHEN** 事件包含 audioCategory
- **THEN** 系统 MUST 解析并播放匹配该分类的通用音效

### Requirement: 禁止游戏层音频资产与配置
系统 SHALL 禁止游戏目录包含音频资产或音频配置文件，否则必须阻止启动并给出错误提示。

#### Scenario: 发现游戏层音频文件
- **WHEN** 启动扫描发现 `src/games/<gameId>/audio` 或同等音频配置
- **THEN** 系统 MUST 抛出错误并阻止启动

### Requirement: 统一资源路径约定
系统 SHALL 使用 `/assets/common/audio/<group>/...` 作为音效资源路径规范。

#### Scenario: 播放通用音效
- **WHEN** 系统播放通用音效
- **THEN** 资源路径 MUST 符合统一路径约定

