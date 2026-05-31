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
import { RESOURCE_IDS } from '../domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import type { CharacterId, DiceThroneCommand, DiceThroneCore, DiceThroneEvent, TurnPhase } from '../domain/types';
import { initHeroState } from '../domain/characters';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, PlayerId } from '../../../engine/types';
import {
    cmd,
    createHeroMatchup,
    createNoResponseSetupWithEmptyHand,
    getCardById,
    createQueuedRandom,
    createRunner,
    fixedRandom,
    getCardInteractionPrompt,
    getSimpleChoicePrompt,
    respondToPrompt,
    testSystems,
} from './test-utils';
import { INITIAL_HEALTH } from '../domain/types';

initializeCustomActions();

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

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
    const reducedCore = applyEvents(state.core, phaseEvents);
    const system = createDiceThroneEventSystem();
    const afterEvents = system.afterEvents?.({
        state: { ...state, core: reducedCore },
        events: phaseEvents,
        random: fixedRandom,
    } as any);
    if (!afterEvents || Array.isArray(afterEvents) || !('state' in afterEvents)) {
        throw new Error('火药桶未创建转交选择交互');
    }
    return {
        events: phaseEvents,
        state: afterEvents.state as MatchState<DiceThroneCore>,
    };
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

    it('咒缚海盗咒缚被动在自己维持阶段受到 4 点不可防止伤害', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
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

    it('咒缚不会在对手已发起攻击的进攻投掷阶段重复施加火药桶', () => {
        const state = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
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
        const next = applyEvents(state.core, events);
        const roll = eventsOfType(events, 'BONUS_DIE_ROLLED')[0];
        const damage = eventsOfType(events, 'DAMAGE_DEALT')
            .find(event => event.payload.sourceAbilityId === 'upkeep-powder-keg');

        expect(roll?.payload.value).toBe(1);
        expect(eventsOfType(events, 'STATUS_REMOVED')[0]?.payload.statusId).toBe(STATUS_IDS.POWDER_KEG);
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
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')[0]?.payload.value).toBe(3);
        expect(eventsOfType(events, 'STATUS_REMOVED')).toHaveLength(0);
        expect(eventsOfType(events, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(next.players['0'].statusEffects[STATUS_IDS.POWDER_KEG]).toBe(1);
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

        const protect = createHeroMatchup('zhanshujia', 'cursed_pirate')(['0', '1'], fixedRandom);
        protect.sys.phase = 'main1';
        protect.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 4;
        events = execute(protect, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'zhanshujia-tactical-advantage',
            actionIndex: 4,
        }), fixedRandom);
        next = applyEvents(protect.core, events);
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.PROTECT]).toBe(1);

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
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(1);
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
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(2);
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

    it('战术家升级后的战争贩子 II 在勋章分支抽牌并触发额外进攻投掷阶段', () => {
        const { state } = playZhanshujiaUpgrade('upgrade-zhanshujia-war-monger-2');
        const handBefore = state.core.players['0'].hand.length;
        const events = resolveEffectsToEvents(
            getAbilityEffects(state.core, '0', 'war-monger'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'war-monger',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: createQueuedRandom([6]) },
        );
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(2);
        expect(next.players['0'].hand.length).toBe(handBefore + 1);
        expect(eventsOfType(events, 'EXTRA_ATTACK_TRIGGERED')[0]?.payload).toMatchObject({
            attackerId: '0',
            targetId: '1',
            sourceStatusId: 'war-monger',
        });
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

        expect(promptState.core.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(2);
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
        const afterSabre = applyEvents(sabreState.core, sabreEvents);
        expect(eventsOfType(sabreEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 2,
            sourceAbilityId: 'card-zhanshujia-disengage',
        });
        expect(afterSabre.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 2);

        const bannerState = createZhanshujiaDefenseCardPlayState('card-zhanshujia-disengage');
        const bannerEvents = execute(bannerState, command('PLAY_CARD', '0', {
            cardId: 'card-zhanshujia-disengage',
        }), createQueuedRandom([4]));
        expect(eventsOfType(bannerEvents, 'DAMAGE_SHIELD_GRANTED')[0]?.payload).toMatchObject({
            targetId: '0',
            value: 3,
            sourceId: 'card-zhanshujia-disengage',
        });

        const medalState = createZhanshujiaDefenseCardPlayState('card-zhanshujia-disengage');
        const medalEvents = execute(medalState, command('PLAY_CARD', '0', {
            cardId: 'card-zhanshujia-disengage',
        }), createQueuedRandom([6]));
        const afterMedal = applyEvents(medalState.core, medalEvents);
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
    });

    it('战术家作战室按骰值一半向上取整获得战术优势', () => {
        const state = createZhanshujiaCardPlayState('card-zhanshujia-war-room');
        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-zhanshujia-war-room',
        }), createQueuedRandom([5]));
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 5,
            face: 'banner',
            effectKey: 'bonusDie.effect.zhanshujiaWarRoom',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE]).toBe(3);
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
            { random: createQueuedRandom([1, 1, 4, 6]) },
        );
        const cutlassDamageEvents = eventsOfType(markedCutlassEvents, 'DAMAGE_DEALT')
            .filter(event => event.payload.sourceAbilityId === 'marked-for-death');
        expect(cutlassDamageEvents).toHaveLength(2);
        expect(cutlassDamageEvents.every(event => event.payload.amount === 2 && event.payload.unblockable === true)).toBe(true);

        const claw = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
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
        const { state: promptState } = requestMercilessCursePowderKegChoice(state);
        const prompt = getSimpleChoicePrompt(promptState, 'merciless-curse');
        const values = prompt.options.map(option => option.value as {
            value: number;
            customId?: string;
            labelParams?: { targets?: string };
        });

        expect(prompt.title).toBe('choices.mercilessCursePowderKeg.title');
        expect(values.map(option => option.value).sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
        expect(values.every(option => option.customId === 'cursed-pirate-merciless-curse-powder-keg')).toBe(true);
        expect(values.some(option => option.labelParams?.targets === 'P2, P4')).toBe(true);
        expect(values.some(option => option.labelParams?.targets?.includes('P3'))).toBe(false);

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

    it('战争贩子在攻击收口后触发额外进攻投掷阶段', () => {
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
        expect(resolved?.overrideNextPhase).toBe('offensiveRoll');
        const extraAttack = eventsOfType((resolved?.events ?? []) as DiceThroneEvent[], 'EXTRA_ATTACK_TRIGGERED')[0];
        expect(extraAttack?.payload.attackerId).toBe('0');
        expect(extraAttack?.payload.targetId).toBe('1');
        expect(extraAttack?.payload.sourceStatusId).toBe('war-monger');
    });

    it('灵魂突刺在 3 个相同骰值时施加火药桶，深海潜行偷取 1CP 并让对手自选弃牌', () => {
        const soulStab = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
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

        const dive = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);
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
});
