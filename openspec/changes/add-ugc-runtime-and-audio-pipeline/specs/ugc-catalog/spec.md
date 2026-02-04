## ADDED Requirements

### Requirement: UGC 包列表与发现
系统 SHALL 提供已发布 UGC 包的列表接口用于首页与分类展示。

#### Scenario: 获取发布列表
- **WHEN** 前端请求 UGC 包列表
- **THEN** 系统 MUST 仅返回已发布的 UGC 包

### Requirement: 全部分类包含 UGC
系统 SHALL 在“全部分类”中展示 UGC 包并跳转到联机入口。

#### Scenario: 全部分类跳转
- **WHEN** 用户从全部分类点击 UGC 包
- **THEN** 系统 MUST 跳转到对应联机入口
