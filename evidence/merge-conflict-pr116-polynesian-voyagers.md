# PR #116 波利尼西亚航海者合并冲突裁决证据

## 冲突对象

- PR：#116 `实装 SmashUp 波利尼西亚航海者与图集`
- PR head：`20cb82f26a9af94cb0140da98f086126e81e5752`
- base：`origin/main` at `e002b95055ba354de69e5e0eb43cc9ec47e11c36`
- 合并提交：`167a50381fad382cb6bcefc520cae0f0bde7eec5`

## 真实冲突文件

- `.gitignore`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/abilities/index.ts`
- `src/games/smashup/data/cards.ts`

## 双边内容裁决

- `.gitignore`：保留 main 已有的 Disney、DIY 杀人狂、小丑等资源白名单，并补入波利尼西亚航海者卡牌 PNG/WebP 白名单。
- `src/games/smashup/abilities/index.ts`：保留 main 已有的 Excellent Movies Teens、DIY 杀人狂、小丑、Disney 四派系能力注册，并补入波利尼西亚航海者能力注册。
- `src/games/smashup/data/cards.ts`：保留 main 已有的 Excellent Movies Teens、DIY 杀人狂、小丑、Disney 四派系卡牌/基地注册，并补入波利尼西亚航海者卡牌与基地注册。
- `public/locales/en/game-smashup.json`：以 main 当前双语结构为底，保留 main 已有 Disney、DIY 等文案，补入波利尼西亚航海者 faction、卡牌和基地文案。
- `public/locales/zh-CN/game-smashup.json`：以 main 当前双语结构为底，保留 main 已有 Disney、DIY 等中文文案，补入波利尼西亚航海者 faction、卡牌和基地中文文案。

## 验证

- `git merge-tree --write-tree origin/main 167a50381fad382cb6bcefc520cae0f0bde7eec5`：无冲突输出。
- `git diff --name-only origin/main...167a50381fad382cb6bcefc520cae0f0bde7eec5`：仅保留 #116 的波利尼西亚航海者相关 22 个文件。
- `git diff origin/main 167a50381fad382cb6bcefc520cae0f0bde7eec5 -- .gitignore public/locales/en/game-smashup.json public/locales/zh-CN/game-smashup.json src/games/smashup/abilities/index.ts src/games/smashup/data/cards.ts`：冲突文件相对 main 只新增波利尼西亚航海者接入内容。
- `npx eslint ...`：0 error，2 warning（未使用参数/函数，按项目规则 warning 不阻塞）。
- `npx vitest run src/games/smashup/__tests__/polynesianVoyagersIntake.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`：4 tests passed。
- `npx openspec validate add-smashup-polynesian-voyagers-faction --strict --no-interactive`：通过。
- `npm run i18n:check`：无 missing keys。
- `npx tsc --noEmit --pretty false`：通过。
