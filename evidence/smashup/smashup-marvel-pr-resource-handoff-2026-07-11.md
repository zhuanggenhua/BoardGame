# 大杀四方漫威第一波 PR 资源交付记录

## 范围

- 派系：复仇者、神盾局、蜘蛛宇宙、终极战队。
- 资源：用户提供的 `9 x 6` 漫威第一波中文卡牌 atlas。
- 交付口径：不走 R2 上传；通过 PR 把资源、manifest、代码和 evidence 提交给作者。

## 本地资源链

- 原始运行时资源：`public/assets/smashup/cards/marvel_wave_one.png`
- 压缩运行时资源：`public/assets/smashup/cards/compressed/marvel_wave_one.webp`
- 运行时 atlas：`SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_CARDS -> smashup/cards/marvel_wave_one`
- 网格：`6 x 9`
- manifest：`public/assets/smashup/assets-manifest.json`

## 本轮已执行

- `node scripts/assets/compress_images.js public/assets/smashup/cards`
- `node scripts/assets/generate_asset_manifests.js --id smashup`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/avengers.test.ts src/games/smashup/__tests__/abilities/marvel.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`

## 后续回查

- `public/assets/smashup/cards/marvel_wave_one.png` 与 `public/assets/smashup/cards/compressed/marvel_wave_one.webp` 命中仓库现有图片忽略规则，PR 提交时需要显式 `git add -f` 纳入；`public/assets/smashup/assets-manifest.json` 不被忽略。
- PR 合并/作者发布前，不执行 R2 上传和远端 `HEAD 200`。
- PR 合并/作者发布后，再按正式 CDN 路径回查 `cards/compressed/marvel_wave_one.webp`。
