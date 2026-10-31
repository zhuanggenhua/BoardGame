# 文化冲击四派系 - PR 资源就绪证据（2026-07-14，2026-07-15 更新）

## 当前结论

- 阿南西传说、格林童话、俄罗斯童话、古代印加人共用的文化冲击卡牌图集已经落到仓库正式 i18n 资源树，并生成压缩 WebP。
- 四派系与波利尼西亚人批次共用的文化冲击基地 atlas 当前采用唯一运行时合同：`SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_BASES` → `smashup/base/polynesian_voyagers/atlas`。
- 本轮已把这组正式图片加入 `.gitignore` 精确白名单；它们现在会作为未跟踪文件显示，可随 PR 提交。
- 当前结论等级：**本地 PR 资产链已就绪；2026-10-23 只读复核确认两个运行时 WebP 和四条 Culture Shock manifest 记录在公网与本地一致。**

## 本地 PR 资产

| 对象 | 本地路径 | SHA-256 | 状态 |
| --- | --- | --- | --- |
| 文化冲击卡牌 atlas PNG | `public/assets/i18n/zh-CN/smashup/cards/culture_shock/atlas.png` | `5ca8838ed9c57f1a53c2c864837e56d2279ece101e1fe39e74be74828b61f08e` | Git 可见，PR 可带入 |
| 文化冲击卡牌 atlas WebP | `public/assets/i18n/zh-CN/smashup/cards/culture_shock/compressed/atlas.webp` | `d01093a8789e0f49a97071afe6ea8992308bc54ce679993191066612c6d97c7a` | Git 可见，运行时压缩资源 |
| 文化冲击共享基地 atlas PNG | `public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/atlas.png` | `253dda49b347392e8657fdb2cda21a7b6ea4cfa667421e44b821d38756c6e0be` | Git 可见，PR 可带入 |
| 文化冲击共享基地 atlas WebP | `public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/compressed/atlas.webp` | `31f4179b388ed1063b20c65f9cb6c5eeb95474b352321fac756939712fa468b0` | Git 可见，运行时压缩资源 |

## Manifest 与预加载合同

- 根级 manifest 已包含：
  - `zh-CN/smashup/cards/culture_shock/atlas`
  - `zh-CN/smashup/cards/culture_shock/compressed/atlas`
  - `zh-CN/smashup/base/polynesian_voyagers/atlas`
  - `zh-CN/smashup/base/polynesian_voyagers/compressed/atlas`
- 游戏级 manifest 已包含：
  - `cards/culture_shock/atlas`
  - `cards/culture_shock/compressed/atlas`
  - `base/polynesian_voyagers/atlas`
  - `base/polynesian_voyagers/compressed/atlas`
- `criticalImageResolver` 已由派系静态数据反查到文化冲击卡牌 atlas 和共享基地 atlas；playing 阶段只预热一次，不重复拉同一张图。

## 本轮验证

| 命令 | 结果 |
| --- | --- |
| `node -e "...culture shock asset hashes and manifest entries verified"` | PASS，四个文化冲击图片 SHA-256 与根级 / 游戏级 manifest 条目精确校验通过 |
| `npm run assets:validate` | BLOCKED，既有 `atlas-configs/dicethrone/ability-cards-gunslinger.atlas.json` hash / bytes 不一致；非文化冲击新增资源 |
| `npx vitest run src/games/smashup/__tests__/cultureShockFourFactionsIntegration.test.ts --configLoader native` | PASS，6 tests |
| `npx vitest run src/games/smashup/__tests__/criticalImageResolver.test.ts --configLoader native` | PASS，12 tests |
| `npx tsc --noEmit --pretty false` | PASS |
| `npx openspec validate add-smashup-culture-shock-four-factions --strict --no-interactive` | PASS |
| `npx vitest run src/games/smashup/__tests__/abilities/anansi-tales.test.ts src/games/smashup/__tests__/abilities/grimms-fairy-tales.test.ts src/games/smashup/__tests__/abilities/russian-fairy-tales.test.ts src/games/smashup/__tests__/abilities/ancient-incas.test.ts src/games/smashup/__tests__/cultureShockFourFactionsIntegration.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts --configLoader native` | PASS，6 files / 70 tests |
| `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-culture-shock-anansi.e2e.ts` | PASS，2 tests |
| `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-culture-shock-grimms.e2e.ts` | PASS，2 tests |
| `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-culture-shock-russian.e2e.ts` | PASS，2 tests |
| `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-culture-shock-ancient-incas.e2e.ts` | PASS，2 tests |
| `node scripts/assets/upload-to-r2.js --only public/assets/i18n/zh-CN/smashup/cards/culture_shock/compressed/atlas.webp public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/compressed/atlas.webp --selection-plan` | PASS，精确上传预演列出 2 个对象 |
| `node scripts/assets/upload-to-r2.js --only public/assets/i18n/zh-CN/smashup/cards/culture_shock/compressed/atlas.webp public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/compressed/atlas.webp --check --skip-android-package-publish` | BLOCKED，R2 返回 `401 UnknownError` |

## 远端残余（2026-07-14 历史快照，已被后续状态覆盖）

- R2 精确差异检查在所选两个运行时对象上返回 `401`，因此本轮没有上传，也没有取得代表 URL 的 `HEAD 200`。
- OpenSpec `2.5` 保持未完成；本地 PR 可以带上图片和 manifest，但不能声称 R2/CDN 已发布。
- 若后续要完成线上资源链路，需要提供有效 R2 凭据后重新执行精确上传，并对以下对象做远端回查：
  - `official/i18n/zh-CN/smashup/cards/culture_shock/compressed/atlas.webp`
  - `official/i18n/zh-CN/smashup/base/polynesian_voyagers/compressed/atlas.webp`

## 2026-10-23 公网状态复核（覆盖上述 401 结论）

- 当前两个运行时 WebP 已能只读 GET，且与本地文件逐字节一致：卡牌 atlas 1,110,284 bytes / SHA-256 `d01093a8789e0f49a97071afe6ea8992308bc54ce679993191066612c6d97c7a`；共享基地 atlas 442,110 bytes / SHA-256 `31f4179b388ed1063b20c65f9cb6c5eeb95474b352321fac756939712fa468b0`。
- 公网 `official/i18n/zh-CN/smashup/assets-manifest.json` 中四个 Culture Shock 资源条目（两张 PNG 与两张 WebP）的 SHA-256、bytes、MIME 均与本地完全相同；两个 WebP 的 HEAD 为 200，响应标记 `X-Asset-Source: server`。
- 因此这两个指定运行时对象的“上传后公网回查”当前已通过，旧 R2 `401` 是历史状态；本次没有上传。公网 manifest 整体仍比本地少 830 bytes，差异在本批四个条目之外，归入共享 manifest 审计，不据此声称整个 Smash Up manifest 已同步。
