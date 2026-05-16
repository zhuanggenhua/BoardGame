import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    runCommand,
    defaultTestRandom,
    makeState,
    makeMinion,
    triggerBaseAbilityWithMS,
    getInteractionsFromResult,
    makeMatchState,
    getSimpleChoicePrompt,
    getPromptSourceId,
    getPromptOptions,
    getPromptOption,
    respondCommand,
    SU_COMMANDS,
    SMASHUP_FACTION_IDS,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_drakkar: 首次随从揭示并抽取合格牌', () => {
    it('base_drakkar 通过 PLAY_MINION 真实触发链时不会被资源契约误拦截', () => {
        const core = makeState({
            bases: [{
                defId: 'base_drakkar',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0', vp: 0,
                    hand: [{ uid: 'm1', defId: 'robot_microbot_guard', type: 'minion', owner: '0' }],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    minionsPlayedPerBase: {},
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0,
                    hand: [],
                    deck: [{ uid: 'd1', defId: 'wizard_summon', type: 'action', owner: '1' }],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    minionsPlayedPerBase: {},
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.PIRATES],
                },
            } as any,
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'm1', baseIndex: 0 } } as any,
            defaultTestRandom,
        );

        expect(played.success, (played as any).error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'base_drakkar');
        expect(getPromptOptions(prompt).some((entry: any) => entry.value?.targetPlayerId === '1')).toBe(true);
    });

    it('base_drakkar 首次有随从打到这里时会提示选择另一位玩家并把合格牌抽到发动者手里', () => {
        const result = triggerBaseAbilityWithMS('base_drakkar', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_drakkar',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.VIKINGS, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [{ uid: 'd1', defId: 'wizard_summon', type: 'action', owner: '1' }],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.PIRATES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_drakkar',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            minionPower: 3,
            now: 1000,
        });

        const prompt = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(prompt)).toBe('base_drakkar');
        expect(getPromptOptions(prompt).some((entry: any) => entry.value?.skip === true)).toBe(true);

        const option = getPromptOption(prompt, entry => entry.value?.targetPlayerId === '1');
        const resolved = runCommand(
            result.matchState!,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'd1')).toBe(true);
        expect(resolved.finalState.core.players['1'].hand.some(card => card.uid === 'd1')).toBe(false);
        expect(resolved.finalState.core.players['1'].deck).toHaveLength(0);
    });

    it('base_drakkar 会在目标牌库为空时先洗回弃牌堆再把揭示到的合格低力量随从拿到发动者手里', () => {
        const result = triggerBaseAbilityWithMS('base_drakkar', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_drakkar',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.VIKINGS, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [],
                        discard: [{ uid: 'd2', defId: 'robot_microbot_alpha', type: 'minion', owner: '1' }],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.PIRATES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_drakkar',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            minionPower: 3,
            now: 1000,
        });

        const prompt = getInteractionsFromResult(result)[0];
        const option = getPromptOption(prompt, entry => entry.value?.targetPlayerId === '1');
        const resolved = runCommand(
            result.matchState!,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'd2')).toBe(true);
        expect(resolved.finalState.core.players['1'].discard).toHaveLength(0);
        expect(resolved.finalState.core.players['1'].deck).toHaveLength(0);
    });

    it('base_drakkar_pod reuses the first-minion reveal-and-draw ability', () => {
        const result = triggerBaseAbilityWithMS('base_drakkar_pod', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_drakkar_pod',
                    minions: [makeMinion('m1', '0', 3, 'vikings_shield_maiden_pod')],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.VIKINGS_POD, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [{ uid: 'd1', defId: 'wizard_summon', type: 'action', owner: '1' }],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_drakkar_pod',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'vikings_shield_maiden_pod',
            minionPower: 3,
            now: 1007,
        });

        const prompt = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(prompt)).toBe('base_drakkar');

        const option = getPromptOption(prompt, entry => entry.value?.targetPlayerId === '1');
        const resolved = runCommand(
            result.matchState!,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'd1')).toBe(true);
        expect(resolved.finalState.core.players['1'].deck).toHaveLength(0);
    });

});
