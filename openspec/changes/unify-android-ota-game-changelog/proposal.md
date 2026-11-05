# Change: 部署时复用网页更新日志到 Android OTA

## Why
Android OTA 目前从 Git 提交标题生成 `notes`，PC 网页则读取后台游戏更新日志。完整更新部署时应判断本次是否有玩家可感知的更新；有价值时写入网页已有日志，并让 OTA 展示同一内容。

## What Changes
- 完整更新部署流程增加可选更新日志环节：有玩家价值时，通过现有发布工具写入网页日志库，并把同一段精简文案传给 OTA。
- 无值得公开的游戏更新时跳过网页日志，完整部署的 OTA 更新说明留空；独立 OTA 流程维持当前行为。
- 文案沿用网页日志样式，参考“一句概述 + 少量分类要点”，过滤测试、规范、审计等内部内容及实施中游戏。
- 发布使用现有本机环境凭据或隐藏交互输入，不新增 GitHub 后台账号 Secrets；存在可公开日志时须明确配置 API 地址，不能静默写入 localhost。
- OTA 与网页日志共用唯一文案来源，禁止 `ota-extra` 覆盖部署日志；重复检查只跳过已公开的记录。

## Impact
- Affected specs: `game-changelog-management`
- Affected code: `.spec/skills/deploy-after-ci/SKILL.md`, `.spec/skills/deploy-after-ci/scripts/deploy-prod.ps1`, `scripts/release/deploy-and-ota.mjs`, `scripts/release/publish-game-changelog.mjs`, `scripts/release/deployment-game-changelog.mjs`, `.github/workflows/android-ota-publish.yml`, `scripts/mobile/android-ota-release-notes.mjs`, `scripts/mobile/publish-android-ota.mjs`, `scripts/mobile/release-android.mjs`
