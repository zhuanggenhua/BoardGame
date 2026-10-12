import { describe, expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import type { MatchState } from '../../../engine/types';
import { FATE_ATTACK_CARDS } from '../data/cards';
import { FateDominationDomain } from '../domain';
import { resolveFateMovement, resolveFateMovementCost, resolveFateMovementPath } from '../domain/movement';
import type { FateDominationCommand, FateDominationCore } from '../domain/types';

const adapter = createReplayAdapter(FateDominationDomain, 'fate-domination-movement-framework');

const command = <T extends FateDominationCommand['type']>(
    type: T,
    playerId: string,
    payload: Extract<FateDominationCommand, { type: T }>['payload'],
): Extract<FateDominationCommand, { type: T }> => ({ type, playerId, payload, timestamp: 1 } as Extract<FateDominationCommand, { type: T }>);

const apply = (state: MatchState<FateDominationCore>, nextCommand: FateDominationCommand) => adapter.execute(state, nextCommand).state;

const deployedState = () => {
    let state = adapter.setup(['0', '1', '2']);
    state = apply(state, command('ADVANCE_PHASE', '0', {}));
    state = apply(state, command('DEPLOY_MASTER', '0', { locationId: 'miyama' }));
    state = apply(state, command('DEPLOY_MASTER', '1', { locationId: 'workshop' }));
    state = apply(state, command('DEPLOY_MASTER', '2', { locationId: 'shinto' }));
    return state;
};

describe('Fate movement mechanism seam', () => {
    it('按当前有向路线累计路径成本，并允许规则上下文替换路线', () => {
        expect(resolveFateMovementPath('workshop', 'shinto')).toEqual(['workshop', 'miyama', 'shinto']);
        expect(resolveFateMovementCost(['workshop', 'miyama', 'shinto'])).toBe(3);
        expect(resolveFateMovementPath('workshop', 'shinto', 'normal', { locationOrder: ['workshop', 'shinto', 'miyama', 'recon'] })).toEqual(['workshop', 'shinto']);
        expect(resolveFateMovementCost(['workshop', 'shinto'])).toBe(1);
        expect(resolveFateMovementPath('shinto', 'workshop', 'effect', { allowAnyDestination: true })).toEqual(['shinto', 'workshop']);
        expect(resolveFateMovementCost(['shinto', 'workshop'], 'effect', { allowAnyDestination: true })).toBe(0);
    });

    it('交战阻止常规移动，但效果移动只绕过交战并保留其它限制', () => {
        const state = deployedState();
        const engagedCore: FateDominationCore = {
            ...state.core,
            battlefield: {
                ...state.core.battlefield,
                miyama: { ...state.core.battlefield.miyama, playerIds: ['0', '1'] },
            },
            players: {
                ...state.core.players,
                '1': { ...state.core.players['1'], locationId: 'miyama' },
            },
        };
        const normal = resolveFateMovement(engagedCore, '0', 'shinto', 'normal');
        const effect = resolveFateMovement(engagedCore, '0', 'shinto', 'effect');
        expect(normal.valid).toBe(false);
        expect(normal.failures.map((failure) => failure.code)).toContain('engaged');
        expect(effect.valid).toBe(true);
        expect(effect.cost).toBe(0);
    });

    it('固有结界同时限制进出，并禁止特殊攻击', () => {
        const state = deployedState();
        const special = FATE_ATTACK_CARDS.find((card) => card.type?.includes('特殊'));
        expect(special).toBeDefined();
        const blockedCore: FateDominationCore = {
            ...state.core,
            battlefield: {
                ...state.core.battlefield,
                miyama: {
                    ...state.core.battlefield.miyama,
                    eventCards: [{ id: 'fuyuki_E16', name: '固有结界', assetPath: 'test', victoryPoints: 2, sourceStatus: 'verified' }],
                },
            },
            players: {
                ...state.core.players,
                '0': { ...state.core.players['0'], hand: [{ id: 'special-1', definitionId: special!.id }, ...state.core.players['0'].hand] },
            },
        };
        expect(resolveFateMovement(blockedCore, '0', 'shinto', 'normal').failures.map((failure) => failure.code)).toContain('cannotLeaveLocation');
        expect(resolveFateMovement({ ...blockedCore, players: { ...blockedCore.players, '1': { ...blockedCore.players['1'], locationId: 'workshop' } } }, '1', 'miyama', 'normal').failures.map((failure) => failure.code)).toContain('cannotEnterLocation');
        expect(FateDominationDomain.validate({ ...state, core: blockedCore }, command('SELECT_ATTACK_CARD', '0', { cardId: 'special-1' })).error).toBe('specialAttackForbidden');
    });

    it('成本修正通过 adapter 注入，不改写基础路线成本', () => {
        expect(resolveFateMovementCost(['workshop', 'miyama', 'shinto'], 'normal', { extraCostPerStep: 1 })).toBe(5);
        expect(resolveFateMovementCost(['workshop', 'miyama', 'shinto'], 'effect', { free: false, extraCostPerStep: 1 })).toBe(5);
    });
});
