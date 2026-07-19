# Change: 自动发布游戏更新日志

## Why
游戏 bug 修复和功能更新已经有后台更新日志能力，但提交 / push 后仍需要人工整理日志，容易漏发或写不清楚本次影响的游戏。

## What Changes
- 新增自动发布工具：从 git 提交范围识别受影响游戏，并生成 Steam 风格、面向玩家的更新日志内容。
- 通过现有 `/auth/login` 登录，再调用现有 `/admin/game-changelogs` 创建日志，不绕过后台权限。
- 支持 env 配置后台账号密码；缺失时在交互式终端询问，便于协作者使用。
- 支持 dry-run、手动指定游戏、标题、版本号、发布状态和提交范围。
- 玩家公开日志默认排除 `statusTag: 'under_construction'` 的实施中游戏，避免把高频迭代内容推给玩家。
- 玩家公开日志默认过滤测试、验证、规范、审计和提交门禁等内部工作说明。

## Impact
- Affected specs: `game-changelog-management`
- Affected code: `scripts/release/publish-game-changelog.mjs`, `scripts/release/push-with-changelog.mjs`, `package.json`, `.env.example`
