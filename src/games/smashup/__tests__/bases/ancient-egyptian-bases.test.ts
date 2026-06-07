import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    fireTriggers,
    buildBuryCardEvents,
    reduce,
    runCommand,
    defaultTestRandom,
    makeState,
    makeMatchState,
    getSimpleChoicePrompt,
    getPromptOption,
    respondCommand,
    SU_COMMANDS,
    SU_EVENTS,
    SMASHUP_FACTION_IDS,
    type BaseAbilityContext,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('Oops Ancient Egyptians bases', () => {
    it('base_pyramids 在出牌阶段可主动使用，埋葬后同回合不能再用', () => {
        const core = makeState({
            bases: [{
                defId: 'base_pyramids',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [{ uid: 'h1', defId: 'ancient_egyptians_tomb_trap', type: 'action', owner: '0' }],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS],
                },
            } as any,
        });
        const initial = makeMatchState(core);

        const activated = runCommand(initial, {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0 },
        } as any, defaultTestRandom);
        expect(activated.success).toBe(true);

        const prompt = getSimpleChoicePrompt(activated.finalState, 'base_pyramids');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'h1');

        const buried = runCommand(activated.finalState, {
            ...respondCommand(option.id, '0'),
        } as any, defaultTestRandom);
        expect(buried.success).toBe(true);
        expect(buried.events.some(event => event.type === SU_EVENTS.BASE_ABILITY_USED)).toBe(true);
        expect(buried.events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);
        expect(buried.finalState.core.usedBaseAbilitiesThisTurn).toEqual([
            { playerId: '0', baseIndex: 0, baseDefId: 'base_pyramids' },
        ]);

        const secondUse = runCommand(buried.finalState, {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0 },
        } as any, defaultTestRandom);
        expect(secondUse.success).toBe(false);
        expect(secondUse.error).toContain('本回合已使用');
    });

    it('base_star_portal 在行动牌打到此基地时让其控制者抽一张牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_star_portal',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0',
                        vp: 0,
                        hand: [],
                        deck: [{ uid: 'd1', defId: 'robot_warbot', type: 'minion', owner: '0' }],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.ALIENS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_star_portal',
            playerId: '0',
            actionTargetBaseIndex: 0,
            actionTargetType: 'base',
            now: 1001,
        };

        const result = triggerBaseAbility('base_star_portal', 'onActionPlayed', ctx);
        const drawEvent = result.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvent).toBeDefined();
        expect((drawEvent as any).payload.playerId).toBe('0');
        expect((drawEvent as any).payload.count).toBe(1);
    });

    it('base_pyramids_pod 在出牌阶段可主动使用并埋葬手牌', () => {
        const core = makeState({
            bases: [{
                defId: 'base_pyramids_pod',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [{ uid: 'h1', defId: 'ancient_egyptians_tomb_trap_pod', type: 'action', owner: '0' }],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.PIRATES],
                },
            } as any,
        });

        const activated = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0 },
        } as any, defaultTestRandom);
        expect(activated.success).toBe(true);

        const prompt = getSimpleChoicePrompt(activated.finalState, 'base_pyramids');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'h1');
        const buried = runCommand(activated.finalState, {
            ...respondCommand(option.id, '0'),
        } as any, defaultTestRandom);

        expect(buried.success).toBe(true);
        expect(buried.events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);
        expect(buried.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'h1')).toBe(true);
    });

    it('base_star_portal_pod 在有牌被埋葬到这里时让埋葬者抽一张牌', () => {
        const core = makeState({
            bases: [{
                defId: 'base_star_portal_pod',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [{ uid: 'bury-me', defId: 'robot_warbot', type: 'minion', owner: '0' }],
                    deck: [{ uid: 'draw-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' }],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
            } as any,
        });

        const events = buildBuryCardEvents({
            core,
            playerId: '0',
            cardUid: 'bury-me',
            defId: 'robot_warbot',
            baseIndex: 0,
            trueOwnerId: '0',
            buriedFrom: 'hand',
            reason: 'test_star_portal_pod',
            random: defaultTestRandom,
            now: 1002,
        });

        expect(events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);
        expect(events.some(event => event.type === SU_EVENTS.TRIGGER_QUEUED)).toBe(true);

        const buriedCore = events.reduce((acc, event) => reduce(acc, event), core);
        const triggered = fireTriggers(buriedCore, 'onCardBuried', {
            state: buriedCore,
            playerId: '0',
            baseIndex: 0,
            buriedCardUid: 'bury-me',
            buriedCardDefId: 'robot_warbot',
            buriedCardControllerId: '0',
            buriedFrom: 'hand',
            random: defaultTestRandom,
            now: 1002,
        });

        const drawEvent = triggered.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(1);
    });

    it('base_star_portal 在其他玩家埋牌到这里时让埋葬者抽牌', () => {
        const core = makeState({
            bases: [{
                defId: 'base_star_portal',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [{ uid: 'draw-0', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' }],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [{ uid: 'bury-me', defId: 'robot_warbot', type: 'minion', owner: '1' }],
                    deck: [{ uid: 'draw-1', defId: 'robot_microbot_beta', type: 'minion', owner: '1' }],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS],
                },
            } as any,
        });

        const events = buildBuryCardEvents({
            core,
            playerId: '1',
            cardUid: 'bury-me',
            defId: 'robot_warbot',
            baseIndex: 0,
            trueOwnerId: '1',
            buriedFrom: 'hand',
            reason: 'test_star_portal',
            random: defaultTestRandom,
            now: 1003,
        });

        expect(events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);

        const buriedCore = events.reduce((acc, event) => reduce(acc, event), core);
        const triggered = fireTriggers(buriedCore, 'onCardBuried', {
            state: buriedCore,
            playerId: '0',
            baseIndex: 0,
            buriedCardUid: 'bury-me',
            buriedCardDefId: 'robot_warbot',
            buriedCardControllerId: '1',
            buriedFrom: 'hand',
            random: defaultTestRandom,
            now: 1003,
        });

        const drawEvent = triggered.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('1');
        expect(drawEvent.payload.count).toBe(1);
    });

    it('base_star_portal_pod 上打出并自埋 Tomb Trap 时，应同时触发 onActionPlayed 与 onCardBuried 各抓一张', () => {
        const core = makeState({
            bases: [{
                defId: 'base_star_portal_pod',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [{
                        uid: 'trap-1',
                        defId: 'ancient_egyptians_tomb_trap_pod',
                        type: 'action',
                        owner: '0',
                    }],
                    deck: [
                        { uid: 'draw-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                        { uid: 'draw-2', defId: 'robot_microbot_beta', type: 'minion', owner: '0' },
                    ],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.PIRATES],
                },
            } as any,
        });

        const result = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'trap-1', targetBaseIndex: 0 },
            } as any,
            defaultTestRandom,
        );

        expect(result.success).toBe(true);
        expect(result.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'trap-1')).toBe(true);

        const drawEvents = result.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN) as any[];
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.every(event => event.payload.playerId === '0')).toBe(true);
        expect(drawEvents.every(event => event.payload.count === 1)).toBe(true);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
    });
});

// ============================================================================
// base_the_workshop: 工坊 - 打出战术额外行动额度
// ============================================================================
