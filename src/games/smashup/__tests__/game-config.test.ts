import { describe, expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom } from '../../../engine/pipeline';
import engineConfig from '../game';
import { SMASHUP_CHEAT_COMMANDS } from '../cheatModifier';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';

describe('SmashUp engine config', () => {
    it('exposes SmashUp-owned debug commands without registering them in the shared engine command table', () => {
        expect(engineConfig.commandTypes).toEqual(expect.arrayContaining(Object.values(SMASHUP_CHEAT_COMMANDS)));
    });

    it('declares SmashUp event telemetry through the game adapter', () => {
        expect(engineConfig.eventTelemetry?.({
            type: SU_EVENTS.VP_AWARDED,
            payload: { playerId: '0', amount: 1, reason: 'test' },
            timestamp: 123,
        })).toEqual({
            eventType: 'vp_awarded',
            playerId: '0',
            amount: 1,
            reason: 'test',
            timestamp: 123,
        });

        expect(engineConfig.eventTelemetry?.({
            type: 'untracked',
            payload: {},
            timestamp: 123,
        })).toBeNull();
    });

    it('declares SmashUp manual setup command semantics through the game adapter', () => {
        expect(engineConfig.onlineAiRecovery?.resolveManualSetupSelectionActionKindFromCommand?.({
            type: SU_COMMANDS.SELECT_FACTION,
            payload: { factionId: 'robots' },
        })).toBe('select-faction');

        expect(engineConfig.onlineAiRecovery?.resolveManualSetupSelectionActionKindFromCommand?.({
            type: SU_COMMANDS.DESELECT_FACTION,
            payload: { factionId: 'robots' },
        })).toBeUndefined();
    });

    it('owns the local test bootstrap contract for skipping faction selection', () => {
        const state = engineConfig.createLocalTestInitialState?.({
            testConfig: {
                skipFactionSelect: true,
                player0Factions: ['aliens', 'robots'],
                player1Factions: ['ninjas', 'pirates'],
            },
            random: createSeededRandom('smashup-local-test-bootstrap'),
            setupData: undefined,
            setupPlayerIds: ['0', '1'],
            aiSeatIds: [],
        });

        expect(state?.sys.phase).toBe('playCards');
        expect((state?.core as { players: Record<string, { factions: string[] }> }).players['0']?.factions).toEqual(['aliens', 'robots']);
        expect((state?.core as { players: Record<string, { factions: string[] }> }).players['1']?.factions).toEqual(['ninjas', 'pirates']);
    });

    it('owns the local test bootstrap contract for skipped initialization states', () => {
        const state = engineConfig.createLocalTestInitialState?.({
            testConfig: { skipInitialization: true },
            random: createSeededRandom('smashup-skip-initialization'),
            setupData: undefined,
            setupPlayerIds: ['0', '1'],
            aiSeatIds: [],
        });

        expect(state?.sys.phase).toBe('playCards');
        expect((state?.core as { bases: unknown[] }).bases).toEqual([]);
        expect((state?.core as { players: Record<string, { factions: string[] }> }).players['0']?.factions).toEqual(['', '']);
    });

    it('owns the local test setup command contract for URL faction presets', () => {
        const playerIds = ['0', '1'];
        const state = {
            core: engineConfig.domain.setup(playerIds, createSeededRandom('smashup-local-test-commands')),
            sys: createInitialSystemState(playerIds, engineConfig.systems),
        };

        const commands = engineConfig.createLocalTestSetupCommands?.({
            testConfig: {
                player0Factions: ['aliens', 'robots'],
                player1Factions: ['ninjas', 'pirates'],
            },
            state,
        });

        expect(commands).toEqual([
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'aliens' } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'ninjas' } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'pirates' } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'robots' } },
        ]);

        expect(engineConfig.createLocalTestSetupCommands?.({
            testConfig: {
                skipFactionSelect: true,
                player0Factions: ['aliens', 'robots'],
                player1Factions: ['ninjas', 'pirates'],
            },
            state,
        })).toEqual([]);
    });
});
