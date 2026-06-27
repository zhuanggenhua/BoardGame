# 2026-06-26 Dice Throne 反馈收口证据

## 反馈 1：技能日志描述不对应

- 反馈 ID：`6a3e73cd6ee79f45eb0a7470`
- 反馈时间口径：线上反馈，2026-06-26
- 现实现象：
  - 同一段战斗日志里，先显示发动的是一个技能，下一行“确认投掷”却写成了另一个技能。
  - 具体现场里是“荣耀”后面跟了“moons-blessing”，说明日志读取的是残留技能来源，不是真实这次攻击来源。
- 根因：
  - `src/games/dicethrone/game.ts` 在 `CONFIRM_ROLL` 日志里，进攻方只读取 `activatingAbilityId`。
  - 当当前攻击的真实来源已经写在 `pendingAttack.sourceAbilityId`，但 `activatingAbilityId` 仍残留旧值时，日志会串技能名。
- 修复：
  - `CONFIRM_ROLL` 日志改为进攻时优先读取真实攻击来源 `pendingAttack.sourceAbilityId`，没有时再回退到 `activatingAbilityId`。
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/actionLogFormat.test.ts -t "CONFIRM_ROLL 应优先使用真实攻击来源写技能名，而不是残留的激活技能"`
  - `npx vitest run src/games/dicethrone/__tests__/actionLogFormat.test.ts`

## 反馈 2：watchdog 报 visible-interaction 一直卡住

- 反馈 ID：`6a3e284fb38ab7057c7da156`
- 重复反馈：`6a3e240db38ab7057c7da0c4`、`6a3e0c86b38ab7057c7d9e4a`
- 反馈时间口径：线上自动反馈，2026-06-26
- 现实现象：
  - 僧侣“禅忘”二选一里，玩家选完“闪避”或“净化”后，效果其实已经生效，但提示没有收掉，流程也没有继续推进。
  - 看门狗看到的就是“可见提示恢复后仍持续存在”，因此报 `visible-interaction:recover-interaction:blocker_persisted`。
- 根因：
  - `src/games/dicethrone/domain/attack.ts` 的 `resolveOffensivePreDefenseEffects` 在前置选择阶段一旦弹出选择就直接停住。
  - 这条路径没有同步写入“前置选择阶段已经进入过”的领域标记 `ATTACK_PRE_DEFENSE_RESOLVED`。
  - 结果是玩家响应后自动续推进时，系统还以为这一步没做过，又重复重建同一条提示，形成“选择已生效但提示不收口”。
- 修复：
  - 当前置防御阶段弹出选择时，仍然补发 `ATTACK_PRE_DEFENSE_RESOLVED`，保证后续自动续推进不会重复生成同一条前置选择。
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/monk-coverage.test.ts -t "触发禅忘获得5太极和闪避Token"`
  - `npx vitest run src/games/dicethrone/__tests__/monk-coverage.test.ts -t "触发禅忘获得5太极和净化Token"`
  - `npx vitest run src/games/dicethrone/__tests__/monk-coverage.test.ts -t "触发禅忘二选一后应关闭当前提示并标记前置选择已完成"`
  - `npx vitest run src/games/dicethrone/__tests__/monk-coverage.test.ts`

## 本轮范围说明

- 以下结论只针对当前对话、本轮改动和本轮验证。
- 当前完成的是“代码修复 + 本地验证 + 反馈证据”。
- 发布状态是另一条轴：本证据不代表已上线，只代表反馈本体在当前代码树下已经修复并完成定向验证。
