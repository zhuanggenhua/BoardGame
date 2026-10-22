import { describe, expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import type { MatchState } from '../../../engine/types';
import { FATE_ATTACK_CARDS } from '../data/cards';
import { FATE_SERVANTS } from '../data';
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
    for (const id of state.core.turnOrder) state = apply(state, command('ADVANCE_PHASE', id, {}));
    state = apply(state, command('DEPLOY_MASTER', '0', { locationId: 'miyama' }));
    state = apply(state, command('ADVANCE_PHASE', '0', {}));
    state = apply(state, command('DEPLOY_MASTER', '1', { locationId: 'workshop' }));
    state = apply(state, command('ADVANCE_PHASE', '1', {}));
    state = apply(state, command('DEPLOY_MASTER', '2', { locationId: 'shinto' }));
    state = apply(state, command('ADVANCE_PHASE', '2', {}));
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
    it('工房有其他玩家不构成交战，常规移动仍可用', () => {
        const state = deployedState();
        state.core.players['0'].locationId = 'workshop';
        state.core.battlefield.miyama.playerIds = [];
        state.core.battlefield.workshop.playerIds = ['0', '1'];
        state.core.players['0'].mana = 12;
        expect(resolveFateMovement(state.core, '0', 'miyama', 'normal').valid).toBe(true);
    });

    it('移动技能必须先有合法目的地，缺目标或原地目标不可扣费', () => {
        const state = deployedState();
        const skill = FATE_SERVANTS.flatMap(servant => servant.skillCards ?? []).find(skill => skill.id === 'sc_cu_2')!;
        expect(skill).toBeDefined();
        state.core.players['0'].skills.push(skill);
        state.core.players['0'].activeSkills=[skill.id];
        state.core.players['0'].mana = 12;
        expect(FateDominationDomain.validate(state, command('PLAY_SKILL', '0', {skillId:skill.id})).valid).toBe(false);
        expect(FateDominationDomain.validate(state, command('PLAY_SKILL', '0', {skillId:skill.id,targetLocationId:'miyama'})).valid).toBe(false);
        const legal = command('PLAY_SKILL', '0', {skillId:skill.id,targetLocationId:'shinto'});
        expect(FateDominationDomain.validate(state, legal).valid).toBe(true);
        const moved = apply(state, legal);
        expect(moved.core.players['0'].locationId).toBe('shinto');
        expect(moved.core.battlefield.miyama.playerIds).not.toContain('0');
        expect(moved.core.battlefield.shinto.playerIds).toContain('0');
    });

    it('常规移动一次决定终点，完成后不得拆段；效果移动仍独立可用',()=>{
        let state=deployedState();state.core.players['0'].mana=12;
        // Isolate the one-normal-move rule from independently tested random event locks.
        for(const location of Object.values(state.core.battlefield)) location.eventCards=[];
        state.core.currentEvents={miyama:[],shinto:[]};
        state.core.battlefield.shinto.playerIds=[];state.core.players['2'].locationId='workshop';state.core.battlefield.workshop.playerIds.push('2');
        state=apply(state,command('MOVE_PLAYER','0',{locationId:'shinto'}));
        expect(state.core.players['0'].locationId).toBe('shinto');
        expect(FateDominationDomain.validate(state,command('MOVE_PLAYER','0',{locationId:'recon'})).valid).toBe(false);
        expect(resolveFateMovement(state.core,'0','recon','effect').valid).toBe(true);
    });
    it('常规出牌后不能再回头进行常规移动',()=>{
        const state=deployedState();state.core.players['0'].normalAttackPlayed=true;
        expect(FateDominationDomain.validate(state,command('MOVE_PLAYER','0',{locationId:'recon'})).valid).toBe(false);
    });

});
