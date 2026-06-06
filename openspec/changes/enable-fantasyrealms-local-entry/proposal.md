# Change: 启用幻想国度本地入口

## Why
- `fantasyrealms` 当前已经具备 2~6 人运行时、官方计分与多人基础版流程，但 `manifest.enabled` 仍为 `false`，导致它不能进入大厅 registry 或客户端 loaderMap。
- 这会让当前实现继续停留在“代码存在但项目里进不去”的状态，和现阶段的实现成熟度不匹配。
- 既然本地模式已经可运行，下一步就应该把它作为一个可进入的本地游戏入口接起来。

## What Changes
- 新增 `fantasyrealms-runtime-entry` capability，正式启用 `fantasyrealms` 本地入口。
- 将 `fantasyrealms` 的 `manifest.enabled` 改为 `true`。
- 更新文案与玩家数描述，使其与当前 2~6 人运行时一致。
- 更新 manifest integration 测试，验证：
  - 已进入大厅 registry
  - 已进入客户端 loaderMap
  - `loadGameImplementation('fantasyrealms')` 可返回运行时模块

## Impact
- Affected specs:
  - 新增 `fantasyrealms-runtime-entry`
- Affected code:
  - `src/games/fantasyrealms/manifest.ts`
  - `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
  - `public/locales/zh-CN/common.json`
  - `public/locales/en/common.json`
  - `design-system/games/fantasyrealms.md`
  - `evidence/fantasyrealms/**`

## Scope Notes
- 本 change 只启用本地入口，不在这一轮接入 AI、教程或逐卡中文文案。
