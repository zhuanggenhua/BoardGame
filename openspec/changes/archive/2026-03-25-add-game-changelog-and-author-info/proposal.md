# Change: add-game-changelog-and-author-info

## Why
游戏详情弹窗原先缺少两类关键内容：当前电子化版本的作者信息，以及这款游戏最近改了什么。后台权限模型也只有 `user/admin` 两档，无法把“只负责若干游戏更新日志的开发者”限制在最小权限范围内。

## What Changes
- 新增按游戏维度发布和读取更新日志的能力：
  - 后台提供 `admin/developer` 可用的游戏更新日志管理页
  - 前台游戏详情弹窗通过独立“更新”标签展示已发布日志
- 将后台角色模型扩展为 `user / developer / admin`，并为 `developer` 增加 `developerGameIds` 范围控制。
- 在用户管理页通过统一角色弹窗设置 `developer` 权限及其可管理游戏；用户详情页展示角色摘要和分配结果。
- 在游戏详情弹窗左侧增加作者信息入口：
  - 作者名来自 `manifest.authorName`
  - 未声明时回退为“佚名”
  - 点击后打开通用作者信息弹窗
- 扩展游戏注册数据结构，向前端注册表暴露 `authorName`，UGC 条目也可从包元数据中带出作者名。

## Impact
- Affected specs:
  - `game-changelog-management`
  - `game-details-content`
  - `game-registry`
- Affected code:
  - `apps/api/src/modules/game-changelog/`
  - `apps/api/src/modules/admin/`
  - `apps/api/src/modules/auth/schemas/user-role.ts`
  - `apps/api/src/modules/auth/schemas/user.schema.ts`
  - `src/App.tsx`
  - `src/pages/admin/GameChangelogs.tsx`
  - `src/pages/admin/Users.tsx`
  - `src/pages/admin/UserDetail.tsx`
  - `src/pages/admin/components/UserRoleModal.tsx`
  - `src/pages/admin/components/AdminLayout.tsx`
  - `src/components/lobby/GameDetailsModal.tsx`
  - `src/components/lobby/GameDetailsChangelogSection.tsx`
  - `src/components/lobby/gameDetailsContent.ts`
  - `src/config/games.config.tsx`
  - `src/games/manifest.types.ts`
