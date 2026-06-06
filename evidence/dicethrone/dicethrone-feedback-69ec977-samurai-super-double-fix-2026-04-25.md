# DiceThrone 反馈修复证据：69ec97789087da2a55c91c17

> 2026-06-05 当前有效口径：本文只保留反馈 `69ec97789087da2a55c91c17` 对应的单问题修复证据，不代表武士整英雄、枪手/武士整批或新英雄整批当前完成态。当前若要判断武士对象级残余或整批发布口径，应以武士单英雄主审计与新英雄总汇总文档为准。

- 反馈内容：武士“三倍抽取”发成了“复制点数”。
- 修复结论：修正 `SAMURAI_COMMON_ATLAS_INDEX` 映射，`atlas 4` 正确发 `card-super-double`。

## 代码变更

- `src/games/dicethrone/domain/commonCards.ts`
- `e2e/src/games/dicethrone/domain/commonCards.ts`
- `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
- `e2e/src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`

## 验证命令

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native -t "samurai atlas 4 应发出 card-super-double，而不是 card-me-too"`

## 验证结果

- 定向用例通过：1 passed / 79 skipped。
- 线上反馈状态已回写为 `resolved`（2026-04-25）。
