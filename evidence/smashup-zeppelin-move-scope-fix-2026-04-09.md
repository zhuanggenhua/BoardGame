# SmashUp 齐柏林飞艇跨基地移动范围修复证据

## 对应反馈
- `69d65dca119046d0b061f5b1`
- 标题：齐百林飞艇在第三个基地开了效果，却可以把第一个基地的随从去往第二个基地

## 结论
- 这是 **真 bug**。
- 旧实现把齐柏林飞艇的目标基地放宽成了“任意其他基地”，导致可以出现“飞艇在 A，但把 B 的随从移到 C”的非法移动。

## 规则证据
- 本地 Wiki 快照 `temp/smashup-wiki-kb/pages.json` 中 Steampunks 页面原文：
  - `Zeppelin - Play on a base. Talent: Move one of your minions from another base to here, or from here to another base.`
- 这句话明确限定了两种合法路径：
  1. 从**其他基地**移到**齐柏林所在基地**
  2. 从**齐柏林所在基地**移到**其他基地**
- 不允许“来源基地和目标基地都不是齐柏林所在基地”。

## 根因
- 文件：`src/games/smashup/abilities/steampunks.ts`
- 旧的 `steampunk_zeppelin_choose_minion` 第二步构建目标基地时，只排除了来源基地：
  - 结果：如果第一步选中了“其他基地”的随从，第二步仍会给出所有非来源基地选项
  - 从而错误地允许“其他基地 → 另一个其他基地”

## 修复
- 在 `steampunk_zeppelin_choose_minion` 中按规则收紧第二步目标：
  - 若第一步选的是**齐柏林所在基地**的随从：目标只能是其他基地
  - 若第一步选的是**其他基地**的随从：目标只能是**齐柏林所在基地**
- 同时给“只剩一个合法目标基地”的场景开启 `autoResolveIfSingle`，避免多余一步交互。

## 验证
1. `npx eslint src/games/smashup/abilities/steampunks.ts src/games/smashup/__tests__/ongoingTalent.test.ts --quiet`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/ongoingTalent.test.ts --configLoader native -t "steampunk_zeppelin（齐柏林飞艇 ongoing talent - 分两步交互）"`

## 覆盖到的关键断言
- 从其他基地选择随从时，第二步只剩齐柏林所在基地一个合法目标
- 从齐柏林所在基地选择随从时，第二步只能去其他基地
- 旧有防御逻辑仍保留：如果目标随从已经离开来源基地，则第二步不会继续错误移动
