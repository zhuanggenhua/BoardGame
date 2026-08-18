import { describe, expect, it } from 'vitest';
import { createDamageCalculation } from '../../../engine/primitives/damageCalculation';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { DiceThroneDomain } from '../domain';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';
import { resolveEffectsToEvents } from '../domain/effects';
import { createDiceThroneEventSystem } from '../domain/systems';
import { initializeCustomActions } from '../domain/customActions';
import { validateCommand } from '../domain/commandValidation';
import { getTokenStackLimit } from '../domain/rules';
import { createPendingDamage, finalizeTokenResponse } from '../domain/tokenResponse';
import { RESOURCE_IDS } from '../domain/resources';
import { CURSED_PIRATE_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS, ZHANSHUJIA_DICE_FACE_IDS } from '../domain/ids';
import type { CharacterId, DiceThroneCommand, DiceThroneCore, DiceThroneEvent, TurnPhase } from '../domain/types';
import { createCharacterDice, getCharacterAbilitiesForFace, initHeroState } from '../domain/characters';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { MatchState, PlayerId } from '../../../engine/types';
import {
    cmd,
    createHeroMatchup,
    createNoResponseSetupWithEmptyHand,
    getCardById,
    getCurrentInteractionId,
    createQueuedRandom,
    createRunner,
    fixedRandom,
    getCardInteractionPrompt,
    getDefenderChoicePrompt,
    getSimpleChoicePrompt,
    injectPendingInteraction,
    respondToPrompt,
    testSystems,
} from './test-utils';
import { INITIAL_HEALTH } from '../domain/types';

initializeCustomActions();

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const setPlayerBoardFace = (
    state: MatchState<DiceThroneCore>,
    playerId: string,
    face: 'normal' | 'cursed',
) => {
    state.core = applyEvents(state.core, [{
        type: 'PLAYER_BOARD_FACE_CHANGED',
        payload: { playerId, face, sourceAbilityId: 'test-setup' },
        sourceCommandType: 'TEST',
        timestamp: 90,
    } as DiceThroneEvent]);
    return state;
};

const command = (
    type: DiceThroneCommand['type'],
    playerId: string,
    payload: Record<string, unknown> = {},
): DiceThroneCommand => ({
    type,
    playerId,
    payload,
    timestamp: 100,
} as DiceThroneCommand);

const settleBonusDice = (
    state: MatchState<DiceThroneCore>,
    playerId: PlayerId,
    random = fixedRandom,
) => {
    const events = execute(
        state,
        command('SKIP_BONUS_DICE_REROLL', playerId),
        random,
    ) as DiceThroneEvent[];
    return {
        events,
        state: { ...state, core: applyEvents(state.core, events) },
    };
};

const settleBonusDiceThroughPipeline = (
    state: MatchState<DiceThroneCore>,
    playerId: PlayerId,
    random = fixedRandom,
) => {
    const result = executePipeline(
        { domain: DiceThroneDomain, systems: testSystems },
        state,
        command('SKIP_BONUS_DICE_REROLL', playerId),
        random,
        Object.keys(state.core.players) as PlayerId[],
    );
    if (!result.success) {
        throw new Error(`奖励骰收口失败: ${result.error}`);
    }
    return result;
};

const passCurrentResponseWindow = (
    state: MatchState<DiceThroneCore>,
    random = fixedRandom,
    playerIds = Object.keys(state.core.players) as PlayerId[],
) => {
    const current = state.sys.responseWindow?.current as {
        responderQueue?: PlayerId[];
        currentResponderIndex?: number;
        currentResponderId?: PlayerId;
    } | undefined;
    if (!current) {
        return {
            success: true,
            state,
            events: [] as DiceThroneEvent[],
        };
    }

    const responderId = current.responderQueue?.[current.currentResponderIndex ?? 0]
        ?? current.currentResponderId;
    if (!responderId) {
        throw new Error('响应窗口缺少当前响应者');
    }

    const result = executePipeline(
        { domain: DiceThroneDomain, systems: testSystems },
        state,
        command('RESPONSE_PASS', responderId),
        random,
        playerIds,
    );
    if (!result.success) {
        throw new Error(`响应窗口让过失败: ${result.error}`);
    }
    return result;
};

const eventsOfType = <T extends DiceThroneEvent['type']>(events: DiceThroneEvent[], type: T) =>
    events.filter((event): event is Extract<DiceThroneEvent, { type: T }> => event.type === type);

function createSetupAtPlayer0Discard(entries: { playerId: string; statusId: string; stacks: number }[]) {
    const baseSetup = createNoResponseSetupWithEmptyHand();
    return (playerIds: string[], random: typeof fixedRandom) => {
        const state = baseSetup(playerIds, random);
        state.sys.phase = 'discard';
        for (const { playerId, statusId, stacks } of entries) {
            state.core.players[playerId].statusEffects[statusId] = stacks;
        }
        return state;
    };
}

const getAbilityEffects = (core: DiceThroneCore, playerId: string, abilityId: string) => {
    const ability = core.players[playerId].abilities.find(entry => entry.id === abilityId);
    if (!ability?.effects) {
        throw new Error(`找不到技能效果: ${abilityId}`);
    }
    return ability.effects;
};

const getAbilityVariantEffects = (core: DiceThroneCore, playerId: string, abilityId: string, variantId: string) => {
    const ability = core.players[playerId].abilities.find(entry => entry.id === abilityId);
    const variant = ability?.variants?.find(entry => entry.id === variantId);
    if (!variant?.effects) {
        throw new Error(`找不到技能分支效果: ${abilityId}/${variantId}`);
    }
    return variant.effects;
};

const playZhanshujiaUpgrade = (cardId: string) => {
    const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
    state.sys.phase = 'main1';
    state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
    state.core.players['0'].hand = [getCardById(cardId)];

    const events = execute(state, command('PLAY_CARD', '0', { cardId }), fixedRandom);
    return {
        events,
        state: { ...state, core: applyEvents(state.core, events) } as MatchState<DiceThroneCore>,
    };
};

const createZhanshujiaCardPlayState = (cardId: string, phase: TurnPhase = 'main1') => {
    const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
    state.sys.phase = phase;
    state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
    state.core.players['0'].hand = [getCardById(cardId)];
    return state;
};

const createZhanshujiaDefenseCardPlayState = (cardId: string) => {
    const state = createZhanshujiaCardPlayState(cardId, 'defensiveRoll');
    state.core.activePlayerId = '1';
    state.core.pendingAttack = {
        attackerId: '1',
        defenderId: '0',
        sourceAbilityId: 'test-attack',
        isDefendable: true,
        defenseAbilityId: 'countermeasures',
    } as any;
    return state;
};

const createCursedPirateCardPlayState = (cardId: string, phase: TurnPhase = 'main1') => {
    const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
    state.sys.phase = phase;
    state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
    state.core.players['0'].hand = [getCardById(cardId)];
    return state;
};

const playCardWithPipeline = (
    state: MatchState<DiceThroneCore>,
    playerId: PlayerId,
    cardId: string,
    random = fixedRandom,
) => executePipeline(
    { domain: DiceThroneDomain, systems: testSystems },
    state,
    command('PLAY_CARD', playerId, { cardId }),
    random,
    Object.keys(state.core.players) as PlayerId[],
);

const setCursedPirateDiceValues = (state: MatchState<DiceThroneCore>, values: number[]) => {
    const faceByValue: Record<number, string> = {
        1: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
        2: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
        3: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
        4: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
        5: CURSED_PIRATE_DICE_FACE_IDS.LOOT,
        6: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
    };
    state.core.dice = state.core.dice.map((die, index) => {
        const value = values[index] ?? die.value;
        const symbol = faceByValue[value] ?? null;
        return {
            ...die,
            definitionId: 'cursed_pirate-dice',
            value,
            symbol: symbol as typeof die.symbol,
            symbols: symbol ? [symbol] : [],
        };
    });
};

const createFourPlayerCursedPirateState = (): MatchState<DiceThroneCore> => {
    const playerIds: PlayerId[] = ['0', '1', '2', '3'];
    const heroByPlayer: Record<PlayerId, CharacterId> = {
        '0': 'cursed_pirate',
        '1': 'zhanshujia',
        '2': 'monk',
        '3': 'treant',
    } as Record<PlayerId, CharacterId>;
    const core = DiceThroneDomain.setup(playerIds, fixedRandom);

    for (const playerId of playerIds) {
        const characterId = heroByPlayer[playerId];
        core.players[playerId] = initHeroState(playerId, characterId, fixedRandom);
        core.selectedCharacters[playerId] = characterId;
        core.readyPlayers[playerId] = true;
        core.players[playerId].hand = [];
    }
    core.hostStarted = true;
    core.activePlayerId = '0';

    return {
        core,
        sys: createInitialSystemState(playerIds, testSystems, undefined),
    };
};

const createFourPlayerZhanshujiaState = (): MatchState<DiceThroneCore> => {
    const playerIds: PlayerId[] = ['0', '1', '2', '3'];
    const heroByPlayer: Record<PlayerId, CharacterId> = {
        '0': 'zhanshujia',
        '1': 'cursed_pirate',
        '2': 'monk',
        '3': 'treant',
    } as Record<PlayerId, CharacterId>;
    const core = DiceThroneDomain.setup(playerIds, fixedRandom);

    for (const playerId of playerIds) {
        const characterId = heroByPlayer[playerId];
        core.players[playerId] = initHeroState(playerId, characterId, fixedRandom);
        core.selectedCharacters[playerId] = characterId;
        core.readyPlayers[playerId] = true;
        core.players[playerId].hand = [];
    }
    core.hostStarted = true;
    core.activePlayerId = '0';

    return {
        core,
        sys: createInitialSystemState(playerIds, testSystems, undefined),
    };
};

const requestMercilessCursePowderKegChoice = (state: MatchState<DiceThroneCore>) => {
    const events = resolveEffectsToEvents(
        getAbilityEffects(state.core, '0', 'merciless-curse'),
        'preDefense',
        {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'merciless-curse',
            state: state.core,
            damageDealt: 0,
            timestamp: 100,
        },
        { random: fixedRandom },
    );
    const reducedCore = applyEvents(state.core, events);
    const system = createDiceThroneEventSystem();
    const afterEvents = system.afterEvents?.({
        state: { ...state, core: reducedCore },
        events,
        random: fixedRandom,
    } as any);
    if (!afterEvents || Array.isArray(afterEvents) || !('state' in afterEvents)) {
        throw new Error('无情诅咒未创建火药桶选择交互');
    }
    return {
        events,
        state: afterEvents.state as MatchState<DiceThroneCore>,
    };
};

const resolveAbilityEffectsWithSystem = (
    state: MatchState<DiceThroneCore>,
    effects: ReturnType<typeof getAbilityEffects> | ReturnType<typeof getAbilityVariantEffects>,
    timing: 'preDefense' | 'postDamage' | 'withDamage',
    ctx: {
        attackerId: string;
        defenderId: string;
        sourceAbilityId: string;
        damageDealt?: number;
        timestamp?: number;
    },
    random = fixedRandom,
) => {
    const events = resolveEffectsToEvents(
        effects,
        timing,
        {
            attackerId: ctx.attackerId,
            defenderId: ctx.defenderId,
            sourceAbilityId: ctx.sourceAbilityId,
            state: state.core,
            damageDealt: ctx.damageDealt ?? 0,
            timestamp: ctx.timestamp ?? 100,
        },
        { random },
    );
    const reducedCore = applyEvents(state.core, events);
    const system = createDiceThroneEventSystem();
    const afterEvents = system.afterEvents?.({
        state: { ...state, core: reducedCore },
        events,
        random,
    } as any);
    return {
        events,
        state: afterEvents && !Array.isArray(afterEvents) && 'state' in afterEvents
            ? afterEvents.state as MatchState<DiceThroneCore>
            : ({ ...state, core: reducedCore } as MatchState<DiceThroneCore>),
    };
};

const requestPowderKegTransferChoice = () => {
    const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
    state.sys.phase = 'discard';
    state.core.activePlayerId = '0';
    state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] = 1;

    const events = diceThroneFlowHooks.onPhaseEnter?.({
        state,
        from: 'discard',
        to: 'upkeep',
        command: command('ADVANCE_PHASE', '0'),
        random: createQueuedRandom([6]),
        exitEvents: [],
    } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]) as DiceThroneEvent[] | void;
    const phaseEvents = events ?? [];
    const afterRollCore = applyEvents(state.core, phaseEvents);
    const settleEvents = execute(
        { ...state, core: afterRollCore },
        command('SKIP_BONUS_DICE_REROLL', '0'),
        fixedRandom,
    ) as DiceThroneEvent[];
    const reducedCore = applyEvents(afterRollCore, settleEvents);
    const system = createDiceThroneEventSystem();
    const afterEvents = system.afterEvents?.({
        state: { ...state, core: reducedCore },
        events: settleEvents,
        random: fixedRandom,
    } as any);
    if (!afterEvents || Array.isArray(afterEvents) || !('state' in afterEvents)) {
        throw new Error('火药桶未创建转交选择交互');
    }
    return {
        events: [...phaseEvents, ...settleEvents],
        state: afterEvents.state as MatchState<DiceThroneCore>,
    };
};

const setupFourPlayerHumanAstonishingState = () => {
    const state = createFourPlayerCursedPirateState();
    setPlayerBoardFace(state, '0', 'normal');
    state.sys.phase = 'offensiveRoll';
    state.core.activePlayerId = '0';
    state.core.rollCount = 1;
    state.core.rollLimit = 3;
    state.core.rollDiceCount = 5;
    state.core.rollConfirmed = true;
    state.core.dice = createCharacterDice('cursed_pirate');
    state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
    state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
    state.core.players['2'].resources[RESOURCE_IDS.CP] = 5;
    state.core.players['3'].resources[RESOURCE_IDS.CP] = 5;
    state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 3;
    setCursedPirateDiceValues(state, [1, 4, 6, 6, 6]);
    return state;
};

describe('DiceThrone 战术家 / 咒缚海盗机制', () => {
    it('诅咒金币按角色差异限制层数，且咒缚海盗可选择不获得金币', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);

        expect(getTokenStackLimit(state.core, '0', STATUS_IDS.CURSED_COIN)).toBe(5);
        expect(getTokenStackLimit(state.core, '1', STATUS_IDS.CURSED_COIN)).toBe(3);

        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 4;
        state.core.players['1'].statusEffects[STATUS_IDS.CURSED_COIN] = 2;

        const pirateEvents = resolveEffectsToEvents([{
            timing: 'immediate',
            action: { type: 'grantStatus', target: 'self', statusId: STATUS_IDS.CURSED_COIN, value: 5 },
        } as any], 'immediate', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-cursed-coin-self',
            state: state.core,
            damageDealt: 0,
            timestamp: 100,
        });
        expect(eventsOfType(pirateEvents, 'STATUS_APPLIED')).toHaveLength(0);
        const choice = eventsOfType(pirateEvents, 'CHOICE_REQUESTED')[0];
        expect(choice?.payload.playerId).toBe('0');
        expect(choice?.payload.options).toEqual(expect.arrayContaining([
            expect.objectContaining({ statusId: STATUS_IDS.CURSED_COIN, value: 1 }),
            expect.objectContaining({ customId: 'decline-cursed-coin', value: 0 }),
        ]));

        const accepted = applyEvents(state.core, [choice, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                statusId: STATUS_IDS.CURSED_COIN,
                value: 1,
                sourceAbilityId: 'test-cursed-coin-self',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent]);
        expect(accepted.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(5);

        const declined = applyEvents(state.core, [choice, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                customId: 'decline-cursed-coin',
                value: 0,
                sourceAbilityId: 'test-cursed-coin-self',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent]);
        expect(declined.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(4);

        const opponentEvents = resolveEffectsToEvents([{
            timing: 'immediate',
            action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.CURSED_COIN, value: 5 },
        } as any], 'immediate', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-cursed-coin-opponent',
            state: state.core,
            damageDealt: 0,
            timestamp: 100,
        });
        expect(eventsOfType(opponentEvents, 'STATUS_APPLIED')[0]?.payload.newTotal).toBe(3);
    });

    it('诅咒金币不可被 REMOVE_STATUS 移除或 TRANSFER_STATUS 转移', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core.players['1'].statusEffects[STATUS_IDS.CURSED_COIN] = 2;

        const removeEvents = execute(state, command('REMOVE_STATUS', '0', {
            targetPlayerId: '1',
            statusId: STATUS_IDS.CURSED_COIN,
        }), fixedRandom);
        expect(removeEvents).toHaveLength(0);

        const transferEvents = execute(state, command('TRANSFER_STATUS', '0', {
            fromPlayerId: '1',
            toPlayerId: '0',
            statusId: STATUS_IDS.CURSED_COIN,
        }), fixedRandom);
        expect(transferEvents).toHaveLength(0);
    });

    it('诅咒金币在持有者维持阶段按层数造成伤害且不移除', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '诅咒金币维持阶段伤害',
            commands: [cmd('ADVANCE_PHASE', '0')],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.CURSED_COIN, stacks: 3 },
            ]),
        });

        const player = result.finalState.core.players['1'];
        expect(player.resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 3);
        expect(player.statusEffects[STATUS_IDS.CURSED_COIN]).toBe(3);
    });

    it('战术家真实开局自带 2 个战术优势', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        expect(state.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(2);
    });

    it('咒缚海盗咒缚被动在自己维持阶段受到 4 点不可防止伤害', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'cursed');
        state.sys.phase = 'discard';
        state.core.activePlayerId = '0';
        const hpBefore = state.core.players['0'].resources[RESOURCE_IDS.HP] ?? 0;

        const result = diceThroneFlowHooks.onPhaseEnter?.({
            state,
            from: 'discard',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]);
        const events = Array.isArray(result) ? result : [];
        const next = applyEvents(state.core, events as DiceThroneEvent[]);
        const damage = eventsOfType(events as DiceThroneEvent[], 'DAMAGE_DEALT')
            .find(event => event.payload.sourceAbilityId === 'cursed');

        expect(damage?.payload.targetId).toBe('0');
        expect(damage?.payload.amount).toBe(4);
        expect(damage?.payload.unblockable).toBe(true);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 4);
    });

    it('咒缚在对手进攻投掷阶段未发起攻击时对其施加火药桶', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '1', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.pendingAttack = null;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : result?.events ?? [];
        const powderKeg = eventsOfType(events as DiceThroneEvent[], 'STATUS_APPLIED')
            .find(event => event.payload.statusId === STATUS_IDS.POWDER_KEG);
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(powderKeg?.payload.targetId).toBe('0');
        expect(powderKeg?.payload.sourceAbilityId).toBe('cursed');
        expect(next.players['0'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('海盗处于正面时，不应再触发反面咒缚的未攻击施加火药桶被动', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '1', 'normal');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.pendingAttack = null;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : result?.events ?? [];

        expect(eventsOfType(events as DiceThroneEvent[], 'STATUS_APPLIED')
            .some(event => event.payload.statusId === STATUS_IDS.POWDER_KEG)).toBe(false);
    });

    it('咒缚不会在对手已发起攻击的进攻投掷阶段重复施加火药桶', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '1', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        const afterAttackInitiated = applyEvents(state.core, [{
            type: 'ATTACK_INITIATED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'test-attack',
                isDefendable: false,
            },
            sourceCommandType: 'SELECT_ABILITY',
            timestamp: 100,
        } as DiceThroneEvent]);
        state.core = { ...afterAttackInitiated, pendingAttack: null };

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : result?.events ?? [];

        expect(state.core.offensiveRollAttackMadeThisTurn?.['0']).toBe(true);
        expect(eventsOfType(events as DiceThroneEvent[], 'STATUS_APPLIED')
            .some(event => event.payload.statusId === STATUS_IDS.POWDER_KEG)).toBe(false);
    });

    it.each([1, 2])('致盲判定为 %s 时视为未成功激活攻击并触发海盗火药桶被动', (blindedValue) => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '1', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-blinded-pirate-passive',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.offensiveRollAttackMadeThisTurn = { '0': true };

        const hookResult = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([blindedValue]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const checkEvents = Array.isArray(hookResult) ? hookResult : (hookResult?.events ?? []);
        const afterCheck = applyEvents(state.core, checkEvents as DiceThroneEvent[]);
        expect(afterCheck.pendingBonusDiceSettlement?.customResolutionId).toBe('blinded-check');

        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            { ...state, core: afterCheck },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([blindedValue]),
            ['0', '1'],
        );

        expect(settled.success).toBe(true);
        if (!settled.success) return;

        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            settled.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );

        expect(advanced.success).toBe(true);
        if (!advanced.success) return;
        expect(advanced.state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('眩光判定为 1 时视为未成功激活攻击并触发海盗火药桶被动', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '1', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.players['0'].statusEffects[STATUS_IDS.DAZZLE] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-dazzle-pirate-passive',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.offensiveRollAttackMadeThisTurn = { '0': true };

        const hookResult = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const checkEvents = Array.isArray(hookResult) ? hookResult : (hookResult?.events ?? []);
        const afterCheck = applyEvents(state.core, checkEvents as DiceThroneEvent[]);
        expect(afterCheck.pendingBonusDiceSettlement?.customResolutionId).toBe('tianshi-dazzle-check');

        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            { ...state, core: afterCheck },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
            ['0', '1'],
        );

        expect(settled.success).toBe(true);
        if (!settled.success) return;

        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            settled.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );

        expect(advanced.success).toBe(true);
        if (!advanced.success) return;
        expect(advanced.state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('额外进攻投掷阶段未发起攻击时仍触发海盗火药桶被动', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '1', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.extraAttackInProgress = {
            attackerId: '0',
            originalActivePlayerId: '0',
            phaseEntered: true,
        };
        state.core.offensiveRollAttackMadeThisTurn = { '0': true };
        state.core.pendingAttack = null;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : (result?.events ?? []);
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(next.players['0'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('战争贩子额外进攻投掷阶段不清理紧缚、刺藤、缠绕或休战', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.core.extraAttackInProgress = {
            attackerId: '0',
            originalActivePlayerId: '0',
            phaseEntered: true,
            sourceStatusId: 'war-monger',
        } as any;
        state.core.players['0'].tokens[TOKEN_IDS.THORN] = 1;
        state.core.players['0'].statusEffects[STATUS_IDS.BIND] = 1;
        state.core.players['0'].statusEffects[STATUS_IDS.ENTANGLE] = 1;
        state.core.players['0'].statusEffects[STATUS_IDS.PARLEY] = 1;

        const enterResult = diceThroneFlowHooks.onPhaseEnter?.({
            state: { ...state, sys: { ...state.sys, phase: 'defensiveRoll' } },
            from: 'defensiveRoll',
            to: 'offensiveRoll',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]);
        const enterEvents = enterResult ?? [];
        const entered = applyEvents(state.core, enterEvents as DiceThroneEvent[]);

        expect(entered.players['0'].statusEffects[STATUS_IDS.ENTANGLE] ?? 0).toBe(1);

        const exitResult = diceThroneFlowHooks.onPhaseExit?.({
            state: { ...state, core: entered, sys: { ...state.sys, phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const exitEvents = Array.isArray(exitResult) ? exitResult : (exitResult?.events ?? []);
        const next = applyEvents(entered, exitEvents as DiceThroneEvent[]);

        expect(next.players['0'].tokens[TOKEN_IDS.THORN] ?? 0).toBe(1);
        expect(next.players['0'].statusEffects[STATUS_IDS.BIND] ?? 0).toBe(1);
        expect(next.players['0'].statusEffects[STATUS_IDS.PARLEY] ?? 0).toBe(1);
    });

    it('火药桶维持投骰 1-2 时爆炸并造成 3 点独立不可防御伤害', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.sys.phase = 'discard';
        state.core.activePlayerId = '0';
        state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] = 1;
        const hpBefore = state.core.players['0'].resources[RESOURCE_IDS.HP] ?? 0;

        const result = diceThroneFlowHooks.onPhaseEnter?.({
            state,
            from: 'discard',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]);
        const events = (Array.isArray(result) ? result : []) as DiceThroneEvent[];
        const afterRoll = applyEvents(state.core, events);
        const settleEvents = execute({ ...state, core: afterRoll }, command('SKIP_BONUS_DICE_REROLL', '0'), fixedRandom) as DiceThroneEvent[];
        const next = applyEvents(afterRoll, settleEvents);
        const roll = eventsOfType(events, 'BONUS_DIE_ROLLED')[0];
        const damage = eventsOfType(settleEvents, 'DAMAGE_DEALT')
            .find(event => event.payload.sourceAbilityId === 'upkeep-powder-keg');

        expect(roll?.payload.value).toBe(1);
        expect(afterRoll.pendingBonusDiceSettlement?.allowDiceModification).toBe(true);
        expect(eventsOfType(events, 'STATUS_REMOVED')).toHaveLength(0);
        expect(eventsOfType(settleEvents, 'STATUS_REMOVED')[0]?.payload.statusId).toBe(STATUS_IDS.POWDER_KEG);
        expect(damage?.payload).toMatchObject({
            targetId: '0',
            amount: 3,
            actualDamage: 3,
            damageScope: 'direct',
            unblockable: true,
        });
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 3);
        expect(next.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
    });

    it('火药桶维持投骰 3-5 时无事发生并保留火药桶', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.sys.phase = 'discard';
        state.core.activePlayerId = '0';
        state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] = 1;

        const result = diceThroneFlowHooks.onPhaseEnter?.({
            state,
            from: 'discard',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([3]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]);
        const events = (Array.isArray(result) ? result : []) as DiceThroneEvent[];
        const afterRoll = applyEvents(state.core, events);
        const settleEvents = execute({ ...state, core: afterRoll }, command('SKIP_BONUS_DICE_REROLL', '0'), fixedRandom) as DiceThroneEvent[];
        const next = applyEvents(afterRoll, settleEvents);

        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')[0]?.payload.value).toBe(3);
        expect(afterRoll.pendingBonusDiceSettlement?.allowDiceModification).toBe(true);
        expect(eventsOfType(events, 'STATUS_REMOVED')).toHaveLength(0);
        expect(eventsOfType(settleEvents, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(next.players['0'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('火药桶维持奖励骰可被战术优势重掷后用普通确认收口', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.sys.phase = 'discard';
        state.core.activePlayerId = '0';
        state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 1;
        const hpBefore = state.core.players['0'].resources[RESOURCE_IDS.HP] ?? 0;

        const phaseEnterEvents = diceThroneFlowHooks.onPhaseEnter?.({
            state,
            from: 'discard',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]);
        const events = (Array.isArray(phaseEnterEvents) ? phaseEnterEvents : []) as DiceThroneEvent[];
        const afterRollState = {
            ...state,
            sys: {
                ...state.sys,
                phase: 'upkeep',
            },
            core: applyEvents(state.core, events),
        } as MatchState<DiceThroneCore>;
        expect(afterRollState.core.pendingBonusDiceSettlement?.dice[0]?.value).toBe(1);
        expect(afterRollState.sys.responseWindow?.current).toBeUndefined();

        const rerolled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            afterRollState,
            command('USE_PASSIVE_ABILITY', '0', {
                passiveId: 'zhanshujia-tactical-advantage',
                actionIndex: 1,
                targetDieId: 0,
            }),
            createQueuedRandom([3]),
            ['0', '1'],
        );
        expect(rerolled.success).toBe(true);
        expect(rerolled.state.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(0);
        expect(rerolled.state.core.pendingBonusDiceSettlement?.dice[0]?.value).toBe(3);

        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            rerolled.state,
            command('CONFIRM_ROLL', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(settled.success).toBe(true);
        expect(settled.state.core.pendingBonusDiceSettlement).toBeFalsy();
        expect(eventsOfType(settled.events as DiceThroneEvent[], 'DAMAGE_DEALT')).toHaveLength(0);
        expect(settled.state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(hpBefore);
        expect(settled.state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('火药桶维持投骰 6 时可选择任意玩家并能转交给其他玩家', () => {
        const { state: promptState } = requestPowderKegTransferChoice();
        const prompt = getSimpleChoicePrompt(promptState, 'upkeep-powder-keg');
        const self = prompt.options.find(option => (
            option.value as { value?: number; labelParams?: { target?: string } }
        ).labelParams?.target === 'P1');
        const target = prompt.options.find(option => (
            option.value as { value?: number; labelParams?: { target?: string } }
        ).labelParams?.target === 'P2');

        expect(self).toBeDefined();
        expect(target).toBeDefined();

        const selfResult = respondToPrompt(promptState, self!.id, '0', fixedRandom, ['0', '1']);
        expect(selfResult.success).toBe(true);
        expect(eventsOfType(selfResult.events as DiceThroneEvent[], 'STATUS_REMOVED')).toHaveLength(0);
        expect(selfResult.state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);

        const { state: transferPromptState } = requestPowderKegTransferChoice();
        const transferPrompt = getSimpleChoicePrompt(transferPromptState, 'upkeep-powder-keg');
        const transferTarget = transferPrompt.options.find(option => (
            option.value as { value?: number; labelParams?: { target?: string } }
        ).labelParams?.target === 'P2');
        expect(transferTarget).toBeDefined();
        const result = respondToPrompt(transferPromptState, transferTarget!.id, '0', fixedRandom, ['0', '1']);
        expect(result.success).toBe(true);
        expect(eventsOfType(result.events as DiceThroneEvent[], 'STATUS_REMOVED')[0]?.payload.targetId).toBe('0');
        expect(result.state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('火药桶维持投骰 6 转交给已持有者时，目标旧火药桶会爆炸并保留新火药桶', () => {
        const { state: promptState } = requestPowderKegTransferChoice();
        promptState.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] = 1;
        const hpBefore = promptState.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;

        const prompt = getSimpleChoicePrompt(promptState, 'upkeep-powder-keg');
        const target = prompt.options.find(option => (
            option.value as { value?: number; labelParams?: { target?: string } }
        ).labelParams?.target === 'P2');
        expect(target).toBeDefined();

        const result = respondToPrompt(promptState, target!.id, '0', fixedRandom, ['0', '1']);
        expect(result.success).toBe(true);

        const removed = eventsOfType(result.events as DiceThroneEvent[], 'STATUS_REMOVED');
        const damage = eventsOfType(result.events as DiceThroneEvent[], 'DAMAGE_DEALT')
            .find(event => event.payload.sourceAbilityId === 'upkeep-powder-keg');
        const applied = eventsOfType(result.events as DiceThroneEvent[], 'STATUS_APPLIED')
            .find(event => event.payload.targetId === '1' && event.payload.statusId === STATUS_IDS.POWDER_KEG);

        expect(removed).toEqual(expect.arrayContaining([
            expect.objectContaining({
                payload: expect.objectContaining({ targetId: '0', statusId: STATUS_IDS.POWDER_KEG }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({ targetId: '1', statusId: STATUS_IDS.POWDER_KEG }),
            }),
        ]));
        expect(damage?.payload).toMatchObject({
            targetId: '1',
            amount: 3,
            actualDamage: 3,
            damageScope: 'direct',
            unblockable: true,
        });
        expect(applied?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.POWDER_KEG,
            newTotal: 1,
        });
        expect(result.state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
        expect(result.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 3);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('火药桶维持投骰 6 生成转交交互时，upkeep 不应自动继续推进', () => {
        const { state: promptState, events } = requestPowderKegTransferChoice();
        const upkeepState = {
            ...promptState,
            sys: {
                ...promptState.sys,
                phase: 'upkeep',
            },
        } as MatchState<DiceThroneCore>;

        const autoContinue = diceThroneFlowHooks.onAutoContinueCheck?.({
            state: upkeepState,
            events: [
                ...events,
                {
                    type: 'SYS_PHASE_CHANGED',
                    payload: {
                        from: 'discard',
                        to: 'upkeep',
                        playerId: '0',
                    },
                    sourceCommandType: 'ADVANCE_PHASE',
                    timestamp: 101,
                } as DiceThroneEvent,
            ],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onAutoContinueCheck>>[0]);

        expect(getSimpleChoicePrompt(promptState, 'upkeep-powder-keg')).toBeDefined();
        expect(autoContinue).toBeUndefined();
    });

    it('火药桶爆炸结算完成后应自动离开维持阶段', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.sys.phase = 'upkeep';
        state.core.activePlayerId = '0';
        state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] = 1;
        const hpBefore = state.core.players['0'].resources[RESOURCE_IDS.HP] ?? 0;

        const phaseEnterEvents = diceThroneFlowHooks.onPhaseEnter?.({
            state,
            from: 'discard',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]) as DiceThroneEvent[] | void;
        const afterRollState = {
            ...state,
            core: applyEvents(state.core, phaseEnterEvents ?? []),
        } as MatchState<DiceThroneCore>;

        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            afterRollState,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            fixedRandom,
            ['0', '1'],
        );

        expect(settled.success).toBe(true);
        expect(settled.state.core.pendingBonusDiceSettlement).toBeFalsy();
        expect(settled.state.sys.interaction?.current).toBeUndefined();
        expect(settled.state.sys.responseWindow?.current).toBeUndefined();
        expect(settled.state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 3);
        expect(settled.state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
        expect(settled.state.sys.phase).toBe('main1');
    });

    it('火药桶转交选择完成后应自动离开维持阶段', () => {
        const { state: promptState } = requestPowderKegTransferChoice();
        const upkeepPromptState = {
            ...promptState,
            sys: {
                ...promptState.sys,
                phase: 'upkeep',
            },
        } as MatchState<DiceThroneCore>;
        const prompt = getSimpleChoicePrompt(upkeepPromptState, 'upkeep-powder-keg');
        const target = prompt.options.find(option => (
            option.value as { value?: number; labelParams?: { target?: string } }
        ).labelParams?.target === 'P2');
        expect(target).toBeDefined();

        const result = respondToPrompt(upkeepPromptState, target!.id, '0', fixedRandom, ['0', '1']);

        expect(result.success).toBe(true);
        expect(result.state.core.pendingBonusDiceSettlement).toBeFalsy();
        expect(result.state.sys.interaction?.current).toBeUndefined();
        expect(result.state.sys.responseWindow?.current).toBeUndefined();
        expect(result.state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
        expect(result.state.sys.phase).toBe('main1');
    });

    it('新收到火药桶时若已拥有火药桶，原火药桶立即爆炸并保留新火药桶', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] = 1;
        const hpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;

        const events = resolveEffectsToEvents([{
            timing: 'preDefense',
            action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.POWDER_KEG, value: 1 },
        } as any], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-powder-keg-overlap',
            state: state.core,
            damageDealt: 0,
            timestamp: 100,
        });
        const next = applyEvents(state.core, events);
        const removed = eventsOfType(events, 'STATUS_REMOVED')[0];
        const damage = eventsOfType(events, 'DAMAGE_DEALT')[0];
        const applied = eventsOfType(events, 'STATUS_APPLIED')[0];

        expect(removed?.payload).toMatchObject({ targetId: '1', statusId: STATUS_IDS.POWDER_KEG, stacks: 1 });
        expect(damage?.payload).toMatchObject({
            targetId: '1',
            amount: 3,
            actualDamage: 3,
            damageScope: 'direct',
            unblockable: true,
        });
        expect(applied?.payload).toMatchObject({ targetId: '1', statusId: STATUS_IDS.POWDER_KEG, newTotal: 1 });
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 3);
        expect(next.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('凋零只减少持有者对对手造成的攻击伤害，不影响直接伤害', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core.players['0'].statusEffects[STATUS_IDS.WITHER] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-attack',
        } as any;

        const attackDamage = createDamageCalculation({
            baseDamage: 6,
            source: { playerId: '0', abilityId: 'test-attack' },
            target: { playerId: '1' },
            state: state.core,
            damageScope: 'attack',
            attackDamageContext: { attackerId: '0', defenderId: '1' },
            timestamp: 100,
        }).resolve();
        expect(attackDamage.finalDamage).toBe(4);

        const directDamage = createDamageCalculation({
            baseDamage: 6,
            source: { playerId: '0', abilityId: 'test-direct' },
            target: { playerId: '1' },
            state: state.core,
            damageScope: 'direct',
            timestamp: 100,
        }).resolve();
        expect(directDamage.finalDamage).toBe(6);
    });

    it('休战阻止攻击伤害但不阻止直接伤害，并在进攻掷骰阶段结束移除', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core.players['0'].statusEffects[STATUS_IDS.PARLEY] = 1;

        const attackEvents = resolveEffectsToEvents([{
            timing: 'withDamage',
            action: { type: 'damage', target: 'opponent', value: 5 },
        } as any], 'withDamage', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-parley-attack',
            state: state.core,
            damageDealt: 0,
            timestamp: 100,
        });
        expect(eventsOfType(attackEvents, 'DAMAGE_DEALT')).toHaveLength(0);

        const directEvents = resolveEffectsToEvents([{
            timing: 'withDamage',
            action: { type: 'damage', target: 'opponent', value: 5, damageScope: 'direct' },
        } as any], 'withDamage', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-parley-direct',
            state: state.core,
            damageDealt: 0,
            timestamp: 100,
        });
        expect(eventsOfType(directEvents, 'DAMAGE_DEALT')).toHaveLength(1);

        const exitResult = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const exitEvents = Array.isArray(exitResult) ? exitResult : (exitResult?.events ?? []);
        const next = applyEvents(state.core, exitEvents as DiceThroneEvent[]);
        expect(next.players['0'].statusEffects[STATUS_IDS.PARLEY] ?? 0).toBe(0);
    });

    it('休战也会阻止 Token 响应收口后落地的攻击伤害事件', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core.players['0'].statusEffects[STATUS_IDS.PARLEY] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-parley-token-response',
            isDefendable: true,
            resolvedDamage: 0,
            damageResolved: false,
        } as DiceThroneCore['pendingAttack'];

        const pendingDamage = createPendingDamage(
            '0',
            '1',
            5,
            'beforeDamageReceived',
            'test-parley-token-response',
            100,
            undefined,
            'attack',
        );
        const closeEvents = finalizeTokenResponse(pendingDamage, state.core, 100);
        const next = applyEvents(state.core, closeEvents as DiceThroneEvent[]);

        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
        expect(next.pendingAttack?.resolvedDamage ?? 0).toBe(0);
    });

    it('直接伤害发生在攻击挂起期间也不会累计为本次攻击伤害', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-attack',
            isDefendable: false,
            settlementStage: 'preDamage',
            resolvedDamage: 0,
            damageResolved: false,
        } as DiceThroneCore['pendingAttack'];

        const next = applyEvents(state.core, [{
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 3,
                actualDamage: 3,
                sourceAbilityId: 'test-direct-damage',
                damageScope: 'direct',
                unblockable: true,
            },
            sourceCommandType: 'TEST',
            timestamp: 100,
        } as DiceThroneEvent]);

        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 3);
        expect(next.pendingAttack?.resolvedDamage ?? 0).toBe(0);
        expect(next.pendingAttack?.settlementStage).toBe('preDamage');
    });

    it('休战在攻击已发起时不会于 offensiveRoll -> defensiveRoll 提前移除', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core.players['0'].statusEffects[STATUS_IDS.PARLEY] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-parley-phase-exit',
            isDefendable: true,
            damageResolved: false,
            resolvedDamage: 0,
        } as DiceThroneCore['pendingAttack'];

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'defensiveRoll',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const exitEvents = Array.isArray(result) ? result : (result?.events ?? []);
        const parleyRemoved = eventsOfType(exitEvents as DiceThroneEvent[], 'STATUS_REMOVED')
            .some((event) => event.payload.statusId === STATUS_IDS.PARLEY);

        expect(parleyRemoved).toBe(false);
    });

    it('紧缚让额外进攻投掷每次消耗 1CP，CP 不足时拒绝并在阶段结束移除', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.players['0'].statusEffects[STATUS_IDS.BIND] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 2;
        state.core.rollCount = 1;
        state.core.rollLimit = 3;

        const rollEvents = execute(state, command('ROLL_DICE', '0'), createQueuedRandom([1, 2, 3, 4, 5]));
        const cpEvents = eventsOfType(rollEvents, 'CP_CHANGED');
        expect(cpEvents).toHaveLength(1);
        expect(cpEvents[0].payload.delta).toBe(-1);

        const blocked = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        blocked.sys.phase = 'offensiveRoll';
        blocked.core.players['0'].statusEffects[STATUS_IDS.BIND] = 1;
        blocked.core.players['0'].resources[RESOURCE_IDS.CP] = 0;
        blocked.core.rollCount = 1;
        blocked.core.rollLimit = 3;
        const validation = validateCommand(blocked.core, command('ROLL_DICE', '0'), 'offensiveRoll');
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('not_enough_cp');
        expect(execute(blocked, command('ROLL_DICE', '0'), createQueuedRandom([1, 2, 3, 4, 5]))).toHaveLength(0);

        const exitResult = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const exitEvents = Array.isArray(exitResult) ? exitResult : (exitResult?.events ?? []);
        const next = applyEvents(state.core, exitEvents as DiceThroneEvent[]);
        expect(next.players['0'].statusEffects[STATUS_IDS.BIND] ?? 0).toBe(0);
    });

    it('倒地跳过进攻投掷阶段时不会移除紧缚', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
        state.core.players['0'].statusEffects[STATUS_IDS.BIND] = 1;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'main1',
            to: 'offensiveRoll',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : (result?.events ?? []);
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(Array.isArray(result)).toBe(false);
        expect((result as Exclude<typeof result, DiceThroneEvent[] | void>)?.overrideNextPhase).toBe('main2');
        expect(next.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0).toBe(0);
        expect(next.players['0'].statusEffects[STATUS_IDS.BIND] ?? 0).toBe(1);
        expect(eventsOfType(events as DiceThroneEvent[], 'STATUS_REMOVED')
            .some(event => event.payload.statusId === STATUS_IDS.BIND)).toBe(false);
    });

    it('战术优势可按动作消耗 token 取得 CP、重掷、抽牌、锁定、守护和转移入口', () => {
        const gainCp = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        gainCp.sys.phase = 'main1';
        gainCp.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 1;
        gainCp.core.players['0'].resources[RESOURCE_IDS.CP] = 1;
        let events = execute(gainCp, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'zhanshujia-tactical-advantage',
            actionIndex: 0,
        }), fixedRandom);
        let next = applyEvents(gainCp.core, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(0);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);

        const reroll = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        reroll.sys.phase = 'offensiveRoll';
        reroll.core.rollCount = 1;
        reroll.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 1;
        reroll.core.dice[0] = { ...reroll.core.dice[0], id: 0, value: 1, isKept: false };
        events = execute(reroll, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'zhanshujia-tactical-advantage',
            actionIndex: 1,
            targetDieId: 0,
        }), createQueuedRandom([6]));
        next = applyEvents(reroll.core, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(0);
        expect(next.dice[0].value).toBe(6);

        const draw = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        draw.sys.phase = 'main1';
        draw.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 3;
        draw.core.players['0'].hand = [];
        const deckBefore = draw.core.players['0'].deck.length;
        events = execute(draw, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'zhanshujia-tactical-advantage',
            actionIndex: 2,
        }), fixedRandom);
        next = applyEvents(draw.core, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(0);
        expect(next.players['0'].hand).toHaveLength(1);
        expect(next.players['0'].deck).toHaveLength(deckBefore - 1);

        const targeted = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        targeted.sys.phase = 'main1';
        targeted.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 3;
        events = execute(targeted, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'zhanshujia-tactical-advantage',
            actionIndex: 3,
        }), fixedRandom);
        next = applyEvents(targeted.core, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(0);
        expect(next.players['1'].statusEffects[STATUS_IDS.TARGETED]).toBe(1);

        const targetedFourPlayer = createFourPlayerZhanshujiaState();
        targetedFourPlayer.sys.phase = 'main1';
        targetedFourPlayer.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 3;
        events = execute(targetedFourPlayer, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'zhanshujia-tactical-advantage',
            actionIndex: 3,
        }), fixedRandom);
        const targetedFourPlayerReducedCore = applyEvents(targetedFourPlayer.core, events);
        const targetedFourPlayerSystem = createDiceThroneEventSystem();
        const targetedFourPlayerAfterEvents = targetedFourPlayerSystem.afterEvents?.({
            state: { ...targetedFourPlayer, core: targetedFourPlayerReducedCore },
            events,
            random: fixedRandom,
        } as any);
        if (!targetedFourPlayerAfterEvents || Array.isArray(targetedFourPlayerAfterEvents) || !('state' in targetedFourPlayerAfterEvents)) {
            throw new Error('战术优势锁定未创建多人目标选择交互');
        }
        const targetedFourPlayerPromptState = targetedFourPlayerAfterEvents.state as MatchState<DiceThroneCore>;
        const targetedInteraction = getCardInteractionPrompt(targetedFourPlayerPromptState, 'zhanshujia-tactical-advantage');
        expect(targetedInteraction).toMatchObject({
            type: 'selectPlayer',
            sourceCardId: 'zhanshujia-tactical-advantage',
            selectCount: 1,
            statusGrantConfig: { statusId: STATUS_IDS.TARGETED, amount: 1 },
        });
        expect(targetedInteraction.targetPlayerIds).toEqual(['1', '3']);

        const targetedResolveEvents = execute(targetedFourPlayerPromptState, command('RESOLVE_INTERACTION', '0', {
            selectedPlayerIds: ['3'],
        }), fixedRandom);
        next = applyEvents(targetedFourPlayerPromptState.core, targetedResolveEvents);
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(0);
        expect(next.players['1'].statusEffects[STATUS_IDS.TARGETED] ?? 0).toBe(0);
        expect(next.players['3'].statusEffects[STATUS_IDS.TARGETED]).toBe(1);

        const protect = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        protect.sys.phase = 'main1';
        protect.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 4;
        events = execute(protect, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'zhanshujia-tactical-advantage',
            actionIndex: 4,
        }), fixedRandom);
        const protectReducedCore = applyEvents(protect.core, events);
        const protectSystem = createDiceThroneEventSystem();
        const protectAfterEvents = protectSystem.afterEvents?.({
            state: { ...protect, core: protectReducedCore },
            events,
            random: fixedRandom,
        } as any);
        if (!protectAfterEvents || Array.isArray(protectAfterEvents) || !('state' in protectAfterEvents)) {
            throw new Error('战术优势守护未创建目标选择交互');
        }
        const protectPromptState = protectAfterEvents.state as MatchState<DiceThroneCore>;
        const protectInteraction = getCardInteractionPrompt(protectPromptState, 'zhanshujia-tactical-advantage');
        expect(protectInteraction).toMatchObject({
            type: 'selectPlayer',
            sourceCardId: 'zhanshujia-tactical-advantage',
            tokenGrantConfig: { tokenId: TOKEN_IDS.PROTECT, amount: 1 },
        });
        expect(protectInteraction.targetPlayerIds).toEqual(['0', '1']);

        const protectResolveEvents = execute(protectPromptState, command('RESOLVE_INTERACTION', '0', {
            selectedPlayerIds: ['1'],
        }), fixedRandom);
        next = applyEvents(protectPromptState.core, protectResolveEvents);
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(0);
        expect(eventsOfType(protectResolveEvents, 'TOKEN_GRANTED')[0]?.payload).toMatchObject({
            targetId: '1',
            tokenId: TOKEN_IDS.PROTECT,
            amount: 1,
            sourceAbilityId: 'zhanshujia-tactical-advantage',
        });
        expect(next.players['1'].tokens[TOKEN_IDS.PROTECT]).toBe(1);

        const protectSelf = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        protectSelf.sys.phase = 'main1';
        protectSelf.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 4;
        events = execute(protectSelf, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'zhanshujia-tactical-advantage',
            actionIndex: 4,
        }), fixedRandom);
        const protectSelfReducedCore = applyEvents(protectSelf.core, events);
        const protectSelfSystem = createDiceThroneEventSystem();
        const protectSelfAfterEvents = protectSelfSystem.afterEvents?.({
            state: { ...protectSelf, core: protectSelfReducedCore },
            events,
            random: fixedRandom,
        } as any);
        if (!protectSelfAfterEvents || Array.isArray(protectSelfAfterEvents) || !('state' in protectSelfAfterEvents)) {
            throw new Error('战术优势守护未创建自选玩家交互');
        }
        const protectSelfPromptState = protectSelfAfterEvents.state as MatchState<DiceThroneCore>;
        const protectSelfResolveEvents = execute(protectSelfPromptState, command('RESOLVE_INTERACTION', '0', {
            selectedPlayerIds: ['0'],
        }), fixedRandom);
        const protectSelfNext = applyEvents(protectSelfPromptState.core, protectSelfResolveEvents);
        expect(protectSelfNext.players['0'].tokens[TOKEN_IDS.PROTECT]).toBe(1);
        expect(protectSelfNext.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(0);

        const transfer = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        transfer.sys.phase = 'main1';
        transfer.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 4;
        events = execute(transfer, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'zhanshujia-tactical-advantage',
            actionIndex: 5,
        }), fixedRandom);
        next = applyEvents(transfer.core, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(0);
        expect(eventsOfType(events, 'INTERACTION_REQUESTED')[0]?.payload.interaction.type).toBe('selectStatus');
        expect(eventsOfType(events, 'INTERACTION_REQUESTED')[0]?.payload.interaction.transferConfig).toEqual({});
    });

    it('战术优势只有转移状态限定主要阶段，其余用法可按瞬时时机使用', () => {
        const createTacticalAdvantageState = (amount: number, phase: TurnPhase = 'offensiveRoll') => {
            const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
            state.sys.phase = phase;
            state.core.activePlayerId = '0';
            state.core.rollCount = 1;
            state.core.rollDiceCount = 5;
            state.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = amount;
            state.core.dice[0] = { ...state.core.dice[0], id: 0, value: 1, isKept: false };
            return state;
        };
        const validatePassive = (
            actionIndex: number,
            amount: number,
            phase: TurnPhase = 'offensiveRoll',
            payload: Record<string, unknown> = {},
        ) => {
            const state = createTacticalAdvantageState(amount, phase);
            return validateCommand(state.core, command('USE_PASSIVE_ABILITY', '0', {
                passiveId: 'zhanshujia-tactical-advantage',
                actionIndex,
                ...payload,
            }), phase);
        };

        expect(validatePassive(0, 1).valid).toBe(true);
        expect(validatePassive(1, 1, 'offensiveRoll', { targetDieId: 0 }).valid).toBe(true);
        expect(validatePassive(2, 3).valid).toBe(true);
        expect(validatePassive(3, 3).valid).toBe(true);
        expect(validatePassive(4, 4).valid).toBe(true);
        expect(validatePassive(5, 4).valid).toBe(false);
        expect(validatePassive(5, 4, 'main1').valid).toBe(true);
    });

    it('对手准备移除或转移战术优势时，战术家仍可先花费', () => {
        for (const [sourceCardId, titleKey, transferConfig] of [
            ['card-bye-bye', 'interaction.selectStatusToRemove', undefined],
            ['card-transfer-status', 'interaction.selectStatusToTransfer', {}],
        ] as const) {
            const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
            state.sys.phase = 'main1';
            state.core.activePlayerId = '1';
            state.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 1;
            state.core.players['0'].resources[RESOURCE_IDS.CP] = 0;
            injectPendingInteraction(state, {
                id: `${sourceCardId}-tactical-advantage`,
                playerId: '1',
                sourceCardId,
                type: 'selectStatus',
                titleKey,
                selectCount: 1,
                selected: [],
                targetPlayerIds: ['0', '1'],
                ...(transferConfig ? { transferConfig } : {}),
            });

            const spent = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                command('USE_PASSIVE_ABILITY', '0', {
                    passiveId: 'zhanshujia-tactical-advantage',
                    actionIndex: 0,
                }),
                fixedRandom,
                ['0', '1'],
            );

            expect(spent.success).toBe(true);
            if (!spent.success) continue;
            expect(spent.state.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0).toBe(0);
            expect(spent.state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(1);
            expect(getCardInteractionPrompt(spent.state).playerId).toBe('1');
        }
    });

    it('战术家反制措施按防御骰结算反击、防伤与战术优势', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.core.rollDiceCount = 4;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: [1, 2, 4, 6][index] ?? die.value,
        }));

        const events = resolveEffectsToEvents(
            getAbilityEffects(state.core, '0', 'countermeasures'),
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'countermeasures',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
                isDefensiveContext: true,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 1,
            damageScope: 'direct',
        });
        expect(next.players['0'].damageShields?.[0]).toMatchObject({
            value: 1,
            sourceId: 'countermeasures',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(3);
    });

    it('战术家专属升级牌替换对应基础技能并记录等级', () => {
        const expectations = [
            { cardId: 'upgrade-zhanshujia-countermeasures-3', targetAbilityId: 'countermeasures', level: 3 },
            { cardId: 'upgrade-zhanshujia-countermeasures-2', targetAbilityId: 'countermeasures', level: 2 },
            { cardId: 'upgrade-zhanshujia-strategic-shift-2', targetAbilityId: 'strategic-shift', level: 2 },
            { cardId: 'upgrade-zhanshujia-expand-battlefield-2', targetAbilityId: 'expand-battlefield', level: 2 },
            { cardId: 'upgrade-zhanshujia-flanking-2', targetAbilityId: 'flanking', level: 2 },
            { cardId: 'upgrade-zhanshujia-drum-movement-2', targetAbilityId: 'drum-movement', level: 2 },
            { cardId: 'upgrade-zhanshujia-carpet-bombing-2', targetAbilityId: 'carpet-bombing', level: 2 },
            { cardId: 'upgrade-zhanshujia-war-monger-2', targetAbilityId: 'war-monger', level: 2 },
            { cardId: 'upgrade-zhanshujia-sabre-thrust-2', targetAbilityId: 'sabre-thrust', level: 2 },
        ];

        for (const { cardId, targetAbilityId, level } of expectations) {
            const { events, state } = playZhanshujiaUpgrade(cardId);
            const replaced = eventsOfType(events, 'ABILITY_REPLACED')[0];

            expect(replaced?.payload).toMatchObject({
                playerId: '0',
                oldAbilityId: targetAbilityId,
                cardId,
                newLevel: level,
            });
            expect(state.core.players['0'].abilityLevels[targetAbilityId]).toBe(level);
            expect(state.core.players['0'].upgradeCardByAbilityId[targetAbilityId]).toMatchObject({ cardId });
            expect(state.core.players['0'].abilities.some(ability => ability.id === targetAbilityId)).toBe(true);
        }
    });

    it('战术家升级后的反制措施 III 使用 5 骰且每组军刀造成 2 反击伤害', () => {
        const { state } = playZhanshujiaUpgrade('upgrade-zhanshujia-countermeasures-3');
        state.core.rollDiceCount = 5;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: [1, 2, 4, 6, 6][index] ?? die.value,
        }));
        const ability = state.core.players['0'].abilities.find(entry => entry.id === 'countermeasures');
        expect(ability?.trigger).toMatchObject({ type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 });

        const events = resolveEffectsToEvents(
            getAbilityEffects(state.core, '0', 'countermeasures'),
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'countermeasures',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
                isDefensiveContext: true,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'DAMAGE_DEALT')[0]?.payload.amount).toBe(2);
        expect(next.players['0'].damageShields?.[0]).toMatchObject({ value: 1, sourceId: 'countermeasures' });
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(4);
    });

    it('战术家升级后的军刀突刺 II 提升伤害并在三同值时施加紧缚', () => {
        const { state } = playZhanshujiaUpgrade('upgrade-zhanshujia-sabre-thrust-2');
        state.core.rollDiceCount = 5;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: [1, 1, 1, 4, 5][index] ?? die.value,
        }));

        const preDefenseEvents = resolveEffectsToEvents(
            getAbilityVariantEffects(state.core, '0', 'sabre-thrust', 'sabre-thrust-2-3'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'sabre-thrust-2-3',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const afterBind = applyEvents(state.core, preDefenseEvents);
        const damageEvents = resolveEffectsToEvents(
            getAbilityVariantEffects(afterBind, '0', 'sabre-thrust', 'sabre-thrust-2-3'),
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'sabre-thrust-2-3',
                state: afterBind,
                damageDealt: 0,
                timestamp: 101,
            },
            { random: fixedRandom },
        );

        expect(eventsOfType(preDefenseEvents, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.BIND,
        });
        expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload.amount).toBe(5);
    });

    it('战术家升级后的战略转移 II 侦察分支只获得 5 战术优势', () => {
        const { state } = playZhanshujiaUpgrade('upgrade-zhanshujia-strategic-shift-2');
        const events = resolveEffectsToEvents(
            getAbilityVariantEffects(state.core, '0', 'strategic-shift', 'strategic-shift-2-recon'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'strategic-shift-2-recon',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(5);
        expect(eventsOfType(events, 'STATUS_APPLIED')).toHaveLength(0);
        expect(eventsOfType(events, 'DAMAGE_DEALT')).toHaveLength(0);
    });

    it('战术家升级后的开拓战场 II lockdown 分支抽 2 并施加紧缚', () => {
        const { state } = playZhanshujiaUpgrade('upgrade-zhanshujia-expand-battlefield-2');
        const handBefore = state.core.players['0'].hand.length;
        const events = resolveEffectsToEvents(
            getAbilityVariantEffects(state.core, '0', 'expand-battlefield', 'expand-battlefield-2-lockdown'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'expand-battlefield-2-lockdown',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(state.core, events);

        expect(next.players['0'].hand.length).toBe(handBefore + 2);
        expect(eventsOfType(events, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.BIND,
        });
        expect(eventsOfType(events, 'DAMAGE_DEALT')).toHaveLength(0);
    });

    it('战术家升级后的摇鼓运动 II 间接接敌分支获得 2 战术优势并造成 2 点不可防御伤害', () => {
        const { state } = playZhanshujiaUpgrade('upgrade-zhanshujia-drum-movement-2');
        const preDefenseEvents = resolveEffectsToEvents(
            getAbilityVariantEffects(state.core, '0', 'drum-movement', 'drum-movement-2-indirect'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'drum-movement-2-indirect',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const afterToken = applyEvents(state.core, preDefenseEvents);
        const damageEvents = resolveEffectsToEvents(
            getAbilityVariantEffects(afterToken, '0', 'drum-movement', 'drum-movement-2-indirect'),
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'drum-movement-2-indirect',
                state: afterToken,
                damageDealt: 0,
                timestamp: 101,
            },
            { random: fixedRandom },
        );

        expect(applyEvents(state.core, preDefenseEvents).players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(4);
        expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 2,
            unblockable: true,
        });
    });

    it('战术家升级后的摇鼓运动 II 间接接敌分支在真实选择后应标记为不可防御', () => {
        const { state } = playZhanshujiaUpgrade('upgrade-zhanshujia-drum-movement-2');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: [1, 2, 3, 4, 6][index] ?? die.value,
            symbol: [ZHANSHUJIA_DICE_FACE_IDS.SABRE, ZHANSHUJIA_DICE_FACE_IDS.SABRE, ZHANSHUJIA_DICE_FACE_IDS.SABRE, ZHANSHUJIA_DICE_FACE_IDS.BANNER, ZHANSHUJIA_DICE_FACE_IDS.MEDAL][index] ?? die.symbol,
        }));

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'drum-movement-2-indirect' }),
            fixedRandom,
            ['0', '1'],
        );

        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'drum-movement-2-indirect',
            isDefendable: false,
        });
    });

    it('战术家升级后的战争贩子 II 在勋章分支抽牌并触发额外进攻投掷阶段', () => {
        const { state } = playZhanshujiaUpgrade('upgrade-zhanshujia-war-monger-2');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: [1, 4, 4, 4, 6][index] ?? die.value,
            symbol: [
                ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            ][index] ?? die.symbol,
        }));
        const handBefore = state.core.players['0'].hand.length;
        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'war-monger' }),
            fixedRandom,
            ['0', '1'],
        );
        const bonusOpened = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            createQueuedRandom([6]),
            ['0', '1'],
        );
        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            bonusOpened.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            fixedRandom,
            ['0', '1'],
        );

        expect(bonusOpened.state.core.pendingBonusDiceSettlement).toBeTruthy();
        expect(settled.state.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(4);
        expect(settled.state.core.players['0'].hand.length).toBe(handBefore + 1);
        expect(settled.state.sys.phase).toBe('offensiveRoll');
        expect(eventsOfType(settled.events as DiceThroneEvent[], 'DAMAGE_DEALT')).toHaveLength(0);
        expect(eventsOfType(settled.events as DiceThroneEvent[], 'EXTRA_ATTACK_TRIGGERED')[0]?.payload).toMatchObject({
            attackerId: '0',
            targetId: '1',
            sourceStatusId: 'war-monger',
        });
    });

    it('基础战争贩子在奖励骰确认前不提前产生军刀伤害或勋章额外进攻', () => {
        const sabreState = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        sabreState.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'war-monger',
            isDefendable: true,
        } as any;
        const sabreEvents = resolveEffectsToEvents(
            getAbilityEffects(sabreState.core, '0', 'war-monger'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'war-monger',
                state: sabreState.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: createQueuedRandom([1]) },
        );
        expect(eventsOfType(sabreEvents, 'BONUS_DICE_REROLL_REQUESTED')).toHaveLength(1);
        expect(eventsOfType(sabreEvents, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(eventsOfType(sabreEvents, 'PENDING_ATTACK_UPDATED')).toHaveLength(0);
        expect(eventsOfType(sabreEvents, 'EXTRA_ATTACK_TRIGGERED')).toHaveLength(0);

        const medalState = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        const medalEvents = resolveEffectsToEvents(
            getAbilityEffects(medalState.core, '0', 'war-monger'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'war-monger',
                state: medalState.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: createQueuedRandom([6]) },
        );
        expect(eventsOfType(medalEvents, 'BONUS_DICE_REROLL_REQUESTED')).toHaveLength(1);
        expect(eventsOfType(medalEvents, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(eventsOfType(medalEvents, 'PENDING_ATTACK_UPDATED')).toHaveLength(0);
        expect(eventsOfType(medalEvents, 'EXTRA_ATTACK_TRIGGERED')).toHaveLength(0);
    });

    it('基础战争贩子军刀分支应先进入防御投掷，防御减伤后才结算攻击伤害', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '1', 'normal');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: [1, 4, 4, 4, 6][index] ?? die.value,
            symbol: [
                ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            ][index] ?? die.symbol,
        }));

        const defenderHpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP];
        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'war-monger' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);

        const enteredDefense = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            createQueuedRandom([1]),
            ['0', '1'],
        );

        expect(enteredDefense.success).toBe(true);
        expect(enteredDefense.state.sys.phase).toBe('offensiveRoll');
        expect(enteredDefense.state.core.pendingBonusDiceSettlement).toBeTruthy();
        expect(enteredDefense.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHpBefore);
        expect(eventsOfType(enteredDefense.events as DiceThroneEvent[], 'DAMAGE_DEALT')).toHaveLength(0);

        const responsePassed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            enteredDefense.state,
            command('RESPONSE_PASS', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(responsePassed.success).toBe(true);
        expect(responsePassed.state.core.pendingBonusDiceSettlement).toBeTruthy();

        const bonusConfirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            responsePassed.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(bonusConfirmed.success).toBe(true);
        expect(bonusConfirmed.state.core.pendingBonusDiceSettlement).toBeFalsy();
        expect(bonusConfirmed.state.sys.phase).toBe('defensiveRoll');
        expect(bonusConfirmed.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'war-monger',
            isDefendable: true,
            damage: 5,
        });
        expect(bonusConfirmed.state.core.pendingAttack?.defenseAbilityId).toBe('human-still-wet-behind-ears');

        const defenseRolled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            bonusConfirmed.state,
            command('ROLL_DICE', '1'),
            createQueuedRandom([6, 4, 4, 4]),
            ['0', '1'],
        );
        expect(defenseRolled.success).toBe(true);

        const defenseConfirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            defenseRolled.state,
            command('CONFIRM_ROLL', '1'),
            fixedRandom,
            ['0', '1'],
        );
        expect(defenseConfirmed.success).toBe(true);
        expect(defenseConfirmed.state.sys.responseWindow?.current).toBeDefined();

        const postDefenseResponse = passCurrentResponseWindow(defenseConfirmed.state);

        const resolved = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            postDefenseResponse.state,
            command('ADVANCE_PHASE', '1'),
            fixedRandom,
            ['0', '1'],
        );

        expect(resolved.success).toBe(true);
        expect(resolved.state.sys.phase).toBe('main2');
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHpBefore - 3);
        expect(eventsOfType(resolved.events as DiceThroneEvent[], 'PREVENT_DAMAGE')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 2,
            sourceAbilityId: 'human-still-wet-behind-ears',
        });
        const warMongerDamage = eventsOfType(resolved.events as DiceThroneEvent[], 'DAMAGE_DEALT')
            .find(event => event.payload.sourceAbilityId === 'war-monger');
        expect(warMongerDamage?.payload.amount).toBe(5);
        expect(warMongerDamage?.payload.shieldsConsumed?.[0]).toMatchObject({
            sourceId: 'human-still-wet-behind-ears',
            absorbed: 2,
        });
    });

    it('战争贩子 II 军刀分支应先进入防御投掷，防御减伤后才结算 6 点攻击伤害', () => {
        const { state } = playZhanshujiaUpgrade('upgrade-zhanshujia-war-monger-2');
        setPlayerBoardFace(state, '1', 'normal');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: [1, 4, 4, 4, 6][index] ?? die.value,
            symbol: [
                ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            ][index] ?? die.symbol,
        }));

        const defenderHpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP];
        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'war-monger' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);

        const bonusOpened = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            createQueuedRandom([1]),
            ['0', '1'],
        );
        expect(bonusOpened.success).toBe(true);
        expect(bonusOpened.state.core.pendingBonusDiceSettlement).toBeTruthy();
        expect(bonusOpened.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHpBefore);

        const responsePassed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            bonusOpened.state,
            command('RESPONSE_PASS', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(responsePassed.success).toBe(true);

        const bonusConfirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            responsePassed.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(bonusConfirmed.success).toBe(true);
        expect(bonusConfirmed.state.core.pendingBonusDiceSettlement).toBeFalsy();
        expect(bonusConfirmed.state.sys.phase).toBe('defensiveRoll');
        expect(bonusConfirmed.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'war-monger',
            isDefendable: true,
            damage: 6,
        });
        expect(bonusConfirmed.state.core.pendingAttack?.defenseAbilityId).toBe('human-still-wet-behind-ears');

        const defenseRolled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            bonusConfirmed.state,
            command('ROLL_DICE', '1'),
            createQueuedRandom([6, 4, 4, 4]),
            ['0', '1'],
        );
        expect(defenseRolled.success).toBe(true);

        const defenseConfirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            defenseRolled.state,
            command('CONFIRM_ROLL', '1'),
            fixedRandom,
            ['0', '1'],
        );
        expect(defenseConfirmed.success).toBe(true);
        expect(defenseConfirmed.state.sys.responseWindow?.current).toBeDefined();

        const postDefenseResponse = passCurrentResponseWindow(defenseConfirmed.state);

        const resolved = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            postDefenseResponse.state,
            command('ADVANCE_PHASE', '1'),
            fixedRandom,
            ['0', '1'],
        );

        expect(resolved.success).toBe(true);
        expect(resolved.state.sys.phase).toBe('main2');
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHpBefore - 4);
        expect(eventsOfType(resolved.events as DiceThroneEvent[], 'PREVENT_DAMAGE')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 2,
            sourceAbilityId: 'human-still-wet-behind-ears',
        });
        const warMongerDamage = eventsOfType(resolved.events as DiceThroneEvent[], 'DAMAGE_DEALT')
            .find(event => event.payload.sourceAbilityId === 'war-monger');
        expect(warMongerDamage?.payload.amount).toBe(6);
        expect(warMongerDamage?.payload.shieldsConsumed?.[0]).toMatchObject({
            sourceId: 'human-still-wet-behind-ears',
            absorbed: 2,
        });
    });

    it('基础战争贩子勋章分支不应进入防御投掷，应直接进入额外进攻投掷阶段', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: [1, 4, 4, 4, 6][index] ?? die.value,
            symbol: [
                ZHANSHUJIA_DICE_FACE_IDS.SABRE,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.BANNER,
                ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
            ][index] ?? die.symbol,
        }));

        const defenderHpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP];
        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'war-monger' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);

        const bonusOpened = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            createQueuedRandom([6]),
            ['0', '1'],
        );

        expect(bonusOpened.success).toBe(true);
        expect(bonusOpened.state.core.pendingBonusDiceSettlement).toBeTruthy();

        const responsePassed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            bonusOpened.state,
            command('RESPONSE_PASS', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(responsePassed.success).toBe(true);
        expect(responsePassed.state.core.pendingBonusDiceSettlement).toBeTruthy();

        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            responsePassed.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            fixedRandom,
            ['0', '1'],
        );

        expect(advanced.success).toBe(true);
        expect(advanced.state.sys.phase).toBe('offensiveRoll');
        expect(advanced.state.core.pendingAttack).toBeNull();
        expect(advanced.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHpBefore);
        expect(eventsOfType(advanced.events as DiceThroneEvent[], 'DAMAGE_DEALT')).toHaveLength(0);
        expect(eventsOfType(advanced.events as DiceThroneEvent[], 'EXTRA_ATTACK_TRIGGERED')[0]?.payload).toMatchObject({
            attackerId: '0',
            targetId: '1',
            sourceStatusId: 'war-monger',
        });
    });

    it('攻击不进入防御投掷阶段时，不应误触发咒缚海盗火药桶被动', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '1', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: [6, 6, 6, 6, 1][index] ?? die.value,
            symbol: [
                ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                ZHANSHUJIA_DICE_FACE_IDS.SABRE,
            ][index] ?? die.symbol,
        }));

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'strategic-shift' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);

        const attackResolved = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(attackResolved.success).toBe(true);

        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            attackResolved.state,
            command('RESPONSE_PASS', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(advanced.success).toBe(true);
        expect(advanced.state.sys.phase).toBe('main2');
        expect(advanced.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 5);
        expect(advanced.state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
    });

    it('战术家地毯式轰炸 II 在 2v2 中必须选择两名不同对手造成附属伤害', () => {
        const state = createFourPlayerZhanshujiaState();
        const { state: upgradedState } = playZhanshujiaUpgrade('upgrade-zhanshujia-carpet-bombing-2');
        const effects = getAbilityVariantEffects(upgradedState.core, '0', 'carpet-bombing', 'carpet-bombing-2-main');

        const events = resolveEffectsToEvents(
            effects,
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'carpet-bombing-2-main',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const reducedCore = applyEvents(state.core, events);
        const system = createDiceThroneEventSystem();
        const afterEvents = system.afterEvents?.({
            state: { ...state, core: reducedCore },
            events,
            random: fixedRandom,
        } as any);
        if (!afterEvents || Array.isArray(afterEvents) || !('state' in afterEvents)) {
            throw new Error('地毯式轰炸 II 未创建 2 名不同对手选择交互');
        }
        const promptState = afterEvents.state as MatchState<DiceThroneCore>;
        const interaction = getCardInteractionPrompt(promptState, 'carpet-bombing-2-main');

        expect(promptState.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(4);
        expect(interaction).toMatchObject({
            type: 'selectPlayer',
            sourceCardId: 'carpet-bombing-2-main',
            selectCount: 2,
            minSelectCount: 2,
            resolveCustomActionId: 'zhanshujia-carpet-bombing-target-damage',
        });
        expect(interaction.targetPlayerIds).toEqual(['1', '3']);

        const singleTargetEvents = execute(promptState, command('RESOLVE_INTERACTION', '0', {
            selectedPlayerIds: ['1'],
        }), fixedRandom);
        expect(eventsOfType(singleTargetEvents, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(eventsOfType(singleTargetEvents, 'INTERACTION_COMPLETED')).toHaveLength(0);

        const resolveEvents = execute(promptState, command('RESOLVE_INTERACTION', '0', {
            selectedPlayerIds: ['1', '3'],
        }), fixedRandom);
        const next = applyEvents(promptState.core, resolveEvents);
        const player2HpBefore = promptState.core.players['2'].resources[RESOURCE_IDS.HP] ?? 0;
        const teamBHpBefore = promptState.core.teamHealth?.B ?? 0;
        const damageTargets = eventsOfType(resolveEvents, 'DAMAGE_DEALT')
            .filter(event => event.payload.sourceAbilityId === 'carpet-bombing-2-main')
            .map(event => event.payload.targetId)
            .sort();

        expect(damageTargets).toEqual(['1', '3']);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(teamBHpBefore - 4);
        expect(next.players['2'].resources[RESOURCE_IDS.HP]).toBe(player2HpBefore);
        expect(next.players['3'].resources[RESOURCE_IDS.HP]).toBe(teamBHpBefore - 4);
        expect(next.teamHealth?.B).toBe(teamBHpBefore - 4);
    });

    it('战术家脱战在被攻击后按军刀、旗帜、勋章分支结算', () => {
        const sabreState = createZhanshujiaDefenseCardPlayState('card-zhanshujia-disengage');
        const hpBefore = sabreState.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const sabreEvents = execute(sabreState, command('PLAY_CARD', '0', {
            cardId: 'card-zhanshujia-disengage',
        }), createQueuedRandom([1]));
        const sabreSettled = settleBonusDice(
            { ...sabreState, core: applyEvents(sabreState.core, sabreEvents) },
            '0',
        );
        const sabreAllEvents = [...sabreEvents, ...sabreSettled.events];
        const afterSabre = sabreSettled.state.core;
        expect(eventsOfType(sabreAllEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 2,
            sourceAbilityId: 'card-zhanshujia-disengage',
        });
        expect(afterSabre.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 2);

        const bannerState = createZhanshujiaDefenseCardPlayState('card-zhanshujia-disengage');
        const bannerEvents = execute(bannerState, command('PLAY_CARD', '0', {
            cardId: 'card-zhanshujia-disengage',
        }), createQueuedRandom([4]));
        const bannerSettled = settleBonusDice(
            { ...bannerState, core: applyEvents(bannerState.core, bannerEvents) },
            '0',
        );
        expect(eventsOfType([...bannerEvents, ...bannerSettled.events], 'DAMAGE_SHIELD_GRANTED')[0]?.payload).toMatchObject({
            targetId: '0',
            value: 3,
            sourceId: 'card-zhanshujia-disengage',
        });

        const medalState = createZhanshujiaDefenseCardPlayState('card-zhanshujia-disengage');
        const medalEvents = execute(medalState, command('PLAY_CARD', '0', {
            cardId: 'card-zhanshujia-disengage',
        }), createQueuedRandom([6]));
        const medalSettled = settleBonusDice(
            { ...medalState, core: applyEvents(medalState.core, medalEvents) },
            '0',
        );
        const afterMedal = medalSettled.state.core;
        expect(afterMedal.players['0'].tokens[TOKEN_IDS.PROTECT]).toBe(1);
    });

    it('战术家伴装撤退在被攻击后对攻击者施加紧缚并防止 3 伤害', () => {
        const state = createZhanshujiaDefenseCardPlayState('card-zhanshujia-tactical-retreat');
        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-zhanshujia-tactical-retreat',
        }), fixedRandom);
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.BIND,
            sourceAbilityId: 'card-zhanshujia-tactical-retreat',
        });
        expect(eventsOfType(events, 'DAMAGE_SHIELD_GRANTED')[0]?.payload).toMatchObject({
            targetId: '0',
            value: 3,
            sourceId: 'card-zhanshujia-tactical-retreat',
        });
        expect(next.players['1'].statusEffects[STATUS_IDS.BIND]).toBe(1);
        expect(next.players['0'].damageShields?.[0]).toMatchObject({ value: 3 });

        const exitResult = diceThroneFlowHooks.onPhaseExit?.({
            state: { ...state, core: next, sys: { ...state.sys, phase: 'defensiveRoll' } },
            from: 'defensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const exitEvents = Array.isArray(exitResult) ? exitResult : (exitResult?.events ?? []);
        const afterDefense = applyEvents(next, exitEvents as DiceThroneEvent[]);

        expect(eventsOfType(exitEvents as DiceThroneEvent[], 'STATUS_REMOVED')
            .some(event => event.payload.targetId === '1' && event.payload.statusId === STATUS_IDS.BIND)).toBe(false);
        expect(afterDefense.players['1'].statusEffects[STATUS_IDS.BIND] ?? 0).toBe(1);
    });

    it('战术家作战室按骰值一半向上取整获得战术优势', () => {
        const state = createZhanshujiaCardPlayState('card-zhanshujia-war-room');
        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-zhanshujia-war-room',
        }), createQueuedRandom([5]));
        const next = applyEvents(state.core, events);
        const settled = settleBonusDice({ ...state, core: next }, '0');

        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 5,
            face: 'banner',
            effectKey: 'bonusDie.effect.zhanshujiaWarRoom',
        });
        expect(settled.state.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(5);
    });

    it('战术家战略防御选择任意玩家获得守护', () => {
        const state = createZhanshujiaCardPlayState('card-zhanshujia-strategic-defense');
        const playEvents = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-zhanshujia-strategic-defense',
        }), fixedRandom);
        const reducedCore = applyEvents(state.core, playEvents);
        const system = createDiceThroneEventSystem();
        const afterEvents = system.afterEvents?.({
            state: { ...state, core: reducedCore },
            events: playEvents,
            random: fixedRandom,
        } as any);
        if (!afterEvents || Array.isArray(afterEvents) || !('state' in afterEvents)) {
            throw new Error('战略防御未创建目标选择交互');
        }
        const promptState = afterEvents.state as MatchState<DiceThroneCore>;
        const interaction = getCardInteractionPrompt(promptState, 'card-zhanshujia-strategic-defense');
        expect(interaction).toMatchObject({
            type: 'selectPlayer',
            sourceCardId: 'card-zhanshujia-strategic-defense',
            tokenGrantConfig: { tokenId: TOKEN_IDS.PROTECT, amount: 1 },
        });
        expect(interaction.targetPlayerIds).toEqual(['0', '1']);

        const resolveEvents = execute(promptState, command('RESOLVE_INTERACTION', '0', {
            selectedPlayerIds: ['1'],
        }), fixedRandom);
        const next = applyEvents(promptState.core, resolveEvents);
        expect(eventsOfType(resolveEvents, 'TOKEN_GRANTED')[0]?.payload).toMatchObject({
            targetId: '1',
            tokenId: TOKEN_IDS.PROTECT,
            amount: 1,
            sourceAbilityId: 'card-zhanshujia-strategic-defense',
        });
        expect(next.players['1'].tokens[TOKEN_IDS.PROTECT]).toBe(1);
    });

    it('制胜高地提升战术优势上限 1 并补至新上限', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 2;
        state.core.players['0'].tokenStackLimits[TOKEN_IDS.TACTICAL_ADVANTAGE] = 5;

        const events = resolveEffectsToEvents(
            getAbilityEffects(state.core, '0', 'high-ground'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'high-ground',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokenStackLimits[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(6);
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(6);
        expect(next.players['1'].statusEffects[STATUS_IDS.TARGETED]).toBe(1);
        expect(next.players['1'].statusEffects[STATUS_IDS.BIND]).toBe(1);
    });

    it('死亡印记先获得 2CP，亡灵之爪按对手诅咒金币层数造成直接伤害', () => {
        const marked = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(marked, '0', 'cursed');
        marked.core.players['0'].resources[RESOURCE_IDS.CP] = 1;

        const markedEvents = resolveEffectsToEvents(
            getAbilityEffects(marked.core, '0', 'marked-for-death'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'marked-for-death',
                state: marked.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: createQueuedRandom([6, 6, 6, 6]) },
        );
        const markedNext = applyEvents(marked.core, markedEvents);
        expect(markedNext.players['0'].resources[RESOURCE_IDS.CP]).toBe(3);

        const markedCutlass = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(markedCutlass, '0', 'cursed');
        const markedCutlassEvents = resolveEffectsToEvents(
            getAbilityEffects(markedCutlass.core, '0', 'marked-for-death'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'marked-for-death',
                state: markedCutlass.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: createQueuedRandom([1, 1, 2, 3]) },
        );
        const markedCutlassSettled = settleBonusDice(
            { ...markedCutlass, core: applyEvents(markedCutlass.core, markedCutlassEvents) },
            '0',
        );
        const markedCutlassAllEvents = [...markedCutlassEvents, ...markedCutlassSettled.events];
        const cutlassDamageEvents = eventsOfType(markedCutlassAllEvents, 'DAMAGE_DEALT')
            .filter(event => event.payload.sourceAbilityId === 'marked-for-death');
        expect(cutlassDamageEvents).toHaveLength(4);
        expect(cutlassDamageEvents.every(event => event.payload.amount === 2 && event.payload.unblockable === true)).toBe(true);
        expect(markedCutlassAllEvents.some(event => event.type === 'CARD_DRAWN')).toBe(false);
        expect(markedCutlassAllEvents.some(event => (
            event.type === 'STATUS_APPLIED' && event.payload.statusId === STATUS_IDS.CURSED_COIN
        ))).toBe(false);

        const markedLootAndSkull = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(markedLootAndSkull, '0', 'cursed');
        const markedLootAndSkullEvents = resolveEffectsToEvents(
            getAbilityEffects(markedLootAndSkull.core, '0', 'marked-for-death'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'marked-for-death',
                state: markedLootAndSkull.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: createQueuedRandom([4, 5, 6, 6]) },
        );
        const markedLootAndSkullSettled = settleBonusDice(
            { ...markedLootAndSkull, core: applyEvents(markedLootAndSkull.core, markedLootAndSkullEvents) },
            '0',
        );
        const markedLootAndSkullAllEvents = [...markedLootAndSkullEvents, ...markedLootAndSkullSettled.events];
        const markedLootAndSkullNext = markedLootAndSkullSettled.state.core;
        expect(markedLootAndSkullNext.players['0'].hand).toHaveLength(2);
        expect(markedLootAndSkullNext.players['1'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(2);
        expect(markedLootAndSkullAllEvents.some(event => event.type === 'DAMAGE_DEALT')).toBe(false);

        const claw = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(claw, '0', 'cursed');
        claw.core.players['1'].statusEffects[STATUS_IDS.CURSED_COIN] = 3;
        const clawEvents = resolveEffectsToEvents(
            getAbilityEffects(claw.core, '0', 'undead-claw'),
            'postDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'undead-claw',
                state: claw.core,
                damageDealt: 8,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const damageEvents = eventsOfType(clawEvents, 'DAMAGE_DEALT');
        expect(damageEvents).toHaveLength(1);
        expect(damageEvents[0].payload.targetId).toBe('1');
        expect(damageEvents[0].payload.amount).toBe(3);
        expect(damageEvents[0].payload.damageScope).toBe('direct');
    });

    it('咒缚海盗你还嫩了点按防御骰结算反击、CP、防伤与诅咒金币', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'cursed');
        state.core.rollDiceCount = 5;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 1;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: [1, 2, 4, 6, 6][index] ?? die.value,
        }));

        const events = resolveEffectsToEvents(
            getAbilityEffects(state.core, '0', 'still-wet-behind-ears'),
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'still-wet-behind-ears',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
                isDefensiveContext: true,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 2,
            damageScope: 'direct',
        });
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);
        expect(next.players['0'].damageShields?.[0]).toMatchObject({
            value: 4,
            sourceId: 'still-wet-behind-ears',
        });
        expect(next.players['1'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
    });

    it('无情诅咒在 4 人 2v2 中只允许至多两名对手获得火药桶', () => {
        const state = createFourPlayerCursedPirateState();
        setPlayerBoardFace(state, '0', 'cursed');
        const { state: promptState } = requestMercilessCursePowderKegChoice(state);
        const prompt = getSimpleChoicePrompt(promptState, 'merciless-curse');
        const values = prompt.options.map(option => option.value as {
            value: number;
            customId?: string;
            labelParams?: { targets?: string };
            targetPlayerIds?: string[];
            statusGrantConfig?: { statusId?: string; amount?: number };
        });

        expect(prompt.title).toBe('choices.mercilessCursePowderKeg.title');
        expect(values.map(option => option.value).sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
        expect(values.every(option => option.customId === 'cursed-pirate-merciless-curse-powder-keg')).toBe(true);
        expect(values.some(option => option.labelParams?.targets === 'P2, P4')).toBe(true);
        expect(values.some(option => option.labelParams?.targets?.includes('P3'))).toBe(false);
        expect(values.find(option => option.value === 3)).toMatchObject({
            targetPlayerIds: ['1', '3'],
            statusGrantConfig: { statusId: STATUS_IDS.POWDER_KEG, amount: 1 },
        });

        const bothOpponents = prompt.options.find(option => (
            option.value as { value?: number }
        ).value === 3);
        expect(bothOpponents).toBeDefined();
        const result = respondToPrompt(promptState, bothOpponents!.id);
        expect(result.success).toBe(true);
        expect(eventsOfType(result.events as DiceThroneEvent[], 'CHOICE_RESOLVED')).toHaveLength(1);

        const applied = eventsOfType(result.events as DiceThroneEvent[], 'STATUS_APPLIED')
            .filter(event => event.payload.statusId === STATUS_IDS.POWDER_KEG);
        expect(applied.map(event => event.payload.targetId).sort()).toEqual(['1', '3']);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
        expect(result.state.core.players['2'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
        expect(result.state.core.players['3'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('无情诅咒选择跳过时不会施加火药桶', () => {
        const state = createFourPlayerCursedPirateState();
        setPlayerBoardFace(state, '0', 'cursed');
        const { state: promptState } = requestMercilessCursePowderKegChoice(state);
        const prompt = getSimpleChoicePrompt(promptState, 'merciless-curse');
        const skip = prompt.options.find(option => (
            option.value as { value?: number }
        ).value === 0);
        expect(skip).toBeDefined();

        const result = respondToPrompt(promptState, skip!.id);
        expect(result.success).toBe(true);
        expect(eventsOfType(result.events as DiceThroneEvent[], 'STATUS_APPLIED')
            .some(event => event.payload.statusId === STATUS_IDS.POWDER_KEG)).toBe(false);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
        expect(result.state.core.players['3'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
    });

    it('基础战争贩子在未触发勋章分支时，攻击收口后不会强制进入额外进攻投掷阶段', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'war-monger',
            isDefendable: false,
            damageResolved: true,
            resolvedDamage: 0,
        } as any;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);

        expect(Array.isArray(result)).toBe(false);
        const resolved = result as Exclude<typeof result, DiceThroneEvent[] | void>;
        expect(resolved?.overrideNextPhase).toBe('main2');
        expect(eventsOfType((resolved?.events ?? []) as DiceThroneEvent[], 'EXTRA_ATTACK_TRIGGERED')).toHaveLength(0);
    });

    it('额外进攻标记尚未进入 offensiveRoll 时，防御阶段收口会进入额外进攻投掷阶段', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'flanking',
            isDefendable: true,
            defenseAbilityId: 'still-wet-behind-ears',
            damageResolved: true,
            resolvedDamage: 0,
        } as any;
        state.core.extraAttackInProgress = {
            attackerId: '0',
            originalActivePlayerId: '0',
            phaseEntered: false,
        };

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'defensiveRoll' } },
            from: 'defensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '1'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);

        expect(Array.isArray(result)).toBe(false);
        const resolved = result as Exclude<typeof result, DiceThroneEvent[] | void>;
        expect(resolved?.overrideNextPhase).toBe('offensiveRoll');
    });

    it('额外进攻已经进入 offensiveRoll 后，后续攻击收口不应再次跳回 offensiveRoll', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'flanking',
            isDefendable: true,
            defenseAbilityId: 'still-wet-behind-ears',
            damageResolved: true,
            resolvedDamage: 0,
        } as any;
        state.core.extraAttackInProgress = {
            attackerId: '0',
            originalActivePlayerId: '0',
            phaseEntered: true,
        };

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'defensiveRoll' } },
            from: 'defensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '1'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);

        expect(Array.isArray(result)).toBe(false);
        const resolved = result as Exclude<typeof result, DiceThroneEvent[] | void>;
        expect(resolved?.overrideNextPhase).toBe('main2');
    });

    it('灵魂突刺在 3 个相同骰值时施加火药桶，深海潜行偷取 1CP 并让对手自选弃牌', () => {
        const soulStab = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(soulStab, '0', 'cursed');
        soulStab.core.rollDiceCount = 5;
        soulStab.core.dice = soulStab.core.dice.map((die, index) => ({
            ...die,
            value: index < 3 ? 2 : index + 1,
        }));
        let events = resolveEffectsToEvents(
            getAbilityVariantEffects(soulStab.core, '0', 'soul-stab', 'soul-stab-3'),
            'postDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'soul-stab-3',
                state: soulStab.core,
                damageDealt: 5,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        expect(eventsOfType(events, 'STATUS_APPLIED')[0]?.payload.statusId).toBe(STATUS_IDS.POWDER_KEG);

        const postDefenseSoulStab = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(postDefenseSoulStab, '0', 'cursed');
        postDefenseSoulStab.core.rollDiceCount = 5;
        postDefenseSoulStab.core.dice = postDefenseSoulStab.core.dice.map((die, index) => ({
            ...die,
            value: index + 1,
        }));
        postDefenseSoulStab.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'soul-stab-3',
            defenseAbilityId: 'countermeasures',
            isDefendable: true,
            damage: 5,
            damageResolved: true,
            resolvedDamage: 5,
            attackDiceValues: [2, 2, 2, 4, 5],
        };
        events = resolveEffectsToEvents(
            getAbilityVariantEffects(postDefenseSoulStab.core, '0', 'soul-stab', 'soul-stab-3'),
            'postDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'soul-stab-3',
                state: postDefenseSoulStab.core,
                damageDealt: 5,
                timestamp: 110,
            },
            { random: fixedRandom },
        );
        expect(eventsOfType(events, 'STATUS_APPLIED')[0]?.payload.statusId).toBe(STATUS_IDS.POWDER_KEG);

        const dive = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(dive, '0', 'cursed');
        dive.core.players['0'].resources[RESOURCE_IDS.CP] = 1;
        dive.core.players['1'].resources[RESOURCE_IDS.CP] = 3;
        dive.core.players['1'].hand = [getCardById('card-flick')];
        const discardedCardId = dive.core.players['1'].hand[0]?.id;
        expect(discardedCardId).toBeDefined();
        events = resolveEffectsToEvents(
            getAbilityEffects(dive.core, '0', 'deep-sea-dive'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'deep-sea-dive',
                state: dive.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(dive.core, events);

        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);
        expect(next.players['1'].resources[RESOURCE_IDS.CP]).toBe(2);
        expect(next.players['1'].statusEffects[STATUS_IDS.WITHER]).toBe(1);

        const discardInteraction = eventsOfType(events, 'INTERACTION_REQUESTED')[0]?.payload.interaction;
        expect(discardInteraction?.type).toBe('selectHandCard');
        expect(discardInteraction?.playerId).toBe('1');
        expect(discardInteraction?.targetPlayerIds).toEqual(['1']);

        const resolveEvents = execute({
            ...dive,
            sys: {
                ...dive.sys,
                interaction: {
                    current: {
                        id: `dt-interaction-${discardInteraction!.id}`,
                        kind: 'dt:card-interaction',
                        playerId: '1',
                        data: {
                            ...discardInteraction,
                            sourceId: discardInteraction!.sourceCardId,
                        },
                    },
                    queue: [],
                },
            },
        } as any, command('RESOLVE_INTERACTION', '1', {
            selectedCardIds: [discardedCardId],
        }), fixedRandom);
        const afterDiscard = applyEvents(dive.core, resolveEvents);
        expect(afterDiscard.players['1'].hand.some(card => card.id === discardedCardId)).toBe(false);
        expect(afterDiscard.players['1'].discard.some(card => card.id === discardedCardId)).toBe(true);
        expect(eventsOfType(resolveEvents, 'CARD_DISCARDED')[0]?.payload.playerId).toBe('1');
    });

    it('灵魂突刺在 3 个相同骰值但未造成伤害时不施加火药桶', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'cursed');
        state.core.rollDiceCount = 5;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            value: index < 3 ? 2 : index + 1,
        }));

        const events = resolveEffectsToEvents(
            getAbilityVariantEffects(state.core, '0', 'soul-stab', 'soul-stab-3'),
            'postDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'soul-stab-3',
                state: state.core,
                damageDealt: 0,
                timestamp: 120,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'STATUS_APPLIED')).toHaveLength(0);
        expect(next.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBeUndefined();
    });

    it('深海潜行真实进攻 pipeline 在偷取 CP 与施加凋零后保留对手弃牌交互', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].hand = [getCardById('card-zhanshujia-strategic-defense')];
        setCursedPirateDiceValues(state, [1, 4, 5, 6, 2]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'deep-sea-dive' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'deep-sea-dive',
        });

        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(advanced.success).toBe(true);
        expect(advanced.state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(6);
        expect(advanced.state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(4);
        expect(advanced.state.core.players['1'].statusEffects[STATUS_IDS.WITHER]).toBe(1);

        const discardPrompt = getCardInteractionPrompt(advanced.state, 'deep-sea-dive');
        expect(discardPrompt.type).toBe('selectHandCard');
        expect(discardPrompt.playerId).toBe('1');

        const discarded = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            advanced.state,
            command('RESOLVE_INTERACTION', '1', {
                selectedCardIds: ['card-zhanshujia-strategic-defense'],
            }),
            fixedRandom,
            ['0', '1'],
        );
        expect(discarded.success).toBe(true);
        expect(discarded.state.sys.interaction.current).toBeUndefined();
        expect(discarded.state.core.players['1'].hand).toHaveLength(0);
        expect(discarded.state.core.players['1'].discard.map(card => card.id)).toContain('card-zhanshujia-strategic-defense');
    });

    it('诅咒卡牌允许选择自伤抽牌分支', () => {
        const state = createCursedPirateCardPlayState('card-cursed-pirate-curse-card');
        const initialHp = state.core.players['0'].resources[RESOURCE_IDS.HP];
        state.core.players['0'].deck = [
            getCardById('card-flick'),
            getCardById('card-surprise'),
            getCardById('card-just-this'),
        ];

        const playResult = playCardWithPipeline(state, '0', 'card-cursed-pirate-curse-card');
        expect(playResult.success).toBe(true);
        const prompt = getSimpleChoicePrompt(playResult.state, 'card-cursed-pirate-curse-card');
        expect(prompt.title).toBe('choices.cursedPirateCurseCard.title');
        const damage4Draw3 = prompt.options.find(option => (
            option.value as { value?: number }
        ).value === 3);
        expect(damage4Draw3).toBeDefined();

        const result = respondToPrompt(playResult.state, damage4Draw3!.id, '0');
        expect(result.success).toBe(true);
        const damage = eventsOfType(result.events as DiceThroneEvent[], 'DAMAGE_DEALT')[0];
        expect(damage?.payload).toMatchObject({
            targetId: '0',
            amount: 4,
            damageScope: 'direct',
            unblockable: true,
        });
        expect(eventsOfType(result.events as DiceThroneEvent[], 'CARD_DRAWN')).toHaveLength(3);
        expect(result.state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(initialHp - 4);
        expect(result.state.core.players['0'].hand.map(card => card.id)).toEqual([
            'card-flick',
            'card-surprise',
            'card-just-this',
        ]);
    });

    it('封舱弃掉剩余手牌后抽 4', () => {
        const state = createCursedPirateCardPlayState('card-cursed-pirate-batten-down');
        state.core.players['0'].hand = [
            getCardById('card-cursed-pirate-batten-down'),
            getCardById('card-flick'),
            getCardById('card-surprise'),
        ];
        state.core.players['0'].deck = [
            getCardById('card-just-this'),
            getCardById('card-next-time'),
            getCardById('card-i-can-again'),
            getCardById('card-me-too'),
        ];

        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-cursed-pirate-batten-down',
        }), fixedRandom);
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'CARD_DISCARDED').map(event => event.payload.cardId).sort()).toEqual([
            'card-flick',
            'card-surprise',
        ]);
        expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(4);
        expect(next.players['0'].discard.map(card => card.id).sort()).toEqual([
            'card-cursed-pirate-batten-down',
            'card-flick',
            'card-surprise',
        ]);
        expect(next.players['0'].hand.map(card => card.id)).toEqual([
            'card-just-this',
            'card-next-time',
            'card-i-can-again',
            'card-me-too',
        ]);
    });

    it('起锚骷髅时只施加休战，非骷髅时只抽 1 张牌', () => {
        const skullState = createCursedPirateCardPlayState('card-cursed-pirate-weigh-anchor');
        const skullEvents = execute(skullState, command('PLAY_CARD', '0', {
            cardId: 'card-cursed-pirate-weigh-anchor',
        }), createQueuedRandom([6]));
        const skullSettled = settleBonusDice(
            { ...skullState, core: applyEvents(skullState.core, skullEvents) },
            '0',
        );
        const skullAllEvents = [...skullEvents, ...skullSettled.events];
        const afterSkull = skullSettled.state.core;

        expect(eventsOfType(skullAllEvents, 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(afterSkull.players['1'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
        expect(eventsOfType(skullAllEvents, 'CARD_DRAWN')).toHaveLength(0);
        expect(afterSkull.players['0'].hand).toHaveLength(0);

        const otherState = createCursedPirateCardPlayState('card-cursed-pirate-weigh-anchor');
        otherState.core.players['0'].deck = [getCardById('card-flick')];
        const otherEvents = execute(otherState, command('PLAY_CARD', '0', {
            cardId: 'card-cursed-pirate-weigh-anchor',
        }), createQueuedRandom([1]));
        const otherSettled = settleBonusDice(
            { ...otherState, core: applyEvents(otherState.core, otherEvents) },
            '0',
        );
        const otherAllEvents = [...otherEvents, ...otherSettled.events];
        const afterOther = otherSettled.state.core;

        expect(eventsOfType(otherAllEvents, 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(eventsOfType(otherAllEvents, 'CARD_DRAWN')).toHaveLength(1);
        expect(afterOther.players['0'].hand.map(card => card.id)).toEqual(['card-flick']);
        expect(afterOther.players['1'].statusEffects[STATUS_IDS.PARLEY] ?? 0).toBe(0);
    });

    it('抽筋剥皮按弯刀数增加攻击伤害，至少 3 点时施加火药桶', () => {
        const state = createCursedPirateCardPlayState('card-cursed-pirate-flay', 'offensiveRoll');
        state.core.rollCount = 1;
        state.core.rollDiceCount = 5;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-attack',
            isDefendable: true,
        } as any;

        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-cursed-pirate-flay',
        }), createQueuedRandom([1, 2, 3, 4, 6]));
        const next = applyEvents(state.core, events);

        const bonusDamage = eventsOfType(events, 'BONUS_DAMAGE_ADDED')[0];
        expect(bonusDamage?.payload).toMatchObject({
            playerId: '0',
            amount: 3,
            sourceCardId: 'card-cursed-pirate-flay',
        });
        expect(next.pendingAttack?.bonusDamage).toBe(3);
        expect(next.pendingAttack?.attackModifierBonusDamage).toBe(3);
        expect(next.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('抽筋剥皮弯刀不足 3 时只增加攻击伤害，不施加火药桶', () => {
        const state = createCursedPirateCardPlayState('card-cursed-pirate-flay', 'offensiveRoll');
        state.core.rollCount = 1;
        state.core.rollDiceCount = 5;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-attack',
            isDefendable: true,
        } as any;

        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-cursed-pirate-flay',
        }), createQueuedRandom([1, 4, 5, 6, 6]));
        const next = applyEvents(state.core, events);

        const bonusDamage = eventsOfType(events, 'BONUS_DAMAGE_ADDED')[0];
        expect(bonusDamage?.payload).toMatchObject({
            playerId: '0',
            amount: 1,
            sourceCardId: 'card-cursed-pirate-flay',
        });
        expect(next.pendingAttack?.bonusDamage).toBe(1);
        expect(next.pendingAttack?.attackModifierBonusDamage).toBe(1);
        expect(eventsOfType(events, 'STATUS_APPLIED')
            .some(event => event.payload.statusId === STATUS_IDS.POWDER_KEG)).toBe(false);
        expect(next.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
    });

    it('虚张声势按弯刀伤害、战利品抽牌、骷髅火药桶三分支结算', () => {
        const cutlassState = createCursedPirateCardPlayState('card-cursed-pirate-bluster');
        cutlassState.core.players['0'].resources[RESOURCE_IDS.CP] = 4;
        const cutlassEvents = execute(cutlassState, command('PLAY_CARD', '0', {
            cardId: 'card-cursed-pirate-bluster',
        }), createQueuedRandom([1]));
        const cutlassSettled = settleBonusDice(
            { ...cutlassState, core: applyEvents(cutlassState.core, cutlassEvents) },
            '0',
        );
        const cutlassAllEvents = [...cutlassEvents, ...cutlassSettled.events];
        const afterCutlass = cutlassSettled.state.core;
        const cutlassDamage = eventsOfType(cutlassAllEvents, 'DAMAGE_DEALT')
            .find(event => event.payload.sourceAbilityId === 'card-cursed-pirate-bluster');
        expect(eventsOfType(cutlassAllEvents, 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(cutlassDamage?.payload).toMatchObject({
            targetId: '1',
            amount: 2,
        });
        expect(eventsOfType(cutlassAllEvents, 'CARD_DRAWN')).toHaveLength(0);
        expect(afterCutlass.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
        expect(afterCutlass.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 2);

        const lootState = createCursedPirateCardPlayState('card-cursed-pirate-bluster');
        lootState.core.players['0'].resources[RESOURCE_IDS.CP] = 4;
        lootState.core.players['0'].deck = [
            getCardById('card-flick'),
            getCardById('card-surprise'),
        ];
        const lootEvents = execute(lootState, command('PLAY_CARD', '0', {
            cardId: 'card-cursed-pirate-bluster',
        }), createQueuedRandom([4]));
        const lootSettled = settleBonusDice(
            { ...lootState, core: applyEvents(lootState.core, lootEvents) },
            '0',
        );
        const lootAllEvents = [...lootEvents, ...lootSettled.events];
        const afterLoot = lootSettled.state.core;
        expect(eventsOfType(lootAllEvents, 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(eventsOfType(lootAllEvents, 'CARD_DRAWN')).toHaveLength(2);
        expect(eventsOfType(lootAllEvents, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(afterLoot.players['0'].hand.map(card => card.id)).toEqual([
            'card-flick',
            'card-surprise',
        ]);
        expect(afterLoot.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);

        const skullState = createCursedPirateCardPlayState('card-cursed-pirate-bluster');
        skullState.core.players['0'].resources[RESOURCE_IDS.CP] = 4;
        const skullEvents = execute(skullState, command('PLAY_CARD', '0', {
            cardId: 'card-cursed-pirate-bluster',
        }), createQueuedRandom([6]));
        const blusterSkullSettled = settleBonusDice(
            { ...skullState, core: applyEvents(skullState.core, skullEvents) },
            '0',
        );
        const blusterSkullAllEvents = [...skullEvents, ...blusterSkullSettled.events];
        const afterSkull = blusterSkullSettled.state.core;
        expect(eventsOfType(blusterSkullAllEvents, 'BONUS_DIE_ROLLED')).toHaveLength(1);
        expect(afterSkull.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
        expect(eventsOfType(blusterSkullAllEvents, 'CARD_DRAWN')).toHaveLength(0);
        expect(eventsOfType(blusterSkullAllEvents, 'DAMAGE_DEALT')).toHaveLength(0);
    });

    it('赎金先选择对手骰子，再由对手支付 2CP 或重掷该骰子', () => {
        const payState = createCursedPirateCardPlayState('card-cursed-pirate-ransom', 'offensiveRoll');
        payState.core.rollCount = 1;
        payState.core.rollDiceCount = 5;
        payState.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        payState.core.players['1'].resources[RESOURCE_IDS.CP] = 3;
        payState.core.dice = payState.core.dice.map((die, index) => ({
            ...die,
            value: index === 0 ? 6 : die.value,
        }));

        const payPlay = playCardWithPipeline(payState, '0', 'card-cursed-pirate-ransom');
        expect(payPlay.success).toBe(true);
        const diePrompt = getSimpleChoicePrompt(payPlay.state, 'card-cursed-pirate-ransom');
        expect(diePrompt.title).toBe('choices.cursedPirateRansomDie.title');
        const dieOption = diePrompt.options.find(option => (
            option.value as { labelParams?: { die?: number } }
        ).labelParams?.die === 1);
        expect(dieOption).toBeDefined();

        const payDecisionState = respondToPrompt(payPlay.state, dieOption!.id, '0');
        expect(payDecisionState.success).toBe(true);
        const payPrompt = getSimpleChoicePrompt(payDecisionState.state, 'card-cursed-pirate-ransom');
        expect(payPrompt.title).toBe('choices.cursedPirateRansomResolve.title');
        expect(payPrompt.playerId).toBe('1');
        const pay = payPrompt.options.find(option => (
            option.value as { value?: number }
        ).value! % 10 === 1);
        expect(pay).toBeDefined();
        const payResult = respondToPrompt(payDecisionState.state, pay!.id, '1');
        expect(payResult.success).toBe(true);
        expect(payResult.state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(5 - 1 + 2);
        expect(payResult.state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(1);

        const rerollState = createCursedPirateCardPlayState('card-cursed-pirate-ransom', 'offensiveRoll');
        rerollState.core.rollCount = 1;
        rerollState.core.rollDiceCount = 5;
        rerollState.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        rerollState.core.players['1'].resources[RESOURCE_IDS.CP] = 0;
        rerollState.core.dice = rerollState.core.dice.map((die, index) => ({
            ...die,
            value: index === 0 ? 6 : die.value,
        }));

        const rerollPlay = playCardWithPipeline(rerollState, '0', 'card-cursed-pirate-ransom');
        const rerollDiePrompt = getSimpleChoicePrompt(rerollPlay.state, 'card-cursed-pirate-ransom');
        const rerollDieOption = rerollDiePrompt.options.find(option => (
            option.value as { labelParams?: { die?: number } }
        ).labelParams?.die === 1);
        expect(rerollDieOption).toBeDefined();
        const rerollDecisionState = respondToPrompt(rerollPlay.state, rerollDieOption!.id, '0');
        const rerollPrompt = getSimpleChoicePrompt(rerollDecisionState.state, 'card-cursed-pirate-ransom');
        const reroll = rerollPrompt.options.find(option => (
            option.value as { value?: number }
        ).value! % 10 === 0);
        expect(reroll).toBeDefined();
        const rerollResult = respondToPrompt(rerollDecisionState.state, reroll!.id, '1', createQueuedRandom([4]));
        expect(rerollResult.success).toBe(true);
        const rerolled = eventsOfType(rerollResult.events as DiceThroneEvent[], 'DIE_REROLLED')[0];
        expect(rerolled?.payload).toMatchObject({
            dieId: 0,
            oldValue: 6,
            newValue: 4,
            playerId: '1',
        });
        expect(rerollResult.state.core.dice[0].value).toBe(4);
        expect(rerollResult.state.sys.phase).toBe('offensiveRoll');
    });

    it('鲨鱼饵在真实攻击链中会保留海盗技能本体的伤害', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
        state.core.players['0'].hand = [getCardById('card-cursed-pirate-shark-bait')];
        setCursedPirateDiceValues(state, [1, 6, 6, 6, 4]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'undead-claw' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);

        const modified = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('PLAY_CARD', '0', { cardId: 'card-cursed-pirate-shark-bait' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(modified.success).toBe(true);

        const hpBefore = modified.state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const resolved = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            modified.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(resolved.success).toBe(true);
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 10);
    });

    it('抽筋剥皮在真实攻击链中会保留海盗技能本体的伤害', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
        state.core.players['0'].hand = [getCardById('card-cursed-pirate-flay')];
        setCursedPirateDiceValues(state, [1, 6, 6, 6, 4]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'undead-claw' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);

        const modified = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('PLAY_CARD', '0', { cardId: 'card-cursed-pirate-flay' }),
            createQueuedRandom([1, 1, 1, 1, 1]),
            ['0', '1'],
        );
        expect(modified.success).toBe(true);

        const bonusConfirmed = settleBonusDiceThroughPipeline(modified.state, '0');
        expect(bonusConfirmed.state.core.pendingBonusDiceSettlement).toBeFalsy();
        expect(bonusConfirmed.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'undead-claw',
            isDefendable: false,
            bonusDamage: 5,
            settlementStage: 'preDamage',
        });
        const hpBefore = bonusConfirmed.state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const resolved = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            bonusConfirmed.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(resolved.success).toBe(true);
        expect(resolved.state.sys.phase).toBe('main2');
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 13);
        expect(resolved.state.core.pendingAttack).toBeNull();
        expect(resolved.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('干票大的只要投出战利品就抽 2 并获得 2CP', () => {
        const state = createCursedPirateCardPlayState('card-cursed-pirate-hefty');
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 3;
        state.core.players['0'].deck = [
            getCardById('card-flick'),
            getCardById('card-surprise'),
        ];

        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-cursed-pirate-hefty',
        }), createQueuedRandom([4, 6]));
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')).toHaveLength(2);
        expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(2);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(3 - 2 + 2);
        expect(next.players['0'].hand.map(card => card.id)).toEqual([
            'card-flick',
            'card-surprise',
        ]);
    });

    it('干票大的未投出战利品时不抽牌也不获得 CP', () => {
        const state = createCursedPirateCardPlayState('card-cursed-pirate-hefty');
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 3;
        state.core.players['0'].deck = [
            getCardById('card-flick'),
            getCardById('card-surprise'),
        ];

        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-cursed-pirate-hefty',
        }), createQueuedRandom([1, 6]));
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')).toHaveLength(2);
        expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(0);
        expect(eventsOfType(events, 'CP_CHANGED')).toHaveLength(0);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(3 - 2);
        expect(next.players['0'].hand).toHaveLength(0);
        expect(next.players['0'].deck.map(card => card.id)).toEqual([
            'card-flick',
            'card-surprise',
        ]);
    });

    it('送你们去喂鱼在 4 人 2v2 中选择至多三名不同对手，且可跳过', () => {
        const state = createFourPlayerCursedPirateState();
        state.sys.phase = 'main1';
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
        state.core.players['0'].hand = [getCardById('card-cursed-pirate-go-fish')];

        const playResult = playCardWithPipeline(state, '0', 'card-cursed-pirate-go-fish');
        expect(playResult.success).toBe(true);
        const prompt = getSimpleChoicePrompt(playResult.state, 'card-cursed-pirate-go-fish');
        expect(prompt.title).toBe('choices.cursedPirateGoFish.title');
        const values = prompt.options.map(option => option.value as {
            value: number;
            labelParams?: { targets?: string };
            targetPlayerIds?: string[];
            statusGrantConfig?: { statusId?: string; amount?: number };
        });
        expect(values.map(option => option.value).sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
        expect(values.some(option => option.labelParams?.targets === 'P2, P4')).toBe(true);
        expect(values.some(option => option.labelParams?.targets?.includes('P3'))).toBe(false);
        expect(values.find(option => option.value === 3)).toMatchObject({
            targetPlayerIds: ['1', '3'],
            statusGrantConfig: { statusId: STATUS_IDS.POWDER_KEG, amount: 1 },
        });

        const bothOpponents = prompt.options.find(option => (
            option.value as { value?: number }
        ).value === 3);
        expect(bothOpponents).toBeDefined();
        const result = respondToPrompt(playResult.state, bothOpponents!.id);
        expect(result.success).toBe(true);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
        expect(result.state.core.players['2'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
        expect(result.state.core.players['3'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);

        const skipState = createFourPlayerCursedPirateState();
        skipState.sys.phase = 'main1';
        skipState.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
        skipState.core.players['0'].hand = [getCardById('card-cursed-pirate-go-fish')];
        const skipPlay = playCardWithPipeline(skipState, '0', 'card-cursed-pirate-go-fish');
        const skipPrompt = getSimpleChoicePrompt(skipPlay.state, 'card-cursed-pirate-go-fish');
        const skip = skipPrompt.options.find(option => (
            option.value as { value?: number }
        ).value === 0);
        expect(skip).toBeDefined();
        const skipResult = respondToPrompt(skipPlay.state, skip!.id);
        expect(skipResult.success).toBe(true);
        expect(eventsOfType(skipResult.events as DiceThroneEvent[], 'STATUS_APPLIED')
            .some(event => event.payload.statusId === STATUS_IDS.POWDER_KEG)).toBe(false);
    });

    it('啜呼让目标选择直接获得火药桶或改为投骰结算', () => {
        const acceptState = createCursedPirateCardPlayState('card-cursed-pirate-sip');
        const acceptPlay = playCardWithPipeline(acceptState, '0', 'card-cursed-pirate-sip');
        expect(acceptPlay.success).toBe(true);
        const acceptPrompt = getSimpleChoicePrompt(acceptPlay.state, 'card-cursed-pirate-sip');
        expect(acceptPrompt.title).toBe('choices.cursedPirateSip.title');
        expect(acceptPrompt.playerId).toBe('1');
        const accept = acceptPrompt.options.find(option => (
            option.value as { value?: number }
        ).value === 0);
        expect(accept).toBeDefined();
        const acceptResult = respondToPrompt(acceptPlay.state, accept!.id, '1');
        expect(acceptResult.success).toBe(true);
        expect(acceptResult.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
        expect(acceptResult.state.core.players['1'].statusEffects[STATUS_IDS.WITHER] ?? 0).toBe(0);

        const rollState = createCursedPirateCardPlayState('card-cursed-pirate-sip');
        const rollPlay = playCardWithPipeline(rollState, '0', 'card-cursed-pirate-sip');
        const rollPrompt = getSimpleChoicePrompt(rollPlay.state, 'card-cursed-pirate-sip');
        const roll = rollPrompt.options.find(option => (
            option.value as { value?: number }
        ).value === 1);
        expect(roll).toBeDefined();
        const rollResult = respondToPrompt(rollPlay.state, roll!.id, '1', createQueuedRandom([4]));
        expect(rollResult.success).toBe(true);
        expect(eventsOfType(rollResult.events as DiceThroneEvent[], 'BONUS_DIE_ROLLED')[0]?.payload.value).toBe(4);
        expect(rollResult.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
        expect(rollResult.state.core.players['1'].statusEffects[STATUS_IDS.WITHER]).toBe(1);
    });

    it('啜呼改为投骰后若掷出 1-2 则不施加任何状态', () => {
        const rollState = createCursedPirateCardPlayState('card-cursed-pirate-sip');
        const rollPlay = playCardWithPipeline(rollState, '0', 'card-cursed-pirate-sip');
        const rollPrompt = getSimpleChoicePrompt(rollPlay.state, 'card-cursed-pirate-sip');
        const roll = rollPrompt.options.find(option => (
            option.value as { value?: number }
        ).value === 1);
        expect(roll).toBeDefined();

        const rollResult = respondToPrompt(rollPlay.state, roll!.id, '1', createQueuedRandom([1]));
        expect(rollResult.success).toBe(true);
        expect(eventsOfType(rollResult.events as DiceThroneEvent[], 'BONUS_DIE_ROLLED')[0]?.payload.value).toBe(1);
        expect(eventsOfType(rollResult.events as DiceThroneEvent[], 'STATUS_APPLIED')).toHaveLength(0);
        expect(rollResult.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
        expect(rollResult.state.core.players['1'].statusEffects[STATUS_IDS.WITHER] ?? 0).toBe(0);
    });

    it('瞭望台按弯刀查看手牌、战利品自选弃牌、骷髅随机弃牌分支结算', () => {
        const viewState = createCursedPirateCardPlayState('card-cursed-pirate-crows-nest');
        viewState.core.players['1'].hand = [getCardById('card-flick'), getCardById('card-surprise')];
        const viewPlay = playCardWithPipeline(viewState, '0', 'card-cursed-pirate-crows-nest', createQueuedRandom([1]));
        expect(viewPlay.success).toBe(true);
        expect(viewPlay.state.sys.interaction.current?.kind).toBe('dt:bonus-dice');
        const viewSettled = settleBonusDiceThroughPipeline(viewPlay.state, '0');
        const viewPrompt = getSimpleChoicePrompt(viewSettled.state, 'card-cursed-pirate-crows-nest');
        expect(viewPrompt.title).toBe('choices.cursedPirateCrowsNestView.title');
        expect(viewPrompt.playerId).toBe('0');
        expect((viewPrompt.options[0]?.value as { labelParams?: { cards?: string } }).labelParams?.cards)
            .toContain('card-flick');
        const viewConfirm = respondToPrompt(viewSettled.state, viewPrompt.options[0]!.id, '0');
        expect(viewConfirm.success).toBe(true);
        expect(viewConfirm.state.core.players['1'].hand.map(card => card.id)).toEqual([
            'card-flick',
            'card-surprise',
        ]);
        expect(eventsOfType(viewConfirm.events as DiceThroneEvent[], 'CARD_DISCARDED')).toHaveLength(0);

        const lootState = createCursedPirateCardPlayState('card-cursed-pirate-crows-nest');
        lootState.core.players['1'].hand = [getCardById('card-flick')];
        const lootPlay = playCardWithPipeline(lootState, '0', 'card-cursed-pirate-crows-nest', createQueuedRandom([4]));
        expect(lootPlay.success).toBe(true);
        expect(lootPlay.state.sys.interaction.current?.kind).toBe('dt:bonus-dice');
        const lootSettled = settleBonusDiceThroughPipeline(lootPlay.state, '0');
        const discardPrompt = getCardInteractionPrompt(lootSettled.state, 'card-cursed-pirate-crows-nest');
        expect(discardPrompt.type).toBe('selectHandCard');
        expect(discardPrompt.playerId).toBe('1');
        const discardEvents = execute(lootSettled.state, command('RESOLVE_INTERACTION', '1', {
            selectedCardIds: ['card-flick'],
        }), fixedRandom);
        const afterDiscard = applyEvents(lootSettled.state.core, discardEvents);
        expect(afterDiscard.players['1'].hand).toHaveLength(0);
        expect(afterDiscard.players['1'].discard.map(card => card.id)).toContain('card-flick');

        const skullState = createCursedPirateCardPlayState('card-cursed-pirate-crows-nest');
        skullState.core.players['1'].hand = [getCardById('card-flick'), getCardById('card-surprise')];
        const skullEvents = execute(skullState, command('PLAY_CARD', '0', {
            cardId: 'card-cursed-pirate-crows-nest',
        }), createQueuedRandom([6]));
        const afterSkull = applyEvents(skullState.core, skullEvents);
        const randomDiscard = eventsOfType(skullEvents, 'CARD_DISCARDED')[0];
        expect(randomDiscard?.payload).toMatchObject({
            playerId: '1',
            cardId: 'card-flick',
        });
        expect(afterSkull.players['1'].hand.map(card => card.id)).toEqual(['card-surprise']);
    });

    it('咒缚海盗真实开局为 human 面并自带 3 个诅咒金币', () => {
        const state = createCursedPirateCardPlayState('card-cursed-pirate-pirates-life');

        expect(state.core.players['0'].playerBoardFace).toBe('normal');
        expect(state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(3);
    });

    it('海盗的一生在咒缚面治疗 3 而不是获得诅咒金币', () => {
        const state = createCursedPirateCardPlayState('card-cursed-pirate-pirates-life');
        setPlayerBoardFace(state, '0', 'cursed');
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH - 5;

        const playResult = playCardWithPipeline(state, '0', 'card-cursed-pirate-pirates-life');
        expect(playResult.success).toBe(true);
        expect(playResult.state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 2);
        expect(playResult.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
        expect(playResult.state.core.currentChoiceSourceAbilityId).not.toBe('card-cursed-pirate-pirates-life');
    });

    it('海盗的一生在普通面保留获得 1 诅咒金币选择分支', () => {
        const state = createCursedPirateCardPlayState('card-cursed-pirate-pirates-life');
        state.core.players['0'].playerBoardFace = 'normal';
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 1;

        const playResult = playCardWithPipeline(state, '0', 'card-cursed-pirate-pirates-life');
        expect(playResult.success).toBe(true);
        const prompt = getSimpleChoicePrompt(playResult.state, 'card-cursed-pirate-pirates-life');
        expect(prompt.playerId).toBe('0');
        const accept = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId === STATUS_IDS.CURSED_COIN);
        expect(accept).toBeDefined();

        const result = respondToPrompt(playResult.state, accept!.id, '0');
        expect(result.success).toBe(true);
        expect(result.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(2);
    });

    it('human 面咒缚在回合结束时优先移除 1 个诅咒金币且不翻面', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.sys.phase = 'discard';
        state.core.activePlayerId = '0';
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 2;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'discard',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : result?.events ?? [];
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(eventsOfType(events as DiceThroneEvent[], 'STATUS_REMOVED')[0]?.payload).toMatchObject({
            targetId: '0',
            statusId: STATUS_IDS.CURSED_COIN,
            stacks: 1,
        });
        expect(eventsOfType(events as DiceThroneEvent[], 'PLAYER_BOARD_FACE_CHANGED')).toHaveLength(0);
        expect(next.players['0'].playerBoardFace).toBe('normal');
        expect(next.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
        expect(next.players['0'].abilities.some(ability => ability.id === 'human-cursed')).toBe(true);
        expect(next.players['0'].abilities.some(ability => ability.id === 'soul-stab')).toBe(false);
    });

    it('human 面咒缚移除最后 1 个诅咒金币后不会在同回合结束立即翻回咒缚面', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.sys.phase = 'discard';
        state.core.activePlayerId = '0';
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 1;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'discard',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : result?.events ?? [];
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(eventsOfType(events as DiceThroneEvent[], 'STATUS_REMOVED')[0]?.payload).toMatchObject({
            targetId: '0',
            statusId: STATUS_IDS.CURSED_COIN,
            stacks: 1,
        });
        expect(eventsOfType(events as DiceThroneEvent[], 'PLAYER_BOARD_FACE_CHANGED')).toHaveLength(0);
        expect(next.players['0'].playerBoardFace).toBe('normal');
        expect(next.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] ?? 0).toBe(0);
        expect(next.players['0'].abilities.some(ability => ability.id === 'human-cursed')).toBe(true);
        expect(next.players['0'].abilities.some(ability => ability.id === 'soul-stab')).toBe(false);
    });

    it('human 面咒缚在没有诅咒金币时会于回合结束翻回咒缚面并切换能力集', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.sys.phase = 'discard';
        state.core.activePlayerId = '0';
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'discard',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : result?.events ?? [];
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(eventsOfType(events as DiceThroneEvent[], 'PLAYER_BOARD_FACE_CHANGED')[0]?.payload).toMatchObject({
            playerId: '0',
            face: 'cursed',
            sourceAbilityId: 'human-cursed',
        });
        expect(next.players['0'].playerBoardFace).toBe('cursed');
        expect(next.players['0'].abilities.some(ability => ability.id === 'soul-stab')).toBe(true);
        expect(next.players['0'].abilities.some(ability => ability.id === 'human-cursed')).toBe(false);
    });

    it('human 面弯刀突刺在 4 个相同数字时施加火药桶', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        setCursedPirateDiceValues(state, [1, 1, 1, 1, 4]);

        const { events, state: nextState } = resolveAbilityEffectsWithSystem(
            state,
            getAbilityVariantEffects(state.core, '0', 'cutlass-stab', 'cutlass-stab-4'),
            'postDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'cutlass-stab', damageDealt: 6 },
        );
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(eventsOfType(events as DiceThroneEvent[], 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.POWDER_KEG,
        });
        expect(next.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
        expect(nextState.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('human 面弯刀突刺在 4 个相同数字但未造成伤害时不施加火药桶', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        setCursedPirateDiceValues(state, [1, 1, 1, 1, 4]);

        const { events, state: nextState } = resolveAbilityEffectsWithSystem(
            state,
            getAbilityVariantEffects(state.core, '0', 'cutlass-stab', 'cutlass-stab-4'),
            'postDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'cutlass-stab', damageDealt: 0 },
        );
        const next = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(eventsOfType(events as DiceThroneEvent[], 'STATUS_APPLIED')).toHaveLength(0);
        expect(next.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBeUndefined();
        expect(nextState.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBeUndefined();
    });

    it('human 面做好标记会结算 CP、奖励骰伤害、抽牌和诅咒金币选择', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;

        const cpBefore = state.core.players['0'].resources[RESOURCE_IDS.CP] ?? 0;
        const hpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const handBefore = state.core.players['0'].hand.length;

        const result = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'make-your-mark'),
            'preDefense',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'make-your-mark' },
            createQueuedRandom([1, 4, 6]),
        );
        const settledResult = settleBonusDiceThroughPipeline(result.state, '0');
        const settledState = settledResult.state;

        expect(settledState.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(cpBefore + 1);
        expect(settledState.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 2);
        expect(settledState.core.players['0'].hand.length).toBe(handBefore + 1);

        const prompt = getSimpleChoicePrompt(settledState, 'make-your-mark');
        const accept = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId === STATUS_IDS.CURSED_COIN);
        expect(accept).toBeDefined();

        const accepted = respondToPrompt(settledState, accept!.id, '0');
        expect(accepted.success).toBe(true);
        expect(accepted.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
    });

    it('human 面走跳板可让对手自选弃掉 1 张牌', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['1'].hand = [getCardById('card-flick')];

        const result = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'walk-the-plank'),
            'preDefense',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'walk-the-plank' },
        );

        const choicePrompt = getSimpleChoicePrompt(result.state, 'walk-the-plank');
        const discardChoice = choicePrompt.options[1];
        const choiceResolved = respondToPrompt(result.state, discardChoice.id, '0');
        expect(choiceResolved.success).toBe(true);

        const discardPrompt = getCardInteractionPrompt(choiceResolved.state, 'walk-the-plank');
        expect(discardPrompt.type).toBe('selectHandCard');
        expect(discardPrompt.playerId).toBe('1');

        const discardEvents = execute(choiceResolved.state, command('RESOLVE_INTERACTION', '1', {
            selectedCardIds: ['card-flick'],
        }), fixedRandom);
        const afterDiscard = applyEvents(choiceResolved.state.core, discardEvents);
        expect(afterDiscard.players['1'].hand).toHaveLength(0);
        expect(afterDiscard.players['1'].discard.map(card => card.id)).toContain('card-flick');
    });

    it('human 面点燃炸药会按大小顺子施加火药桶并造成对应伤害', () => {
        const smallState = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        smallState.core = applyEvents(smallState.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);

        const smallHpBefore = smallState.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const smallResult = resolveAbilityEffectsWithSystem(
            smallState,
            getAbilityVariantEffects(smallState.core, '0', 'light-the-fuse', 'light-the-fuse-small'),
            'preDefense',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'light-the-fuse' },
        );
        const smallFollowUp = resolveAbilityEffectsWithSystem(
            smallResult.state,
            getAbilityVariantEffects(smallResult.state.core, '0', 'light-the-fuse', 'light-the-fuse-small'),
            'postDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'light-the-fuse', damageDealt: 7 },
        );

        expect(smallResult.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(smallHpBefore - 7);
        expect(smallFollowUp.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);

        const largeState = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        largeState.core = applyEvents(largeState.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);

        const largeHpBefore = largeState.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const largeResult = resolveAbilityEffectsWithSystem(
            largeState,
            getAbilityVariantEffects(largeState.core, '0', 'light-the-fuse', 'light-the-fuse-large'),
            'preDefense',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'light-the-fuse' },
        );
        const largeFollowUp = resolveAbilityEffectsWithSystem(
            largeResult.state,
            getAbilityVariantEffects(largeResult.state.core, '0', 'light-the-fuse', 'light-the-fuse-large'),
            'postDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'light-the-fuse', damageDealt: 9 },
        );

        expect(largeResult.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(largeHpBefore - 9);
        expect(largeFollowUp.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('human 面点燃炸药在未造成伤害时不施加火药桶', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.PARLEY] = 1;

        const hpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const result = resolveAbilityEffectsWithSystem(
            state,
            getAbilityVariantEffects(state.core, '0', 'light-the-fuse', 'light-the-fuse-small'),
            'preDefense',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'light-the-fuse' },
        );
        const followUp = resolveAbilityEffectsWithSystem(
            result.state,
            getAbilityVariantEffects(result.state.core, '0', 'light-the-fuse', 'light-the-fuse-small'),
            'postDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'light-the-fuse', damageDealt: 0 },
        );

        expect(result.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore);
        expect(followUp.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
    });

    it('human 面判决指令会获得诅咒金币、施加休战并造成不可防御伤害', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;

        const hpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const result = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'verdict-command'),
            'preDefense',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'verdict-command' },
        );

        expect(eventsOfType(result.events, 'CHOICE_REQUESTED')).toHaveLength(1);
        expect(result.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY] ?? 0).toBe(0);

        const prompt = getSimpleChoicePrompt(result.state, 'verdict-command');
        const accept = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId === STATUS_IDS.CURSED_COIN);
        expect(accept).toBeDefined();

        const accepted = respondToPrompt(result.state, accept!.id, '0');
        expect(accepted.success).toBe(true);
        expect(accepted.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
        expect(accepted.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 7);
        expect(accepted.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
    });

    it('human 面判决指令拒绝获得诅咒金币时仍会继续施加休战并造成不可防御伤害', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;

        const hpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const result = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'verdict-command'),
            'preDefense',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'verdict-command' },
        );

        const prompt = getSimpleChoicePrompt(result.state, 'verdict-command');
        const decline = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId !== STATUS_IDS.CURSED_COIN);
        expect(decline).toBeDefined();

        const declined = respondToPrompt(result.state, decline!.id, '0');
        expect(declined.success).toBe(true);
        expect(declined.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] ?? 0).toBe(0);
        expect(declined.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 7);
        expect(declined.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
    });

    it('human 面判决指令在真实进攻 pipeline 中会于 ADVANCE_PHASE 后进入诅咒金币 simple-choice', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'normal');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;
        setCursedPirateDiceValues(state, [1, 6, 6, 6, 6]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'verdict-command' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'verdict-command',
            isDefendable: true,
        });
        expect(getCurrentInteractionId(selected.state)).toBeUndefined();

        const hpBefore = selected.state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(advanced.success).toBe(true);
        expect(advanced.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore);
        expect(advanced.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY] ?? 0).toBe(0);
        expect(advanced.state.sys.phase).toBe('offensiveRoll');
        expect(advanced.state.core.currentChoiceSourceAbilityId).toBe('verdict-command');
        expect(advanced.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'verdict-command',
            isDefendable: true,
        });
        expect(advanced.state.core.pendingAttack?.preDefenseResolved).toBe(true);

        const prompt = getSimpleChoicePrompt(advanced.state, 'verdict-command');
        expect(prompt.playerId).toBe('0');
        expect(prompt.options).toHaveLength(2);
        expect(prompt.options.map(option => option.label)).toEqual([
            'choices.cursedCoinGain.accept',
            'choices.cursedCoinGain.decline',
        ]);

        const accept = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId === STATUS_IDS.CURSED_COIN);
        expect(accept).toBeDefined();

        const resolved = respondToPrompt(advanced.state, accept!.id, '0');
        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === 'ATTACK_MADE_UNDEFENDABLE')).toBe(true);
        expect(resolved.state.sys.phase).toBe('main2');
        expect(resolved.state.core.pendingAttack).toBeNull();
        expect(resolved.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
        expect(resolved.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 7);
    });

    it('诅咒面无情诅咒选择火药桶后仍会继续结算 13 点主伤害', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        setCursedPirateDiceValues(state, [6, 6, 6, 6, 6]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'merciless-curse' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'merciless-curse',
            isDefendable: false,
        });
        expect(getCurrentInteractionId(selected.state)).toBeUndefined();

        const hpBefore = selected.state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(advanced.success).toBe(true);
        expect(advanced.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore);
        expect(advanced.state.core.currentChoiceSourceAbilityId).toBe('merciless-curse');

        const prompt = getSimpleChoicePrompt(advanced.state, 'merciless-curse');
        const applyToDefender = prompt.options.find(option => (
            option.value as { value?: number }
        ).value === 1);
        expect(applyToDefender).toBeDefined();

        const resolved = respondToPrompt(advanced.state, applyToDefender!.id, '0');
        expect(resolved.success).toBe(true);
        expect(resolved.state.sys.phase).toBe('main2');
        expect(resolved.state.core.pendingAttack).toBeNull();
        expect(resolved.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
        expect(resolved.state.core.players['1'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
        expect(resolved.state.core.players['1'].statusEffects[STATUS_IDS.WITHER]).toBe(1);
        expect(resolved.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 13);
    });

    it('诅咒面死亡吐息对已有火药桶目标会先爆桶再继续结算 7 点主攻击伤害', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] = 1;
        setCursedPirateDiceValues(state, [1, 2, 3, 4, 5]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'breath-of-death-small' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'breath-of-death-small',
            isDefendable: true,
        });

        const hpBefore = selected.state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const enteredDefense = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );

        expect(enteredDefense.success).toBe(true);
        expect(enteredDefense.state.sys.phase).toBe('defensiveRoll');
        expect(eventsOfType(enteredDefense.events as DiceThroneEvent[], 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 3,
            damageScope: 'direct',
        });
        expect(enteredDefense.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 3);
        expect(enteredDefense.state.core.players['1'].statusEffects[STATUS_IDS.WITHER]).toBe(1);
        expect(enteredDefense.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
        expect(enteredDefense.state.core.pendingAttack?.resolvedDamage ?? 0).toBe(0);
        expect(enteredDefense.state.core.pendingAttack?.settlementStage).toBe('preDamage');

        const defenseRolled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            enteredDefense.state,
            command('ROLL_DICE', '1'),
            createQueuedRandom([1, 1, 1, 1, 1]),
            ['0', '1'],
        );
        expect(defenseRolled.success).toBe(true);

        const defenseConfirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            defenseRolled.state,
            command('CONFIRM_ROLL', '1'),
            fixedRandom,
            ['0', '1'],
        );
        expect(defenseConfirmed.success).toBe(true);

        const resolved = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            defenseConfirmed.state,
            command('ADVANCE_PHASE', '1'),
            fixedRandom,
            ['0', '1'],
        );
        expect(resolved.success).toBe(true);
        expect(resolved.state.sys.phase).toBe('main2');
        expect(resolved.state.core.pendingAttack).toBeNull();
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 10);
        expect(eventsOfType(resolved.events as DiceThroneEvent[], 'DAMAGE_DEALT')
            .some(event => event.payload.sourceAbilityId === 'breath-of-death-small'
                && event.payload.damageScope === 'attack'
                && event.payload.amount === 7)).toBe(true);
    });

    it('诅咒面灵魂指令对已有火药桶目标会先爆桶再继续结算 8 点主攻击伤害', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'cursed');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] = 1;
        setCursedPirateDiceValues(state, [6, 6, 6, 6, 1]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'soul-command' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'soul-command',
            isDefendable: false,
        });

        const hpBefore = selected.state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );

        expect(advanced.success).toBe(true);
        expect(eventsOfType(advanced.events as DiceThroneEvent[], 'DAMAGE_DEALT')
            .map(event => ({
                amount: event.payload.amount,
                damageScope: event.payload.damageScope,
                sourceAbilityId: event.payload.sourceAbilityId,
            }))).toEqual([
            { amount: 3, damageScope: 'direct', sourceAbilityId: 'soul-command' },
            { amount: 8, damageScope: 'attack', sourceAbilityId: 'soul-command' },
        ]);
        expect(advanced.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 11);
        expect(advanced.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
        expect(advanced.state.core.players['1'].statusEffects[STATUS_IDS.WITHER]).toBe(1);
        expect(advanced.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
        expect(advanced.state.core.pendingAttack).toBeNull();
        expect(advanced.state.sys.phase).toBe('main2');
    });

    it('human 面判决指令在镜像 E2E 注入态下仍会于 ADVANCE_PHASE 后进入诅咒金币 simple-choice', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.sys.currentPlayerIndex = 1;
        state.sys.interaction = { current: undefined, queue: [] } as typeof state.sys.interaction;
        state.sys.responseWindow = { current: undefined } as typeof state.sys.responseWindow;
        state.core.activePlayerId = '1';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.selectedAbilityId = undefined;
        state.core.activatingAbilityId = undefined;
        state.core.pendingAttack = undefined as unknown as typeof state.core.pendingAttack;
        state.core.pendingBonusDiceSettlement = undefined;
        state.core.pendingDamage = undefined;
        state.core.extraAttackInProgress = undefined;
        state.core.players['0'].hand = [];
        state.core.players['0'].discard = [];
        state.core.players['0'].tokens = {};
        state.core.players['0'].statusEffects = {};
        state.core.players['0'].damageShields = [];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 50;
        state.core.players['1'].hand = [];
        state.core.players['1'].discard = [];
        state.core.players['1'].playerBoardFace = 'normal';
        state.core.players['1'].abilities = structuredClone(getCharacterAbilitiesForFace('cursed_pirate', 'normal'));
        state.core.players['1'].tokens = {};
        state.core.players['1'].statusEffects = {};
        state.core.players['1'].damageShields = [];
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        setCursedPirateDiceValues(state, [1, 6, 6, 6, 6]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '1', { abilityId: 'verdict-command' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'verdict-command',
            isDefendable: true,
        });
        expect(selected.state.core.players['1'].playerBoardFace).toBe('normal');
        expect(selected.state.core.players['1'].abilities.some((ability) => ability.id === 'verdict-command')).toBe(true);
        expect(selected.state.core.pendingAttack?.preDefenseResolved).toBeUndefined();

        const hpBefore = selected.state.core.players['0'].resources[RESOURCE_IDS.HP] ?? 0;
        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '1'),
            fixedRandom,
            ['0', '1'],
        );
        expect(advanced.success).toBe(true);
        expect(advanced.state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(hpBefore);
        expect(advanced.state.core.players['0'].statusEffects[STATUS_IDS.PARLEY] ?? 0).toBe(0);
        expect(advanced.state.core.currentChoiceSourceAbilityId).toBe('verdict-command');

        const prompt = getSimpleChoicePrompt(advanced.state, 'verdict-command');
        expect(prompt.playerId).toBe('1');
        expect(prompt.options).toHaveLength(2);
        expect(prompt.options.map(option => option.label)).toEqual([
            'choices.cursedCoinGain.accept',
            'choices.cursedCoinGain.decline',
        ]);
    });

    it('human 面判决指令在多人局选择诅咒金币后仍应命中原防守方', () => {
        const state = createFourPlayerCursedPirateState();
        setPlayerBoardFace(state, '0', 'normal');
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '3',
            sourceAbilityId: 'verdict-command',
            isDefendable: true,
            preDefenseResolved: true,
        } as DiceThroneCore['pendingAttack'];

        const hpBeforeP2 = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const hpBeforeP4 = state.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0;
        const result = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'verdict-command'),
            'preDefense',
            { attackerId: '0', defenderId: '3', sourceAbilityId: 'verdict-command' },
        );

        const prompt = getSimpleChoicePrompt(result.state, 'verdict-command');
        const accept = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId === STATUS_IDS.CURSED_COIN);
        expect(accept).toBeDefined();

        const accepted = respondToPrompt(result.state, accept!.id, '0');
        expect(accepted.success).toBe(true);
        expect(accepted.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
        expect(accepted.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBeforeP2 - 7);
        expect(accepted.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY] ?? 0).toBe(0);
        expect(accepted.state.core.players['3'].resources[RESOURCE_IDS.HP]).toBe(hpBeforeP4 - 7);
        expect(accepted.state.core.players['3'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
    });

    it('human 面做好标记在多人局会先进入索敌阶段，不会在索敌前先打到自己', () => {
        const state = createFourPlayerCursedPirateState();
        setPlayerBoardFace(state, '0', 'normal');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.dice = createCharacterDice('cursed_pirate');
        setCursedPirateDiceValues(state, [4, 4, 4, 1, 2]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'make-your-mark' }),
            fixedRandom,
            ['0', '1', '2', '3'],
        );
        expect(selected.success).toBe(true);
        const selfHpBefore = selected.state.core.players['0'].resources[RESOURCE_IDS.HP] ?? 0;

        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1', '2', '3'],
        );
        expect(advanced.success).toBe(true);
        expect(advanced.state.sys.phase).toBe('targetingRoll');
        expect(advanced.state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(selfHpBefore);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            sourceAbilityId: 'make-your-mark',
            defenderId: undefined,
        });
    });

    it('human 面惊魂动魄可移除任意数量的诅咒金币', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 3;

        const result = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'astonishing'),
            'postDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'astonishing', damageDealt: 7 },
        );

        const prompt = getSimpleChoicePrompt(result.state, 'astonishing');
        expect(prompt.options).toHaveLength(4);
        const removeTwo = prompt.options[2];
        expect(removeTwo).toBeDefined();

        const afterRemove = respondToPrompt(result.state, removeTwo!.id, '0');
        expect(afterRemove.success).toBe(true);
        expect(afterRemove.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
    });

    it('human 面惊魂动魄在真实进攻 pipeline 中会于移除诅咒金币选择后收口攻击链', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'normal');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 3;
        setCursedPirateDiceValues(state, [1, 4, 6, 6, 6]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'astonishing' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'astonishing',
            isDefendable: false,
        });
        expect(getCurrentInteractionId(selected.state)).toBeUndefined();

        const hpBefore = selected.state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(advanced.success).toBe(true);
        expect(advanced.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 7);
        expect(advanced.state.core.currentChoiceSourceAbilityId).toBe('astonishing');

        const prompt = getSimpleChoicePrompt(advanced.state, 'astonishing');
        expect(prompt.playerId).toBe('0');
        expect(prompt.options).toHaveLength(4);
        expect(prompt.options.map(option => option.label)).toEqual([
            'choices.cursedPirateHumanRemoveCoins.keep',
            'choices.cursedPirateHumanRemoveCoins.remove',
            'choices.cursedPirateHumanRemoveCoins.remove',
            'choices.cursedPirateHumanRemoveCoins.remove',
        ]);

        const removeTwo = prompt.options[2];
        expect(removeTwo).toBeDefined();

        const resolved = respondToPrompt(advanced.state, removeTwo!.id, '0');
        expect(resolved.success).toBe(true);
        expect(resolved.state.sys.phase).toBe('main2');
        expect(resolved.state.core.pendingAttack).toBeNull();
        expect(resolved.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 7);
    });

    it.each([
        {
            name: '目标骰 1/2 自动锁左敌时',
            targetingRoll: 2,
            chooserPlayerId: undefined,
            chosenDefenderId: '3',
            expectedDamagedSeat: '3',
        },
        {
            name: '目标骰 3/4 自动锁右敌时',
            targetingRoll: 4,
            chooserPlayerId: undefined,
            chosenDefenderId: '1',
            expectedDamagedSeat: '1',
        },
        {
            name: '目标骰 5 由防守队选右敌时',
            targetingRoll: 5,
            chooserPlayerId: '3',
            chosenDefenderId: '1',
            expectedDamagedSeat: '1',
        },
        {
            name: '目标骰 6 由进攻方选左敌时',
            targetingRoll: 6,
            chooserPlayerId: '0',
            chosenDefenderId: '3',
            expectedDamagedSeat: '3',
        },
    ])('human 面惊魂动魄在多人局 $name 只会结算 1 次 7 点攻击伤害', ({
        targetingRoll,
        chooserPlayerId,
        chosenDefenderId,
        expectedDamagedSeat,
    }) => {
        const playerIds: PlayerId[] = ['0', '1', '2', '3'];
        const state = setupFourPlayerHumanAstonishingState();

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'astonishing' }),
            fixedRandom,
            playerIds,
        );
        expect(selected.success).toBe(true);

        const enteredTargeting = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            playerIds,
        );
        expect(enteredTargeting.success).toBe(true);
        expect(enteredTargeting.state.sys.phase).toBe('targetingRoll');

        const targetingRandom = createQueuedRandom([targetingRoll]);
        const rolled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            enteredTargeting.state,
            command('ROLL_DICE', '0'),
            targetingRandom,
            playerIds,
        );
        expect(rolled.success).toBe(true);

        const confirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            rolled.state,
            command('CONFIRM_ROLL', '0'),
            targetingRandom,
            playerIds,
        );
        expect(confirmed.success).toBe(true);

        const postRollResponse = passCurrentResponseWindow(confirmed.state, targetingRandom, playerIds);

        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            postRollResponse.state,
            command('ADVANCE_PHASE', '0'),
            targetingRandom,
            playerIds,
        );
        expect(advanced.success).toBe(true);

        let postTargeting = advanced;
        if (chooserPlayerId) {
            const defenderPrompt = getDefenderChoicePrompt(advanced.state, 'astonishing');
            expect(defenderPrompt.playerId).toBe(chooserPlayerId);
            expect(defenderPrompt.options.some(option => option.playerId === chosenDefenderId)).toBe(true);
            postTargeting = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                advanced.state,
                command('SELECT_DEFENDER_TARGET', chooserPlayerId, { defenderId: chosenDefenderId }),
                fixedRandom,
                playerIds,
            );
            expect(postTargeting.success).toBe(true);
        } else {
            expect(advanced.state.core.pendingAttack?.defenderId).toBe(chosenDefenderId);
        }

        const damageEvents = eventsOfType(postTargeting.events, 'DAMAGE_DEALT');
        expect(damageEvents).toHaveLength(1);
        expect(damageEvents[0]?.payload).toMatchObject({
            targetId: expectedDamagedSeat,
            amount: 7,
            actualDamage: 7,
            sourceAbilityId: 'astonishing',
        });

        expect(postTargeting.state.core.teamHealth).toEqual({ A: 50, B: 43 });
        expect(postTargeting.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(43);
        expect(postTargeting.state.core.players['3'].resources[RESOURCE_IDS.HP]).toBe(43);
        expect(postTargeting.state.core.currentChoiceSourceAbilityId).toBe('astonishing');

        const prompt = getSimpleChoicePrompt(postTargeting.state, 'astonishing');
        const removeTwo = prompt.options[2];
        expect(removeTwo).toBeDefined();

        const resolved = respondToPrompt(postTargeting.state, removeTwo!.id, '0', fixedRandom, playerIds);
        expect(resolved.success).toBe(true);
        expect(eventsOfType(resolved.events, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(resolved.state.sys.phase).toBe('main2');
        expect(resolved.state.core.pendingAttack).toBeNull();
        expect(resolved.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
        expect(resolved.state.core.teamHealth).toEqual({ A: 50, B: 43 });
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(43);
        expect(resolved.state.core.players['3'].resources[RESOURCE_IDS.HP]).toBe(43);
    });

    it('human 面无情劫掠会造成伤害、自得 2 个诅咒金币并施加休战和火药桶', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;

        const hpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const damageResult = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'merciless-plunder'),
            'withDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'merciless-plunder' },
        );

        expect(damageResult.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 12);

        const result = resolveAbilityEffectsWithSystem(
            damageResult.state,
            getAbilityEffects(damageResult.state.core, '0', 'merciless-plunder'),
            'postDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'merciless-plunder', damageDealt: 12 },
        );

        expect(eventsOfType(result.events, 'CHOICE_REQUESTED')).toHaveLength(1);
        expect(result.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 12);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY] ?? 0).toBe(0);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);

        const prompt = getSimpleChoicePrompt(result.state, 'merciless-plunder');
        const accept = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId === STATUS_IDS.CURSED_COIN);
        expect(accept).toBeDefined();

        const accepted = respondToPrompt(result.state, accept!.id, '0');
        expect(accepted.success).toBe(true);
        expect(accepted.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(2);
        expect(accepted.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
        expect(accepted.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('human 面无情劫掠拒绝获得诅咒金币时仍会继续施加休战和火药桶', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;

        const hpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const damageResult = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'merciless-plunder'),
            'withDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'merciless-plunder' },
        );

        const result = resolveAbilityEffectsWithSystem(
            damageResult.state,
            getAbilityEffects(damageResult.state.core, '0', 'merciless-plunder'),
            'postDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'merciless-plunder', damageDealt: 12 },
        );

        const prompt = getSimpleChoicePrompt(result.state, 'merciless-plunder');
        const decline = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId !== STATUS_IDS.CURSED_COIN);
        expect(decline).toBeDefined();

        const declined = respondToPrompt(result.state, decline!.id, '0');
        expect(declined.success).toBe(true);
        expect(declined.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] ?? 0).toBe(0);
        expect(declined.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 12);
        expect(declined.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
        expect(declined.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('human 面无情劫掠在未造成伤害时不继续施加休战和火药桶', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.PARLEY] = 1;
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;

        const hpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const damageResult = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'merciless-plunder'),
            'withDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'merciless-plunder' },
        );

        expect(damageResult.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore);

        const result = resolveAbilityEffectsWithSystem(
            damageResult.state,
            getAbilityEffects(damageResult.state.core, '0', 'merciless-plunder'),
            'postDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'merciless-plunder', damageDealt: 0 },
        );

        expect(eventsOfType(result.events, 'CHOICE_REQUESTED')).toHaveLength(0);
        expect(result.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] ?? 0).toBe(0);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY] ?? 0).toBe(0);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
    });

    it('human 面无情劫掠在真实进攻 pipeline 中会于诅咒金币选择后收口攻击链', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'normal');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;
        setCursedPirateDiceValues(state, [6, 6, 6, 6, 6]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'merciless-plunder' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'merciless-plunder',
            isDefendable: false,
        });
        expect(getCurrentInteractionId(selected.state)).toBeUndefined();

        const hpBefore = selected.state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(advanced.success).toBe(true);
        expect(advanced.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 12);
        expect(advanced.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY] ?? 0).toBe(0);
        expect(advanced.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
        expect(advanced.state.core.currentChoiceSourceAbilityId).toBe('merciless-plunder');

        const prompt = getSimpleChoicePrompt(advanced.state, 'merciless-plunder');
        expect(prompt.playerId).toBe('0');
        expect(prompt.options).toHaveLength(2);

        const accept = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId === STATUS_IDS.CURSED_COIN);
        expect(accept).toBeDefined();

        const resolved = respondToPrompt(advanced.state, accept!.id, '0');
        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === 'ATTACK_MADE_UNDEFENDABLE')).toBe(true);
        expect(resolved.state.sys.phase).toBe('main2');
        expect(resolved.state.core.pendingAttack).toBeNull();
        expect(resolved.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(2);
        expect(resolved.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
        expect(resolved.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 12);
    });

    it('human 面无情劫掠在多人局选择诅咒金币后仍应把休战和火药桶施加给原防守方', () => {
        const state = createFourPlayerCursedPirateState();
        setPlayerBoardFace(state, '0', 'normal');
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '3',
            sourceAbilityId: 'merciless-plunder',
            isDefendable: false,
        } as DiceThroneCore['pendingAttack'];

        const result = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'merciless-plunder'),
            'postDamage',
            { attackerId: '0', defenderId: '3', sourceAbilityId: 'merciless-plunder', damageDealt: 12 },
        );

        const prompt = getSimpleChoicePrompt(result.state, 'merciless-plunder');
        const accept = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId === STATUS_IDS.CURSED_COIN);
        expect(accept).toBeDefined();

        const accepted = respondToPrompt(result.state, accept!.id, '0');
        expect(accepted.success).toBe(true);
        expect(accepted.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(2);
        expect(accepted.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY] ?? 0).toBe(0);
        expect(accepted.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(0);
        expect(accepted.state.core.players['3'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
        expect(accepted.state.core.players['3'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('human 面无情劫掠对已有炸药桶的目标不应当场引爆炸药桶', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        setPlayerBoardFace(state, '0', 'normal');
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;
        state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG] = 1;
        setCursedPirateDiceValues(state, [6, 6, 6, 6, 6]);

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'merciless-plunder' }),
            fixedRandom,
            ['0', '1'],
        );
        expect(selected.success).toBe(true);

        const hpBefore = selected.state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            ['0', '1'],
        );
        expect(advanced.success).toBe(true);
        expect(advanced.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 12);

        const prompt = getSimpleChoicePrompt(advanced.state, 'merciless-plunder');
        const accept = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId === STATUS_IDS.CURSED_COIN);
        expect(accept).toBeDefined();
        expect(accept!.value).toMatchObject({
            statusGrantConfigs: [
                { statusId: STATUS_IDS.CURSED_COIN, amount: 2, targetPlayerId: '0' },
                { statusId: STATUS_IDS.PARLEY, amount: 1, targetPlayerId: '1' },
                { statusId: STATUS_IDS.POWDER_KEG, amount: 1, targetPlayerId: '1' },
            ],
        });
        const decline = prompt.options.find(option => (
            option.value as { statusId?: string }
        ).statusId !== STATUS_IDS.CURSED_COIN);
        expect(decline!.value).toMatchObject({
            statusGrantConfigs: [
                { statusId: STATUS_IDS.PARLEY, amount: 1, targetPlayerId: '1' },
                { statusId: STATUS_IDS.POWDER_KEG, amount: 1, targetPlayerId: '1' },
            ],
        });

        const resolved = respondToPrompt(advanced.state, accept!.id, '0');
        expect(resolved.success).toBe(true);
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 12);
        expect(resolved.state.core.players['1'].statusEffects[STATUS_IDS.PARLEY]).toBe(1);
        expect(resolved.state.core.players['1'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
    });

    it('human 面嘿，老兄会结算反击、CP、防伤与诅咒金币选择', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;
        state.core.rollDiceCount = 4;
        setCursedPirateDiceValues(state, [1, 1, 4, 6]);

        const cpBefore = state.core.players['0'].resources[RESOURCE_IDS.CP] ?? 0;

        const result = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'human-still-wet-behind-ears'),
            'withDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'human-still-wet-behind-ears' },
        );

        expect(result.state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(cpBefore + 1);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({ targetId: '1', amount: 2 }),
            }),
            expect.objectContaining({
                type: 'PREVENT_DAMAGE',
                payload: expect.objectContaining({ targetId: '0', amount: 2 }),
            }),
        ]));

        const prompt = getSimpleChoicePrompt(result.state, 'human-still-wet-behind-ears');
        const accept = prompt.options.find(option => (
            option.value as { statusId?: string; value?: number }
        ).statusId === STATUS_IDS.CURSED_COIN);
        expect(accept).toBeDefined();

        const accepted = respondToPrompt(result.state, accept!.id, '0');
        expect(accepted.success).toBe(true);
        expect(accepted.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN]).toBe(1);
    });

    it('human 面防御技能获得诅咒金币时可以选择不获得', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
        state.core = applyEvents(state.core, [{
            type: 'PLAYER_BOARD_FACE_CHANGED',
            payload: { playerId: '0', face: 'normal', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST',
            timestamp: 90,
        } as DiceThroneEvent]);
        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 0;
        state.core.rollDiceCount = 4;
        setCursedPirateDiceValues(state, [1, 1, 4, 6]);
        const cpBefore = state.core.players['0'].resources[RESOURCE_IDS.CP] ?? 0;

        const result = resolveAbilityEffectsWithSystem(
            state,
            getAbilityEffects(state.core, '0', 'human-still-wet-behind-ears'),
            'withDamage',
            { attackerId: '0', defenderId: '1', sourceAbilityId: 'human-still-wet-behind-ears' },
        );

        const prompt = getSimpleChoicePrompt(result.state, 'human-still-wet-behind-ears');
        const decline = prompt.options.find(option => (
            (option.value as { statusId?: string }).statusId !== STATUS_IDS.CURSED_COIN
        ));
        expect(decline).toBeDefined();

        const declined = respondToPrompt(result.state, decline!.id, '0');
        expect(declined.success).toBe(true);
        expect(declined.state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] ?? 0).toBe(0);
        expect(declined.state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(cpBefore + 1);
        expect(declined.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 2);
    });
});
