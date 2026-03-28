## Context
官方泰坦规则来自两部分：

- 《Big in Japan》规则书定义了泰坦的通用规则：泰坦是独立牌种；默认不在手牌/牌库/弃牌堆；只能在卡牌明确允许时打出；打出是可选且必须立即完成；同一玩家同时最多控制 1 个泰坦；标准基地上双泰坦会发生 clash；泰坦离场时回到牌库旁并清空指示物；计分清场时泰坦不进弃牌堆。
- TITANS Event Kit 为老派系补充了泰坦。本仓库当前已实现的派系中，有 10 个拥有官方泰坦。

仓库现状有三个明显缺口：

1. `PlayerState` 没有正式的泰坦结构，只有能力代码中的 `any.activeTitan` 假设。
2. 现有卡牌类型只有 `minion | action | fusion`，没有 `titan`。
3. 力量计算、基地清场、目标选择、UI 展示都默认“场上牌只有随从/行动/基地”。

这意味着泰坦不能作为“补一张卡”来实现，必须把它作为正式机制落到领域模型里。

## Goals
- 用单一真实来源建模泰坦，而不是在不同能力里各自塞临时字段。
- 支持 owner / controller 分离，避免未来出现“打出别人的泰坦”时返工。
- 支持泰坦 set-aside、在场、离场返还、指示物、每回合能力使用状态。
- 让力量、计分、清场、目标选择、UI 都使用同一套泰坦查询入口。
- 首批支持仓库中已实现且有官方泰坦的派系。

## Non-Goals
- 不在本次设计里实现 Big in Japan 四个派系。
- 不把 Kaiju Island 等未来基地特例写死到分支判断里；只预留显式可配置能力。

## Decision 1: 用全局 `TitanState[]` 建模泰坦，而不是塞进 `PlayerState.activeTitan`

### Rationale
- 玩家可能拥有 0~2 个泰坦，但同时只控制 0~1 个；owner 和 controller 也可能不同。
- 如果把“当前在场泰坦”塞进 `PlayerState.activeTitan`，会丢失“已拥有但未在场的泰坦”和 owner/controller 分离信息。
- 全局集合更容易做“按基地查泰坦”“按控制者查泰坦”“计分清场统一处理”。

### Proposed Shape
新增一等公民结构，示意如下：

```ts
type TitanLocation =
  | { zone: 'setaside' }
  | { zone: 'base'; baseIndex: number; enteredAt: number };

interface TitanState {
  uid: string;
  defId: string;
  faction: FactionId;
  ownerId: PlayerId;
  controllerId: PlayerId;
  powerCounters: number;
  talentUsed: boolean;
  location: TitanLocation;
  metadata?: Record<string, unknown>;
}
```

`SmashUpCore` 新增 `titans: TitanState[]`，并移除所有基于 `any.activeTitan` 的隐式读取。

## Decision 2: 新增 `TitanCardDef`，让泰坦成为正式牌种

### Rationale
- 官方规则明确泰坦既不是随从也不是行动。
- 现有系统很多逻辑依赖 `CardType`；如果不新增牌种，只能继续用 minion/action 伪装，后续规则会不断打补丁。

### Proposed Shape
新增：

```ts
type CardType = 'minion' | 'action' | 'fusion' | 'titan';

interface TitanCardDef {
  id: string;
  type: 'titan';
  faction: FactionId;
  name: string;
  abilityTags?: AbilityTag[];
  previewRef?: CardPreviewRef;
  summonMode: 'explicit' | 'insteadOfRegularMinion' | 'insteadOfRegularAction';
  playAsKinds?: Array<'minion' | 'action'>;
}
```

说明：
- `summonMode` 不是为了替代卡面文本，而是为了显式声明该泰坦会消耗哪种常规出牌额。
- `playAsKinds` 只描述“这张泰坦在被打出时可作为哪种常规牌被选择/验证”，不改变其静态牌种。
- 泰坦不进入 20 张派系牌库，不参与 `buildDeck`。

## Decision 3: “可视作随从打出”通过显式出牌语义建模，而不是改牌种

### Rationale
- 用户已明确要求：某些泰坦可以被“选择一个随从打出”的效果选中，但这不等于它们在场上是随从。
- 如果直接把这类泰坦伪装成 `type='minion'`，会污染目标选择、保护效果、计分资格、清场和 clash 规则。
- 真正需要放宽的是“打出阶段的候选资格”，不是“运行时卡牌类型”。

### Proposed Changes
- 增加统一 helper，例如 `canCardBePlayedAs(cardLike, 'minion' | 'action', context)`。
- 对“打出一个随从/行动”类效果，候选计算改为调用上面的 helper，而不是只看 `card.type`。
- 对“选择一个 minion/action 作为目标”类效果，仍然只按真实牌种判断，不因为 `playAsKinds` 放宽。
- reducer、ongoing、清场、计分、保护、clash、日志都继续以真实 `type='titan'` 为准。

## Decision 4: 为泰坦增加显式命令/事件，而不是复用随从事件

### Rationale
- “打出泰坦不算打出随从/行动”“移动泰坦不改变控制权”“离场回牌库旁不进弃牌堆”都和随从事件语义不同。
- 复用随从事件会把各种例外散落到 reducer 和触发器里，后续难维护。

### Proposed Commands / Events
- `su:play_titan`
- `su:move_titan`
- `su:titan_played`
- `su:titan_moved`
- `su:titan_removed_from_play`
- `su:titan_clash_resolved`
- `su:titan_power_counter_added`
- `su:titan_power_counter_removed`
- `su:titan_metadata_updated`

已有能力通过 `abilityHelpers.playTitan(...) / moveTitan(...) / removeTitanFromPlay(...)` 这类统一 helper 生成事件，不直接写裸事件。

## Decision 5: Clash 作为通用后处理，而不是散落在个别能力里

### Rationale
- 官方规则规定：打出或移动到已有泰坦的基地都要 clash。
- 这是机制级后处理，不应该让每张会打出/移动泰坦的卡自己记得补 clash。

### Proposed Flow
- `TITAN_PLAYED` / `TITAN_MOVED` reduce 后，统一进入 `postProcessSystemEvents`。
- 如果目标基地存在多个泰坦：
  - 默认触发 clash。
  - 若基地定义显式声明 `allowMultipleTitans: true`，则跳过 clash（为未来 Kaiju Island 预留）。
- clash 比较双方该基地的总力量：
  - 包括随从、可计入力量的行动、泰坦指示物/能力带来的力量。
  - 包括 ongoing。
  - 不包括 talent。
  - 平局时先在场的泰坦保留。

## Decision 6: 力量与计分资格通过统一查询函数纳入泰坦

### Rationale
- 官方规则里泰坦本体没有基础力量，但它的指示物和能力可能让你拥有力量并获得计分资格。
- 现有代码很多地方默认“计分资格来自随从或总力量”；泰坦不能再走旁路。

### Proposed Changes
- 增加 `getTitansOnBase(baseIndex, state)`、`getTitanByController(playerId, state)`、`getTitanPowerContribution(...)` 等查询函数。
- `getPlayerEffectivePowerOnBase` 和相关 breakdown 逻辑纳入泰坦指示物/能力贡献。
- “至少有 1 个随从或至少有 1 点总力量才能拿分”的现有规则继续保留；泰坦只通过“总力量”路径满足资格。

## Decision 7: 清场与离场统一走 `removeTitanFromPlay`

### Rationale
- 官方规则要求：无论是被 destroy/return/place，还是基地离场，还是计分清场，泰坦都回到牌库旁并清空指示物。
- 如果每条链路自己写，会很容易漏掉“清空 counters / 重置 talentUsed / 保留 ownerId / 移除 base 关联”。

### Proposed Changes
- 新增统一 helper `removeTitanFromPlay(state, titanUid, reason, now)`。
- 所有“会让泰坦离场”的路径都只调用这一入口。
- 计分清场第 6 步也使用同一入口，而不是走普通弃牌归约。

## Decision 8: 用通用 room setup 多选字段承载扩展开关

### Rationale
- 用户要求创建房间阶段就能配置扩展，而且这必须是通用 UI，不能只为 Smash Up 手写一个私有表单。
- `setupOptions` 当前只有单选 `select`，不足以表达“默认全选、可多选、允许清空”的扩展配置。
- 把扩展开关放到 manifest 声明层，可以让未来其他游戏直接复用，而不需要复制创建房间 UI。

### Proposed Shape
- `GameSetupField` 新增：

```ts
interface GameSetupMultiSelectField {
  type: 'multi-select';
  labelKey: string;
  options: GameSetupSelectOption[];
  default?: string[];
}
```

- `CreateRoomModal` 统一渲染：
  - 折叠式选择器入口
  - 已选标签行
  - 标签右侧关闭按钮用于取消单项
  - 下拉面板内复选项列表
- 默认值规则：
  - 若 manifest 显式提供 `default`，用该值
  - 否则默认选中全部选项
  - 允许最终为空数组
- 创建房间提交时，把结果写入 `setupData.setupSelections[fieldKey] = string[]`

### Smash Up Binding
- `src/games/smashup/manifest.ts` 声明 `expansions` 多选字段，首批至少包含 `titans`。
- 默认值包含 `titans`，但房主可以移除它。
- `setup()` 初始化时读取 `setupData.setupSelections?.expansions`；若未启用 `titans`，则不初始化任何泰坦 set-aside 数据。

## Decision 9: 泰坦 UI 摆位使用显式锚点，不挤压现有布局

### Rationale
- 用户已经明确指定了摆位顺序：基地上的泰坦优先放在持续行动上方一排；没有持续行动时放在基地上方；己方可用泰坦放在牌库右侧排列。
- 这类元素是瞬态/附加信息，必须走 overlay，不得把现有基地布局和牌库布局挤乱。
- clash 期间同一基地可能短暂出现两个泰坦，因此需要一个稳定的“泰坦行”而不是把泰坦塞进随从列。

### Proposed Layout
- `BaseZone` 新增 `TitanRow`：
  - 以 `absolute` 方式居中挂在基地区上方
  - 若当前基地存在 `ongoingActions`，锚点位于 ongoing 行再上方一层
  - 若当前基地没有 `ongoingActions`，锚点直接位于 base card 上方
  - 行内最多展示该基地上的两个泰坦，并保留指示物/控制者信息
- `DeckDiscardZone` 或其上层容器新增 `SetAsideTitanRail`：
  - 仅对当前视角玩家展示自己的可用泰坦
  - 紧贴牌库右侧排列
  - 与牌库、弃牌堆保持独立 hit area，避免误触
- 所有泰坦展示位都必须支持与现有卡牌预览/高亮/点选逻辑对接。

## Decision 10: 首批泰坦范围只覆盖仓库已实现派系

### Supported Titans
- `vampires_ancient_lord`
- `wizards_arcane_protector`
- `tricksters_big_funny_giant`
- `ghosts_creampuff_man`
- `cthulhu_cthulhu_titan`
- `innsmouth_dagon`
- `giant_ants_death_on_six_legs`
- `werewolves_great_wolf_spirit`
- `bear_cavalry_major_ursa`
- `pirates_the_kraken`

### Rationale
- 这能让首批交付直接覆盖当前仓库已可游玩的相关派系。
- 对未实现派系不预置空数据，避免伪支持。

## Testing Strategy
- 领域单测：
  - set-aside 初始化
  - 泰坦打出/移动/离场/回牌库旁
  - 同玩家单泰坦限制
  - clash 胜负与平局
  - 计分资格与总力量
  - 计分清场不进弃牌堆
- UI/E2E：
  - 泰坦可见
  - 允许打出泰坦时有明确交互入口
  - 含泰坦的计分清场截图证据

## Risks / Trade-offs
- 这是横跨状态、规则、UI 的系统改动，初期改动面会比“只加卡牌脚本”大。
- 但把泰坦做成正式牌种后，未来再接入 Kaiju/魔法少女/Changerbots 等依赖泰坦的内容会明显更稳。
