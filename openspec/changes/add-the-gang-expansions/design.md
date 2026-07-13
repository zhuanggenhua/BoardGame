## Context
The Gang 基础版已完成运行时接入，但旧规范明确把 7-10 人、Joker、挑战、专家、工具和扑克变体列为范围外。TTS Workshop JSON 的 `LuaScript` 字段提供了本次扩展还原的主要真相源。

## Goals / Non-Goals
- Goals: 还原 TTS Lua 中可直接落到现有规则内核的模式、挑战、特殊牌和牌型评估。
- Goals: 提供可见扩展选择 UI，但仍保持当前绿色牌桌和折叠面板风格。
- Goals: 保留每条扩展的运行时状态，避免未实现规则被误报为完成。
- Non-Goals: 不解包或复刻保险柜 3D 模型。
- Non-Goals: 不在本次实现工具牌、专家牌、保险柜交互和提醒类桌面脚本。
- Non-Goals: 不把扩展选择做成新的游戏入口或替换基础牌桌 UI。

## Decisions
- Decision: 规则配置挂在 The Gang 领域状态中，并在首轮未选筹码前允许修改。
- Rationale: 规则配置会影响发牌、牌堆和牌型评估，开始抢劫后再改会破坏当前局面一致性。
- Decision: `pocketCards` 在运行时表示前置公共牌或个人公共牌，不当作额外隐藏手牌。
- Rationale: TTS Lua 中 `pocketCards` 被用于生成公共/个人公共牌 tile，尤其七张梭哈是 3 张手牌加 1 张个人公共牌。
- Decision: 已实现挑战与已记录挑战共享注册表，但通过 `runtimeStatus` 区分。
- Rationale: UI 可以完整呈现来源范围，同时防止提醒类、工具类、专家类和保险柜类规则被误认为已经生效。
- Decision: 特殊牌使用程序化牌面。
- Rationale: 当前目标是规则脚本还原，Joker、万能牌和空白牌没有稳定运行时素材，程序化替代足以支撑规则验收。

## Risks / Trade-offs
- 部分 TTS 规则依赖桌面提醒、工具对象或保险柜交互；本次只记录，不改变正式游戏逻辑。
- 万能牌和鬼牌评估需要枚举替代牌，后续若继续扩展牌型，应优先增加针对性牌型测试。
- 七张梭哈和香蕉分牌使用个人公共牌，摊牌逻辑必须优先读取个人公共牌，基础德州扑克必须继续读取共享公共牌。

## Validation
- ESLint 覆盖 The Gang Board、domain、game、manifest 与相关测试。
- Vitest 覆盖扑克评估、基础流程、扩展配置、Board 运行时和 manifest。
- OpenSpec 严格校验该 change。

