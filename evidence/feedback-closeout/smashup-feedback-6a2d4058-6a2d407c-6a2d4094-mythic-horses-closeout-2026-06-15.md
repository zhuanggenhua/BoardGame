# SmashUp 线上反馈收口（6a2d40588b110d6694bb8db1 / 6a2d407c8b110d6694bb8db3 / 6a2d40948b110d6694bb8db5）

## 范围

- 反馈 ID：
  - `6a2d40588b110d6694bb8db1`
  - `6a2d407c8b110d6694bb8db3`
  - `6a2d40948b110d6694bb8db5`
- 游戏：`smashup`
- 反馈原文：
  - `小马的鼓舞之力是每个其他随从给当前随从战力加一 有bug少加了`
  - `小马的星辉效果应该是每个其他随从给星辉战力加一而不是星辉给每个其他随从战力加一`
  - `小马的海之星额外召唤效果触发不了`

## 结论

- 本轮结论：三条均为 `closed`
- 关闭理由：
  - 这三条命中的是**同一局、同一份小马乐园现场**。
  - `海星（mythic_horses_seastar）` 的额外召唤在行动日志里已经真实生效，随后 `星耀（mythic_horses_starlyte）` 成功额外登场。
  - `星耀（mythic_horses_starlyte）` 与 `鼓舞之力（mythic_horses_encouragement_power）` 的加成属于**运行时 effective power 结算**，不会直接写进 `powerModifier` / `tempPowerModifier` 原始字段。
  - 当前规则与定向测试都表明：
    - `星耀` 只按同基地其他己方随从数量给**自己**加力，不会反向给其他随从加力。
    - `鼓舞之力` 会按其他己方随从数量给附着目标加力。
    - `海星` 有其他己方随从在场时，能给所在基地额外随从额度。
  - 因此这三条都不属于“当前版本仍存在的规则缺口”，更适合按“当前版本复核无现存问题”归档关闭。

## 是否需要更新规范

- 不需要。
- 原因：
  - 现有规范已经足够区分：
    - 真 bug 修好后用 `resolved`
    - 当前版本复核无现存缺口、反馈属于旧态/误读/原始字段误判时，用 `closed`
  - 这三条属于后者。

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet boardgame` -> `boardgame.feedbacks`
- 回写前状态快照：
  - `temp/feedback-closeout/query-feedback-6a2d4058-6a2d407c-6a2d4094-before-writeback-20260615.raw.txt`
- 回写结果摘要：
  - `temp/feedback-closeout/update-feedback-status-20260615-6a2d4058-6a2d407c-6a2d4094-to-closed.raw.txt`
- 回写后状态快照：
  - `temp/feedback-closeout/query-feedback-6a2d4058-6a2d407c-6a2d4094-after-writeback-20260615.raw.txt`
- 回写后人工 open/in_progress 列表：
  - `temp/feedback-closeout/query-human-open-inprogress-after-20260615-6a2d4058-6a2d407c-6a2d4094.raw.txt`

## 现场证据

- 三条反馈来自同一局现场，核心对象一致：
  - 基地：`小马乐园（base_pony_paradise）`
  - 场上同控制者随从：
    - `顽强丧尸（zombie_tenacious_z）`
    - `海星（mythic_horses_seastar）`
    - `顽强丧尸（zombie_tenacious_z）`
    - `星耀（mythic_horses_starlyte）`
  - `鼓舞之力（mythic_horses_encouragement_power）` 附着在 `星耀` 身上
- 行动日志还原：
  - `19:31:17`：`海星` 天赋触发
  - `19:31:23`：`星耀` 登场到 `小马乐园`
  - `19:33:18`：`鼓舞之力` 施放并附着到 `星耀`
- 这说明：
  - `海星` 的额外召唤并非“没触发”，而是已经触发并被消费掉
  - `星耀` 与 `鼓舞之力` 的效果要看运行时结算值，不能只看原始 `powerModifier` 字段

## 本地规则证据

- 小马能力测试：
  - `src/games/smashup/__tests__/abilities/mythic-horses.test.ts`
    - `mythic_horses_seastar 有其他己方随从基地时授予这里一次额外随从`
- 小马持续战力测试：
  - `src/games/smashup/__tests__/ongoingModifiers.test.ts`
    - `mythic_horses_starlyte 按同基地其他己方随从数量给自己加力量`
    - `mythic_horses_encouragement_power 按每张附着牌 owner 逐个统计其他己方随从数量`

## 本地验证

- 验证命令：
  - `pnpm vitest run src/games/smashup/__tests__/abilities/mythic-horses.test.ts src/games/smashup/__tests__/ongoingModifiers.test.ts --testNamePattern "mythic_horses_seastar|mythic_horses_starlyte|mythic_horses_encouragement_power"`
- 结果：
  - `2` 个文件
  - `3` 条目标测试通过

## 生产反馈状态

### 1. 回写前

- 三条反馈在生产 `feedbacks` 真源中均为 `status: open`。

### 2. 回写执行

- 目标状态：均为 `closed`
- 关闭理由写入：
  - `6a2d40588b110d6694bb8db1`：`鼓舞之力` 的加力是运行时结算，不直接写原始字段；当前规则与测试已覆盖
  - `6a2d407c8b110d6694bb8db3`：`星耀` 只给自己加力，不会反向给其他随从加力；当前规则与测试已覆盖
  - `6a2d40948b110d6694bb8db5`：行动日志已证明 `海星` 的额外召唤当时实际生效
- 真源回写结果：
  - 三条均 `matchedCount=1`
  - 三条均 `modifiedCount=1`
  - `updatedAt=2026-06-15T02:52:00.000Z`

### 3. 回写后

- 三条反馈在生产 `boardgame.feedbacks` 中均已变为 `status: closed`。
- 回写后人工 `feedback-modal` 的 `open/in_progress` 计数为 `1`。

## 收口边界

- 本轮没有新增业务修复代码。
- 这三条收口不是“某个新补丁已上线”，而是“当前树规则、测试与行动日志共同证明它们不是现存规则缺口”。
