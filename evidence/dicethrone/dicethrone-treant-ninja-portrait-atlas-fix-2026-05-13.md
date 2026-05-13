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
