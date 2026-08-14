# DiceThrone 其他能力交互形态横向扩审（2026-04-05）

## 审计范围

- 游戏：`dicethrone`
- 目标：在枪手 `compare-roll-choice` 落地后，继续横向确认其他英雄/卡牌/Token 是否还存在“应该升格成新交互类型，但仍被塞进旧壳”的能力。
- 本轮覆盖文件：
  - `src/games/dicethrone/domain/systems.ts`
  - `src/games/dicethrone/ui/BoardOverlays.tsx`
  - `src/games/dicethrone/domain/customActions/common.ts`
  - `src/games/dicethrone/domain/customActions/monk.ts`
  - `src/games/dicethrone/domain/customActions/paladin.ts`
  - `src/games/dicethrone/domain/customActions/pyromancer.ts`
  - `src/games/dicethrone/domain/customActions/samurai.ts`
  - `src/games/dicethrone/domain/customActions/shadow_thief.ts`
  - `src/games/dicethrone/domain/customActions/gunslinger.ts`
  - `src/games/dicethrone/heroes/**/abilities.ts`

## 权威来源

- 运行时交互映射：`src/games/dicethrone/domain/systems.ts`
- 前端交互承载：`src/games/dicethrone/ui/BoardOverlays.tsx`
- 能力/卡牌真实实现：各英雄 `customActions/*.ts`
- 规则语义关键词复审：各英雄 `abilities.ts`
- 审计框架：`.spec/knowledge/standards/testing-audit.md`

## 审计方法

1. 枚举 DiceThrone 当前所有可见交互入口：`CHOICE_REQUESTED`、`COMPARE_ROLL_REQUESTED`、`INTERACTION_REQUESTED`、`BONUS_DICE_REROLL_REQUESTED`、`TOKEN_RESPONSE_REQUESTED`。
2. 反查 `systems.ts` 与 `BoardOverlays.tsx`，确认每类入口都对应唯一 UI 承载层。
3. 扫描 `customActions` 中所有 `requiresInteraction: true`、`CHOICE_REQUESTED`、`INTERACTION_REQUESTED`、`COMPARE_ROLL_REQUESTED` 的发射点。
4. 再用“双方各掷 / 比较 / 对决 / 若你的结果”等语义关键词复审 `heroes/**/abilities.ts`，确认是否还有 compare-roll 语义漏网。

## 当前交互家族

DiceThrone 当前已明确落地的交互类型共 6 类：

1. `simple-choice`
2. `compare-roll-choice`
3. `multistep-choice`（改骰 / 选骰）
4. `dt:card-interaction`（选玩家 / 选状态）
5. `dt:bonus-dice`
6. `dt:token-response`

对应映射入口在 `src/games/dicethrone/domain/systems.ts`，对应 UI 承载在 `src/games/dicethrone/ui/BoardOverlays.tsx`。

## 逐项结论

### 1. 目前命中 compare-roll 语义的只有枪手

- 复审关键词命中结果只落在：
  - `src/games/dicethrone/heroes/gunslinger/abilities.ts`
  - `src/games/dicethrone/domain/customActions/gunslinger.ts`
- 未在其他英雄能力描述中发现新的“双方各掷 / 比较结果后再分支”的语义。
- 判定：
  - 当前 `compare-roll-choice` 没有遗漏到其他英雄。
  - 本轮不需要继续新增第二种 compare 类交互变体。

### 2. 其他 `CHOICE_REQUESTED` 场景仍属于普通选择，不构成新交互

- 命中样例：
  - `src/games/dicethrone/domain/customActions/monk.ts`
    - 清修 III：二选一获得 `闪避 / 净化`
    - 花开见佛：支付 2 太极或跳过
  - `src/games/dicethrone/domain/customActions/pyromancer.ts`
    - 花费任意数量 CP 换火焰专精，用 slider 选择数值
- 判定：
  - 这些场景本质都是“普通按钮选择”或“普通数值确认”。
  - 现有 `simple-choice` + slider 扩展已经匹配语义，不需要升格成新交互类型。

### 3. 其他 `INTERACTION_REQUESTED` 场景仍属于既有选择类交互，不构成新交互

- 命中样例：
  - `src/games/dicethrone/domain/customActions/common.ts`
    - 改骰 / 复制骰 / 调整骰 / 选骰重掷
  - `src/games/dicethrone/domain/customActions/paladin.ts`
    - 选择玩家授予守护/弹反等
  - `src/games/dicethrone/domain/customActions/samurai.ts`
    - 四人局选定敌方目标
  - `src/games/dicethrone/domain/customActions/shadow_thief.ts`
    - 暗影操控改 1~2 颗骰
  - `src/games/dicethrone/domain/customActions/gunslinger.ts`
    - 多人局卡牌选定敌方玩家
- 判定：
  - 这些交互分别落在：
    - `multistep-choice`（改骰 / 选骰）
    - `dt:card-interaction`（选玩家 / 选状态）
  - 语义与承载层一致，没有出现像枪手 compare-roll 那种“领域语义比 UI 壳更丰富”的断层。

### 4. Bonus die 与 token response 仍是独立家族，暂未发现应再拆分的新类型

- `BONUS_DICE_REROLL_REQUESTED` 继续由 `dt:bonus-dice` 承载，覆盖“展示掷骰结果 + 可选重掷”。
- `TOKEN_RESPONSE_REQUESTED` 继续由 `dt:token-response` 承载，覆盖伤害响应窗口中的 token 消耗。
- 判定：
  - 当前没有发现必须再拆出“第三种骰子结算 overlay”或“第二种 token 响应壳”的场景。

## 审计结论

- 本轮横向扩审后，未发现除枪手 `Showdown / Duel` 之外的第二批“应升格为新交互类型”的能力。
- 当前 DiceThrone 交互家族与能力语义的对应关系仍然成立：
  - 普通二选一/滑条确认 → `simple-choice`
  - 双方对掷并比较 → `compare-roll-choice`
  - 改骰/选骰 → `multistep-choice`
  - 选玩家/选状态 → `dt:card-interaction`
  - 奖励骰展示/重掷 → `dt:bonus-dice`
  - Token 响应窗口 → `dt:token-response`

## 未覆盖风险

1. 本轮是静态横向审计，不是把所有交互能力逐条重新跑一遍 E2E。
2. 若后续新增英雄或改写现有描述，尤其出现“双方比较”“公开对掷”“先展示结果再二次决策”这类语义，必须优先复用 `compare-roll-choice`，并补回归。
3. 若未来 `simple-choice` 再被塞入更复杂的结构化结果帧，需要再次按 `D5 / D15 / D20 / D48` 复审，不应默认沿用当前结论。
