/**
 * FlowSystem 自动推进测试（当前引擎契约）
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { Cardia } from '../game';
import CardiaDomain from '../domain';
import type { CardiaCore } from '../domain/core-types';
import { CARDIA_COMMANDS } from '../domain/commands';
import { ABILITY_IDS } from '../domain/ids';
import { createTestCard } from './test-helpers';

function createRunner() {
  return new GameTestRunner({
    domain: CardiaDomain,
    systems: Cardia.systems,
    playerIds: ['0', '1'],
    random: {
      random: () => 0.5,
      d: (sides: number) => Math.floor(0.5 * sides) + 1,
      range: (min: number, max: number) => Math.floor(0.5 * (max - min + 1)) + min,
      shuffle: <T>(arr: T[]) => [...arr],
    },
  });
}

function seedHands(
  runner: GameTestRunner<CardiaCore>,
  p0Card: ReturnType<typeof createTestCard>,
  p1Card: ReturnType<typeof createTestCard>
) {
  const state = runner.getState();
  runner.setState({
    ...state,
    core: {
      ...state.core,
      players: {
        ...state.core.players,
        '0': {
          ...state.core.players['0'],
          hand: [p0Card],
          deck: [
            createTestCard({ uid: 'p0-deck-1', defId: 'deck_i_card_03', ownerId: '0', baseInfluence: 3, abilityIds: [] }),
          ],
        },
        '1': {
          ...state.core.players['1'],
          hand: [p1Card],
          deck: [
            createTestCard({ uid: 'p1-deck-1', defId: 'deck_i_card_04', ownerId: '1', baseInfluence: 4, abilityIds: [] }),
          ],
        },
      },
    },
  });
}

describe('FlowSystem Auto-Advance', () => {
  it('遭遇战解析后有失败者时，应自动推进到 ability 阶段', () => {
    const runner = createRunner();

    seedHands(
      runner,
      createTestCard({ uid: 'p0-hand-1', defId: 'deck_i_card_01', ownerId: '0', baseInfluence: 1, abilityIds: [] }),
      createTestCard({ uid: 'p1-hand-1', defId: 'deck_i_card_02', ownerId: '1', baseInfluence: 3, abilityIds: [] })
    );

    runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '0', cardUid: 'p0-hand-1', slotIndex: 0 });
    const second = runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '1', cardUid: 'p1-hand-1', slotIndex: 0 });

    expect(second.success).toBe(true);
    expect(second.finalState.sys.phase).toBe('ability');
    expect(second.finalState.core.currentEncounter?.loserId).toBe('0');
  });

  it('遭遇战平局时，应跳过 ability 阶段并推进到下一回合 play', () => {
    const runner = createRunner();

    seedHands(
      runner,
      createTestCard({ uid: 'p0-hand-2', defId: 'deck_i_card_05', ownerId: '0', baseInfluence: 4, abilityIds: [] }),
      createTestCard({ uid: 'p1-hand-2', defId: 'deck_i_card_06', ownerId: '1', baseInfluence: 4, abilityIds: [] })
    );

    runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '0', cardUid: 'p0-hand-2', slotIndex: 0 });
    const second = runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '1', cardUid: 'p1-hand-2', slotIndex: 0 });

    expect(second.success).toBe(true);
    expect(second.finalState.sys.phase).toBe('play');
    expect(second.finalState.core.currentEncounter?.loserId).toBeUndefined();
  });

  it('审判官赢得平局时，仍应跳过 ability 阶段并把平局改判为己方获胜', () => {
    const runner = createRunner();

    seedHands(
      runner,
      createTestCard({ uid: 'p0-hand-judge', defId: 'deck_i_card_11', ownerId: '0', baseInfluence: 4, abilityIds: [] }),
      createTestCard({ uid: 'p1-hand-judge', defId: 'deck_i_card_12', ownerId: '1', baseInfluence: 4, abilityIds: [] })
    );

    const state = runner.getState();
    runner.setState({
      ...state,
      core: {
        ...state.core,
        ongoingAbilities: [
          {
            abilityId: ABILITY_IDS.MAGISTRATE,
            cardId: 'magistrate-marker',
            playerId: '0',
            effectType: 'winTies',
            timestamp: 1,
          },
        ],
      },
    });

    runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '0', cardUid: 'p0-hand-judge', slotIndex: 0 });
    const second = runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '1', cardUid: 'p1-hand-judge', slotIndex: 0 });

    expect(second.success).toBe(true);
    expect(second.finalState.sys.phase).toBe('play');
    expect(second.finalState.core.currentEncounter).toBeUndefined();
    expect(second.finalState.core.encounterHistory.at(-1)?.winnerId).toBe('0');
    expect(second.finalState.core.encounterHistory.at(-1)?.loserId).toBe('1');
    expect(second.finalState.core.players['0'].playedCards.at(-1)?.signets).toBe(1);
    expect(second.finalState.core.players['1'].playedCards.at(-1)?.signets).toBe(0);
  });

  it('失败者跳过能力后，应自动推进出 ability 阶段', () => {
    const runner = createRunner();

    seedHands(
      runner,
      createTestCard({ uid: 'p0-hand-3', defId: 'deck_i_card_07', ownerId: '0', baseInfluence: 1, abilityIds: [ABILITY_IDS.MERCENARY_SWORDSMAN] }),
      createTestCard({ uid: 'p1-hand-3', defId: 'deck_i_card_08', ownerId: '1', baseInfluence: 6, abilityIds: [] })
    );

    runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '0', cardUid: 'p0-hand-3', slotIndex: 0 });
    runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '1', cardUid: 'p1-hand-3', slotIndex: 0 });

    const skip = runner.dispatch(CARDIA_COMMANDS.SKIP_ABILITY, { playerId: '0' });

    expect(skip.success).toBe(true);
    expect(skip.finalState.sys.phase).not.toBe('ability');
    expect(['end', 'play']).toContain(skip.finalState.sys.phase);
  });

  it('激活无交互能力后，应自动推进出 ability 阶段', () => {
    const runner = createRunner();

    seedHands(
      runner,
      createTestCard({ uid: 'p0-hand-4', defId: 'deck_i_card_09', ownerId: '0', baseInfluence: 1, abilityIds: [ABILITY_IDS.MERCENARY_SWORDSMAN] }),
      createTestCard({ uid: 'p1-hand-4', defId: 'deck_i_card_10', ownerId: '1', baseInfluence: 5, abilityIds: [] })
    );

    runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '0', cardUid: 'p0-hand-4', slotIndex: 0 });
    runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '1', cardUid: 'p1-hand-4', slotIndex: 0 });

    const activate = runner.dispatch(CARDIA_COMMANDS.ACTIVATE_ABILITY, {
      playerId: '0',
      abilityId: ABILITY_IDS.MERCENARY_SWORDSMAN,
      sourceCardUid: 'p0-hand-4',
    });

    expect(activate.success).toBe(true);
    expect(activate.finalState.sys.phase).not.toBe('ability');
    expect(['end', 'play']).toContain(activate.finalState.sys.phase);
  });
});
