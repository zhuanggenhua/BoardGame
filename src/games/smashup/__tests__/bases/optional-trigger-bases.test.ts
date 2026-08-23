import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    triggerExtendedBaseAbility,
    makeState,
    makeMinion,
    triggerBaseAbilityWithMS,
    getInteractionsFromResult,
    makeMatchState,
    getPromptSourceId,
    getPromptOptions,
    SMASHUP_FACTION_IDS,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_castle_blood: 血堡 - 可选触发', () => {
    it('满足条件时应创建可选交互（可跳过）', () => {
        const result = triggerBaseAbilityWithMS('base_castle_blood', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_castle_blood',
                    minions: [
                        makeMinion('m_me', '0', 2),
                        makeMinion('m_op', '1', 5),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.WEREWOLVES, SMASHUP_FACTION_IDS.PIRATES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_castle_blood',
            playerId: '0',
            minionUid: 'm_me',
            now: 1000,
        });

        expect(result.events.length).toBe(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions.length).toBe(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_castle_blood');
        expect(getPromptOptions(interactions[0]).some((o: any) => o.id === 'skip')).toBe(true);
    });

    it('无交互态不会自动选择放置 +1 指示物', () => {
        const result = triggerBaseAbility('base_castle_blood', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_castle_blood',
                    minions: [
                        makeMinion('m_me', '0', 2),
                        makeMinion('m_op', '1', 5),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.WEREWOLVES, SMASHUP_FACTION_IDS.PIRATES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_castle_blood',
            playerId: '0',
            minionUid: 'm_me',
            now: 1001,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
    });
});

describe('base_crypt: 地窖 - 可选触发', () => {
    it('单个可放置目标时也应创建可选交互（包含跳过）', () => {
        const state = makeState({
            bases: [{
                defId: 'base_crypt',
                minions: [
                    makeMinion('m_destroyer', '1', 4),
                ],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.WEREWOLVES],
                },
            } as any,
        });

        const result = triggerExtendedBaseAbility('base_crypt', 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_crypt',
            playerId: '0',
            minionUid: 'm_victim',
            destroyerId: '1',
            now: 1000,
        });

        expect(result.events.length).toBe(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions.length).toBe(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_crypt');
        expect(getPromptOptions(interactions[0]).some((o: any) => o.id === 'skip')).toBe(true);
    });
});
