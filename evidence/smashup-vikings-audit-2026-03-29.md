# Smash Up Vikings 审计（2026-03-29）

## 审计定位
- 本文档是 `Oops, You Did It Again` 四派系逐派系审计的第 2 轮，承接 `Ancient Egyptians` 之后，收口 `Vikings`。
- 本轮重点核对维京的“可选揭示 / 额外打出 / 牌库顶操作 / 埋葬牌夺取 / 主动基地能力”语义，确认不是只“能跑”，而是规则时点与所有权都正确。

## 审计范围
- 派系数据定义：`src/games/smashup/data/factions/vikings.ts`
- 派系能力实现：`src/games/smashup/abilities/vikings.ts`
- 相关回归测试：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `src/games/smashup/__tests__/newBaseAbilities.test.ts`

## 规则依据
- `https://smashup.fandom.com/wiki/Vikings`
- `https://smashup.fandom.com/wiki/Drakkar`
- `https://smashup.fandom.com/wiki/Longhouse`
- `https://www.alderac.com/smash-up-faq/`

## 本轮已确认规则结论

### 结论 1：多张维京牌是“you may”，不能强制执行
- 命中项：
  - `Huscarl`
  - `Shield Maiden`
  - `Valkyrie`
  - `Drakkar`
- 旧实现把这些效果做成了只要能选就必须选，缺少“跳过”。
- 现已统一补成显式可跳过交互，避免把可选收益错误升级成强制收益。

### 结论 2：`Longhouse` 是主动基地能力，不是回合开始自动弹窗
- 规则语义是 “On your turn, you may ...”。
- 这类描述应落到“你的回合中主动使用”的基地能力入口，而不是 `onTurnStart` 自动询问。
- 现已改为 `registerActiveBaseAbility('base_longhouse', ...)`，并沿用共享的 `USE_BASE_ABILITY` 链路。

### 结论 3：`Raiding Party` 是“立即作为额外牌打出”，不是“先拿到手里再给额度”
- 规则语义：
  - 展示另一位玩家牌库顶 3 张；
  - 你可以把其中一张合格行动牌，或力量 4 以下的随从，作为额外牌打出；
  - 其余牌放回牌库顶。
- 旧实现误做成“转到手里 + 给额外额度”，这会把时点、目标选择和后续触发都做错。
- 现已改为：
  - 随从：先选基地，再直接作为额外随从打出；
  - 需要基地的行动：先选基地，再直接作为额外行动打出；
  - 需要随从目标的行动：先选随从，再直接结算；
  - 不再进入手牌中转。

### 结论 4：`Drakkar` 拿到的是发动者手里，不是被揭示玩家手里
- 规则是“you may draw it”，`you` 指发动 `Drakkar` 的玩家。
- 旧实现曾把合格牌放回被揭示玩家手里，所有权方向错了。
- 现已改正为进入发动者手牌。

### 结论 5：`Raider` 是“至多三张”，不是“至少一张”
- 规则文本允许 0 到 3 张。
- 旧实现把多选下限卡成了 `1`，会把“你可以不用放”错误变成强制消耗手牌。
- 现已改为 `min: 0, max: 3`。

## 本轮新增已确认修复

### 修复 1：`Huscarl / Shield Maiden / Valkyrie / Drakkar` 增加跳过选项
- 这些效果现在都保留 “you may” 的可选性。
- 不再出现“只要有目标就被迫执行”的偏差。

### 修复 2：`Longhouse` 改为主动基地能力
- 基地能力触发点从错误的 `onTurnStart` 改为主动调用。
- 现在只能在自己回合主动使用，也与共享的基地能力次数管线一致。

### 修复 3：`Raider` 的多选约束改正
- 现在允许不选，也允许 1 到 3 张。
- 临时力量加成仍按实际选择张数结算。

### 修复 4：`Drakkar` 的抽牌归属修正为发动者
- 揭示到合格牌后，进入的是当前发动能力的玩家手牌。
- 不再错误地回流给目标玩家。

### 修复 5：`Raiding Party` 改为直接额外打出
- 现在不是“先拿牌、后发额度”，而是直接模拟一次额外打牌：
  - 额外随从打出不消耗普通随从额度；
  - 额外行动打出按额外行动链路执行；
  - 需要基地/随从目标的牌会补齐对应选择交互。

### 修复 6：`Raiding Party` 的转移与重排事件顺序修正
- 旧实现先 `DECK_REORDERED` 再 `CARD_TRANSFERRED`，会导致目标牌先从牌库视角被抹掉，后续转移失败。
- 现已改成先转移被打出的那张牌，再重排其余揭示牌。

## 回归覆盖
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `vikings_shield_maiden 可以跳过可选揭示`
  - `vikings_raiding_party 会把揭示的低力量随从作为额外随从直接打出`
  - `vikings_raiding_party 选择需要基地的行动时会先选基地再作为额外行动打出`
- `src/games/smashup/__tests__/newBaseAbilities.test.ts`
  - `base_drakkar 首次有随从打到这里时会提示选择另一位玩家并把合格牌抽到发动者手里`
  - `base_longhouse 改为主动基地能力：使用后会把手牌置于牌库顶并给此基地己方随从 +2 力量`

## 本轮验证
- 已运行：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts --configLoader native --environment node`
- 结果：
  - `2` 个测试文件通过
  - `126 passed, 1 skipped`
- 说明：
  - 本地默认 Vitest/jsdom worker 仍有依赖噪音，因此本轮继续用 `--environment node` 验证领域逻辑链路。

## 审计收口结论
- 本轮已覆盖维京当前最容易出偏差的共享链路：
  - `optional may`
  - `draw ownership`
  - `extra play timing`
  - `deck reorder symmetry`
  - `active base ability`
- 当前未再发现新的高优先级规则偏差。
- `Vikings` 首轮审计收口完成，可进入下一个派系。
