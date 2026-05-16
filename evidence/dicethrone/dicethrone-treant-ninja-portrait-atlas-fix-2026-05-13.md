# DiceThrone Treant / Ninja 头像图集修正证据

## 范围

- 对象：Treant / 树精、Ninja / 忍者
- 问题：两个新角色的头像来源与老角色 `character-portraits` 合同不一致，不能用新素材反向覆盖老角色共享头像合同。
- 修正：老角色继续使用 `character-portraits`；Treant / Ninja 单独分流到 `characterhead2`。

## 资源合同

- 老角色头像合同：`dicethrone/images/Common/character-portraits`
- 新角色头像合同：`dicethrone/images/Common/characterhead2`
- Ninja：`characterhead2` 第 3 个，代码索引 `2`
- Treant：`characterhead2` 第 14 个，代码索引 `13`
- 正式压缩资源：`public/assets/i18n/zh-CN/dicethrone/images/Common/compressed/characterhead2.webp`
- 远端 URL：`https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/Common/compressed/characterhead2.webp`
- 远端回查：`200 image/webp`，SHA-256 `8f06ae83f1aa0004f8f9300d3337b064489a40a0e586194b4e49bed8dbbd1c98`

## 截图观察

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-ninja-selection.png`
  - 桌面选角中，Treant / Ninja 使用新头像图集分流后的头像。
  - 左侧老角色仍显示旧图集头像，没有被 `characterhead2` 的规格污染。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-ninja-selection-mobile-landscape.png`
  - 移动横屏选角中，底部 Treant / Ninja 卡片分别显示树精和忍者头像。
  - 老角色列表仍保持旧共享图集灰度头像；未出现新图集尺寸套用到老角色导致的错裁。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-implementation-card.png`
  - Treant 选角卡显示树精头像，实施中斜横幅仍覆盖在卡片上。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\ninja-implementation-card.png`
  - Ninja 选角卡显示忍者头像，实施中斜横幅仍覆盖在卡片上。

## 验证

- `npm run assets:manifest`
- `npm run assets:validate`
- `npm run assets:upload`：上传 1，失败 0
- 远端下载 SHA-256 与本地一致
- `npx eslint src/games/dicethrone/ui/assets.ts e2e/src/games/dicethrone/ui/assets.ts src/games/dicethrone/criticalImageResolver.ts e2e/src/games/dicethrone/criticalImageResolver.ts e2e/dicethrone/character-selection.e2e.ts`
- `npm run typecheck`
- `npx vitest run src/games/dicethrone/__tests__/criticalImageResolver.test.ts --configLoader native --maxWorkers 1`
- `npm run test:e2e:ci:file -- e2e/dicethrone/character-selection.e2e.ts "树精和忍者应该能够选角并进入游戏"`

## 结论

- 已按“新素材与旧合同不一致时按对象分流”的规范处理。
- 老角色共享头像合同未再被新角色素材覆盖。
- Treant / Ninja 头像在桌面与移动横屏选角中均可见。

## 2026-05-16 修订：老角色资源本体未恢复

- 复查发现：2026-05-14 的代码已恢复“老角色 `character-portraits` / Treant、Ninja `characterhead2`”分流，但本地 `public/assets/i18n/zh-CN/dicethrone/images/Common/character-portraits.png` 与压缩 WebP 仍停留在 2026-05-13 的统一图集产物。
- 错误资源状态：`character-portraits.png` 为 `3570x2589`，`compressed/character-portraits.webp` 为 `2048x1485`，与代码中的老角色 `3950x4096` 合同不一致，导致老角色头像按错误尺寸裁切。
- 修正后资源状态：
  - `character-portraits.png`：`3950x4096`，SHA-256 `f472e4b082cf299ddb4399ce08937bd061ca643fa25a4e73a8ca4080c7144912`
  - `compressed/character-portraits.webp`：`1975x2048`，SHA-256 `329ed4504c3bf59d31dce7b93be7af951f9277c89aa9931103a0d459bcd325ed`
  - `characterhead2.png`：`3570x6042`，SHA-256 `c72c311c9360b6c019e627cf4c2326db03eeea4a3bf91ef246b6cb0cf1ed2747`
  - `compressed/characterhead2.webp`：`1210x2048`，SHA-256 `8f06ae83f1aa0004f8f9300d3337b064489a40a0e586194b4e49bed8dbbd1c98`
- 同步修正：
  - `public/assets/i18n/assets-manifest.json` 中老头像 PNG/WebP hash 回到旧合同。
  - `public/assets/i18n/zh-CN/dicethrone/assets-manifest.json` 补齐老头像 PNG 与 `characterhead2` PNG/WebP 条目。
  - 新增 `src/games/dicethrone/ui/__tests__/portraitAtlasContract.test.ts`，锁定老角色/新角色分流、图片尺寸和 manifest hash。
- 验证：
  - `npx vitest run src/games/dicethrone/ui/__tests__/portraitAtlasContract.test.ts --configLoader native --maxWorkers 1`：2 passed。
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/character-selection.e2e.ts "树精和忍者应该能够选角并进入游戏"`：1 passed。
  - `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id dicethrone`：未通过，失败点是既存 Samurai `dice.webp` 与 `status-icons-atlas.json` hash/bytes 不一致；本轮头像条目已由新增合同测试定向覆盖。
  - `CHECK_ONLY=1 node scripts/assets/upload-to-r2.js`：1951 个可上传资源中仅 `official/i18n/zh-CN/dicethrone/images/Common/compressed/character-portraits.webp` 需要更新。
  - `node scripts/assets/upload-to-r2.js`：上传 1、跳过 1950、删除 0、失败 0。
  - 远端复查：`compressed/character-portraits.webp` 返回 `200 image/webp`，165570 bytes，SHA-256 `329ed4504c3bf59d31dce7b93be7af951f9277c89aa9931103a0d459bcd325ed`；`compressed/characterhead2.webp` 返回 `200 image/webp`，SHA-256 `8f06ae83f1aa0004f8f9300d3337b064489a40a0e586194b4e49bed8dbbd1c98`。
- 2026-05-16 截图观察：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-ninja-selection.png`
    - PC 选角左侧老角色显示为旧图集灰度头像，僧侣、狂战士、烈火术士、暗影刺客、月精灵、圣骑士、枪手、武士不再按新图集错裁。
    - Treant / Ninja 仍显示新图集头像，并保留实施中斜横幅。
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-ninja-selection-mobile-landscape.png`
    - 移动横屏下左侧老角色头像与 PC 同源，未出现新图集尺寸套用到老角色的错裁。
    - Treant / Ninja 底部卡片仍分别显示树精与忍者头像。
