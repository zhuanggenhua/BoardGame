import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    makeState,
    makeCard,
    makeMatchState,
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    getSimpleChoicePrompt,
    respondCommand,
    runCommand,
    dummyRandom,
    SU_EVENTS,
    SMASHUP_FACTION_IDS,
    type BaseAbilityContext,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_haunted_house_al9000: 随从入场后弃牌', () => {
    it('打出随从后触发弃牌事件', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house_al9000',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('h1', '0'), makeCard('h2', '0')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house_al9000',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'd1',
            minionPower: 3,
            now: 1000,
        };

        const result = triggerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', {
            ...ctx,
            matchState: makeMatchState(ctx.state),
        });
        expect(result.events.length).toBe(0);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_haunted_house_al9000');
        expect(getPromptSourceId(prompt)).toBe('base_haunted_house_al9000');
        expect(getPromptOptions(prompt)).toHaveLength(2);
        expect(
            (prompt as { responseValidationMode?: string }).responseValidationMode
            ?? (prompt as { data?: { responseValidationMode?: string } }).data?.responseValidationMode,
        ).toBe('live');
    });

    it('只有 1 张手牌时也必须由玩家选择弃牌，不能自动弃掉', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house_al9000',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('h1', '0')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house_al9000',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'd1',
            minionPower: 3,
            now: 1000,
        };

        const result = triggerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', {
            ...ctx,
            matchState: makeMatchState(ctx.state),
        });

        expect(result.events).toHaveLength(0);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_haunted_house_al9000');
        expect(getPromptOptions(prompt)).toHaveLength(1);
        expect(getPromptOptions(prompt)[0].value?.cardUid).toBe('h1');
    });

    it('响应交互后弃掉所选手牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house_al9000',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('h1', '0'), makeCard('h2', '0')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house_al9000',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'd1',
            minionPower: 3,
            now: 1000,
        };

        const result = triggerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', {
            ...ctx,
            matchState: makeMatchState(ctx.state),
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_haunted_house_al9000');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'h2', 'h2 discard option');
        const response = runCommand(result.matchState!, respondCommand(option.id, '0'), dummyRandom);

        expect(response.success).toBe(true);
        const discarded = response.events.find(event => event.type === SU_EVENTS.CARDS_DISCARDED);
        expect(discarded).toBeDefined();
        expect((discarded as any).payload.cardUids).toEqual(['h2']);
    });

    it('响应前若手牌已被清空，应允许 emergency skip 且不再弃牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house_al9000',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('h1', '0'), makeCard('h2', '0')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house_al9000',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'd1',
            minionPower: 3,
            now: 1000,
        };

        const result = triggerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', {
            ...ctx,
            matchState: makeMatchState(ctx.state),
        });

        const emptiedState = {
            ...result.matchState!,
            core: {
                ...result.matchState!.core,
                players: {
                    ...result.matchState!.core.players,
                    '0': {
                        ...result.matchState!.core.players['0'],
                        hand: [],
                    },
                },
            },
        };

        const response = runCommand(emptiedState, respondCommand('__emergency_skip__', '0'), dummyRandom);

        expect(response.success).toBe(true);
        expect(response.events.some(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toBe(false);
    });

    it('手牌为空时不触发弃牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house_al9000',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house_al9000',
            playerId: '0',
            minionUid: 'm1',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', ctx);
        expect(events.length).toBe(0);
    });
});


// ============================================================================
// base_the_field_of_honor: 荣誉之地 - 消灭者获1VP
// ============================================================================
