## 1. 后端数据与权限
- [x] 1.1 扩展用户角色枚举、用户模型与用户详情 DTO，支持 `user / developer / admin` 与 `developerGameIds`
- [x] 1.2 新增游戏更新日志模块（schema / dto / service / controller），支持按 `gameId` 过滤与排序
- [x] 1.3 实现公开接口，仅返回某个游戏的已发布更新日志
- [x] 1.4 实现后台 CRUD，并在 `developer` 写接口上校验 `developerGameIds` 范围
- [x] 1.5 补充 API / service 测试，覆盖公开过滤、角色切换、越权拒绝与发布状态切换

## 2. 后台管理界面
- [x] 2.1 在后台侧边栏新增“更新日志”入口，并完成 `admin/developer` 的路由与导航边界控制
- [x] 2.2 实现按游戏筛选的更新日志管理页，支持草稿、发布、撤回发布与删除
- [x] 2.3 在 `Users` 页面提供统一角色设置弹窗，支持角色切换和 `developer` 多游戏分配
- [x] 2.4 在 `UserDetail` 页面只读展示角色摘要和分配结果
- [x] 2.5 `developer` 仅允许进入 `/admin/changelogs`，其余后台页会被拦回更新日志页

## 3. 游戏注册与作者信息
- [x] 3.1 扩展 `GameManifestEntry`，增加可选 `authorName`
- [x] 3.2 前端游戏注册表与 UGC 条目都能暴露 `authorName`
- [x] 3.3 UGC 条目可从包元数据 `author` 回填作者名
- [x] 3.4 本次实现采用通用作者弹窗，不再依赖 `author.tsx` 动态内容模块

## 4. 前台游戏详情弹窗
- [x] 4.1 在 `GameDetailsModal` 左侧增加作者入口，未声明作者名时回退为“佚名”
- [x] 4.2 点击作者入口可打开通用作者信息弹窗
- [x] 4.3 在详情弹窗标签页中新增独立“更新”标签
- [x] 4.4 接入已发布更新日志查询，并提供 loading / empty / error 状态
- [x] 4.5 保持大厅、评论、排行榜标签原有行为不变

## 5. 收尾
- [x] 5.1 相关前后端测试已覆盖关键路径
- [x] 5.2 本 change 已按真实实现口径回填文档
- [x] 5.3 归档前执行 OpenSpec 校验
