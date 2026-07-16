# #96 合并主线冲突审计

## 对象

- PR：#96 `[codex] 实装绵羊与全明星 Promo 派系`
- head：`codex/smashup-promos-sheep-all-stars-pr`
- base：`origin/main`
- 冲突解析提交：`70fd786cfd5c99d46c1134930c2f3644985c87de`
- PR 合并提交：`8a3fe7fb2151460ac9ef64850f448af8043b221d`
- 执行位置：`temp/pr-96-merge-fix`

## 冲突范围

本次同步主线时出现 5 个真实冲突：

- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/__tests__/FactionSelection.variantLock.test.tsx`
- `src/games/smashup/__tests__/criticalImageResolver.test.ts`

## 裁决

- 保留 #96 的绵羊与全明星 Promo 派系、卡图资源、BASE4 基地图集引用、双语文案和资源清单条目。
- 保留主线已合入的文化冲击四派系、文化冲击卡图、波利尼西亚航海者基地 atlas、双语文案和资源清单条目。
- JSON 资源清单与 locale 文件按对象键递归合并；双方新增 key 均保留，没有删除单边独有内容。
- `FactionSelection.variantLock.test.tsx` 保留“实施中派系统一排到末尾”的动态排序断言，并把老四派与文化冲击四派列为必含实施中派系，允许 #96 新增实施中派系继续排到末尾。
- `criticalImageResolver.test.ts` 拆成两个独立用例，分别覆盖 Promo 绵羊/全明星资源预热与文化冲击资源预热，避免二选一覆盖。

## 验证

- `node -e "JSON.parse(...)"` 验证 `public/assets/i18n/zh-CN/smashup/assets-manifest.json`、`public/locales/zh-CN/game-smashup.json`、`public/locales/en/game-smashup.json` 均可解析。
- `node ..\..\node_modules\vitest\vitest.mjs run src/games/smashup/__tests__/FactionSelection.variantLock.test.tsx src/games/smashup/__tests__/criticalImageResolver.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1 --passWithNoTests`：25 tests passed。
- `npm run i18n:check`：no missing keys detected。
- `npm run assets:validate`：incremental manifest 校验通过。