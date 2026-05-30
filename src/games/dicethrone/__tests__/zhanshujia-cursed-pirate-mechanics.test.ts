import { describe, expect, it } from 'vitest';
import { createDamageCalculation } from '../../../engine/primitives/damageCalculation';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';
import { resolveEffectsToEvents } from '../domain/effects';
import { initializeCustomActions } from '../domain/customActions';
import { validateCommand } from '../domain/commandValidation';
import { getTokenStackLimit } from '../domain/rules';
import { RESOURCE_IDS } from '../domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import type { DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import {
    cmd,
    createHeroMatchup,
    createNoResponseSetupWithEmptyHand,
    createQueuedRandom,
    createRunner,
    fixedRandom,
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

describe('DiceThrone 战术家 / 咒缚海盗机制', () => {
    it('诅咒金币按角色差异限制层数，并被 grantStatus 共享路径遵守', () => {
        const state = createHeroMatchup('cursed_pirate', 'zhanshujia')(['0', '1'], fixedRandom);

        expect(getTokenStackLimit(state.core, '0', STATUS_IDS.CURSED_COIN)).toBe(5);
        expect(getTokenStackLimit(state.core, '1', STATUS_IDS.CURSED_COIN)).toBe(3);

        state.core.players['0'].statusEffects[STATUS_IDS.CURSED_COIN] = 4;
        state.core.players['1'].statusEffects[STATUS_IDS.CURSED_COIN] = 2;

        const selfEvents = resolveEffectsToEvents([{
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
        expect(eventsOfType(selfEvents, 'STATUS_APPLIED')[0]?.payload.newTotal).toBe(5);

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

    it('灵魂突刺在 3 个相同骰值时施加火药桶，深海潜行偷取 1CP 并施加凋零', () => {
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
    });
});
