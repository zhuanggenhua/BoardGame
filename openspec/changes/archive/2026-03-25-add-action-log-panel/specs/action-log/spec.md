# action-log Specification

## Purpose
提供跨游戏统一的玩家可读操作日志能力，记录公开领域行为并支持悬浮球面板展示。

## ADDED Requirements

### Requirement: 操作日志记录
系统 SHALL 将可记录的领域操作写入 `G.sys.actionLog.entries`。

#### Scenario: 记录可撤回操作
- **GIVEN** 命令类型在共享 allowlist 内
- **WHEN** 命令执行
- **THEN** 系统追加一条日志，包含时间戳、执行者与可读片段

### Requirement: 公开信息限制
系统 SHALL 仅记录公开信息，不得暴露手牌、隐藏资源等私密数据。

#### Scenario: 私有信息被过滤
- **GIVEN** 操作包含私有数据
- **WHEN** 生成日志条目
- **THEN** 日志仅包含公开摘要，不包含私有细节

### Requirement: 与撤回共享白名单
系统 SHALL 使用与撤回相同的 allowlist，确保“可撤回 == 可记录”。

#### Scenario: 非 allowlist 命令不记录
- **GIVEN** 命令类型不在 allowlist 内
- **WHEN** 命令执行
- **THEN** 系统不生成日志条目

### Requirement: 撤回回滚一致性
系统 SHALL 将操作日志存储于对局状态，并随撤回回滚。

#### Scenario: 撤回后日志回退
- **GIVEN** 玩家撤回成功
- **WHEN** 状态回滚到旧快照
- **THEN** 日志与快照保持一致

### Requirement: 卡牌预览片段
系统 SHALL 支持卡牌预览片段，且预览只允许引用卡牌定义的 `assets.image/atlasIndex`。

#### Scenario: 卡牌预览来自卡牌资源
- **GIVEN** 日志条目引用卡牌
- **AND** 卡牌定义包含 `assets.image` 或 `assets.atlasIndex`
- **WHEN** 生成日志
- **THEN** 日志片段包含对应的资源引用以供预览

### Requirement: 悬浮球日志面板
系统 SHALL 在 GameHUD 悬浮球中提供操作日志入口，展示最近日志。

#### Scenario: 展示最新 50 条日志
- **GIVEN** 操作日志存在
- **WHEN** 玩家打开日志面板
- **THEN** 系统显示最近 50 条日志（默认上限）
