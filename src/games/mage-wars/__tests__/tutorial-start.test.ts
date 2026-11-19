import { describe, expect, it, vi } from 'vitest';
import { createInitialLocalProviderState, createLocalProviderRandom } from '../../../engine/transport/localProviderBootstrap';
import type { GameEngineConfig } from '../../../engine/transport/engineConfig';
import type { DomainSetupContext, MatchState } from '../../../engine/types';
import type { MageWarsCore } from '../domain';
import { engineConfig } from '../game';
import { buildMageWarsTutorialSetupData, MAGE_WARS_TUTORIAL_UNICORN, MAGE_WARS_TUTORIAL_WOLF } from '../tutorialStart';

function open(mode: DomainSetupContext['mode'], persistedState?: MatchState<MageWarsCore>) {
    const prepareLocalTutorialMatch = vi.fn(engineConfig.prepareLocalTutorialMatch);
    const state = createInitialLocalProviderState({
        config: { ...engineConfig, prepareLocalTutorialMatch } as GameEngineConfig,
        setupContext: { mode },
        setupPlayerIds: ['0', '1'],
        initialRandom: createLocalProviderRandom('mage-wars-start-test'),
        setupData: mode === 'tutorial' ? buildMageWarsTutorialSetupData() : undefined,
        aiSeatIds: [],
        persistedState,
    }) as MatchState<MageWarsCore>;
    return { state, prepareLocalTutorialMatch };
}

describe('Mage Wars tutorial match start', () => {
    it('loads one legal fifth-round guard decision before showing the board', () => {
        const { state, prepareLocalTutorialMatch } = open('tutorial');
        expect(prepareLocalTutorialMatch).toHaveBeenCalledOnce();
        expect(state.sys.phase).toBe('creatureAction');
        expect(state.core.turnNumber).toBe(5);
        expect(state.core.phaseActorId).toBe('0');
        expect(state.core.players['0']).toMatchObject({
            mana: 51, mageZoneId: 'a3', actionReady: false, quickcastReady: true, preparedSpellCardIds: [3402],
        });
        expect(state.core.players['1']).toMatchObject({ mana: 47, actionReady: false });
        expect(state.core.objects[MAGE_WARS_TUTORIAL_WOLF]).toMatchObject({
            damage: 3, zoneId: 'a3', actionReady: true, guarding: false,
        });
        expect(state.core.objects[MAGE_WARS_TUTORIAL_UNICORN]).toMatchObject({
            damage: 0, zoneId: 'a3', actionReady: true,
        });
        expect(state.sys.actionLog.entries).toEqual([]);
    });

    it('keeps standard local setup and resumes a tutorial without replaying its history', () => {
        const ordinary = open('local');
        expect(ordinary.prepareLocalTutorialMatch).not.toHaveBeenCalled();
        expect(ordinary.state.sys.phase).toBe('reset');
        expect(Object.keys(ordinary.state.core.objects)).toHaveLength(0);

        const original = open('tutorial').state;
        const resumed = open('tutorial', original);
        expect(resumed.prepareLocalTutorialMatch).not.toHaveBeenCalled();
        expect(resumed.state.core).toEqual(original.core);
        expect(resumed.state.sys.phase).toBe(original.sys.phase);
    });
});
