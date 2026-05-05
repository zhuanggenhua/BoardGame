# Smash Up 反馈 69f27a5d 本地验收收口说明（2026-05-04）

## 反馈原文

- `因为忍者侍从打出的随从无法触发打出效果`

线上反馈对应：

- feedbackId：`69f27a5dab54eadcc2bb2c75`
- gameId：`smashup`
- route：`/play/smashup/match/WWJIlGJSnnt?playerID=0`
- appVersion：`production`

## 线上现场能确认到什么

- 该局 action log 已明确出现：
  - `炎风: 随从登场： 忍者侍从  → 工坊`
  - `炎风: 战术卡施放： 那山里有金子`
  - `炎风: 随从登场： 枪手  → 工坊`
- 但现场后续没有出现 `枪手` 的决斗选择，也没有对应的决斗结算。
- 这说明问题不是“忍者侍从没把随从打出来”，而是“额外打出的随从已经进场，但它的 onPlay 没有继续往后触发交互链”。

## 根因定位

根因不在 `ninja_acolyte_play` 交互处理器本身，而在 `MINION_PLAYED` 的后处理时机：

1. `ninja_acolyte_play` 响应后，确实会产出 `MINION_PLAYED(consumesNormalLimit=false)`。
2. 这个 `MINION_PLAYED` 不是走普通 `PLAY_MINION` 的 execute 主链，而是走 `afterEvents` 轮里的交互处理器返回事件。
3. `postProcessSystemEvents()` 在处理这类 `afterEvents` 轮产生的 `MINION_PLAYED` 时，临时 `core` 里还看不到刚进场的随从。
4. `cowboys_gunfighter` 的 onPlay 需要先在当前 `state` 里找到自己所在基地；看不到自己时，`queueEnemyDuelPrompt()` 会直接短路返回空事件。
5. 于是现场表现成：“枪手已经被打出，但不会继续弹决斗交互”。

## 本地修复点

- `src/games/smashup/domain/index.ts`
  - 修正 `postProcessSystemEvents()` 中 `MINION_PLAYED` 的临时状态构造。
  - 当 `MINION_PLAYED` 来自 `afterEvents` 轮、尚未先 reduce 进 `core` 时，先把当前这张随从临时 reduce 到 `tempCore`，再调用 `fireMinionPlayedTriggers()`。
  - 这样 `onPlay` 能看到“自己已经在场上”的权威态，像 `cowboys_gunfighter` 这种依赖在场定位的能力就能继续创建后续交互。
- `src/games/smashup/__tests__/baseFactionOngoing.test.ts`
  - 新增最小回归：`忍者侍从额外打出的枪手会继续接管当前交互并创建决斗选择`

## 本地验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseFactionOngoing.test.ts --configLoader native --maxWorkers 1 -t "忍者侍从额外打出的枪手会继续接管当前交互并创建决斗选择"`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 -t "忍者侍从额外打出的枪手会继续接管当前交互并创建决斗选择|cowboys_gunfighter 打出后可与同基地敌方随从决斗并消灭失败者"`

结果：

- `baseFactionOngoing.test.ts`：`1 passed`
- `baseFactionOngoing.test.ts + newFactionAbilities.test.ts`：`2 passed`

## 收口结论

- 当前任务口径下，`resolved` 表示“本地已经修好并完成本地验收”，不代表已上传/已上线。
- 本条已经具备：
  - 线上现场日志证据；
  - 明确的交互链断点根因；
  - 当前代码基线下的最小复现测试与原始枪手 onPlay 回归测试通过。
- 因此本条可以按本地验收转 `resolved`。
