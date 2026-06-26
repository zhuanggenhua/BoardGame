# 线上反馈批次收口记录（2026-06-26）

- 时间：2026-06-26
- 来源口径：线上真实反馈批次 `temp/feedback-closeout/2026-06-25T13-45-39-656Z/summary.json`
- 本地状态板：`temp/feedback-closeout/status-board.json`
- 本轮目标反馈：
  - `6a3bf9a4e4029ac4f5fafe61`
  - `6a3a9099e4029ac4f5fafaaf`
  - `6a3a97e8e4029ac4f5fafb41`
  - `6a3b9ef7e4029ac4f5fafd13`
  - `6a3cb53fe4029ac4f5faffb5`

## 真相源

- 线上真实反馈诊断包：
  - `temp/feedback-closeout/2026-06-25T13-45-39-656Z/6a3bf9a4e4029ac4f5fafe61.md`
  - `temp/feedback-closeout/2026-06-25T13-45-39-656Z/6a3a9099e4029ac4f5fafaaf.md`
  - `temp/feedback-closeout/2026-06-25T13-45-39-656Z/6a3a97e8e4029ac4f5fafb41.md`
  - `temp/feedback-closeout/2026-06-25T13-45-39-656Z/6a3b9ef7e4029ac4f5fafd13.md`
  - `temp/feedback-closeout/2026-06-25T13-45-39-656Z/6a3cb53fe4029ac4f5faffb5.md`
- 生产 Mongo 回写前状态快照：
  - `temp/feedback-closeout/query-feedback-open-batch-before-writeback-20260626.raw.txt`
- 生产 Mongo 回写脚本：
  - `temp/feedback-closeout/update-feedback-status-20260626-open-batch.js`
- 生产 Mongo 回写结果：
  - `temp/feedback-closeout/update-feedback-status-20260626-open-batch.raw.txt`
- 生产 Mongo 回写后状态快照：
  - `temp/feedback-closeout/query-feedback-open-batch-after-writeback-20260626.raw.txt`

## 逐条结论

### 1. DiceThrone 人类反馈 `6a3bf9a4e4029ac4f5fafe61`

- 反馈含义：AI 在自己进攻掷骰时，无法使用改骰或重掷卡牌继续修正骰面。
- 归类：已复现并修复
- 使用的真实证据：
  - 线上真实反馈诊断包
  - 当前源码与定向回归
- 根因：
  - `src/games/dicethrone/ai.ts` 在 `offensiveRoll / defensiveRoll` 只给 AI 生成锁骰、掷骰、确认等候选，没有把 roll 时机能打出的卡牌候选补进去，导致 AI 在自己掷骰阶段看不到《惊不惊喜》《配得上我》这类改骰牌。
- 修复：
  - 在 `src/games/dicethrone/ai.ts` 给 `offensiveRoll / defensiveRoll` 补上 roll 时机 `play-card` 候选生成。
  - 只允许攻击已真正发起前的进攻掷骰阶段继续生成这些候选，避免攻击已创建后重复走错语义。
  - 新增回归证明：
    - AI 在自己进攻掷骰阶段能看到 `card-surprise`
    - AI 在自己进攻掷骰阶段能看到 `card-worthy-of-me`
    - AI 在先锁关键骰后，会继续主动打出 `card-surprise`，而不是卡在锁骰/确认
- 验证命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native`
- 验证结果：
  - 通过
- 本轮收口状态：
  - `resolved`
- 解决方式：
  - 补上 DiceThrone AI 在进攻掷骰阶段对改骰/重掷牌的候选生成与决策回归

### 2. SmashUp 系统反馈 `6a3a9099e4029ac4f5fafaaf`

- 反馈含义：SmashUp 在处理《墓穴陷阱》目标选择时，服务端直接报 `context is not defined`，交互无法继续。
- 归类：当前树已恢复
- 使用的真实证据：
  - 线上真实反馈诊断包
  - 当前树既有回归测试
- 判断说明：
  - 当前仓库对应根因的回归测试已经存在并通过，说明这条历史报错现场已被当前代码覆盖。
  - 本轮没有再对 SmashUp 这条链路新增代码；做的是按真实反馈重新核对并正式收口。
- 验证命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts --configLoader native`
- 验证结果：
  - 通过
- 本轮收口状态：
  - `closed`
- 关闭理由：
  - 当前树对应回归已通过，旧 `context is not defined` 现场未再复现

### 3. DiceThrone 自动反馈 `6a3a97e8e4029ac4f5fafb41`

- 反馈含义：DiceThrone 棋盘页在右侧骰子交互区域渲染时，旧现场曾报“读取未定义对象的 `length` 失败”。
- 归类：当前树已恢复
- 使用的真实证据：
  - 线上真实反馈诊断包
  - 当前 `RightSidebar / DiceTray` 定向渲染回归
- 判断说明：
  - 当前树里这条链路已经对 `selectedDiceIds`、`modifications` 以及相关多步骰子交互结果做了兜底。
  - 用这条反馈对应的真实快照形态直接渲染 `RightSidebar`，当前不会再崩。
- 验证命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/active-modifiers-undo.test.ts --configLoader native`
- 验证结果：
  - 通过
- 本轮收口状态：
  - `closed`
- 关闭理由：
  - 当前树按真实交互快照渲染验证已恢复，未再复现旧前端包崩溃

### 4. DiceThrone watchdog `6a3b9ef7e4029ac4f5fafd13`

- 反馈含义：DiceThrone 在响应交互尚未完成时，watchdog 试图跳过响应，被服务端以“交互处理中，无法跳过响应”拒绝。
- 归类：当前树已恢复
- 使用的真实证据：
  - 线上真实反馈诊断包
  - 当前响应窗口锁定回归
- 判断说明：
  - 当前测试已经证明：当响应窗口里还有正在进行的真实交互时，`RESPONSE_PASS` 必须被拒绝，且不能提前清掉交互和响应窗口。
  - 因此这条 watchdog 记录不是“当前树还缺修复”，而是历史现场已被现有保护链覆盖。
- 验证命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts --configLoader native`
- 验证结果：
  - 通过
- 本轮收口状态：
  - `closed`
- 关闭理由：
  - 当前树响应窗口锁定回归通过，watchdog 所报场景属于已恢复旧现场

### 5. DiceThrone 自动反馈 `6a3cb53fe4029ac4f5faffb5`

- 反馈含义：DiceThrone 棋盘页在对手重掷交互的右侧骰区渲染时，旧现场曾报“读取未定义对象的第 0 项失败”。
- 归类：当前树已恢复
- 使用的真实证据：
  - 线上真实反馈诊断包
  - 当前 `RightSidebar` 定向渲染回归
- 判断说明：
  - 这条快照的关键特点是缺少 `initialResult`。
  - 当前树已能在缺少这部分旧字段时继续渲染，不会因为对手重掷交互快照不完整而崩溃。
- 验证命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/active-modifiers-undo.test.ts --configLoader native`
- 验证结果：
  - 通过
- 本轮收口状态：
  - `closed`
- 关闭理由：
  - 当前树按真实交互快照渲染验证已恢复，缺 `initialResult` 的旧现场未再复现

## 本轮边界

- 这 5 条里，只有 `6a3bf9a4e4029ac4f5fafe61` 是本轮新增代码直接修掉的现存业务问题。
- 另外 4 条结论都是“当前树已恢复”，不是“本轮再次复现后新修好”。
- 本轮反馈状态回写与部署状态拆轴处理：
  - 本轮会回写反馈状态
  - 本轮不提供“新代码已部署到生产容器”的证明
