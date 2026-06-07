# Change: Smash Up 葫芦娃派系正式接入

## Why

- 用户已经确认本轮要把 `葫芦娃` 作为 `Smash Up / 大杀四方` 的正式内置派系接入，而不是继续停留在素材整理阶段。
- 当前仓库没有 `huluwawa` 的 faction id、卡牌/基地/泰坦定义、资源接线、locale、玩法实现与测试闭环。
- 用户已经提供了明确的中文规则文本，以及可直接使用的本地图集与泰坦单图，因此可以按“中文首版正式可玩”路线推进。

## What Changes

- 新增 `add-smashup-huluwawa-faction` OpenSpec 变更，明确本轮只做官方内置派系接入，不做通用 DIY 派系框架。
- 接入 `huluwawa` 的 card/base/titan 静态数据、atlas 资源、UI metadata、locale 与预加载链路。
- 实现 `葫芦娃` 的 18 张仆从/行动、2 张基地和 `葫芦小金刚` 泰坦的玩法能力。
- 调整测试与 i18n 完整性规则，使 `huluwawa` 在中文界面正式可玩、英文界面先隐藏。
- 为本轮资源与玩法交付补齐 evidence、资产压缩、manifest 更新与验证证据。

## Impact

- Affected specs:
  - 新增 `smashup-huluwawa-faction`
- Affected code / docs:
  - `src/games/smashup/domain/{ids,atlasCatalog}.ts`
  - `src/games/smashup/data/{cards.ts,titans.ts,factions/huluwawa.ts}`
  - `src/games/smashup/abilities/{index.ts,huluwawa.ts,titans.ts}`
  - `src/games/smashup/ui/factionMeta.ts`
  - `src/games/smashup/runtimeCriticalImageResolver.ts`
  - `src/games/smashup/__tests__/**`
  - `public/locales/zh-CN/game-smashup.json`
  - `public/assets/i18n/zh-CN/smashup/**`
  - `evidence/smashup/**`
- Key risks:
  - `葫芦娃` 首版只有中文真相源，需要确保英文 UI 不暴露未本地化派系。
  - `葫芦小金刚` 的“复制仆从发动能力”需要与当前主动能力运行时模型对齐，避免扩散到被动触发链。
  - `二娃` 与 `一根藤上七朵花` 都需要新的交互编排，必须补对应测试与证据，不能只做静态接线。
