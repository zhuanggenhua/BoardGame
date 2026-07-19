## ADDED Requirements
### Requirement: 自动生成并发布游戏更新日志
系统 SHALL 提供一个协作者可运行的自动化入口，根据 git 改动生成游戏更新日志，并通过现有后台权限模型发布。

#### Scenario: 从提交范围识别游戏并生成日志
- **WHEN** 协作者运行自动更新日志工具且提交范围包含一个或多个游戏目录、游戏 E2E、游戏文档、游戏本地化或游戏资源改动
- **THEN** 工具 MUST 识别受影响的 `gameId`
- **AND** 工具 MUST 为每个受影响游戏生成包含修复、新增、优化或调整分组的玩家可见更新日志草稿
- **AND** 工具 MUST 默认过滤测试、验证、规范、审计、提交门禁等内部工作说明，不把它们写进玩家公开日志正文

#### Scenario: 玩家公开日志默认排除实施中游戏
- **WHEN** 自动更新日志工具识别到 `manifest.ts` 标记为 `statusTag: 'under_construction'` 的游戏
- **THEN** 工具 MUST 默认跳过该游戏，不为玩家公开更新日志创建记录
- **AND** 工具 MUST 在输出中说明被跳过的实施中游戏
- **AND** 只有协作者显式传入 `--include-under-construction` 时，工具 MAY 为实施中游戏生成日志

#### Scenario: 使用现有后台接口发布
- **WHEN** 协作者确认发布自动生成的更新日志
- **THEN** 工具 MUST 先通过 `/auth/login` 获取登录令牌
- **AND** 工具 MUST 调用 `/admin/game-changelogs` 创建日志
- **AND** 后台 MUST 继续执行现有 `admin` / `developer` 权限与开发者游戏范围校验

#### Scenario: 凭据来自环境变量或交互输入
- **WHEN** 自动更新日志工具需要后台账号与密码
- **THEN** 工具 MUST 优先读取环境变量配置
- **AND** 如果缺少凭据且当前终端支持交互输入，工具 MUST 询问协作者补充
- **AND** 工具 MUST 不把密码写入仓库或输出到日志

#### Scenario: 预览模式不写入后台
- **WHEN** 协作者以 dry-run 模式运行自动更新日志工具
- **THEN** 工具 MUST 输出将要创建的日志内容
- **AND** 工具 MUST 不登录后台
- **AND** 工具 MUST 不创建或修改任何更新日志记录
