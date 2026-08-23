# 线上反馈收口 - Smash Up 玩家反馈后续批次

- 口径：线上真实反馈。
- 抓取源：`https://api.easyboardgame.top/admin-api/feedback`。
- 抓取时间：`2026-08-23T15:35:39.645Z`。
- 本轮记录时间：`2026-08-24T00:26:31+08:00`。
- 抓取数量：12 条未收口反馈，归并为 11 个代表组。
- 诊断包：`temp/feedback-closeout/2026-08-23T15-35-35-760Z/summary.json`。

## 6a8ae389446de293e25ff758 - 叛逆者额外 3 力随从打不出

- 原始症状：玩家说“按照效果，我应该可以打出另一张不同名的3战力随从，但是我打不出，明明右下角显示有一个额外的。”
- 真实证据：诊断包显示玩家有额外随从额度，但旧状态把额度限制成牌库内某一张指定青少年牌，导致手牌里的不同名 3 力随从不能使用。
- 规则合同：叛逆者与运动员同基地时，应授予“该基地一张非叛逆者、力量不超过 3 的额外随从”额度，不是只允许从牌库打指定牌。
- 根本机制：旧实现把“非同名 + 力量上限 + 基地限定”的额度压成了“指定牌 UID / 指定牌名”限制；命令校验读取该限制后拒绝合法的手牌随从。
- 修复：`teens_rebel` 改用上下文额外随从额度；随从额度状态新增可消费的基地限定限制项，支持排除同名和力量上限，并在打出时正确消费。
- 验证：
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\excellent-movies-teens.test.ts --configLoader native -t "叛逆者与运动员同基地"`：1 file passed / 1 passed。
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\excellent-movies-teens.test.ts --configLoader native`：1 file passed / 83 passed。
- 状态建议：`resolved`。

## 6a8aea84446de293e25ff8b0 - 万圣节镇计分后不能选择角色修正牌

- 原始症状：玩家说触发万圣节镇基地效果后无法操作，规则上应选择角色身上的行动牌洗回牌库。
- 图面与快照：截图停在计分期，万圣节镇右侧有附着在角色上的行动牌；快照事件显示玩家已选择“万圣节镇”计分后触发。
- 真实故障现象：旧线上事件流在选择万圣节镇触发后只消费了触发，没有进入“选择角色修正牌”窗口。
- 当前实现结论：当前树的万圣节镇链路是两步路径：先选择万圣节镇触发，再打开角色修正牌选择窗口；选择后移除附着行动牌并洗回牌库。
- 验证：
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\afterScoring-rescoring.test.ts --configLoader native -t "万圣节镇经统一"`：1 file passed / 1 passed。
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\afterScoring-rescoring.test.ts --configLoader native`：1 file passed / 12 passed。
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\disney-factions-abilities.test.ts --configLoader native`：1 file passed / 29 passed。
- 状态建议：`resolved`，说明当前代码已恢复正确两步流程；本轮没有部署。

## 6a8aec4c446de293e25ff90b - 阿拉丁找神灯后没有进手牌

- 原始症状：玩家说“神灯没有进手牌”。
- 真实证据：线上事件显示玩家选择了牌库里的神灯 `c37`，随后旧事件先把牌库重排成不含 `c37`，再发出“抽取 `c37`”事件；最终抽牌结算时目标牌已不在牌库里。
- 红测：新增“阿拉丁选择牌库神灯，且牌库后面仍有其它牌”的断言后，修复前失败为 `expected [] to include 'deck-lamp'`，命中玩家症状。
- 根本机制：精确从牌库拿指定牌时，旧事件顺序会先重排剩余牌库并把目标牌移出牌库，再用目标 UID 执行抽牌；抽牌 reducer 只能从当前牌库找 UID，因此找不到目标牌，手牌没有新增。
- 修复：`aladdin.ts` 的运行时搜索和 `disney_shared.ts` 的共享精确抽牌 helper 在重排时先保留目标牌在牌库顶，随后抽牌事件再把目标牌移入手牌，剩余牌库保持重排结果。
- 验证：
  - 修复前红测：`node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\disney-factions-abilities.test.ts --configLoader native -t "阿拉丁搜神灯"` 失败，断言手牌没有 `deck-lamp`。
  - 修复后同命令通过：1 file passed / 1 passed。
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\disney-factions-abilities.test.ts --configLoader native`：1 file passed / 29 passed。
- 状态建议：`resolved`。

## 6a8aee14446de293e25ff98f - 螺旋山丘计分后不能继续操作

- 原始症状：玩家说“螺旋山结算后不能正常触发效果，无法进行后续操作。”
- 快照证据：事件流显示螺旋山丘计分后，先处理了“圣诞老人服装”返回莎莉并回牌库底，之后玩家选择螺旋山丘计分后触发，但旧线上事件只消费触发，未继续打开角色修正牌选择窗口。
- 当前实现结论：当前树的螺旋山丘链路在计分后会打开角色修正牌选择窗口，可从弃牌堆或当前基地附着牌中选择一张返回手牌，也可跳过。
- 验证：
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\disney-factions-abilities.test.ts --configLoader native -t "万圣节镇|螺旋山丘|阿拉丁|神灯"`：1 file passed / 2 passed。
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\afterScoring-rescoring.test.ts --configLoader native`：1 file passed / 12 passed。
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\disney-factions-abilities.test.ts --configLoader native`：1 file passed / 29 passed。
- 状态建议：`resolved`，说明当前代码已恢复正确两步流程；本轮没有部署。

## 同类扩审

- 搜索范围：阿拉丁精确搜索、迪士尼共享精确抽牌、万圣节镇和螺旋山丘计分后触发、青少年叛逆者额外随从额度。
- 命中并处理：`aladdin.ts` 运行时精确抽牌与 `disney_shared.ts` 共享精确抽牌同源问题一并修复。
- 命中但不改：`excellent_movies_teens.ts` 内局部 `drawSpecificDeckCard` 已在重排时把目标牌放在牌库顶，抽牌可消费该目标，当前相关测试 83/83 通过。
- 验证汇总：
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\disney-factions-abilities.test.ts --configLoader native`：29 passed。
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\afterScoring-rescoring.test.ts --configLoader native`：12 passed。
  - `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\excellent-movies-teens.test.ts --configLoader native`：83 passed。
