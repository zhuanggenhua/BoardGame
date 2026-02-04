# 新游戏目录骨架（最小模板）

```
src/games/<gameId>/
  manifest.ts
  game.ts
  Board.tsx
  thumbnail.tsx        # 可选
  tutorial.ts          # 可选
  audio.config.ts      # 可选
  domain/
    index.ts
    types.ts
    commands.ts
    reducer.ts
    rules.ts           # 可选
  __tests__/
    flow.test.ts       # 推荐覆盖核心流程
```

## manifest.ts（最小示例）
```ts
import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: '<gameId>',
    type: 'game',
    enabled: true,
    titleKey: 'games.<gameId>.title',
    descriptionKey: 'games.<gameId>.description',
    category: 'strategy',
    playersKey: 'games.<gameId>.players',
    icon: '🎮',
};

export const <GAME_ID>_MANIFEST: GameManifestEntry = entry;
export default entry;
```

## game.ts（最小示例）
```ts
import { createGameAdapter, createLogSystem, createActionLogSystem } from '../../engine';
import { <GameDomain> } from './domain';

const systems = [
    createLogSystem(),
    createActionLogSystem(),
];

export const <GameId> = createGameAdapter({
    domain: <GameDomain>,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: [
        '<COMMAND_1>',
    ],
});

export default <GameId>;
```

## domain/index.ts（最小示例）
```ts
import type { DomainCore, PlayerId, RandomFn, GameOverResult } from '../../../engine/types';
import type { <Core>, <Command>, <Event> } from './types';
import { validate } from './commands';
import { execute, reduce } from './reducer';

export const <GameDomain>: DomainCore<<Core>, <Command>, <Event>> = {
    gameId: '<gameId>',
    setup: (playerIds: PlayerId[], _random: RandomFn): <Core> => ({
        playerIds,
    } as <Core>),
    validate,
    execute,
    reduce,
    isGameOver: (state: <Core>): GameOverResult | undefined => state.gameResult,
};
```

> 说明：示例仅展示结构与接口形态。实际实现必须根据规则补齐校验、事件、状态与 UI。不要直接复制 dicethrone 的规则或数据结构。若需要多阶段流程，使用 FlowSystem + FlowHooks，并保持阶段为单一权威来源。
