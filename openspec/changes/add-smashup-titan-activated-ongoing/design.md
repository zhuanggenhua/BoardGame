## Context

`Emperor Penguin / 企鹅帝皇` 的 ongoing 文本是：

- 你可以从牌库顶打出随从至本基地中以代替打出通常随从。

它具备 3 个关键语义：

1. 入口发生在泰坦已经在场之后，不是 set-aside special。
2. 是否使用由玩家主动决定，不是被动自动触发。
3. 消耗的是一次常规随从打出，不是 talent 次数，也不是 special 限次。

现有系统只有 `special` 和 `talent` 两种主动入口，无法无歧义承载这类能力。

## Goals

- 为“在场泰坦的主动 ongoing 能力”建立独立入口，不污染 `special` / `talent` 语义。
- 让 UI 只在能力真的可用时高亮泰坦，避免所有 `ongoing` 都变成可点击。
- 允许能力解析函数消费常规出牌额等资源，而不是复用 `talentUsed`。
- 先支持 `Emperor Penguin`，但让数据契约和命令命名能容纳后续同类泰坦。

## Non-Goals

- 不把所有 `ongoing` 都升级为主动能力。
- 不在这次设计中引入面向所有牌种的通用 activated-ongoing 框架。

## Decision 1: 新增显式“可主动激活能力 kind”，而不是直接依赖 `abilityTags=['ongoing']`

### Rationale

- `abilityTags` 当前主要描述卡面能力段落，`ongoing` 同时覆盖被动持续和主动持续。
- 如果 UI 仅凭 `abilityTags.includes('ongoing')` 高亮，会把大量被动能力误判成可点击。
- 最小正确做法是增加单独的“可主动激活 kind”声明，让 `Emperor Penguin` 明确声明自己拥有 `ongoing` 激活入口，而其他被动 ongoing 保持不变。

### Proposed Shape

```ts
type ActivatableAbilityKind = 'special' | 'talent' | 'ongoing';

interface TitanCardDef {
  ...
  activatableAbilityKinds?: ActivatableAbilityKind[];
}
```

- `abilityTags` 继续表示卡面具备哪些能力段；
- `activatableAbilityKinds` 专门驱动 UI 高亮和命令分发。

## Decision 2: 为泰坦 ongoing 主动能力增加独立命令与解析入口

### Rationale

- `USE_TALENT` 会复用 `talentUsed` 门禁，语义不对。
- `ACTIVATE_SPECIAL` 当前限定在 `playCards | scoreBases`，并带有 special 专属校验，也不对。
- 用独立命令可以把“常规随从额替代”“是否可从牌库顶打出”“目标基地固定为泰坦所在基地”等规则留在专属 validator / executor 中。

### Proposed Shape

```ts
type SmashUpCommand =
  | { type: 'su:activate_titan_ongoing'; payload: { titanUid: string; baseIndex: number } }
```

- validator 独立检查：
  - 泰坦是否在该基地；
  - 是否为控制者的回合；
  - 该泰坦是否声明了 `activatableAbilityKinds.includes('ongoing')`；
  - 该能力自己的前置条件是否满足。
- ability registry 增加对应解析入口，例如 `resolveTitanOngoingActivation(defId)` 或等价的显式 tag。

## Decision 3: `Emperor Penguin` 的首次实现走“显式点击泰坦触发”路径

### Rationale

- 这条能力本质上是在“是否使用这次常规随从打出”上给玩家一个替代来源。
- 让玩家直接点击在场泰坦，路径最明确，也不需要把牌库顶伪装成手牌或 set-aside 牌。
- 该入口不会改变泰坦牌种，也不会把“牌库顶随从”混入普通手牌出牌路径。

### Proposed Flow

1. `BaseZone` 识别可用的泰坦 ongoing 激活入口并高亮。
2. 玩家点击泰坦，dispatch `ACTIVATE_TITAN_ONGOING`。
3. validator 校验：
   - 当前阶段为 `playCards`
   - 轮到泰坦控制者
   - 仍有常规随从打出额度
   - 牌库顶是可合法打到该基地的随从
4. executor 生成“从牌库顶打出该随从到当前基地”的领域事件，并消耗一次常规随从打出。

## Decision 4: 首个 scenario 只覆盖 `Emperor Penguin`，但命令命名不绑具体卡

### Rationale

- 当前用户任务只要求继续推进下一张泰坦，没必要同时把未来所有同类卡一起实现。
- 但如果命令直接命名成 `ACTIVATE_EMPEROR_PENGUIN_ONGOING`，后续会重复造轮子。

### Result

- OpenSpec requirement 用“在场泰坦的主动 ongoing 能力”命名；
- 实现阶段首个 consumer 是 `Emperor Penguin`。
