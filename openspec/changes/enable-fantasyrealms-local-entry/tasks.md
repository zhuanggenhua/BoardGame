# 启用幻想国度本地入口任务

> 说明：当前仓库里可能已经存在本地入口启用相关的探索实现与验证记录；在 `0.1` 未完成前，它们只能算“草案对应的探索产物”，不能按正式 change 收口。

## 0. Approval Gate
- [x] 0.1 用户明确批准 `enable-fantasyrealms-local-entry` 的范围与边界

## 1. Runtime entry
- [x] 1.1 将 `fantasyrealms` 的 `manifest.enabled` 改为 `true`
- [x] 1.2 更新玩家数与描述文案，使其与当前 2~6 人实现一致

## 2. Verification
- [x] 2.1 更新 manifest integration 测试，验证 registry / loaderMap / runtime load
- [x] 2.2 运行 `openspec validate enable-fantasyrealms-local-entry --strict --no-interactive`
- [x] 2.3 运行 `npx vitest run` 的 fantasyrealms 定向测试集
- [x] 2.4 运行 `npm run generate:manifests`
