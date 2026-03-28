## Context
本变更落地的是三条相互关联的链路：
- 后台按游戏管理更新日志
- `developer` 角色按被分配的游戏范围受限访问后台
- 前台游戏详情弹窗展示作者信息与已发布更新日志

旧提案里曾考虑“作者详情来自 `author.tsx` 动态模块”“排行榜页内双栏并排展示日志”等方案，但当前代码已经采用更轻量、实现更稳定的版本，需要以现实实现为准归档。

## Goals / Non-Goals
- Goals
  - 为每个游戏提供公开可读的已发布更新日志
  - 让 `developer` 只管理自己负责的游戏日志
  - 在游戏详情弹窗展示作者入口与更新日志入口
  - 让游戏注册表显式暴露作者名
- Non-Goals
  - 不引入富文本作者资料模块或 `author.tsx` 动态注入机制
  - 不把更新日志和排行榜强制做成同一页双栏布局

## Decisions
- 后端新增 `game-changelog` 模块：
  - 公开接口 `GET /game-changelogs/:gameId` 仅返回已发布日志
  - 后台接口 `admin/game-changelogs` 支持列表、创建、更新、删除
  - 日志支持 `published`、`pinned`、`publishedAt`
- 后台角色模型升级为 `user / developer / admin`：
  - `admin` 拥有完整后台能力
  - `developer` 只允许访问 `/admin/changelogs`
  - `developerGameIds` 控制其可管理的 `gameId` 范围
- 用户管理入口采用统一角色弹窗完成授权和范围分配，用户详情页只读展示结果。
- 游戏详情弹窗集成方式：
  - 左侧操作区增加作者名入口
  - 右侧标签页增加独立“更新”标签
  - 更新日志区通过公开接口按游戏加载，并提供 loading / empty / error 状态
- 作者信息来源统一为 `manifest.authorName`：
  - 普通游戏直接从 manifest 读取
  - UGC 游戏从包元数据 `author` 回填到注册表
  - 作者弹窗展示通用说明，不再依赖游戏目录下的可选作者详情模块

## Risks / Trade-offs
- 相比富文本作者模块，当前作者弹窗更轻量，信息表达有限，但能稳定覆盖所有游戏并避免额外内容维护成本。
- `developer` 角色引入后，后台路由和接口鉴权边界更复杂，需要同时覆盖前后端限制。

## Migration Plan
1. 上线用户角色模型与 `developerGameIds`
2. 上线游戏更新日志后端模块与后台管理页
3. 前台游戏详情弹窗接入作者入口与更新日志标签
4. 注册表补齐 `authorName` 暴露与 UGC 回填

## Open Questions
- 无
