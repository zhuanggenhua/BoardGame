# 大杀四方基地计分对照审计（官方 Rules 页）2026-04-10

## 审计范围

- 权威来源：用户指定官方规则页 `https://smashup.fandom.com/wiki/Rules`
- 对照范围：
  - 基地计分总流程
  - `before scoring / when scoring / after scoring`
  - 多基地顺序
  - 计分资格
  - 平局处理
  - 当前代码实现与测试

## 权威来源摘录结论

根据官方规则页 `Smash Up Wiki - Rules`，基地计分的关键口径是：

1. 只有在 `Phase 3: Score Bases` 检查基地是否 ready to score。
2. 若多个基地同时 ready to score，由当前玩家选择先结哪个。
3. `before scoring` 发生在正式发 VP 之前。
4. 若在 `before scoring` 中让“当前这个正在计分的基地”不再能继续计分，则停止该基地结算并回到步骤 1 重查。
5. 一旦进入发 VP 的那一步，基地就已经算分；官方原文明确写到：
   - `the base is scored regardless...`
6. `after scoring` 发生在 VP 发完之后。
7. 然后才是弃基地上的牌、弃基地、补新基地，再回到步骤 1。

我对官方页的关键理解是：

- `after scoring` 不是“重新打开这次 VP 结算”的窗口。
- 它是“这次基地已经算完分之后，处理后续效果和清场替代”的窗口。
- 其他基地是否因为这次后续效果变成 ready to score，需要在回到步骤 1 后重新检查；这不等于把刚才那个基地的 VP 再重算一次。

## 当前实现对照

### 一致项

1. 多基地顺序由当前玩家选择
   - 代码：`src/games/smashup/domain/index.ts:220-252`
2. 进入 `scoreBases` 时先锁定 eligible 基地
   - 代码：`src/games/smashup/domain/index.ts:1377-1405`
   - 测试：`src/games/smashup/__tests__/scoringEligibleLock.test.ts`
3. `Me First!` 之后就算力量被压到临界点以下，已锁定基地仍继续计分
   - 代码：`src/games/smashup/domain/ongoingModifiers.ts:669-694`
4. 战力为 0 但有随从的玩家仍参与计分
   - 代码：`src/games/smashup/domain/index.ts:81-99`
   - 测试：`src/games/smashup/__tests__/zero-power-scoring.test.ts`

### Findings

#### [P1] 当前实现把 `afterScoring` 做成了“可重新计分”，与官方规则流程不一致

- 文件：
  - `src/games/smashup/domain/index.ts:308`
  - `src/games/smashup/domain/index.ts:320`
  - `src/games/smashup/domain/index.ts:343`
- 现状：
  - `finalizeCurrentScoringBase()` 会比较 `afterScoring` 窗口打开前后的玩家力量
  - 若有变化，就额外构造并发出新的 `BASE_SCORED`
- 问题：
  - 官方规则页说明的是：`after scoring` 在正式发 VP 之后
  - 官方页没有给出“after scoring 影响当前基地力量后，应重新计算这次 VP”的流程
- 结论：
  - 当前实现相当于引入了一个官方规则页没有声明的“重计分机制”

#### [P1] 重计分时不会回滚第一次 VP，而是再次累加 VP

- 文件：
  - `src/games/smashup/domain/index.ts:343-347`
  - `src/games/smashup/domain/reduce.ts:806-820`
- 现状：
  - 第二次 `BASE_SCORED` 只是再发一个相同类型事件
  - `reduce(BASE_SCORED)` 的行为是按 `rankings` 直接加 VP
  - 没有任何“撤销第一次计分结果”或“覆盖前一次结果”的逻辑
- 实证：
  - 我此前已用定向脚本复现过 `afterScoring` 改变力量的场景
  - 最终表现是第一次冠军保留第一次拿到的 VP，第二次冠军又额外拿一次 VP
- 结论：
  - 即使团队想坚持“afterScoring 后可重计分”的 house rule，当前 VP 落地方式也不正确

#### [P1] 引擎缺少官方规则里的 `when scoring` 独立时点

- 文件：
  - `src/games/smashup/domain/baseAbilities.ts:60-66`
  - `src/games/smashup/domain/types.ts:173`
  - `src/games/smashup/domain/commands.ts:380-436`
- 现状：
  - 基地能力时点只有 `beforeScoring` / `afterScoring`
  - 行动卡 `SpecialTiming` 也只有 `beforeScoring | afterScoring`
  - 响应窗口只有 `meFirst` 和 `afterScoring`
- 问题：
  - 官方规则页的计分流程实际上区分了：
    - `before scoring`
    - `when scoring`
    - `after scoring`
  - 当前代码结构层面就没有 `when scoring` 这个合法时点
- 影响：
  - 任何真正属于 `when scoring` 的基地能力、卡牌 Special、响应牌，都会被迫错挂到 `beforeScoring` 或 `afterScoring`
  - 这不是单卡 bug，而是时间窗建模缺口

#### [P2] 一些官方属于 `when scoring` 的基地能力被错误建模成了 `beforeScoring`

- 文件：
  - `src/games/smashup/domain/baseAbilities.ts:442-461`
  - `src/games/smashup/domain/baseAbilities.ts:559-578`
- 例子：
  - `base_rhodes_plaza`
    - 注释写的是“在这个基地计分时”
    - 实际注册为 `beforeScoring`
  - `base_the_factory`
    - 注释写的是“当这个基地计分时”
    - 实际注册为 `beforeScoring`
- 问题：
  - 这两类能力在官方语义里更接近 `when scoring`
  - 当前实现因为没有 `when scoring` 时点，被提前到了 `beforeScoring`
- 风险：
  - 一旦某些牌的“when scoring”与“before scoring”在顺序上有互动，当前实现就会和官方规则页分叉

#### [P2] 项目内部规则文档也没有和官方页完全同步

- 文件：
  - `src/games/smashup/rule/大杀四方规则.md:98-115`
- 现状：
  - 项目规则文档写了 `before scoring -> 发 VP -> after scoring -> 清场`
  - 这点与官方页大方向一致
- 问题：
  - 当前代码却又额外做了 `afterScoring` 后的重新 `BASE_SCORED`
  - 项目规则文档没有把这件事写进去
- 结论：
  - 现在是“官方页”“仓库规则文档”“代码”三者没有完全对齐

## 我认为最接近官方规则页的正确结算顺序

1. 进入 `scoreBases`
2. 找出 ready to score 的基地
3. 多基地时当前玩家选一个
4. 处理 `before scoring`
5. 如果该基地在这一步被停止计分，则终止当前基地，回到步骤 2
6. 进入 `when scoring`，发本次计分相关 VP / 同步处理该时点能力
7. 处理 `after scoring`
8. 清场、弃基地、补新基地
9. 回到步骤 2 检查其他基地

在这个模型下：

- `after scoring` 不应再次发新的 `BASE_SCORED`
- 如果某张牌是“当基地计分时”，应归到 `when scoring`
- 如果某个 `after scoring` 效果影响了其他基地，使其变成 ready to score，应在后续重新检查“其他基地”，而不是重开刚刚那一张基地的 VP 结算

## 验证证据

- 官方规则来源：
  - [Smash Up Wiki Rules](https://smashup.fandom.com/wiki/Rules)
- 本地对照代码：
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/domain/baseAbilities.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/domain/reduce.ts`
- 本地测试参考：
  - `src/games/smashup/__tests__/afterScoring-rescoring.test.ts`
  - `src/games/smashup/__tests__/scoringEligibleLock.test.ts`
  - `src/games/smashup/__tests__/zero-power-scoring.test.ts`

## 本轮结论

按你给的官方规则页看，当前项目至少有三处关键偏差：

1. 额外实现了 `afterScoring` 后重计分
2. 重计分时 VP 直接累加
3. 缺少 `when scoring` 这个独立规则时点

这三处里，前两处会直接影响“基地分数到底怎么发”；第三处会持续影响后续所有“计分时”牌/基地的语义正确性。
