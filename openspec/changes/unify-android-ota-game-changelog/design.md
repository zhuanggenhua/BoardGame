## Context

网页读取后台 `/game-changelogs/:gameId`；OTA 目前独立生成提交摘要。已有 `publish-game-changelog.mjs` 可从本机环境变量或隐藏交互读取账号，并通过后台权限接口写入同一日志库。完整部署由本机 `deploy-and-ota.mjs` 编排，因此不需要把后台凭据传入 GitHub Actions。

## Goals / Non-Goals
- Goals: 完整部署时可选写入玩家可见更新日志；同一文案同时用于 OTA；保留现有权限与过滤规则。
- Non-Goals: 改产品版本、OTA 强更策略、网页日志 UI 或引入第二套日志存储。

## Decisions
- 决策：仅完整部署流程接入可选日志；使用现有游戏更新日志 API 和发布脚本，不新增日志模型或公开入口。
- 决策：完整部署入口接收可选 JSON 文案文件，每个游戏一条标题、版本和正文；由部署审查判断是否存在玩家可感知内容，有价值时发布网页记录，并将完全相同的标题与正文传入 OTA manifest `notes`。
- 决策：完整部署没有可公开内容时不生成网页日志，OTA manifest `notes` 留空；独立 OTA 手动工作流继续按提交生成说明。
- 决策：文案沿用网页风格，使用一句概述和少量分类要点；过滤内部工作和实施中游戏。无值得公开内容时跳过日志发布。
- 决策：复用本机 `BG_CHANGELOG_ACCOUNT` / `BG_CHANGELOG_PASSWORD` 等现有配置，缺少时使用发布脚本的隐藏交互输入；不将凭据传给 CI。存在可公开日志时必须明确设置 `--changelog-api-base-url`、`BG_CHANGELOG_API_BASE_URL` 或 `VITE_BACKEND_URL`，禁止静默回退到 localhost。
- 决策：只把已公开的相同日志视为重复记录；同文案草稿不能阻止部署创建公开记录。完整部署不允许 `ota-extra` 覆盖共享 `notes`。
- 决策：网页记录发布失败时停止本次 OTA，明确报告服务器已部署、OTA 未启动；可重试时依赖现有重复检查避免重复记录。
- 决策：仅对非空 `entries` 发布；跳过实施中游戏，未知游戏、重复游戏或无效文案在部署前报错。部署成功后才写入网页日志，避免服务器部署失败时留下未对应的公开记录。

## Risks / Trade-offs
- 本机未配置日志账号时，完整部署会在日志发布步骤要求交互输入；非交互执行需提前配置本机环境变量。
- 后台日志与 OTA 清单位于不同存储；网页记录写入后若 OTA 构建或上传失败，PC 页面会先显示该记录，需在交付汇报中区分两端状态。

## Migration Plan
先扩展部署入口传递可选日志内容，再通过一次有价值的 stable 更新部署验证网页记录和 Android manifest 内容一致；不含玩家可见更新时验证跳过路径。

## Open Questions
- 无
