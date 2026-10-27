import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { buildDiceThroneAiLegalActions } from '../ai';
import { engineConfig } from '../game';
import { resolveNextLocalAiAction } from '../../../engine/ai';
import { DiceThroneDomain } from '../domain';
import { DICETHRONE_CHARACTER_CATALOG, DICETHRONE_PLAYER_VISIBLE_CHARACTER_CATALOG } from '../domain/core-types';
import type { DiceThroneEvent } from '../domain/events';
import { initHeroState } from '../domain/characters';
import { canPrepareSpell, canUseDejaVuCore, isCrimsonBandsBlocking } from '../domain/doctorStrange/rules';
import { createDoctorStrangeSpellSystem } from '../domain/doctorStrange/system';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { DOCTOR_STRANGE_CARDS, DOCTOR_STRANGE_COMMON_ATLAS_INDEX, DOCTOR_STRANGE_SPELLS } from '../heroes/doctor_strange/cards';
import { COMMON_CARDS } from '../domain/commonCards';
import { checkPlayCard, getOpponents, getTeammateId } from '../domain/rules';
import { DOCTOR_STRANGE_ABILITIES } from '../heroes/doctor_strange/abilities';
import { DOCTOR_STRANGE_ABILITY, DOCTOR_STRANGE_ATLAS, DOCTOR_STRANGE_TOKEN } from '../heroes/doctor_strange/constants';
import { getPendingAttackExpectedDamage } from '../domain/utils';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { cmd, createHeroMatchup, createQueuedRandom, fixedRandom, getSimpleChoicePrompt,
    advanceTo, createNoResponseSetup, interactionRespondCommandType, testSystems } from './test-utils';

function resolveDoctorStrangeAttack(
    abilityId: string,
    attackDice: number[],
    clearPreparedSpells = false,
    castPreparedSpell = false,
    preparedSpellId?: string,
    handSize?: number,
    options: {
        attackDamagePercent?: 'dazzle' | 'spiderSense';
        defenderShield?: number;
        defenderShieldReductionPercent?: number;
        defenderProtect?: number;
        discardSpellIds?: string[];
        randomAfterAttackDice?: number[];
    } = {},
) {
    const playerIds = ['0', '1'];
    const random = createQueuedRandom([...attackDice, ...(options.randomAfterAttackDice ?? [1, 1, 1, 1, 1])]);
    let state = createHeroMatchup('doctor_strange', 'monk')(playerIds, fixedRandom);
    state.sys.phase = 'main1';
    state.core.activePlayerId = '0';
    const defenderDamageShields: Array<{ value: number; sourceId: string; reductionPercent?: number }> = [];
    if (options.defenderShieldReductionPercent !== undefined) {
        defenderDamageShields.push({
            value: 0,
            reductionPercent: options.defenderShieldReductionPercent,
            sourceId: 'doctor-strange-test-percent-shield',
        });
    }
    if (options.defenderShield !== undefined) {
        defenderDamageShields.push({ value: options.defenderShield, sourceId: 'doctor-strange-test-shield' });
    }
    if (defenderDamageShields.length > 0) {
        state.core.players['1'].damageShields = defenderDamageShields;
    }
    if (options.defenderProtect !== undefined) {
        state.core.players['1'].tokens[TOKEN_IDS.PROTECT] = options.defenderProtect;
    }
    if (clearPreparedSpells) {
        const player = state.core.players['0'];
        player.deck = [...(player.preparedSpells ?? []), ...player.deck];
        player.preparedSpells = [];
        player.discard = [];
    }
    if (preparedSpellId) {
        const player = state.core.players['0'];
        const inventory = [...player.hand, ...player.deck, ...player.discard, ...(player.preparedSpells ?? [])];
        const spell = inventory.find(card => card.id === preparedSpellId);
        if (!spell) throw new Error(`奇异博士测试牌库缺少准备法术：${preparedSpellId}`);
        player.deck = [...player.deck, ...(player.preparedSpells ?? []).filter(card => card.id !== spell.id)]
            .filter(card => card.id !== spell.id);
        player.hand = player.hand.filter(card => card.id !== spell.id);
        player.discard = player.discard.filter(card => card.id !== spell.id);
        player.preparedSpells = [spell];
    }
    if (options.discardSpellIds) {
        const player = state.core.players['0'];
        const inventory = [...player.hand, ...player.deck, ...player.discard, ...(player.preparedSpells ?? [])];
        const discardSpells = options.discardSpellIds.map(id => {
            const spell = inventory.find(card => card.id === id);
            if (!spell) throw new Error(`奇异博士测试牌库缺少待准备法术：${id}`);
            return spell;
        });
        const discardSpellIds = new Set(discardSpells.map(card => card.id));
        const preparedSpellIds = new Set((player.preparedSpells ?? []).map(card => card.id));
        player.hand = player.hand.filter(card => !discardSpellIds.has(card.id));
        player.deck = inventory.filter(card => !discardSpellIds.has(card.id) && !preparedSpellIds.has(card.id));
        player.discard = discardSpells;
    }

    let timestamp = 80;
    const errors: string[] = [];
    const pipelineEvents: DiceThroneEvent[] = [];
    const dispatch = (type: string, playerId = '0', payload: Record<string, unknown> = {}) => {
        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            { ...cmd(type, playerId, payload), timestamp: timestamp++ } as never,
            random,
            playerIds,
        );
        if (!result.success) {
            errors.push(`${type}: ${result.error ?? 'unknown error'}`);
            return;
        }
        pipelineEvents.push(...result.events);
        state = result.state;
    };

    dispatch('ADVANCE_PHASE');
    dispatch('ROLL_DICE');
    dispatch('CONFIRM_ROLL');
    const rolledValues = state.core.dice.map(die => die.value);
    dispatch('SELECT_ABILITY', '0', { abilityId });
    if (options.attackDamagePercent && state.core.pendingAttack) {
        state.core.pendingAttack = {
            ...state.core.pendingAttack,
            dazzleCheckResolved: true,
            ...(options.attackDamagePercent === 'dazzle'
                ? { dazzleDamagePercent: -50 }
                : { zhizhuxiaDamagePercent: -50 }),
        };
    }
    dispatch('ADVANCE_PHASE');
    let phaseAfterAttackAdvance = state.sys.phase;
    if (state.sys.phase === 'offensiveRoll' && !state.sys.interaction.current) {
        dispatch('ADVANCE_PHASE');
        phaseAfterAttackAdvance = state.sys.phase;
    }
    if (state.sys.phase === 'defensiveRoll') {
        dispatch('ROLL_DICE', '1');
        dispatch('CONFIRM_ROLL', '1');
        dispatch('ADVANCE_PHASE', '1');
        phaseAfterAttackAdvance = state.sys.phase;
    }
    for (let step = 0; step < 6 && state.sys.phase !== 'main2'; step += 1) {
        const pendingDamage = state.core.pendingDamage;
        if (options.defenderProtect !== undefined
            && pendingDamage?.responseType === 'beforeDamageReceived'
            && pendingDamage.currentDamage > 0) {
            const pendingDamageId = pendingDamage.id;
            dispatch('USE_TOKEN', '1', {
                tokenId: TOKEN_IDS.PROTECT,
                amount: options.defenderProtect,
                pendingDamageId,
            });
            dispatch('SKIP_TOKEN_RESPONSE', '1', { pendingDamageId });
            continue;
        }
        if (state.sys.interaction.current?.kind === 'simple-choice') {
            if (!castPreparedSpell) break;
            if (handSize !== undefined && state.core.players['0'].hand.length < handSize) {
                const player = state.core.players['0'];
                const drawn = player.deck.slice(0, handSize - player.hand.length);
                player.deck = player.deck.slice(drawn.length);
                player.hand = [...player.hand, ...drawn];
            }
            const prompt = getSimpleChoicePrompt(state);
            const spellOption = prompt.options[0];
            if (!spellOption) throw new Error('奇异博士测试法术选择没有候选项');
            dispatch(interactionRespondCommandType, prompt.playerId, { optionId: spellOption.id });
            continue;
        }
        if (state.sys.phase === 'offensiveRoll') {
            dispatch('ADVANCE_PHASE', '0');
        } else if (state.sys.phase === 'defensiveRoll') {
            if (state.core.pendingAttack?.isDefendable !== false && !state.core.pendingAttack?.defenseResolved) {
                if (state.core.rollCount === 0) dispatch('ROLL_DICE', '1');
                if (!state.core.rollConfirmed) dispatch('CONFIRM_ROLL', '1');
            }
            dispatch('ADVANCE_PHASE', '1');
        } else {
            break;
        }
    }
    return { state, errors, rolledValues, phaseAfterAttackAdvance, pipelineEvents };
}

function createDoctorStrangeCardState(cardId: string, phase: 'main1' | 'offensiveRoll' | 'defensiveRoll') {
    const state = createHeroMatchup('doctor_strange', 'monk')(['0', '1'], fixedRandom);
    const player = state.core.players['0'];
    const card = player.deck.find(candidate => candidate.id === cardId);
    if (!card) throw new Error(`奇异博士测试牌库缺少行动牌：${cardId}`);
    player.deck = player.deck.filter(candidate => candidate.id !== cardId);
    player.hand = [card];
    player.resources.cp = 10;
    state.core.activePlayerId = phase === 'defensiveRoll' ? '1' : '0';
    state.sys.phase = phase;
    return state;
}

let doctorStrangeCommandTimestamp = 2000;

function dispatchDoctorStrangeCommand(
    state: ReturnType<typeof createDoctorStrangeCardState>,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
    random: ReturnType<typeof createQueuedRandom> = createQueuedRandom([1, 1, 1, 1, 1]),
) {
    const result = executePipeline(
        { domain: DiceThroneDomain, systems: testSystems },
        state,
        { ...cmd(type, playerId, payload), timestamp: doctorStrangeCommandTimestamp++ } as never,
        random,
        ['0', '1'],
    );
    expect(result.success, type + ': ' + (result.error ?? '')).toBe(true);
    if (!result.success) throw new Error(type + ': ' + (result.error ?? 'unknown error'));
    return result.state;
}

function rollDoctorStrangeDice(
    state: ReturnType<typeof createDoctorStrangeCardState>,
    rollerId: string,
    random: ReturnType<typeof createQueuedRandom>,
    confirm = false,
) {
    let current = dispatchDoctorStrangeCommand(state, 'ROLL_DICE', rollerId, {}, random);
    if (confirm) {
        current = dispatchDoctorStrangeCommand(current, 'CONFIRM_ROLL', rollerId, {}, random);
    }
    return current;
}

function confirmDoctorStrangeCardInteraction(
    state: ReturnType<typeof createDoctorStrangeCardState>,
    playerId: string,
    random: ReturnType<typeof createQueuedRandom>,
) {
    if (state.sys.interaction.current?.kind !== 'multistep-choice') return state;
    return dispatchDoctorStrangeCommand(state, 'SYS_INTERACTION_CONFIRM', playerId, {}, random);
}

function runDoctorStrangeCard(
    state: ReturnType<typeof createDoctorStrangeCardState>,
    cardId: string,
    random: ReturnType<typeof createQueuedRandom>,
    playerId = '0',
) {
    const playerIds = ['0', '1'];
    let current = state;
    let timestamp = 120;
    const dispatch = (type: string, playerId: string, payload: Record<string, unknown> = {}) => {
        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            current,
            { ...cmd(type, playerId, payload), timestamp: timestamp++ } as never,
            random,
            playerIds,
        );
        expect(result.success, `${type}: ${result.error ?? ''}`).toBe(true);
        current = result.state;
    };

    dispatch('PLAY_CARD', playerId, { cardId });
    while (current.sys.interaction.current) {
        const interaction = current.sys.interaction.current;
        if (interaction.kind === 'dt:bonus-dice') {
            dispatch('CONFIRM_ROLL', interaction.playerId);
            continue;
        }
        if (interaction.kind === 'dt:token-response') {
            return current;
        }
        if (interaction.kind === 'simple-choice') {
            const prompt = getSimpleChoicePrompt(current);
            const option = prompt.options[0];
            if (!option) throw new Error(`奇异博士行动牌选择没有选项：${cardId}`);
            dispatch(interactionRespondCommandType, prompt.playerId, { optionId: option.id });
            continue;
        }
        if (interaction.kind === 'dt:card-interaction' || interaction.kind === 'multistep-choice') {
            return current;
        }
        throw new Error(`奇异博士行动牌产生了未覆盖交互：${cardId}/${interaction.kind}`);
    }
    return current;
}

describe('奇异博士完成态与开局卡区', () => {
    it('默认可选且不显示实施中标记，同时内部初始化仍可用', () => {
        const character = DICETHRONE_CHARACTER_CATALOG.find(candidate => candidate.id === 'doctor_strange');
        expect(character?.setupOptionStatus).toBeUndefined();
        expect(character?.setupOptionStatusReason).toBeUndefined();
        expect(character?.badges?.some(badge => badge.id === 'implementation_in_progress') ?? false).toBe(false);
        expect(DICETHRONE_PLAYER_VISIBLE_CHARACTER_CATALOG.some(candidate => candidate.id === 'doctor_strange')).toBe(true);

        const playerIds = ['0', '1'];
        const state = {
            core: DiceThroneDomain.setup(playerIds, fixedRandom),
            sys: createInitialSystemState(playerIds, [], undefined),
        };
        state.sys.phase = 'setup';
        const result = DiceThroneDomain.validate(state, {
            type: 'SELECT_CHARACTER',
            playerId: '0',
            payload: { characterId: 'doctor_strange' },
            timestamp: 1,
        } as never);
        expect(result).toMatchObject({ valid: true });

        expect(() => initHeroState('0', 'doctor_strange', fixedRandom)).not.toThrow();
    });

    it('起始法尔特之焰只进入准备区，其余31张卡留在手牌与牌库', () => {
        const player = initHeroState('0', 'doctor_strange', fixedRandom);
        expect(player.preparedSpells?.map(card => card.id)).toEqual([DOCTOR_STRANGE_SPELLS[0].id]);
        expect(player.hand.length + player.deck.length).toBe(31);
        expect(player.tokens['premonition'] ?? 0).toBe(0);

        const cards = [...player.hand, ...player.deck, ...(player.preparedSpells ?? [])];
        expect(cards).toHaveLength(32);
        expect(new Set(cards.map(card => card.id)).size).toBe(32);
    });

    it('18张共享行动牌引用公共定义，只保留三项声明过的奇异博士配置差异', () => {
        const sharedCards = DOCTOR_STRANGE_CARDS.filter(card => card.id in DOCTOR_STRANGE_COMMON_ATLAS_INDEX);
        expect(sharedCards).toHaveLength(18);

        for (const card of sharedCards) {
            const { previewRef, ...actualDefinition } = card;
            const common = COMMON_CARDS.find(candidate => candidate.id === card.id);
            expect(common, `缺少公共牌定义：${card.id}`).toBeDefined();
            expect(previewRef).toEqual({
                type: 'atlas',
                atlasId: DOCTOR_STRANGE_ATLAS.CARDS,
                index: DOCTOR_STRANGE_COMMON_ATLAS_INDEX[card.id],
            });

            const expected = structuredClone(common!);
            if (card.id === 'card-next-time') {
                expected.timing = 'roll';
            } else if (card.id === 'card-i-can-again') {
                expected.playCondition = { ...expected.playCondition, phase: 'offensiveRoll' };
            } else if (card.id === 'card-worthy-of-me') {
                const playCondition = { ...expected.playCondition };
                delete playCondition.requireIsRoller;
                expected.playCondition = { ...playCondition, requireIsRollerOrTeammate: true };
                expected.effects = expected.effects?.map(effect => effect.action?.type === 'custom'
                    && effect.action.customActionId === 'reroll-die-2'
                    ? { ...effect, action: { ...effect.action, target: 'select' } }
                    : effect);
            }

            expect(actualDefinition, `共享定义或许可配置差异越界：${card.id}`).toEqual(expected);
        }
    });

    it('奇异博士的一掷千金真实投骰后按半数向上取整获得CP', () => {
        const cardId = 'card-one-throw-fortune';
        const state = createDoctorStrangeCardState(cardId, 'main1');
        state.core.players['0'].resources.cp = 2;

        const result = runDoctorStrangeCard(state, cardId, createQueuedRandom([4, 1, 1, 1, 1]));

        expect(result.core.players['0'].resources.cp).toBe(4);
        expect(result.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(result.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
    });

    it('奇异博士打出加倍从本角色牌库实际抽两张并扣除1CP', () => {
        const cardId = 'card-double';
        const state = createDoctorStrangeCardState(cardId, 'main1');
        const player = state.core.players['0'];
        player.resources.cp = 5;
        player.deck = [
            DOCTOR_STRANGE_CARDS.find(card => card.id === 'card-get-away')!,
            DOCTOR_STRANGE_CARDS.find(card => card.id === 'card-what-status')!,
        ];

        const result = runDoctorStrangeCard(state, cardId, createQueuedRandom([1, 1, 1, 1, 1]));

        expect(result.core.players['0'].resources.cp).toBe(4);
        expect(result.core.players['0'].hand.map(card => card.id)).toEqual(['card-get-away', 'card-what-status']);
        expect(result.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
    });

    it('奇异博士打出超级加倍从本角色牌库实际抽三张并扣除2CP', () => {
        const cardId = 'card-super-double';
        const state = createDoctorStrangeCardState(cardId, 'main1');
        const player = state.core.players['0'];
        player.resources.cp = 5;
        player.deck = [
            DOCTOR_STRANGE_CARDS.find(card => card.id === 'card-get-away')!,
            DOCTOR_STRANGE_CARDS.find(card => card.id === 'card-what-status')!,
            DOCTOR_STRANGE_CARDS.find(card => card.id === 'card-one-throw-fortune')!,
        ];

        const result = runDoctorStrangeCard(state, cardId, createQueuedRandom([1, 1, 1, 1, 1]));

        expect(result.core.players['0'].resources.cp).toBe(3);
        expect(result.core.players['0'].hand.map(card => card.id)).toEqual([
            'card-get-away',
            'card-what-status',
            'card-one-throw-fortune',
        ]);
        expect(result.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
    });

    it('奇异博士打出慷慨上司实际获得2CP并将牌送入弃牌区', () => {
        const cardId = 'card-boss-generous';
        const state = createDoctorStrangeCardState(cardId, 'main1');
        state.core.players['0'].resources.cp = 4;

        const result = runDoctorStrangeCard(state, cardId, createQueuedRandom([1, 1, 1, 1, 1]));

        expect(result.core.players['0'].resources.cp).toBe(6);
        expect(result.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
    });

    it('奇异博士打出再见移除自己的一层状态并关闭交互', () => {
        const cardId = 'card-bye-bye';
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const state = createDoctorStrangeCardState(cardId, 'main1');
        state.core.players['0'].statusEffects[STATUS_IDS.POISON] = 2;

        const played = runDoctorStrangeCard(state, cardId, random);
        const interaction = played.sys.interaction.current;
        expect(interaction?.kind).toBe('dt:card-interaction');

        const resolved = dispatchDoctorStrangeCommand(played, 'REMOVE_STATUS', '0', {
            targetPlayerId: '0',
            statusId: STATUS_IDS.POISON,
            interactionId: interaction!.id,
        }, random);

        expect(resolved.core.players['0'].statusEffects[STATUS_IDS.POISON]).toBe(1);
        expect(resolved.sys.interaction.current).toBeUndefined();
        expect(resolved.core.players['0'].resources.cp).toBe(8);
        expect(resolved.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
    });

    it('奇异博士打出走开移除对手的一层状态并关闭交互', () => {
        const cardId = 'card-get-away';
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const state = createDoctorStrangeCardState(cardId, 'main1');
        state.core.players['1'].statusEffects[STATUS_IDS.POISON] = 2;

        const played = runDoctorStrangeCard(state, cardId, random);
        const interaction = played.sys.interaction.current;
        expect(interaction?.kind).toBe('dt:card-interaction');

        const resolved = dispatchDoctorStrangeCommand(played, 'REMOVE_STATUS', '0', {
            targetPlayerId: '1',
            statusId: STATUS_IDS.POISON,
            interactionId: interaction!.id,
        }, random);

        expect(resolved.core.players['1'].statusEffects[STATUS_IDS.POISON]).toBe(1);
        expect(resolved.sys.interaction.current).toBeUndefined();
        expect(resolved.core.players['0'].resources.cp).toBe(9);
        expect(resolved.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
    });

    it('奇异博士打出什么状态清除目标的全部可移除状态', () => {
        const cardId = 'card-what-status';
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const state = createDoctorStrangeCardState(cardId, 'main1');
        state.core.players['1'].statusEffects[STATUS_IDS.POISON] = 2;
        state.core.players['1'].statusEffects[STATUS_IDS.BIND] = 1;

        const played = runDoctorStrangeCard(state, cardId, random);
        const interaction = played.sys.interaction.current;
        expect(interaction?.kind).toBe('dt:card-interaction');

        const resolved = dispatchDoctorStrangeCommand(played, 'RESOLVE_INTERACTION', '0', {
            selectedPlayerIds: ['1'],
            interactionId: interaction!.id,
        }, random);

        expect(resolved.core.players['1'].statusEffects[STATUS_IDS.POISON]).toBe(0);
        expect(resolved.core.players['1'].statusEffects[STATUS_IDS.BIND]).toBe(0);
        expect(resolved.sys.interaction.current).toBeUndefined();
        expect(resolved.core.players['0'].resources.cp).toBe(8);
        expect(resolved.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
    });

    it('奇异博士打出乾坤大挪移只转移一层状态并关闭交互', () => {
        const cardId = 'card-transfer-status';
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const state = createDoctorStrangeCardState(cardId, 'main1');
        state.core.players['1'].statusEffects[STATUS_IDS.POISON] = 2;

        const played = runDoctorStrangeCard(state, cardId, random);
        const interaction = played.sys.interaction.current;
        expect(interaction?.kind).toBe('dt:card-interaction');

        const resolved = dispatchDoctorStrangeCommand(played, 'TRANSFER_STATUS', '0', {
            fromPlayerId: '1',
            toPlayerId: '0',
            statusId: STATUS_IDS.POISON,
            interactionId: interaction!.id,
        }, random);

        expect(resolved.core.players['1'].statusEffects[STATUS_IDS.POISON]).toBe(1);
        expect(resolved.core.players['0'].statusEffects[STATUS_IDS.POISON]).toBe(1);
        expect(resolved.sys.interaction.current).toBeUndefined();
        expect(resolved.core.players['0'].resources.cp).toBe(8);
        expect(resolved.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
    });

    it('奇异博士打出来个六后将所选骰改为6并关闭交互', () => {
        const cardId = 'card-play-six';
        const random = createQueuedRandom([1, 2, 3, 4, 5]);
        let state = createDoctorStrangeCardState(cardId, 'offensiveRoll');
        state = rollDoctorStrangeDice(state, '0', random);
        state = runDoctorStrangeCard(state, cardId, random);
        state = dispatchDoctorStrangeCommand(state, 'MODIFY_DIE', '0', { dieId: 0, newValue: 6 }, random);
        state = confirmDoctorStrangeCardInteraction(state, '0', random);

        expect(state.core.dice[0]?.value).toBe(6);
        expect(state.core.players['0'].resources.cp).toBe(9);
        expect(state.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(state.sys.interaction.current).toBeUndefined();
    });

    it('奇异博士打出弹一手后将所选骰调整1点并关闭交互', () => {
        const cardId = 'card-flick';
        const random = createQueuedRandom([1, 2, 3, 4, 5]);
        let state = createDoctorStrangeCardState(cardId, 'offensiveRoll');
        state = rollDoctorStrangeDice(state, '0', random);
        state = runDoctorStrangeCard(state, cardId, random);
        state = dispatchDoctorStrangeCommand(state, 'MODIFY_DIE', '0', { dieId: 0, newValue: 2 }, random);
        state = confirmDoctorStrangeCardInteraction(state, '0', random);

        expect(state.core.dice[0]?.value).toBe(2);
        expect(state.core.players['0'].resources.cp).toBe(9);
        expect(state.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(state.sys.interaction.current).toBeUndefined();
    });

    it('奇异博士打出惊喜后将所选骰改为指定点数并关闭交互', () => {
        const cardId = 'card-surprise';
        const random = createQueuedRandom([1, 2, 3, 4, 5]);
        let state = createDoctorStrangeCardState(cardId, 'offensiveRoll');
        state = rollDoctorStrangeDice(state, '0', random);
        state = runDoctorStrangeCard(state, cardId, random);
        state = dispatchDoctorStrangeCommand(state, 'MODIFY_DIE', '0', { dieId: 0, newValue: 6 }, random);
        state = confirmDoctorStrangeCardInteraction(state, '0', random);

        expect(state.core.dice[0]?.value).toBe(6);
        expect(state.core.players['0'].resources.cp).toBe(8);
        expect(state.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(state.sys.interaction.current).toBeUndefined();
    });

    it('奇异博士打出大意外后分别修改两颗骰并关闭交互', () => {
        const cardId = 'card-unexpected';
        const random = createQueuedRandom([1, 2, 3, 4, 5]);
        let state = createDoctorStrangeCardState(cardId, 'offensiveRoll');
        state = rollDoctorStrangeDice(state, '0', random);
        state = runDoctorStrangeCard(state, cardId, random);
        state = dispatchDoctorStrangeCommand(state, 'MODIFY_DIE', '0', { dieId: 0, newValue: 6 }, random);
        state = dispatchDoctorStrangeCommand(state, 'MODIFY_DIE', '0', { dieId: 1, newValue: 5 }, random);
        state = confirmDoctorStrangeCardInteraction(state, '0', random);

        expect(state.core.dice.slice(0, 2).map(die => die.value)).toEqual([6, 5]);
        expect(state.core.players['0'].resources.cp).toBe(7);
        expect(state.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(state.sys.interaction.current).toBeUndefined();
    });

    it('奇异博士打出俺也一样后将所选目标骰改为同次投掷另一骰的点数', () => {
        const cardId = 'card-me-too';
        const random = createQueuedRandom([2, 4, 1, 3, 5]);
        let state = createDoctorStrangeCardState(cardId, 'offensiveRoll');
        state = rollDoctorStrangeDice(state, '0', random);
        state = runDoctorStrangeCard(state, cardId, random);
        state = dispatchDoctorStrangeCommand(state, 'MODIFY_DIE', '0', { dieId: 4, newValue: 5 }, random);
        state = dispatchDoctorStrangeCommand(state, 'MODIFY_DIE', '0', { dieId: 0, newValue: 5 }, random);
        state = confirmDoctorStrangeCardInteraction(state, '0', random);

        expect(state.core.dice[0]?.value).toBe(5);
        expect(state.core.players['0'].resources.cp).toBe(9);
        expect(state.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(state.sys.interaction.current).toBeUndefined();
    });

    it('奇异博士在对手确认进攻骰后打出抬一手并重掷对手选择的骰', () => {
        const cardId = 'card-give-hand';
        const random = createQueuedRandom([1, 2, 3, 4, 5, 6]);
        let state = createDoctorStrangeCardState(cardId, 'offensiveRoll');
        state.core.activePlayerId = '1';
        state = rollDoctorStrangeDice(state, '1', random, true);
        state = runDoctorStrangeCard(state, cardId, random);
        state = dispatchDoctorStrangeCommand(state, 'REROLL_DIE', '0', { dieId: 0 }, random);
        state = confirmDoctorStrangeCardInteraction(state, '0', random);

        expect(state.core.dice[0]?.value).toBe(6);
        expect(state.core.players['0'].resources.cp).toBe(9);
        expect(state.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(state.sys.interaction.current).toBeUndefined();
    });

    it('奇异博士在防御投掷阶段打出就这并重掷自己的防御骰', () => {
        const cardId = 'card-just-this';
        const random = createQueuedRandom([2, 2, 2, 2, 2, 6]);
        let state = createDoctorStrangeCardState(cardId, 'defensiveRoll');
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            defenseAbilityId: 'test-defense',
            isDefendable: true,
            damage: 5,
        };
        state = rollDoctorStrangeDice(state, '0', random);
        state = runDoctorStrangeCard(state, cardId, random);
        state = dispatchDoctorStrangeCommand(state, 'REROLL_DIE', '0', { dieId: 0 }, random);
        state = confirmDoctorStrangeCardInteraction(state, '0', random);

        expect(state.core.dice[0]?.value).toBe(6);
        expect(state.core.players['0'].resources.cp).toBe(10);
        expect(state.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(state.sys.interaction.current).toBeUndefined();
    });

    it('奇异博士的 card-i-can-again 仅在进攻投掷阶段满足新增阶段限制', () => {
        const cardId = 'card-i-can-again';
        const state = createDoctorStrangeCardState(cardId, 'offensiveRoll');
        const random = createQueuedRandom([1, 2, 3, 4, 5]);
        const rolled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            { ...cmd('ROLL_DICE', '0'), timestamp: 170 },
            random,
            ['0', '1'],
        );
        expect(rolled.success, rolled.error ?? '').toBe(true);

        const card = rolled.state.core.players['0'].hand.find(candidate => candidate.id === cardId);
        if (!card) throw new Error(`奇异博士手牌缺少 ${cardId}`);
        expect(checkPlayCard(rolled.state.core, '0', card, 'offensiveRoll')).toEqual({ ok: true });
        expect(checkPlayCard(rolled.state.core, '0', card, 'defensiveRoll')).toEqual({
            ok: false,
            reason: 'wrongPhaseForCard',
        });
    });

    it('奇异博士打出我又行了后重掷所选进攻骰并完成卡牌事务', () => {
        const cardId = 'card-i-can-again';
        const random = createQueuedRandom([1, 2, 3, 4, 5, 6]);
        let state = createDoctorStrangeCardState(cardId, 'offensiveRoll');
        state = rollDoctorStrangeDice(state, '0', random);
        state = runDoctorStrangeCard(state, cardId, random);
        state = dispatchDoctorStrangeCommand(state, 'REROLL_DIE', '0', { dieId: 0 }, random);
        state = confirmDoctorStrangeCardInteraction(state, '0', random);

        expect(state.core.dice[0]?.value).toBe(6);
        expect(state.core.players['0'].resources.cp).toBe(9);
        expect(state.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(state.sys.interaction.current).toBeUndefined();
    });

    it('奇异博士的 card-worthy-of-me 可由队友选择当前投掷者骰子并重复重掷两次', async () => {
        const playerIds = ['0', '1', '2', '3'] as const;
        const random = createQueuedRandom([1, 2, 3, 4, 5, 6, 5]);
        let state = createNoResponseSetup()(playerIds as unknown as string[], random);
        const rollerId = '0';
        const teammateId = getTeammateId(state.core, rollerId);
        const opponentId = getOpponents(state.core, rollerId)[0];
        if (!teammateId || !opponentId) throw new Error('四人局必须能解析投掷者队友和对手');

        state.core.selectedCharacters[teammateId] = 'doctor_strange';
        state.core.players[teammateId] = initHeroState(teammateId, 'doctor_strange', random);
        const teammate = state.core.players[teammateId];
        const card = DOCTOR_STRANGE_CARDS.find(candidate => candidate.id === 'card-worthy-of-me');
        if (!card) throw new Error('奇异博士牌组缺少 card-worthy-of-me');
        teammate.hand = [structuredClone(card)];
        teammate.deck = teammate.deck.filter(candidate => candidate.id !== card.id);
        teammate.resources.cp = 1;
        const opponent = state.core.players[opponentId];
        opponent.hand = [structuredClone(card)];
        opponent.resources.cp = 1;
        state.core.activePlayerId = rollerId;

        const dispatch = (input: ReturnType<typeof cmd>) => {
            const result = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                { ...input, timestamp: Date.now() } as never,
                random,
                [...playerIds],
            );
            expect(result.success, `${input.type}/${input.playerId}: ${result.error ?? ''}`).toBe(true);
            state = result.state as typeof state;
        };

        for (const input of advanceTo('offensiveRoll', rollerId)) dispatch(input);
        dispatch(cmd('ROLL_DICE', rollerId));

        expect(state.core.dice.map(die => die.value)).toEqual([1, 2, 3, 4, 5]);
        expect(checkPlayCard(state.core, teammateId, card, 'offensiveRoll')).toMatchObject({ ok: true });
        expect(checkPlayCard(state.core, opponentId, card, 'offensiveRoll')).toMatchObject({
            ok: false,
            reason: 'requireIsRoller',
        });
        expect(DiceThroneDomain.validate(state, {
            ...cmd('PLAY_CARD', opponentId, { cardId: card.id }),
            timestamp: 219,
        } as never)).toMatchObject({ valid: false, error: 'requireIsRoller' });

        const teammateActions = buildDiceThroneAiLegalActions({ playerId: teammateId, state });
        const playCardAction = teammateActions.find(action => action.kind === 'play-card'
            && action.metadata?.cardId === card.id);
        expect(playCardAction).toBeDefined();
        const [playCardCommand] = playCardAction!.commands;
        expect(playCardCommand?.type).toBe('PLAY_CARD');
        const playResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            {
                ...cmd(playCardCommand!.type, teammateId, playCardCommand!.payload as Record<string, unknown>),
                timestamp: 220,
            } as never,
            random,
            [...playerIds],
        );
        expect(playResult.success, playResult.error ?? '').toBe(true);
        state = playResult.state as typeof state;

        const selection = state.sys.interaction.current;
        expect(selection).toMatchObject({ kind: 'multistep-choice', playerId: teammateId });
        expect(selection?.data).toMatchObject({
            sourceId: card.id,
            meta: {
                dtType: 'selectDie',
                selectCount: 2,
                diceOwnerId: rollerId,
                targetOpponentDice: true,
                allowRepeatedDieSelection: true,
            },
        });

        expect(DiceThroneDomain.validate(state, {
            ...cmd('REROLL_DIE', opponentId, { dieId: 0 }),
            timestamp: 221,
        } as never)).toMatchObject({ valid: false, error: 'player_mismatch' });

        const aiResolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:doctor-strange-worthy-of-me-teammate-reroll',
            seatControllers: { [teammateId]: { type: 'local-ai' } },
        });
        expect(aiResolution?.playerId).toBe(teammateId);
        expect(aiResolution?.action.kind).toBe('interaction-multistep');
        const aiRerollCommand = aiResolution?.action.commands.find(command => command.type === 'REROLL_DIE');
        expect(aiRerollCommand?.payload).toMatchObject({ dieId: 0 });
        if (!aiRerollCommand) throw new Error('本地AI必须选择一颗可重掷骰子');
        dispatch(cmd('REROLL_DIE', teammateId, aiRerollCommand.payload as Record<string, unknown>));
        expect(state.core.dice[0]?.value).toBe(6);
        dispatch(cmd('REROLL_DIE', teammateId, { dieId: 0 }));
        expect(state.core.dice[0]?.value).toBe(5);
        dispatch(cmd('SYS_INTERACTION_CONFIRM', teammateId));

        expect(state.sys.interaction.current).toBeUndefined();
        expect(state.core.dice.map(die => die.value)).toEqual([5, 2, 3, 4, 5]);
        expect(state.core.rollCount).toBe(1);
        const finalTeammate = state.core.players[teammateId];
        expect(finalTeammate.hand.some(candidate => candidate.id === card.id)).toBe(false);
        expect(finalTeammate.discard.map(candidate => candidate.id)).toContain(card.id);
        expect(finalTeammate.resources.cp).toBe(0);
    });

    it('奇异博士的 card-next-time roll 配置仍生成合法 AI 伤害响应并结算到正式状态', async () => {
        const playerIds = ['0', '1'];
        const state = createHeroMatchup('doctor_strange', 'monk')(playerIds, fixedRandom);
        const player = state.core.players['0'];
        const card = DOCTOR_STRANGE_CARDS.find(candidate => candidate.id === 'card-next-time');
        if (!card) throw new Error('奇异博士牌组缺少 card-next-time');
        player.hand = [structuredClone(card)];
        player.resources.cp = 1;
        state.core.activePlayerId = '1';
        state.sys.phase = 'defensiveRoll';
        state.core.pendingDamage = {
            id: 'doctor-strange-next-time-ai-response',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 6,
            currentDamage: 6,
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        state.sys.responseWindow = {
            current: {
                id: 'doctor-strange-next-time-response-window',
                windowType: 'afterAttackResolved',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const actions = buildDiceThroneAiLegalActions({ playerId: '0', state });
        const response = actions.find(action => action.kind === 'response-play-card'
            && action.metadata?.cardId === 'card-next-time');
        expect(response).toBeDefined();
        expect(DiceThroneDomain.validate(state, {
            type: 'PLAY_CARD',
            playerId: '0',
            payload: { cardId: 'card-next-time' },
            timestamp: 200,
        } as never)).toMatchObject({ valid: true });

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:doctor-strange-next-time-response',
            seatControllers: { '0': { type: 'local-ai' } },
        });
        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action).toMatchObject({
            kind: 'response-play-card',
            metadata: { cardId: 'card-next-time' },
        });
        if (!resolution) throw new Error('本地 AI 未返回奇异博士伤害响应动作');
        const [command] = resolution.action.commands;
        if (!command) throw new Error('本地 AI 响应动作缺少执行命令');

        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            {
                ...cmd(command.type as CommandInput['type'], resolution.playerId, command.payload as Record<string, unknown>),
                timestamp: 201,
            } as never,
            fixedRandom,
            playerIds,
        );
        expect(result.success, result.error ?? '').toBe(true);
        expect(result.state.core.players['0'].damageShields).toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceId: 'card-next-time', value: 6 }),
        ]));
        expect(result.state.core.players['0'].discard.map(candidate => candidate.id)).toContain('card-next-time');
        expect(result.state.core.players['0'].resources.cp).toBe(0);
    });

    it('预兆用真实骰面触发后获得即视感并保留8点攻击候选', () => {
        const playerIds = ['0', '1'];
        const random = createQueuedRandom([3, 4, 6, 6, 1, 1, 1, 1, 1]);
        let state = createHeroMatchup('doctor_strange', 'monk')(playerIds, random);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        let timestamp = 40;

        const dispatch = (type: string, playerId = '0', payload: Record<string, unknown> = {}) => {
            const result = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                { ...cmd(type, playerId, payload), timestamp: timestamp++ } as never,
                random,
                playerIds,
            );
            expect(result.success, `${type} 应成功：${result.error ?? ''}`).toBe(true);
            state = result.state;
        };

        dispatch('ADVANCE_PHASE');
        dispatch('ROLL_DICE');
        dispatch('CONFIRM_ROLL');
        expect(state.core.dice.map(die => die.value)).toEqual([3, 4, 6, 6, 1]);
        dispatch('SELECT_ABILITY', '0', { abilityId: DOCTOR_STRANGE_ABILITY.OMEN });
        dispatch('ADVANCE_PHASE');
        if (state.sys.phase === 'offensiveRoll') dispatch('ADVANCE_PHASE');

        expect(state.core.players['0'].tokens['deja-vu']).toBe(1);
        expect(state.core.pendingAttack?.sourceAbilityId).toBe(DOCTOR_STRANGE_ABILITY.OMEN);
        expect(getPendingAttackExpectedDamage(state.core, state.core.pendingAttack!)).toBe(8);

        dispatch('ROLL_DICE', '1');
        dispatch('CONFIRM_ROLL', '1');
        dispatch('ADVANCE_PHASE', '1');

        expect(state.sys.phase).toBe('main2');
        expect(state.core.players['1'].resources.hp).toBe(42);
        expect(state.core.lastResolvedAttackDamage).toBe(8);
    });

    it('星际侵入用真实骰面结算两个奖励骰并将加成并入最终攻击伤害', () => {
        const playerIds = ['0', '1'];
        const random = createQueuedRandom([1, 3, 5, 6, 1, 1, 3, 1, 1, 1, 1, 1]);
        let state = createHeroMatchup('doctor_strange', 'monk')(playerIds, random);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        let timestamp = 60;

        const dispatch = (type: string, playerId = '0', payload: Record<string, unknown> = {}) => {
            const result = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                { ...cmd(type, playerId, payload), timestamp: timestamp++ } as never,
                random,
                playerIds,
            );
            expect(result.success, `${type} 应成功：${result.error ?? ''}`).toBe(true);
            state = result.state;
        };

        dispatch('ADVANCE_PHASE');
        dispatch('ROLL_DICE');
        dispatch('CONFIRM_ROLL');
        expect(state.core.dice.map(die => die.value)).toEqual([1, 3, 5, 6, 1]);
        dispatch('SELECT_ABILITY', '0', { abilityId: DOCTOR_STRANGE_ABILITY.ASTRAL });
        for (let step = 0; step < 5 && state.sys.phase === 'offensiveRoll'; step += 1) {
            dispatch(state.core.pendingBonusDiceSettlement ? 'CONFIRM_ROLL' : 'ADVANCE_PHASE');
        }

        expect(state.core.players['0'].tokens['premonition']).toBe(1);
        expect(state.core.pendingAttack?.sourceAbilityId).toBe(DOCTOR_STRANGE_ABILITY.ASTRAL);
        expect(state.core.pendingAttack?.bonusDamage).toBe(3);
        dispatch('ROLL_DICE', '1');
        dispatch('CONFIRM_ROLL', '1');
        dispatch('ADVANCE_PHASE', '1');

        expect(state.sys.phase).toBe('main2');
        expect(state.core.players['1'].resources.hp).toBe(41);
        expect(state.core.lastResolvedAttackDamage).toBe(9);
    });

    it('束缚术用曼荼罗与斗篷骰施加深红系带并结算9点攻击', () => {
        const result = resolveDoctorStrangeAttack(DOCTOR_STRANGE_ABILITY.BINDING, [1, 1, 5, 5, 3]);

        expect(result.errors).toEqual([]);
        expect(result.rolledValues).toEqual([1, 1, 5, 5, 3]);
        expect(result.phaseAfterAttackAdvance).toBe('main2');
        expect(result.state.sys.phase).toBe('main2');
        expect(result.state.core.players['1'].statusEffects[DOCTOR_STRANGE_TOKEN.CRIMSON_BANDS]).toBe(1);
        expect(result.state.core.players['1'].resources.hp).toBe(41);
        expect(result.state.core.lastResolvedAttackDamage).toBe(9);
    });

    it.each([
        { label: '小顺子', dice: [1, 2, 3, 4, 6], damage: 6 },
        { label: '大顺子', dice: [2, 3, 4, 5, 6], damage: 9 },
    ])('秘术雷击以$label骰面结算对应伤害', ({ dice, damage }) => {
        const variant = damage === 6 ? `${DOCTOR_STRANGE_ABILITY.BOLT}-small` : `${DOCTOR_STRANGE_ABILITY.BOLT}-large`;
        const result = resolveDoctorStrangeAttack(variant, dice, true);

        expect(result.errors).toEqual([]);
        expect(result.rolledValues).toEqual(dice);
        expect(result.phaseAfterAttackAdvance).toBe('main2');
        expect(result.state.sys.phase, JSON.stringify({ pendingAttack: result.state.core.pendingAttack,
            pendingDamage: result.state.core.pendingDamage, frameKinds: result.state.sys.resolution?.frames.map(frame => frame.kind),
            interaction: result.state.sys.interaction.current?.kind })).toBe('main2');
        expect(result.state.core.players['1'].resources.hp).toBe(50 - damage);
        expect(result.state.core.lastResolvedAttackDamage).toBe(damage);
    });

    it.each([
        { spellIndex: 0, damageBonus: 1, destination: 'hand', handSize: 0 },
        { spellIndex: 7, damageBonus: 3, destination: 'discard', handSize: 0 },
        { spellIndex: 8, damageBonus: 4, destination: 'discard', handSize: 4 },
    ])('秘术雷击大顺子施放法术索引$spellIndex后将追加伤害结算进生命与攻击总伤害', ({ spellIndex, damageBonus, destination, handSize }) => {
        const spell = DOCTOR_STRANGE_SPELLS[spellIndex];
        const result = resolveDoctorStrangeAttack(
            `${DOCTOR_STRANGE_ABILITY.BOLT}-large`,
            [2, 3, 4, 5, 6],
            false,
            true,
            spell.id,
            handSize,
        );
        const player = result.state.core.players['0'];
        const bonusEvent = result.pipelineEvents.find(event => event.type === 'BONUS_DAMAGE_ADDED'
            && event.payload.sourceCardId === spell.id);
        const supplementalDamage = result.pipelineEvents.find(event => event.type === 'DAMAGE_DEALT'
            && event.payload.sourceAbilityId === spell.id);
        expect(result.errors).toEqual([]);
        expect(result.state.sys.phase).toBe('main2');
        expect(result.state.core.players['1'].resources.hp).toBe(41 - damageBonus);
        expect(result.state.core.lastResolvedAttackDamage).toBe(9 + damageBonus);
        expect(result.state.core.pendingAttack).toBeNull();
        expect(player.preparedSpells).toHaveLength(0);
        expect(bonusEvent?.payload).toMatchObject({ amount: damageBonus, applyToResolvedAttack: true });
        expect(supplementalDamage).toMatchObject({ payload: { amount: damageBonus, damageScope: 'attack', damageOrigin: 'card' } });
        expect(player[destination as 'hand' | 'discard'].some(card => card.id === spell.id)).toBe(true);
    });

    it.each([
        { modifier: 'dazzle' as const, label: '眩光', spellIndex: 0, handSize: 0, expectedDamage: 5 },
        { modifier: 'dazzle' as const, label: '眩光', spellIndex: 7, handSize: 0, expectedDamage: 6 },
        { modifier: 'dazzle' as const, label: '眩光', spellIndex: 8, handSize: 4, expectedDamage: 7 },
        { modifier: 'spiderSense' as const, label: '蜘蛛感应', spellIndex: 0, handSize: 0, expectedDamage: 5 },
        { modifier: 'spiderSense' as const, label: '蜘蛛感应', spellIndex: 7, handSize: 0, expectedDamage: 6 },
        { modifier: 'spiderSense' as const, label: '蜘蛛感应', spellIndex: 8, handSize: 4, expectedDamage: 7 },
    ])('$label下施放法术索引$spellIndex时按整次攻击重算减半与舍入差额', ({ modifier, spellIndex, handSize, expectedDamage }) => {
        const spell = DOCTOR_STRANGE_SPELLS[spellIndex];
        const result = resolveDoctorStrangeAttack(
            `${DOCTOR_STRANGE_ABILITY.BOLT}-large`,
            [2, 3, 4, 5, 6],
            false,
            true,
            spell.id,
            handSize,
            { attackDamagePercent: modifier },
        );

        expect(result.errors).toEqual([]);
        expect(result.state.sys.phase).toBe('main2');
        expect(result.state.core.players['1'].resources.hp).toBe(50 - expectedDamage);
        expect(result.state.core.lastResolvedAttackDamage).toBe(expectedDamage);
        expect(result.pipelineEvents.some(event => event.type === 'DAMAGE_DEALT'
            && event.payload.sourceAbilityId === spell.id)).toBe(expectedDamage > 5);
    });

    it('眩光减半后的追加攻击伤害仍通过同一个防止与护盾归约入口', () => {
        const result = resolveDoctorStrangeAttack(
            `${DOCTOR_STRANGE_ABILITY.BOLT}-large`,
            [2, 3, 4, 5, 6],
            false,
            true,
            DOCTOR_STRANGE_SPELLS[7].id,
            0,
            { attackDamagePercent: 'dazzle', defenderShield: 1 },
        );

        expect(result.errors).toEqual([]);
        expect(result.state.core.players['1'].resources.hp).toBe(45);
        expect(result.state.core.players['1'].damageShields).toEqual([]);
        expect(result.state.core.lastResolvedAttackDamage).toBe(5);
    });

    it.each([
        { spellIndex: 0, handSize: 0, label: '法尔特之焰 +1' },
        { spellIndex: 7, handSize: 0, label: '法瑞拉之牙 +3' },
        { spellIndex: 8, handSize: 4, label: '艾坎之形 +4' },
    ])('守护将眩光主伤害降为0后施放$label仍不穿透免伤', ({ spellIndex, handSize }) => {
        const spell = DOCTOR_STRANGE_SPELLS[spellIndex];
        const result = resolveDoctorStrangeAttack(
            `${DOCTOR_STRANGE_ABILITY.BOLT}-large`,
            [2, 3, 4, 5, 6],
            false,
            true,
            spell.id,
            handSize,
            { attackDamagePercent: 'dazzle', defenderProtect: 1 },
        );

        expect(result.errors).toEqual([]);
        expect(result.state.sys.phase).toBe('main2');
        expect(result.state.core.players['1'].resources.hp).toBe(50);
        expect(result.state.core.lastResolvedAttackDamage).toBe(0);
        expect(result.state.core.pendingAttack).toBeNull();
        expect(result.state.core.players['1'].tokens[TOKEN_IDS.PROTECT]).toBe(0);
        expect(result.pipelineEvents.some(event => event.type === 'TOKEN_RESPONSE_CLOSED'
            && event.payload.finalDamage === 0
            && event.payload.fullyEvaded === false)).toBe(true);
        expect(result.pipelineEvents.some(event => event.type === 'BONUS_DAMAGE_ADDED'
            && event.payload.sourceCardId === spell.id)).toBe(true);
        expect(result.pipelineEvents.some(event => event.type === 'DAMAGE_DEALT'
            && event.payload.sourceAbilityId === spell.id)).toBe(false);
        const spellInHand = result.state.core.players['0'].hand.some(card => card.id === spell.id);
        const spellInDiscard = result.state.core.players['0'].discard.some(card => card.id === spell.id);
        expect(Number(spellInHand) + Number(spellInDiscard)).toBe(1);
        expect(spell.spell?.destination === 'hand' ? spellInHand : spellInDiscard).toBe(true);
    });

    it('守护对主攻击减半后，后置法术只造成本次攻击累计减半的差额', () => {
        const spell = DOCTOR_STRANGE_SPELLS[7];
        const result = resolveDoctorStrangeAttack(
            `${DOCTOR_STRANGE_ABILITY.BOLT}-large`,
            [2, 3, 4, 5, 6],
            false,
            true,
            spell.id,
            0,
            { defenderProtect: 1 },
        );

        expect(result.errors).toEqual([]);
        expect(result.state.sys.phase).toBe('main2');
        expect(result.state.core.players['1'].resources.hp).toBe(44);
        expect(result.state.core.lastResolvedAttackDamage).toBe(6);
        expect(result.pipelineEvents.some(event => event.type === 'DAMAGE_DEALT'
            && event.payload.sourceAbilityId === spell.id
            && event.payload.amount === 2)).toBe(true);
    });

    it('固定护盾与守护在主伤害中先后生效后，后置法术沿用同一减伤账本', () => {
        const spell = DOCTOR_STRANGE_SPELLS[7];
        const result = resolveDoctorStrangeAttack(
            `${DOCTOR_STRANGE_ABILITY.BOLT}-large`,
            [2, 3, 4, 5, 6],
            false,
            true,
            spell.id,
            0,
            { defenderShield: 1, defenderProtect: 1 },
        );

        expect(result.errors).toEqual([]);
        expect(result.state.sys.phase).toBe('main2');
        expect(result.state.core.players['1'].resources.hp).toBe(45);
        expect(result.state.core.lastResolvedAttackDamage).toBe(5);
        expect(result.state.core.players['1'].damageShields).toEqual([]);
        expect(result.pipelineEvents.some(event => event.type === 'DAMAGE_DEALT'
            && event.payload.sourceAbilityId === spell.id
            && event.payload.amount === 1)).toBe(true);
        const shieldConsumptions = result.pipelineEvents.flatMap(event => event.type === 'DAMAGE_DEALT'
            ? event.payload.shieldsConsumed ?? []
            : []);
        expect(shieldConsumptions.filter(shield => shield.sourceId === 'doctor-strange-test-shield')).toHaveLength(1);
    });

    it('单独的百分比护盾也会作用于后置法术的累计伤害差额', () => {
        const spell = DOCTOR_STRANGE_SPELLS[7];
        const result = resolveDoctorStrangeAttack(
            `${DOCTOR_STRANGE_ABILITY.BOLT}-large`,
            [2, 3, 4, 5, 6],
            false,
            true,
            spell.id,
            0,
            { defenderShieldReductionPercent: 50 },
        );

        expect(result.errors).toEqual([]);
        expect(result.state.sys.phase).toBe('main2');
        expect(result.state.core.players['1'].resources.hp).toBe(44);
        expect(result.state.core.lastResolvedAttackDamage).toBe(6);
        expect(result.state.core.players['1'].damageShields).toEqual([]);
        expect(result.pipelineEvents.some(event => event.type === 'DAMAGE_DEALT'
            && event.payload.sourceAbilityId === spell.id
            && event.payload.amount === 2)).toBe(true);
        const shieldConsumptions = result.pipelineEvents.flatMap(event => event.type === 'DAMAGE_DEALT'
            ? event.payload.shieldsConsumed ?? []
            : []);
        expect(shieldConsumptions.filter(shield => shield.sourceId === 'doctor-strange-test-percent-shield')).toHaveLength(1);
    });

    it('瓦图姆魔杖连续施放两张后置法术时保留主攻击百分比与固定盾账本', () => {
        const preparationSpell = DOCTOR_STRANGE_SPELLS[0];
        const firstBonusSpell = DOCTOR_STRANGE_SPELLS[0];
        const secondBonusSpell = DOCTOR_STRANGE_SPELLS[7];
        const result = resolveDoctorStrangeAttack(
            DOCTOR_STRANGE_ABILITY.WAND,
            [6, 6, 6, 6, 3],
            false,
            true,
            preparationSpell.id,
            0,
            {
                defenderShieldReductionPercent: 50,
                defenderShield: 5,
                discardSpellIds: [secondBonusSpell.id],
            },
        );

        expect(result.errors).toEqual([]);
        expect(result.state.sys.phase).toBe('main2');
        expect(result.state.core.players['1'].resources.hp).toBe(50);
        expect(result.state.core.lastResolvedAttackDamage).toBe(0);
        const shieldConsumptions = result.pipelineEvents.flatMap(event => event.type === 'DAMAGE_DEALT'
            ? event.payload.shieldsConsumed ?? []
            : []);
        expect(shieldConsumptions.filter(shield => shield.sourceId === 'doctor-strange-test-percent-shield')).toHaveLength(1);
        expect(shieldConsumptions
            .filter(shield => shield.sourceId === 'doctor-strange-test-shield')
            .reduce((total, shield) => total + shield.absorbed, 0)).toBe(4);
        expect(result.pipelineEvents.some(event => event.type === 'BONUS_DAMAGE_ADDED'
            && event.payload.sourceCardId === firstBonusSpell.id
            && event.payload.amount === 1)).toBe(true);
        expect(result.pipelineEvents.some(event => event.type === 'BONUS_DAMAGE_ADDED'
            && event.payload.sourceCardId === secondBonusSpell.id
            && event.payload.amount === 3)).toBe(true);
        expect(result.state.core.players['0'].hand.some(card => card.id === firstBonusSpell.id)).toBe(true);
        expect(result.state.core.players['0'].discard.some(card => card.id === secondBonusSpell.id)).toBe(true);
    });

    it('瓦图姆魔杖以四护身符骰施加深红系带并完成5点不可防御攻击', () => {
        const result = resolveDoctorStrangeAttack(DOCTOR_STRANGE_ABILITY.WAND, [6, 6, 6, 6, 3], true);

        expect(result.errors).toEqual([]);
        expect(result.rolledValues).toEqual([6, 6, 6, 6, 3]);
        expect(result.phaseAfterAttackAdvance).toBe('main2');
        expect(result.state.sys.phase, JSON.stringify({ pendingAttack: result.state.core.pendingAttack,
            pendingDamage: result.state.core.pendingDamage, frameKinds: result.state.sys.resolution?.frames.map(frame => frame.kind),
            interaction: result.state.sys.interaction.current?.kind })).toBe('main2');
        expect(result.state.core.players['1'].statusEffects[DOCTOR_STRANGE_TOKEN.CRIMSON_BANDS]).toBe(1);
        expect(result.state.core.players['1'].resources.hp).toBe(45);
        expect(result.state.core.lastResolvedAttackDamage).toBe(5);
    });

    it('看见未来通过真实出牌获得2层预感并进入弃牌区', () => {
        const cardId = 'card-strange-see-the-future';
        const state = createDoctorStrangeCardState(cardId, 'main1');
        const result = runDoctorStrangeCard(state, cardId, createQueuedRandom([1]));

        expect(result.core.players['0'].tokens[DOCTOR_STRANGE_TOKEN.PREMONITION]).toBe(2);
        expect(result.core.players['0'].hand.some(card => card.id === cardId)).toBe(false);
        expect(result.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(result.core.players['0'].resources.cp).toBe(10);
    });

    it('寒冰藤蔓通过真实临时骰结算加伤、深红系带与行动牌去向', () => {
        const cardId = 'card-strange-icy-tendrils';
        const state = createDoctorStrangeCardState(cardId, 'offensiveRoll');
        state.core.pendingAttack = {
            attackerId: '0', defenderId: '1', sourceAbilityId: DOCTOR_STRANGE_ABILITY.BOLT,
            isDefendable: true, settlementStage: 'preDamage',
        };
        const result = runDoctorStrangeCard(state, cardId, createQueuedRandom([1, 6]));

        expect(result.core.pendingAttack?.bonusDamage).toBe(1);
        expect(result.core.players['1'].statusEffects[DOCTOR_STRANGE_TOKEN.CRIMSON_BANDS]).toBe(1);
        expect(result.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(result.core.players['0'].resources.cp).toBe(9);
    });

    it('塞拉芬之盾通过真实临时骰预备一次性减伤并获得预感', () => {
        const cardId = 'card-strange-shield-of-seraphim';
        const state = createDoctorStrangeCardState(cardId, 'defensiveRoll');
        state.core.pendingAttack = {
            attackerId: '1', defenderId: '0', sourceAbilityId: 'fist-technique-5',
            isDefendable: true, settlementStage: 'preDamage',
        };
        const result = runDoctorStrangeCard(state, cardId, createQueuedRandom([1, 6]));

        expect(result.sys.phase).toBe('defensiveRoll');
        expect(result.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(result.core.players['0'].damageShields).toContainEqual({
            value: 1, sourceId: cardId, preventStatus: false,
        });
        expect(result.core.players['0'].tokens[DOCTOR_STRANGE_TOKEN.PREMONITION]).toBe(1);
        expect(result.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(result.core.players['0'].resources.cp).toBe(9);
    });

    it('转瞬即逝通过真实出牌施放已准备法术并按卡牌去向返回手牌', () => {
        const cardId = 'card-strange-cast-away';
        const state = createDoctorStrangeCardState(cardId, 'offensiveRoll');
        state.core.pendingAttack = {
            attackerId: '0', defenderId: '1', sourceAbilityId: DOCTOR_STRANGE_ABILITY.BOLT,
            isDefendable: true, settlementStage: 'preDamage',
        };
        const result = runDoctorStrangeCard(state, cardId, createQueuedRandom([1]));

        expect(result.core.pendingAttack?.bonusDamage).toBe(1);
        expect(result.core.players['0'].preparedSpells?.some(card => card.id === DOCTOR_STRANGE_SPELLS[0].id)).toBe(false);
        expect(result.core.players['0'].hand.some(card => card.id === DOCTOR_STRANGE_SPELLS[0].id)).toBe(true);
        expect(result.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(result.core.players['0'].resources.cp).toBe(10);
    });

    it('时间回溯通过真实出牌定向授予即视感并支付CP', () => {
        const cardId = 'card-strange-time-loop';
        const result = runDoctorStrangeCard(
            createDoctorStrangeCardState(cardId, 'main1'),
            cardId,
            createQueuedRandom([1]),
        );

        expect(result.core.players['0'].tokens[DOCTOR_STRANGE_TOKEN.DEJA_VU]).toBe(1);
        expect(result.core.players['1'].tokens[DOCTOR_STRANGE_TOKEN.DEJA_VU] ?? 0).toBe(0);
        expect(result.core.players['0'].discard.some(card => card.id === cardId)).toBe(true);
        expect(result.core.players['0'].resources.cp).toBe(8);
    });

    it('悬浮斗篷用两枚真实防御骰减免最终伤害并结算预感', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1, 3, 5]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createHeroMatchup('monk', 'doctor_strange'),
            silent: true,
        });

        const result = runner.run({
            name: '奇异博士悬浮斗篷防御结算',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('SELECT_ABILITY', '1', { abilityId: DOCTOR_STRANGE_ABILITY.CLOAK }),
                cmd('ADVANCE_PHASE', '1'),
            ],
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.actualErrors, JSON.stringify(result.steps.map(({ commandType, playerId, success, error }) => ({ commandType, playerId, success, error })))).toEqual([]);
        expect(result.finalState.sys.phase).toBe('main2');
        expect(result.finalState.core.players['1'].resources.hp).toBe(44);
        expect(result.finalState.core.players['1'].tokens[DOCTOR_STRANGE_TOKEN.PREMONITION]).toBe(1);
        expect(result.finalState.core.lastResolvedAttackDamage).toBe(6);
    });

    it('悬浮斗篷的曼荼罗与护身符反击骰伤害攻击者', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1, 1, 6]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createHeroMatchup('monk', 'doctor_strange'),
            silent: true,
        });

        const result = runner.run({
            name: '奇异博士悬浮斗篷反击骰目标',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('SELECT_ABILITY', '1', { abilityId: DOCTOR_STRANGE_ABILITY.CLOAK }),
                cmd('ADVANCE_PHASE', '1'),
            ],
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.actualErrors, JSON.stringify(result.steps.map(({ commandType, playerId, success, error }) => ({ commandType, playerId, success, error })))).toEqual([]);
        expect(result.finalState.sys.phase).toBe('main2');
        expect(result.finalState.core.players['0'].resources.hp).toBe(46);
        expect(result.finalState.core.players['1'].resources.hp).toBe(42);
        expect(result.finalState.core.lastResolvedAttackDamage).toBe(8);
    });

    it('维山帝之书两个主要阶段共用一次手牌准备，并拒绝同回合第二次准备', () => {
        const playerIds = ['0', '1'];
        const state = createHeroMatchup('doctor_strange', 'monk')(playerIds, fixedRandom);
        const player = state.core.players['0'];
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.turnNumber = 6;

        const cards = [...player.hand, ...player.deck, ...player.discard];
        const firstSpell = cards.find(card => card.id === DOCTOR_STRANGE_SPELLS[1].id);
        const secondSpell = cards.find(card => card.id === DOCTOR_STRANGE_SPELLS[2].id);
        if (!firstSpell || !secondSpell) throw new Error('测试起始牌组缺少准备法术');
        player.hand = [firstSpell, secondSpell];
        player.deck = cards.filter(card => card.id !== firstSpell.id && card.id !== secondSpell.id);
        player.discard = [];

        expect(canPrepareSpell(state.core, '0', 'main1')).toBe(true);
        const prepared = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            { ...cmd('PLAY_CARD', '0', { cardId: firstSpell.id }), timestamp: 30 } as never,
            fixedRandom,
            playerIds,
        );
        expect(prepared.success, prepared.error ?? '').toBe(true);
        expect(prepared.state.core.players['0'].preparedSpells?.some(card => card.id === firstSpell.id)).toBe(true);
        expect(prepared.state.core.players['0'].spellPreparedTurn).toBe(6);
        expect(canPrepareSpell(prepared.state.core, '0', 'main2')).toBe(false);

        const repeated = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            prepared.state,
            { ...cmd('PLAY_CARD', '0', { cardId: secondSpell.id }), timestamp: 31 } as never,
            fixedRandom,
            playerIds,
        );
        expect(repeated.success).toBe(false);
        expect(repeated.error).toBe('spellPreparationUnavailable');
        expect(repeated.state.core.players['0'].hand.some(card => card.id === secondSpell.id)).toBe(true);
    });

    it('即视感可在投掷次数用尽后重开进攻阶段，并清理旧阶段致盲/炫光', () => {
        const playerIds = ['0', '1'];
        const state = createHeroMatchup('doctor_strange', 'monk')(playerIds, fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = state.core.rollLimit;
        state.core.players['0'].tokens[TOKEN_IDS.DEJA_VU] = 1;
        state.core.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
        state.core.players['0'].statusEffects[STATUS_IDS.DAZZLE] = 1;

        expect(canUseDejaVuCore(state.core, 'offensiveRoll', '0')).toBe(true);
        const aiAction = buildDiceThroneAiLegalActions({ playerId: '0', state })
            .find(action => action.kind === 'use-deja-vu');
        expect(aiAction?.commands).toEqual([{ type: 'USE_DEJA_VU', payload: {} }]);

        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            { ...cmd('USE_DEJA_VU', '0'), timestamp: 20 } as never,
            fixedRandom,
            playerIds,
        );

        expect(result.success, result.error ?? '').toBe(true);
        expect(result.state.sys.phase).toBe('offensiveRoll');
        expect(result.state.core.rollCount).toBe(0);
        expect(result.state.core.players['0'].tokens[TOKEN_IDS.DEJA_VU]).toBe(0);
        expect(result.state.core.players['0'].statusEffects[STATUS_IDS.BLINDED] ?? 0).toBe(0);
        expect(result.state.core.players['0'].statusEffects[STATUS_IDS.DAZZLE] ?? 0).toBe(0);
        expect(result.state.core.pendingAttack).toBeNull();
    });

    it('即视感在进攻投掷阶段之外不生成 AI 动作且命令校验拒绝使用', () => {
        const playerIds = ['0', '1'];
        const state = createHeroMatchup('doctor_strange', 'monk')(playerIds, fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.DEJA_VU] = 1;

        expect(buildDiceThroneAiLegalActions({ playerId: '0', state })
            .some(action => action.kind === 'use-deja-vu')).toBe(false);
        const rejected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            { ...cmd('USE_DEJA_VU', '0'), timestamp: 21 } as never,
            fixedRandom,
            playerIds,
        );

        expect(rejected.success).toBe(false);
        expect(rejected.state.sys.phase).toBe('main1');
        expect(rejected.state.core.players['0'].tokens[TOKEN_IDS.DEJA_VU]).toBe(1);
    });

    it('深红系带在后续本人进攻开始生效，拒绝出牌并在整段投掷流程后移除', () => {
        const playerIds = ['0', '1'];
        const state = createHeroMatchup('doctor_strange', 'monk')(playerIds, fixedRandom);
        const player = state.core.players['0'];
        player.statusEffects['crimson-bands'] = 1;
        player.crimsonBandsReceivedTurn = state.core.turnNumber - 1;
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';

        const system = createDoctorStrangeSpellSystem();
        const command = { type: 'TEST', playerId: '0', payload: {}, timestamp: 21 };
        const activated = system.afterEvents?.({
            state,
            events: [{ type: 'SYS_PHASE_CHANGED', payload: { to: 'offensiveRoll' }, timestamp: 21 }],
            command,
            random: fixedRandom,
            playerIds,
        });
        expect(activated?.events?.map(event => event.type)).toContain('STRANGE_BANDS_ACTIVATED');
        let current = activated?.state ?? state;
        for (const event of activated?.events ?? []) {
            current = { ...current, core: DiceThroneDomain.reduce(current.core, event as never) };
        }

        expect(isCrimsonBandsBlocking(current.core, '0', 'offensiveRoll')).toBe(true);
        for (const card of DOCTOR_STRANGE_CARDS) {
            expect(checkPlayCard(current.core, '0', card, 'offensiveRoll'), card.id).toMatchObject({
                ok: false,
                reason: 'crimsonBandsBlocksCards',
            });
        }

        for (const phase of ['targetingRoll', 'defensiveRoll'] as const) {
            const phaseResult = system.afterEvents?.({
                state: current,
                events: [{ type: 'SYS_PHASE_CHANGED', payload: { to: phase }, timestamp: 21 }],
                command,
                random: fixedRandom,
                playerIds,
            });
            expect((phaseResult?.events ?? []).some(event => event.type === 'STATUS_REMOVED'), phase).toBe(false);
        }

        const cleaned = system.afterEvents?.({
            state: current,
            events: [{ type: 'SYS_PHASE_CHANGED', payload: { to: 'main2' }, timestamp: 22 }],
            command: { ...command, timestamp: 22 },
            random: fixedRandom,
            playerIds,
        });
        expect(cleaned?.events?.map(event => event.type)).toContain('STATUS_REMOVED');
        current = cleaned?.state ?? current;
        for (const event of cleaned?.events ?? []) {
            current = { ...current, core: DiceThroneDomain.reduce(current.core, event as never) };
        }
        expect(current.core.players['0'].statusEffects['crimson-bands'] ?? 0).toBe(0);
        expect(isCrimsonBandsBlocking(current.core, '0', 'main2')).toBe(false);
    });

    it('深红系带在同回合获得时不会提前激活', () => {
        const playerIds = ['0', '1'];
        const state = createHeroMatchup('doctor_strange', 'monk')(playerIds, fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        const player = state.core.players['0'];
        player.statusEffects['crimson-bands'] = 1;
        player.crimsonBandsReceivedTurn = state.core.turnNumber;

        const result = createDoctorStrangeSpellSystem().afterEvents?.({
            state,
            events: [{ type: 'SYS_PHASE_CHANGED', payload: { to: 'offensiveRoll' }, timestamp: 22 }],
            command: { type: 'TEST', playerId: '0', payload: {}, timestamp: 22 },
            random: fixedRandom,
            playerIds,
        });

        expect((result?.events ?? []).some(event => event.type === 'STRANGE_BANDS_ACTIVATED')).toBe(false);
        expect((result?.events ?? []).some(event => event.type === 'STATUS_REMOVED')).toBe(false);
        expect(result?.state?.core.players['0'].statusEffects['crimson-bands']
            ?? state.core.players['0'].statusEffects['crimson-bands']).toBe(1);
    });

    it('深红系带禁止打牌但仍允许使用即视感状态', () => {
        const playerIds = ['0', '1'];
        const state = createHeroMatchup('doctor_strange', 'monk')(playerIds, fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.players['0'].crimsonBandsActiveTurn = state.core.turnNumber;
        state.core.players['0'].statusEffects['crimson-bands'] = 1;
        state.core.players['0'].tokens['deja-vu'] = 1;

        expect(isCrimsonBandsBlocking(state.core, '0', 'offensiveRoll')).toBe(true);
        expect(canUseDejaVuCore(state.core, 'offensiveRoll', '0')).toBe(true);
        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            { ...cmd('USE_DEJA_VU', '0'), timestamp: 23 } as never,
            fixedRandom,
            playerIds,
        );

        expect(result.success, result.error ?? '').toBe(true);
        expect(result.state.sys.phase).toBe('offensiveRoll');
        expect(result.state.core.players['0'].tokens['deja-vu']).toBe(0);
        expect(result.state.core.players['0'].statusEffects['crimson-bands']).toBe(1);
    });

    it('秘术雷击和瓦图姆魔杖在主攻击伤害后才进入法术选择', () => {
        const bolt = DOCTOR_STRANGE_ABILITIES.find(ability => ability.id === DOCTOR_STRANGE_ABILITY.BOLT);
        expect(bolt?.variants?.map(variant => variant.effects.map(effect => effect.timing))).toEqual([
            ['withDamage', 'postDamage'],
            ['withDamage', 'postDamage'],
        ]);

        const wand = DOCTOR_STRANGE_ABILITIES.find(ability => ability.id === DOCTOR_STRANGE_ABILITY.WAND);
        expect(wand?.effects?.map(effect => effect.timing)).toEqual(['preDefense', 'withDamage', 'postDamage']);
        expect(wand?.effects?.map(effect => (
            effect.action?.type === 'custom' ? effect.action.params?.operation : effect.action?.type
        ))).toEqual(['wand', 'damage', 'wand-after-damage']);
    });
});
