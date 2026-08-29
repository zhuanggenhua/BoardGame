# 伤害计算管线迁移指南

项目伤害合同主源是 [`engine-damage-pipeline`](../../.spec/knowledge/standards/engine-damage-pipeline.md)。本文是迁移操作指南和历史注意事项，不单独定义新规范；当前函数签名与可用能力以源码和测试为准。

## 适用场景

新游戏或旧游戏改动只要涉及伤害、护盾、减伤、防止、生命值扣减、日志伤害展示、动画伤害展示或 AI 伤害判断，都应优先判断是否走统一伤害管线。

目标不是“多一层包装”，而是让数值结果、正式事件、日志、动画和 AI 消费来自同一个结算结果。

## 为什么迁移

旧写法的常见问题：

- 各游戏手写 `DAMAGE_DEALT`，护盾、减伤和防止规则容易不一致。
- 日志、动画或 AI 重新计算伤害，可能和 reducer 提交结果不一致。
- 撤回或重放后，跨批次累计状态可能污染本次结算。
- 每个游戏重复实现 breakdown，测试难覆盖所有组合。

迁移收益：

- 最终伤害统一落到 `actualDamage`。
- breakdown 由正式计算链产出，后续展示层只读取结果。
- Token / 状态 / 护盾修正可集中审查。
- 跨游戏行为更容易用共享管线单测覆盖。

## 代码入口

- 管线实现：[`src/engine/primitives/damageCalculation.ts`](../../src/engine/primitives/damageCalculation.ts)。
- 管线测试：[`src/engine/primitives/__tests__/damageCalculation.test.ts`](../../src/engine/primitives/__tests__/damageCalculation.test.ts)。
- 当前消费点：`rg -n "createDamageCalculation|toEvents\\(" src/games src/engine`。
- 游戏迁移测试：优先查 `src/games/<gameId>/__tests__/` 或该游戏领域测试目录。

## 迁移步骤

### 1. 识别迁移目标

先找出游戏里所有直接创建伤害事件、修改生命值或格式化伤害日志的位置：

```bash
rg -n "DAMAGE_DEALT|actualDamage|damage|health|shield|prevent" src/games/<gameId> src/engine
```

把命中点分成：

- 真实伤害结算。
- 只读展示，如日志、动画、UI。
- 测试 fixture 或历史证据。
- 非伤害含义的同名字段。

只有真实伤害结算进入迁移；展示层应该改成读取正式结果，而不是自己重算。

### 2. 接入管线

基础形态是创建一次伤害计算，再用 `toEvents()` 产出正式事件：

```ts
const calculation = createDamageCalculation({
  sourceId,
  targetId,
  baseDamage,
  state,
  timestamp,
});

const events = calculation.toEvents();
```

实际参数以当前源码为准；迁移前先看现有测试和已迁移游戏的调用方式。

### 3. 处理自动修正

只有 Token、状态、护盾等修正已经写入当前 state，且字段完整时，才启用自动收集。

如果同一条链路是“先授予资源，再造成伤害”，state 里还没有本次刚确认的修正，不能让管线从旧 state 自动读取。此时应显式传入本次确认的 `additionalModifiers`，并关闭会读取旧 state 的自动收集能力。

### 4. 替换展示消费

展示层、日志、动画和 AI 只能读取 reducer 已提交的正式结果：

- `actualDamage`
- breakdown / modifiers
- 正式伤害事件 payload

不要在 UI 或日志里再次根据 base damage、护盾或 Token 计算最终值。

### 5. 清掉旧手写主链

迁移完成后，旧的手写 `DAMAGE_DEALT` 主链不能与新管线并存。否则同一次攻击可能产生两套来源不同的伤害结果。

## 常见问题

### 什么时候使用自动收集

当修正来源已经是当前 state 的正式事实时使用，例如回合开始前已存在的护盾、状态或 token。

当修正来源来自本次交互刚选择、刚授予、尚未写入 state 的对象时，不要自动收集，应显式传入本次结果。

### 如何处理护盾减免

护盾减免必须进入同一次正式计算，并体现在 `actualDamage` 与 breakdown 中。日志只读 breakdown，不再自己扣一次护盾。

### 如何处理条件修正

条件修正先在游戏规则层判断是否成立，再作为 modifier 传给管线。不要把游戏专属条件塞进共享管线，让共享管线反向理解所有游戏规则。

### 迁移后 ActionLog 不对

先查 ActionLog 读取的是正式事件，还是旧累计状态 / 旧 payload 字段。日志如果从旧状态读取 total 值，即使伤害管线正确，也可能显示错。

### 测试失败怎么办

先区分失败类型：

- 数值不一致：检查 modifier 收集时机和顺序。
- breakdown 不一致：检查每个 modifier 的来源和标签。
- 日志不一致：检查日志是否还在重算。
- 动画不一致：检查动画是否读正式 `actualDamage`。

## 迁移检查清单

- [ ] 找到所有手写伤害事件和生命值扣减点。
- [ ] 确认每个修正来源是当前 state 事实，还是本次链路临时结果。
- [ ] 真实结算只由管线产出正式事件。
- [ ] 日志、动画、UI、AI 只读正式结果。
- [ ] 旧手写主链没有和新管线并存。
- [ ] 共享管线单测或对应游戏窄集成测试通过。
- [ ] 真实入口或代表态能证明玩家可见结果一致。

## 当前使用口径

- 具体游戏迁移经验只作为历史样例，不是通用规则来源。
- 历史迁移状态、未迁完的技能和一次性例外写入对应游戏记录或 evidence。
- 改共享管线时跑管线单测；改某个游戏时再跑该游戏的窄集成测试或真实入口 E2E。
