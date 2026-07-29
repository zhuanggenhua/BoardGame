import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  BETRAYAL_DISCOVERY_POOLS,
  BETRAYAL_SCENARIO_CONFIGS,
  isBetrayalEventRuntimeSupported,
  type BetrayalEventSeed,
} from '../../../src/games/betrayal/scenarioConfig';

const outputPath = resolve('evidence/betrayal/full-audit/object-inventory.json');

const firstScenarioObjects = [
  { id: 'haunt-trigger', name: '作祟触发', category: 'scenario' },
  { id: 'traitor-selection', name: '叛徒确认', category: 'scenario' },
  { id: 'place-mummy-and-sarcophagus', name: '放置木乃伊与石棺', category: 'setup' },
  { id: 'place-mummy-girl', name: '放置女孩', category: 'setup' },
  { id: 'prepare-mummy-knowledge-tokens', name: '准备知识标记', category: 'setup' },
  { id: 'study-mummy-name', name: '寻找木乃伊真名', category: 'hero-action' },
  { id: 'learn-mummy-banishment', name: '学习驱逐法术', category: 'hero-action' },
  { id: 'banish-mummy', name: '驱逐木乃伊', category: 'hero-action' },
  { id: 'pick-up-mummy-girl', name: '拾起女孩', category: 'haunt-side-rule' },
  { id: 'give-girl-to-mummy', name: '把女孩交给木乃伊', category: 'traitor-action' },
  { id: 'give-omen-to-mummy', name: '把圣符或指环交给木乃伊', category: 'traitor-action' },
  { id: 'mummy-monster-movement', name: '木乃伊移动与 0/1 瞬移', category: 'monster' },
  { id: 'mummy-forced-attack', name: '木乃伊同房强制攻击', category: 'monster' },
  { id: 'mummy-attack-reward', name: '木乃伊伤害或偷窃选择', category: 'combat' },
  { id: 'survivor-victory', name: '英雄胜利终局', category: 'endgame' },
  { id: 'traitor-victory', name: '叛徒胜利终局', category: 'endgame' },
];

function summarizeEvent(event: BetrayalEventSeed) {
  return {
    id: event.name,
    name: event.name,
    runtimeSupported: isBetrayalEventRuntimeSupported(event),
    rollTrait: event.roll?.kind === 'dice' ? null : event.roll?.trait ?? null,
    rollDice: event.roll?.kind === 'dice' ? event.roll.dice : null,
    branches: event.roll?.branches.map((branch) => ({
      min: branch.min,
      label: branch.label,
      effectMode: branch.effect.mode,
    })) ?? [],
    effectMode: event.effect?.mode ?? null,
    modes: [
      event.effect?.mode,
      event.roll?.kind === 'dice' ? 'diceRoll' : event.roll?.trait ? 'traitRoll' : undefined,
      ...(event.roll?.branches.map((branch) => branch.effect.mode) ?? []),
    ].filter(Boolean),
  };
}

function collectRuntimePossessions() {
  const discoveryCards = [
    ...BETRAYAL_DISCOVERY_POOLS.possessions.item,
    ...BETRAYAL_DISCOVERY_POOLS.possessions.omen,
  ];
  const cardsById = new Map(discoveryCards.map((card) => [card.id, { ...card, source: 'discoveryPool' }]));

  for (const cards of Object.values(
    BETRAYAL_SCENARIO_CONFIGS['first-scenario'].startingInventoryByExplorerId,
  )) {
    for (const card of cards) {
      if (!cardsById.has(card.id)) {
        cardsById.set(card.id, { ...card, source: 'firstScenarioStartingInventory' });
      }
    }
  }

  return [...cardsById.values()].sort((a, b) => a.id.localeCompare(b.id));
}

const inventory = {
  generatedAt: process.env.BETRAYAL_AUDIT_GENERATED_AT ?? new Date().toISOString().slice(0, 10),
  source: 'src/games/betrayal/scenarioConfig.ts::BETRAYAL_DISCOVERY_POOLS',
  counts: {
    rooms: {
      ground: BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.length,
      upper: BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.length,
      basement: BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.length,
    },
    events: BETRAYAL_DISCOVERY_POOLS.events.length,
    runtimeEvents: BETRAYAL_DISCOVERY_POOLS.events.filter(isBetrayalEventRuntimeSupported).length,
    items: BETRAYAL_DISCOVERY_POOLS.possessions.item.length,
    omens: BETRAYAL_DISCOVERY_POOLS.possessions.omen.length,
    runtimePossessions: collectRuntimePossessions().length,
  },
  rooms: Object.fromEntries(
    Object.entries(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor).map(([floor, rooms]) => [
      floor,
      rooms.map((room) => ({
        id: room.visualId,
        name: room.name,
        floor,
        tags: [...room.tags],
        doorways: [...room.doorways],
        discoveryReward: null,
        discoveryEffect: room.discoveryEffect ?? null,
        endTurnEffect: room.endTurnEffect ?? null,
        enterEffect: room.enterEffect ?? null,
      })),
    ]),
  ),
  events: BETRAYAL_DISCOVERY_POOLS.events.map(summarizeEvent),
  possessions: {
    item: BETRAYAL_DISCOVERY_POOLS.possessions.item.map((card) => ({ ...card })),
    omen: BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((card) => ({ ...card })),
  },
  runtimePossessions: collectRuntimePossessions(),
  firstScenarioObjects,
};

writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
console.log(`Generated ${outputPath}`);
console.log(JSON.stringify(inventory.counts, null, 2));
