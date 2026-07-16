# PR #99 合并冲突审计：origin/main -> codex/smashup-international-incident-pr

- 时间：2026-07-15
- 执行目录：`temp/pr-99-merge-fix`
- PR head：`5d4dfdfe784243aaae03c2d91ad147197c3460e7`
- 合入 main：`e108fa795d6bdb9261849f63ca72ea96da0882ea`

## 冲突范围

- `.gitignore`
- `public/assets/i18n/assets-manifest.json`
- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/__tests__/FactionSelection.variantLock.test.tsx`
- `src/games/smashup/abilities/index.ts`
- `src/games/smashup/abilities/ongoing_modifiers.ts`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/domain/events.ts`
- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/reduce.ts`
- `src/games/smashup/domain/types.ts`

## 裁决结论

- `.gitignore`：保留国际事件资源例外，同时保留 Promo、《我们到底在想什么？》和文化冲击资源例外；国际事件注释改为“正式发布走服务器素材主源回查”，不再沿用 R2 回查口径。
- 资源 manifest 与本地化 JSON：以 main 为底深合并 #99 国际事件新增 key，保留 Promo、文化冲击、《我们到底在想什么？》和国际事件四组内容。
- `FactionSelection.variantLock.test.tsx`：保留 main 对文化冲击实施中派系的断言，继续允许 #99 新增实施中派系通过 `arrayContaining` 排序测试。
- `abilities/index.ts`：同时注册国际事件、《我们到底在想什么？》和文化冲击四派系能力/交互处理器。
- `ongoing_modifiers.ts`：同时保留国际事件的骑警/摔角手力量修正，以及《我们到底在想什么？》的摇滚明星/泰迪熊修正。
- `data/cards.ts` 与 `atlasCatalog.ts`：同时注册国际事件和 main 已合入派系的卡牌、基地与图集入口。
- `events.ts`、`reduce.ts`、`types.ts`：保留 main 的行动牌定义本回合阻止事件，同时保留 #99 基地 metadata 更新链路。
- `ids.ts`：同时保留国际事件四派系、摇滚明星/泰迪熊/外婆/探险家和相关 atlas id / 中文展示名。

## 验证

- JSON parse：`public/assets/i18n/assets-manifest.json`、`public/assets/i18n/zh-CN/smashup/assets-manifest.json`、`public/locales/en/game-smashup.json`、`public/locales/zh-CN/game-smashup.json` 解析通过。
- 定向 Vitest：`international-incident.test.ts`、`internationalIncidentResourceContract.test.ts`、`criticalImageResolver.test.ts`、`FactionSelection.variantLock.test.tsx` 共 73 个用例通过。
- `npm run i18n:check`：通过，无缺失本地化 key。
- `npm run assets:validate`：通过，`public/assets/i18n/assets-manifest.json` 增量校验通过。
