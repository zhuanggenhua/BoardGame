# Smash Up AI 派系选择开局保护（2026-08-27）

## 原始症状

- 用户反馈：大杀四方 AI 选择派系再次出现只选了一个派系的情况。
- 本轮允许的兜底方向：如果暂时定位不到真实来源，开始游戏时自动补充随机派系。

## 本轮定位

- 正常新局 setup 仍明确要求每名玩家选择 2 个派系，代码入口在 `src/games/smashup/domain/index.ts`。
- 当前本地测试没有复现“正常 AI 只执行一次后停住”：房主先选 1 个派系后，3 个 AI 会按蛇形顺序连续完成 `1,2,3,3,2,1` 六次选择，并把选择权交还房主。
- 只读拉取线上未收口反馈快照：2026-08-27 12:50:14 +08:00，线上 `open=1`、`in_progress=0`，唯一未收口项是 Dice Throne，不是 Smash Up 派系选择。
- 已定位到一个真实坏状态入口：如果运行态里的“每人需要派系数”异常变成 1，原开局事件会过早触发，可能让玩家以不足 2 个派系进入后续开局链。

## 本轮改动

- `src/games/smashup/domain/reducer.ts`
  - 在组牌、发手牌、发基地前补齐每名玩家至少 2 个合法派系。
  - 补齐候选来自本局可用派系池；过滤未接入派系、疯狂牌和普通/POD 同身份重复。
  - 如果可用派系不足，直接抛出明确错误，不做空牌假开局。
- `src/games/smashup/domain/types.ts`
  - `ALL_FACTIONS_SELECTED` 事件新增 `selectedFactionsByPlayer`，记录开局实际使用的最终派系列表。
- `src/games/smashup/domain/reduce.ts`
  - 归约开局事件时优先使用事件携带的最终派系列表，确保玩家派系、牌库和手牌一致。
- `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - 增加异常 1 派系运行态的开局补齐回归。
  - 增加 4 人局 AI 连续完成两轮蛇形选派系并交还房主的回归。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --testNamePattern "派系选择|AI 自动选派系|AI 选派系|异常状态只要求 1 个派系|房主首选后 3 个 AI"`
  - 结果：1 个测试文件通过，7 个测试通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiImmediateExecutionRunner.test.ts --configLoader native`
  - 结果：1 个测试文件通过，2 个测试通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/factionSelection.test.ts --configLoader native`
  - 结果：1 个测试文件通过，51 个测试通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`
  - 结果：1 个测试文件通过，209 个测试通过。
- `npm run typecheck`
  - 结果：通过。
- `npx eslint src/games/smashup/domain/types.ts src/games/smashup/domain/reducer.ts src/games/smashup/domain/reduce.ts src/games/smashup/__tests__/smashup.smoke.test.ts`
  - 结果：0 errors；仍有既有 warning。
- `git diff --check -- src/games/smashup/domain/types.ts src/games/smashup/domain/reducer.ts src/games/smashup/domain/reduce.ts src/games/smashup/__tests__/smashup.smoke.test.ts`
  - 结果：通过；仅提示 Windows 行尾转换。

## 结论与残余风险

- 本轮不能证明在线 AI “为什么只选了一次”的完整根本原因已经定位。
- 已确认正常 AI 连续选派系链路在当前树通过。
- 已增加开局保护：即使运行态异常过早认为每名玩家只需 1 个派系，真正开局组牌前也会自动补齐到 2 个合法派系，避免不足派系或空派系假开局。
- 这次应称为开局保护 / 兜底修复，不应称为已完全定位在线复发根因。
