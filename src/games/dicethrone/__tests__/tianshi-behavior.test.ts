import { describe, expect, it } from 'vitest';
import type { ChoiceRequest } from '../../../engine/ChoiceRequest';
import { buildAiDecisionContext } from '../../../engine/ai';
import { executePipeline } from '../../../engine/pipeline';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import { DiceThroneDomain } from '../domain';
import { getChoiceResolvedEventHandler } from '../domain/choiceResolvedEvents';
import { getCustomActionHandler, resolveEffectsToEvents, type EffectContext } from '../domain/effects';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { reduce } from '../domain/reducer';
import { diceThroneAiRuntime } from '../ai';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { checkPlayCard } from '../domain/rules';
import { getUsableTokensForTiming } from '../domain/tokenResponse';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import {
    buildDiceThroneTokenResponseChoiceCandidates,
    buildDiceThroneTokenResponseOpportunityId,
} from '../domain/timingOpportunities';
import { initHeroState } from '../domain/characters';
import { ANGELIC_CLOAK_2, DIVINE_PURIFICATION_2, DIVINE_PUNISHMENT_2, HOLY_BLADE_2, SUPREME_POWER_2, TIANSHI_ABILITIES } from '../heroes/tianshi/abilities';
import { TIANSHI_CARDS } from '../heroes/tianshi/cards';
import { TIANSHI_TOKENS } from '../heroes/tianshi/tokens';
import {
    createHeroMatchup,
    createQueuedRandom,
    getCardById,
    getCardInteractionPrompt,
    getMultistepChoicePrompt,
    getSimpleChoicePrompt,
    injectPendingInteraction,
    respondToPrompt,
    testSystems,
} from './test-utils';

const playerIds: PlayerId[] = ['0', '1'];

const command = (
    type: DiceThroneCommand['type'],
    playerId: PlayerId,
    payload: Record<string, unknown> = {},
): DiceThroneCommand => ({
    type,
    playerId,
    payload,
    timestamp: 100,
});

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore => (
    events.reduce((current, event) => reduce(current, event), core)
);

const createTianshiState = (random: RandomFn = createQueuedRandom([1])): MatchState<DiceThroneCore> => (
    createHeroMatchup('tianshi', 'monk')(playerIds, random)
);

const createTianshiThreePlayerState = (): MatchState<DiceThroneCore> => {
    const state = createTianshiState();
    state.core.players['2'] = initHeroState('2', 'barbarian', createQueuedRandom([1]));
    state.core.selectedCharacters['2'] = 'barbarian';
    return state;
};

const attachTokenResponseInteraction = (state: MatchState<DiceThroneCore>): void => {
    const pendingDamage = state.core.pendingDamage;
    if (!pendingDamage) {
        throw new Error('测试夹具缺少待处理伤害，无法构造 Token 响应选择合同');
    }

    const choiceRequest: ChoiceRequest = {
        requestId: buildDiceThroneTokenResponseOpportunityId(pendingDamage),
        playerId: pendingDamage.responderId,
        kind: 'choose-option',
        candidates: buildDiceThroneTokenResponseChoiceCandidates(state.core, pendingDamage),
        selection: { min: 1, max: 1 },
        resolution: { type: 'candidate-commands' },
        metadata: {
            pendingDamageId: pendingDamage.id,
            responseType: pendingDamage.responseType,
            responderId: pendingDamage.responderId,
            currentDamage: pendingDamage.currentDamage,
            originalDamage: pendingDamage.originalDamage,
        },
    };

    state.sys.interaction.current = {
        id: `dt-token-response-${pendingDamage.id}`,
        kind: 'dt:token-response',
        playerId: pendingDamage.responderId,
        data: { choiceRequestContract: choiceRequest },
    } satisfies InteractionDescriptor;
};

const setPlayerBoardFace = (
    state: MatchState<DiceThroneCore>,
    playerId: PlayerId,
    face: 'normal' | 'cursed',
): void => {
    state.core = applyEvents(state.core, [{
        type: 'PLAYER_BOARD_FACE_CHANGED',
        payload: { playerId, face, sourceAbilityId: 'test-setup' },
        sourceCommandType: 'TEST',
        timestamp: 90,
    } as DiceThroneEvent]);
};

const decideWithBaselineAi = async (
    state: MatchState<DiceThroneCore>,
    playerId: PlayerId = '0',
) => {
    const baselinePolicy = diceThroneAiRuntime.localPolicies?.baseline;
    if (!baselinePolicy) throw new Error('DiceThrone baseline AI policy is not registered.');
    const context = buildAiDecisionContext({
        gameId: 'dicethrone',
        matchId: 'tianshi-ai-targeting',
        playerId,
        visibleState: state,
        rulesVersion: null,
        decisionBudgetMs: 250,
        source: 'local',
        seatController: { type: 'local-ai', difficulty: 'expert' },
    });
    const decision = await baselinePolicy.decide(context);
    return {
        context,
        action: context.legalActions.find((action) => action.actionId === decision?.actionId),
    };
};

describe('炽天使领域行为', () => {
    it('选角初始化炽天使的骰面、九个技能和专属牌库', () => {
        const state = createTianshiState();
        const player = state.core.players['0'];

        expect(player.characterId).toBe('tianshi');
        expect(player.abilities).toHaveLength(9);
        expect(player.abilities.map(ability => ability.id)).toEqual([
            'holy-blade',
            'holy-radiance',
            'divine-purification',
            'divine-punishment',
            'triumphant-return',
            'supreme-power',
            'archangel-resolve',
            'angelic-cloak',
            'heavenly-severing',
        ]);
        expect(player.deck.some(card => card.id === 'card-tianshi-holy-strike')).toBe(true);
        expect(state.core.tokenDefinitions.find(token => token.id === TOKEN_IDS.FLIGHT)?.stackLimit).toBe(3);
        expect(state.core.tokenDefinitions.find(token => token.id === STATUS_IDS.DAZZLE)?.stackLimit).toBe(1);
    });

    it('飞行在当前掷骰阶段的伤害响应弹窗中可立即使用', () => {
        const state = createTianshiState();
        state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] = 1;
        const flight = TIANSHI_TOKENS.find((token) => token.id === TOKEN_IDS.FLIGHT);

        expect(flight?.activeUse?.timing).toEqual(['beforeDamageDealt', 'beforeDamageReceived', 'duringRoll']);
        expect(getUsableTokensForTiming(state.core, '0', 'beforeDamageDealt').map((token) => token.id))
            .toContain(TOKEN_IDS.FLIGHT);
        expect(getUsableTokensForTiming(state.core, '0', 'beforeDamageReceived').map((token) => token.id))
            .toContain(TOKEN_IDS.FLIGHT);
    });

    it('防御掷骰阶段刚获得的飞行投骰需确认后才收口', () => {
        const state = createTianshiState();
        state.sys.phase = 'defensiveRoll';
        state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] = 1;
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: true,
            damage: 7,
        };
        state.core.pendingDamage = {
            id: 'tianshi-flight-response',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 7,
            currentDamage: 7,
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        attachTokenResponseInteraction(state);

        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.FLIGHT, amount: 1, pendingDamageId: 'tianshi-flight-response' }),
            createQueuedRandom([6, 1]),
            playerIds,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] ?? 0).toBe(0);
        expect(result.state.core.pendingAttack?.defensiveFlightActivated).not.toBe(true);
        expect(result.state.core.pendingAttack?.isDefendable).toBe(true);
        expect(result.state.core.pendingDamage?.currentDamage).toBe(7);
        expect(result.events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_USED',
            payload: expect.objectContaining({
                tokenId: TOKEN_IDS.FLIGHT,
                effectType: 'evasionAttempt',
            }),
        }));
        expect(result.state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(result.state.core.currentRollContext).toMatchObject({
            kind: 'bonus',
            status: 'open',
            display: { replayOnly: false },
            dice: [{ value: 6 }, { value: 1 }],
        });

        const confirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            result.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(confirmed.success).toBe(true);
        if (!confirmed.success) return;
        expect(confirmed.state.core.pendingAttack?.defensiveFlightActivated).toBe(true);
        expect(confirmed.state.core.pendingDamage).toBeUndefined();
        expect(confirmed.state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(confirmed.state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(confirmed.state.core.currentRollContext).toMatchObject({
            kind: 'bonus',
            status: 'settled',
            display: { replayOnly: true },
            dice: [{ value: 6 }, { value: 1 }],
        });
    });

    it('智天使升级卡的费用应与卡面一致，为 3 CP', () => {
        const card = TIANSHI_CARDS.find(entry => entry.id === 'upgrade-tianshi-holy-blade-3-cherub-2');

        expect(card?.cpCost).toBe(3);
    });

    it.each([
        { cardId: 'upgrade-tianshi-supreme-power-2-gospel-arrival', targetAbilityId: 'supreme-power', expectedLevel: 2 },
        { cardId: 'upgrade-tianshi-divine-punishment-2-divine-command', targetAbilityId: 'divine-punishment', expectedLevel: 2 },
        { cardId: 'upgrade-tianshi-archangel-resolve-2-divine-protection', targetAbilityId: 'archangel-resolve', expectedLevel: 2 },
        { cardId: 'upgrade-tianshi-holy-radiance-2-takeoff', targetAbilityId: 'holy-radiance', expectedLevel: 2 },
        { cardId: 'upgrade-tianshi-holy-blade-3-cherub-2', targetAbilityId: 'holy-blade', expectedLevel: 3 },
        { cardId: 'upgrade-tianshi-holy-blade-2-cherub', targetAbilityId: 'holy-blade', expectedLevel: 2 },
    ])('复合升级牌 $cardId 打出时只替换技能，不立刻执行下半区技能', ({ cardId, targetAbilityId, expectedLevel }) => {
        const state = createTianshiState();
        const card = TIANSHI_CARDS.find(entry => entry.id === cardId);
        expect(card).toBeDefined();
        if (!card) return;
        state.sys.phase = 'main1';
        state.core.players['0'].hand = [card];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;

        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('PLAY_UPGRADE_CARD', '0', { cardId, targetAbilityId }),
            createQueuedRandom([1]),
            playerIds,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        const eventTypes = result.events.map(event => event.type);
        expect(eventTypes).toContain('ABILITY_REPLACED');
        expect(result.state.core.players['0'].abilityLevels[targetAbilityId]).toBe(expectedLevel);
        expect(result.state.core.players['0'].upgradeCardByAbilityId[targetAbilityId]?.cardId).toBe(cardId);
        expect(eventTypes).not.toContain('TOKEN_GRANTED');
        expect(eventTypes).not.toContain('STATUS_APPLIED');
        expect(eventTypes).not.toContain('DAMAGE_DEALT');
        expect(eventTypes).not.toContain('HEAL_APPLIED');
        expect(eventTypes).not.toContain('INTERACTION_REQUESTED');
        expect(eventTypes).not.toContain('CHOICE_REQUESTED');
        expect(eventTypes).not.toContain('BONUS_DICE_REROLL_REQUESTED');
        expect(eventTypes).not.toContain('BONUS_DIE_ROLLED');
    });

    it('圣洁光辉选定后不应自动跳过进攻阶段，显式推进后进入防御并结算伤害', () => {
        let state = createHeroMatchup('tianshi', 'moon_elf')(['0', '1'], createQueuedRandom([1]));
        const defenderHpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const flightBefore = state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] ?? 0;

        const toOffensiveRoll = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ADVANCE_PHASE', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(toOffensiveRoll.success).toBe(true);
        if (!toOffensiveRoll.success) return;
        state = toOffensiveRoll.state;

        const roll = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ROLL_DICE', '0'),
            createQueuedRandom([3, 5, 3, 3, 4]),
            playerIds,
        );
        expect(roll.success).toBe(true);
        if (!roll.success) return;
        state = roll.state;

        const confirm = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('CONFIRM_ROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(confirm.success).toBe(true);
        if (!confirm.success) return;
        state = confirm.state;

        const selectRadiance = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'holy-radiance' }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(selectRadiance.success).toBe(true);
        if (!selectRadiance.success) return;
        state = selectRadiance.state;

        expect(state.sys.phase).toBe('offensiveRoll');
        expect(state.sys.interaction?.current).toBeUndefined();
        expect(state.sys.responseWindow?.current).toBeUndefined();
        expect(state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-radiance',
            isDefendable: true,
        });

        const advanceToDefense = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ADVANCE_PHASE', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(advanceToDefense.success).toBe(true);
        if (!advanceToDefense.success) return;
        state = advanceToDefense.state;
        expect(state.sys.phase).toBe('defensiveRoll');
        expect(state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-radiance',
            isDefendable: true,
            defenseAbilityId: 'elusive-step',
        });
        expect(state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] ?? 0).toBe(flightBefore + 1);

        const defenseRoll = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ROLL_DICE', '1'),
            createQueuedRandom([1, 1, 1, 1, 1]),
            playerIds,
        );
        expect(defenseRoll.success).toBe(true);
        if (!defenseRoll.success) return;
        state = defenseRoll.state;

        const defenseConfirm = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('CONFIRM_ROLL', '1'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(defenseConfirm.success).toBe(true);
        if (!defenseConfirm.success) return;
        state = defenseConfirm.state;

        const tokenResponse = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ADVANCE_PHASE', '1'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(tokenResponse.success).toBe(true);
        if (!tokenResponse.success) return;
        state = tokenResponse.state;
        expect(state.core.pendingDamage).toMatchObject({
            sourceAbilityId: 'holy-radiance',
            targetPlayerId: '1',
            currentDamage: 6,
            responderId: '0',
        });
        const pendingDamageId = state.core.pendingDamage?.id;
        expect(pendingDamageId).toBeDefined();
        if (!pendingDamageId) return;

        const resolved = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SKIP_TOKEN_RESPONSE', '0', { pendingDamageId }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(resolved.success).toBe(true);
        if (!resolved.success) return;

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: 'DAMAGE_DEALT',
            payload: expect.objectContaining({
                sourceAbilityId: 'holy-radiance',
                targetId: '1',
                amount: 6,
            }),
        }));
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHpBefore - 6);
        expect(resolved.state.core.pendingAttack).toBeNull();
        expect(resolved.state.sys.phase).toBe('main2');
    });

    it('凯旋归来奖励骰掷出 6 后应保留基础伤害并以不可防御攻击结算', () => {
        let state = createHeroMatchup('tianshi', 'moon_elf')(['0', '1'], createQueuedRandom([1]));
        const defenderHpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;

        const toOffensiveRoll = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ADVANCE_PHASE', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(toOffensiveRoll.success).toBe(true);
        if (!toOffensiveRoll.success) return;
        state = toOffensiveRoll.state;

        const roll = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ROLL_DICE', '0'),
            createQueuedRandom([1, 2, 3, 4, 5]),
            playerIds,
        );
        expect(roll.success).toBe(true);
        if (!roll.success) return;
        state = roll.state;

        const confirm = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('CONFIRM_ROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(confirm.success).toBe(true);
        if (!confirm.success) return;
        state = confirm.state;

        const selected = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'triumphant-return' }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(selected.success).toBe(true);
        if (!selected.success) return;
        state = selected.state;
        expect(state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'triumphant-return',
        });

        const bonusOpened = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ADVANCE_PHASE', '0'),
            createQueuedRandom([6]),
            playerIds,
        );
        expect(bonusOpened.success).toBe(true);
        if (!bonusOpened.success) return;
        state = bonusOpened.state;
        expect(state.core.pendingBonusDiceSettlement).toMatchObject({
            sourceAbilityId: 'triumphant-return',
            attackerId: '0',
        });

        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(settled.success).toBe(true);
        if (!settled.success) return;

        expect(settled.events).toContainEqual(expect.objectContaining({
            type: 'ATTACK_MADE_UNDEFENDABLE',
            payload: expect.objectContaining({ attackerId: '0' }),
        }));
        expect(settled.events).toContainEqual(expect.objectContaining({
            type: 'ATTACK_RESOLVED',
            payload: expect.objectContaining({
                sourceAbilityId: 'triumphant-return',
                totalDamage: 6,
            }),
        }));
        expect(settled.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHpBefore - 6);
        expect(settled.state.core.pendingAttack).toBeNull();
        expect(settled.state.sys.phase).toBe('main2');
    });

    it.each([
        { name: '任一骰为 6 时激活', values: [6, 1], defendable: false },
        { name: '两骰都不是 6 时不激活', values: [5, 1], defendable: true },
    ])('进攻掷骰阶段飞行：$name', ({ values, defendable }) => {
        const state = createTianshiState();
        state.sys.phase = 'offensiveRoll';
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: true,
            damage: 8,
        };
        state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] = 1;

        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.FLIGHT, amount: 1 }),
            createQueuedRandom(values),
            playerIds,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.state.core.players['0'].tokens[TOKEN_IDS.FLIGHT]).toBe(0);
        expect(result.state.core.pendingAttack?.isDefendable).toBe(true);

        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            result.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(settled.success).toBe(true);
        if (!settled.success) return;
        expect(settled.state.core.pendingAttack?.isDefendable).toBe(defendable);
    });

    it.each([
        { value: 1, expectedPercent: 0, expectedMissed: true },
        { value: 2, expectedPercent: -50, expectedMissed: false },
        { value: 3, expectedPercent: -50, expectedMissed: false },
        { value: 4, expectedPercent: 0, expectedMissed: false },
        { value: 6, expectedPercent: 0, expectedMissed: false },
    ])('眩光判定 $value 点：按规则处理本次攻击并只消费一层', ({ value, expectedPercent, expectedMissed }) => {
        const state = createTianshiState();
        state.sys.phase = 'offensiveRoll';
        state.core.players['0'].statusEffects[STATUS_IDS.DAZZLE] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: false,
            damage: 8,
            preDefenseResolved: true,
        };

        const hookResult = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([value]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(hookResult) ? hookResult : (hookResult?.events ?? []);
        const afterCheck = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(events.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(true);
        expect(afterCheck.players['0'].statusEffects[STATUS_IDS.DAZZLE] ?? 0).toBe(0);

        const settlement = afterCheck.pendingBonusDiceSettlement;
        expect(settlement?.customResolutionId).toBe('tianshi-dazzle-check');

        const settledResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            { ...state, core: afterCheck },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([value]),
            playerIds,
        );
        expect(settledResult.success).toBe(true);
        if (!settledResult.success) return;
        const finalCore = settledResult.state.core;

        expect(finalCore.pendingAttack?.dazzleCheckMissed).toBe(expectedMissed);
        expect(finalCore.pendingAttack?.dazzleDamagePercent).toBe(expectedPercent);
    });

    it('致盲与眩光同时存在时先由攻击者选择判定顺序', () => {
        const state = createTianshiState();
        state.sys.phase = 'offensiveRoll';
        state.core.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
        state.core.players['0'].statusEffects[STATUS_IDS.DAZZLE] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: false,
            damage: 8,
            preDefenseResolved: true,
        };

        const hookResult = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([4, 4]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(hookResult) ? hookResult : (hookResult?.events ?? []);
        const choice = events.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));

        expect(choice?.payload.titleKey).toBe('choices.statusCheckOrder.title');
        expect(choice?.payload.options.map(option => option.customId)).toEqual([
            'status-check-order-dazzle-first',
            'status-check-order-blinded-first',
        ]);
        expect(events.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(false);

        const afterChoiceRequested = applyEvents(state.core, events as DiceThroneEvent[]);
        const afterChoice = reduce(afterChoiceRequested, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                customId: 'status-check-order-dazzle-first',
                sourceAbilityId: 'holy-blade-3',
                value: 1,
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);
        expect(afterChoice.pendingAttack?.statusCheckOrder).toBe('dazzleFirst');
    });

    it.each([
        {
            label: '眩光先',
            order: 'dazzleFirst' as const,
            resolvedPatch: { dazzleCheckResolved: true, dazzleCheckMissed: false, dazzleDamagePercent: 0 },
            expectedEffectKey: 'bonusDie.effect.blinded.hit',
            expectedStatusId: STATUS_IDS.BLINDED,
        },
        {
            label: '致盲先',
            order: 'blindedFirst' as const,
            resolvedPatch: { blindedCheckResolved: true, blindedCheckMissed: false },
            expectedEffectKey: 'bonusDie.effect.tianshi.dazzle',
            expectedStatusId: STATUS_IDS.DAZZLE,
        },
    ])('$label 判定成功后继续结算另一个状态', ({ order, resolvedPatch, expectedEffectKey, expectedStatusId }) => {
        const state = createTianshiState();
        state.sys.phase = 'offensiveRoll';
        state.core.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
        state.core.players['0'].statusEffects[STATUS_IDS.DAZZLE] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: false,
            damage: 8,
            preDefenseResolved: true,
            statusCheckOrder: order,
            ...resolvedPatch,
        };

        const hookResult = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([4]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(hookResult) ? hookResult : (hookResult?.events ?? []);

        expect(events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DIE_ROLLED',
            payload: expect.objectContaining({ effectKey: expectedEffectKey }),
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'STATUS_REMOVED',
            payload: expect.objectContaining({ statusId: expectedStatusId, stacks: 1 }),
        }));
    });

    it.each([
        { label: '攻击无效', dazzleCheckMissed: true, dazzleDamagePercent: 0, amount: undefined },
        { label: '伤害减半并向上取整', dazzleCheckMissed: false, dazzleDamagePercent: -50, amount: 3 },
        { label: '伤害正常', dazzleCheckMissed: false, dazzleDamagePercent: 0, amount: 5 },
    ])('眩光 $label 会作用于当前攻击伤害', ({ dazzleCheckMissed, dazzleDamagePercent, amount }) => {
        const state = createTianshiState();
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: false,
            damage: 5,
            dazzleCheckResolved: true,
            dazzleCheckMissed,
            dazzleDamagePercent,
        };
        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'holy-blade');
        const effects = ability?.variants?.find(variant => variant.id === 'holy-blade-3')?.effects ?? [];
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-blade-3',
            state: state.core,
            damageDealt: 0,
            timestamp: 200,
        };

        const events = resolveEffectsToEvents(effects, 'withDamage', context, { random: createQueuedRandom([1]) });
        const damageEvents = events.filter((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => (
            event.type === 'DAMAGE_DEALT'
        ));

        if (amount === undefined) {
            expect(damageEvents).toHaveLength(0);
        } else {
            expect(damageEvents).toHaveLength(1);
            expect(damageEvents[0].payload.amount).toBe(amount);
        }
    });

    it('防御掷骰阶段飞行成功时让本次主攻击完全免伤', () => {
        const state = createTianshiState();
        state.sys.phase = 'defensiveRoll';
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: true,
            damage: 5,
        };
        state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] = 1;

        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.FLIGHT, amount: 1 }),
            createQueuedRandom([6, 1]),
            playerIds,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.state.core.pendingAttack?.defensiveFlightActivated).not.toBe(true);

        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            result.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(settled.success).toBe(true);
        if (!settled.success) return;
        expect(settled.state.core.pendingAttack?.defensiveFlightActivated).toBe(true);

        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'holy-blade');
        const effects = ability?.variants?.find(variant => variant.id === 'holy-blade-3')?.effects ?? [];
        const events = resolveEffectsToEvents(effects, 'withDamage', {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'holy-blade-3',
            state: settled.state.core,
            damageDealt: 0,
            timestamp: 210,
        }, { random: createQueuedRandom([1]) });

        expect(events.some(event => event.type === 'DAMAGE_DEALT')).toBe(false);
    });

    it('神圣降临按层数伤害所有真实对手，不伤害持有者自己', () => {
        const state = createTianshiState();
        state.core.players['2'] = initHeroState('2', 'barbarian', createQueuedRandom([1]));
        state.core.selectedCharacters['2'] = 'barbarian';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.DIVINE_ARRIVAL] = 2;

        const hookResult = diceThroneFlowHooks.onPhaseEnter?.({
            state,
            from: 'income',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]);
        const events = Array.isArray(hookResult) ? hookResult : [];
        const damageEvents = events.filter((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => (
            event.type === 'DAMAGE_DEALT'
        ));

        expect(damageEvents.map(event => [event.payload.targetId, event.payload.amount])).toEqual([
            ['1', 2],
            ['2', 2],
        ]);
        expect(damageEvents.some(event => event.payload.targetId === '0')).toBe(false);
    });

    it('神圣降临的直接伤害会触发对手的神圣祝福致死保护', () => {
        const state = createTianshiThreePlayerState();
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.DIVINE_ARRIVAL] = 1;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 1;
        state.core.players['1'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] = 1;

        const hookResult = diceThroneFlowHooks.onPhaseEnter?.({
            state,
            from: 'income',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]);
        const events = Array.isArray(hookResult) ? hookResult : [];
        const after = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(events).toContainEqual(expect.objectContaining({
            type: 'DAMAGE_DEALT',
            payload: expect.objectContaining({
                targetId: '1',
                amount: 1,
            }),
        }));
        expect(events.some(event => event.type === 'PREVENT_DAMAGE')).toBe(false);
        expect(after.players['1'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0).toBe(0);
        expect(after.players['1'].resources[RESOURCE_IDS.HP]).toBe(1);
    });

    it.each([
        { label: '基础版', damage: 5 },
        { label: '升级版', damage: 6 },
    ])('神圣净化 $label 选择对手造成不可防御伤害，并进入可移除状态交互', ({ label, damage }) => {
        const state = createTianshiState();
        state.core.players['1'].statusEffects[STATUS_IDS.POISON] = 1;
        const ability = damage === 6
            ? DIVINE_PURIFICATION_2
            : TIANSHI_ABILITIES.find(entry => entry.id === 'divine-purification');
        const effects = ability?.effects ?? [];
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'divine-purification',
            state: state.core,
            damageDealt: 0,
            timestamp: 300,
        };

        const choiceEvents = resolveEffectsToEvents(effects, 'preDefense', context, {
            random: createQueuedRandom([1]),
        });
        const choiceEvent = choiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(choiceEvent).toBeDefined();
        if (!choiceEvent) return;

        const customId = choiceEvent.payload.options[1]?.customId;
        expect(customId).toBe(label === '升级版' ? 'tianshi-divine-purification-target-2' : 'tianshi-divine-purification-target');
        if (!customId) return;

        const resolveChoice = getChoiceResolvedEventHandler(customId);
        expect(resolveChoice).toBeDefined();
        if (!resolveChoice) return;
        const resolvedEvents = resolveChoice({
            state: state.core,
            playerId: '0',
            customId,
            sourceAbilityId: 'divine-purification',
            value: 1,
            timestamp: 301,
        });
        const damageEvent = resolvedEvents.find((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => (
            event.type === 'DAMAGE_DEALT'
        ));
        expect(damageEvent?.payload.amount).toBe(damage);
        expect(damageEvent?.payload.unblockable).toBe(true);

        const interactionEvent = resolvedEvents.find((event): event is Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }> => (
            event.type === 'INTERACTION_REQUESTED'
        ));
        expect(interactionEvent?.payload.interaction.type).toBe('selectStatus');
        if (!interactionEvent) return;
        injectPendingInteraction(state, interactionEvent.payload.interaction);

        const removeResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('REMOVE_STATUS', '1', {
                targetPlayerId: '1',
                statusId: STATUS_IDS.POISON,
            }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(removeResult.success).toBe(true);
        if (removeResult.success) {
            expect(removeResult.state.core.players['1'].statusEffects[STATUS_IDS.POISON] ?? 0).toBe(0);
        }
    });

    it('神圣净化等待目标玩家先花费净化，再继续选择要移除的状态', () => {
        const state = createTianshiState();
        state.core.players['1'].tokens[TOKEN_IDS.PURIFY] = 1;
        state.core.players['1'].statusEffects[STATUS_IDS.POISON] = 1;
        state.core.players['1'].statusEffects[STATUS_IDS.BIND] = 1;

        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'divine-purification');
        const choiceEvents = resolveEffectsToEvents(ability?.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'divine-purification',
            state: state.core,
            damageDealt: 0,
            timestamp: 320,
        }, { random: createQueuedRandom([1]) });
        const choiceEvent = choiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        const customId = choiceEvent?.payload.options[1]?.customId;
        expect(customId).toBe('tianshi-divine-purification-target');
        if (!customId) return;

        const resolveChoice = getChoiceResolvedEventHandler(customId);
        expect(resolveChoice).toBeDefined();
        if (!resolveChoice) return;
        const resolvedEvents = resolveChoice({
            state: state.core,
            playerId: '0',
            customId,
            sourceAbilityId: 'divine-purification',
            value: 1,
            timestamp: 321,
        });
        const interactionEvent = resolvedEvents.find((event): event is Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }> => (
            event.type === 'INTERACTION_REQUESTED'
        ));
        expect(interactionEvent?.payload.interaction.type).toBe('selectStatus');
        if (!interactionEvent) return;
        injectPendingInteraction(state, interactionEvent.payload.interaction);

        const purifyResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('USE_PURIFY', '1', { statusId: STATUS_IDS.POISON }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(purifyResult.success).toBe(true);
        if (!purifyResult.success) return;
        expect(purifyResult.state.core.players['1'].tokens[TOKEN_IDS.PURIFY] ?? 0).toBe(0);
        expect(purifyResult.state.core.players['1'].statusEffects[STATUS_IDS.POISON] ?? 0).toBe(0);
        expect(getCardInteractionPrompt(purifyResult.state, 'divine-purification').type).toBe('selectStatus');

        const removeResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            purifyResult.state,
            command('REMOVE_STATUS', '1', {
                targetPlayerId: '1',
                statusId: STATUS_IDS.BIND,
            }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(removeResult.success).toBe(true);
        if (!removeResult.success) return;
        expect(removeResult.state.core.players['1'].statusEffects[STATUS_IDS.BIND] ?? 0).toBe(0);
        expect(() => getCardInteractionPrompt(removeResult.state, 'divine-purification')).toThrow(
            'Expected a card-interaction prompt, but none was active.',
        );
    });

    it('神圣净化移除状态前，目标玩家可以用瞬时行动牌打断', () => {
        const state = createTianshiState();
        const target = state.core.players['1'];
        target.statusEffects[STATUS_IDS.POISON] = 1;
        target.statusEffects[STATUS_IDS.BIND] = 1;
        target.resources[RESOURCE_IDS.CP] = 2;
        target.hand = [getCardById('card-bye-bye')];
        target.deck = target.deck.filter(card => card.id !== 'card-bye-bye');

        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'divine-purification');
        const choiceEvents = resolveEffectsToEvents(ability?.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'divine-purification',
            state: state.core,
            damageDealt: 0,
            timestamp: 340,
        }, { random: createQueuedRandom([1]) });
        const targetChoice = choiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(targetChoice).toBeDefined();
        if (!targetChoice) return;

        const customId = targetChoice.payload.options[1]?.customId;
        expect(customId).toBe('tianshi-divine-purification-target');
        if (!customId) return;
        const resolveChoice = getChoiceResolvedEventHandler(customId);
        expect(resolveChoice).toBeDefined();
        if (!resolveChoice) return;
        const resolvedEvents = resolveChoice({
            state: state.core,
            playerId: '0',
            customId,
            sourceAbilityId: 'divine-purification',
            value: 1,
            timestamp: 341,
        });
        const purificationInteraction = resolvedEvents.find((event): event is Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }> => (
            event.type === 'INTERACTION_REQUESTED'
        ));
        expect(purificationInteraction?.payload.interaction.type).toBe('selectStatus');
        if (!purificationInteraction) return;
        injectPendingInteraction(state, purificationInteraction.payload.interaction);

        const playByeBye = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('PLAY_CARD', '1', { cardId: 'card-bye-bye' }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(playByeBye.success).toBe(true);
        if (!playByeBye.success) return;
        expect(playByeBye.state.core.players['1'].discard.map(card => card.id)).toContain('card-bye-bye');
        expect(getCardInteractionPrompt(playByeBye.state, 'card-bye-bye').type).toBe('selectStatus');

        const removeWithCard = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            playByeBye.state,
            command('REMOVE_STATUS', '1', {
                targetPlayerId: '1',
                statusId: STATUS_IDS.POISON,
            }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(removeWithCard.success).toBe(true);
        if (!removeWithCard.success) return;
        expect(removeWithCard.state.core.players['1'].statusEffects[STATUS_IDS.POISON] ?? 0).toBe(0);
        expect(getCardInteractionPrompt(removeWithCard.state, 'divine-purification').type).toBe('selectStatus');
    });

    it.each([
        { label: '基础版', heal: 4 },
        { label: '升级版', heal: 5 },
    ])('神圣净化 $label 选择自己治疗，并进入自身状态移除交互', ({ label, heal }) => {
        const state = createTianshiState();
        state.core.players['0'].statusEffects[STATUS_IDS.POISON] = 1;
        const ability = heal === 5
            ? DIVINE_PURIFICATION_2
            : TIANSHI_ABILITIES.find(entry => entry.id === 'divine-purification');
        const effects = ability?.effects ?? [];
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'divine-purification',
            state: state.core,
            damageDealt: 0,
            timestamp: 400,
        };

        const choiceEvents = resolveEffectsToEvents(effects, 'preDefense', context, {
            random: createQueuedRandom([1]),
        });
        const choiceEvent = choiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(choiceEvent).toBeDefined();
        if (!choiceEvent) return;

        const customId = choiceEvent.payload.options[0]?.customId;
        expect(customId).toBe(label === '升级版' ? 'tianshi-divine-purification-target-2' : 'tianshi-divine-purification-target');
        if (!customId) return;

        const resolveChoice = getChoiceResolvedEventHandler(customId);
        expect(resolveChoice).toBeDefined();
        if (!resolveChoice) return;
        const resolvedEvents = resolveChoice({
            state: state.core,
            playerId: '0',
            customId,
            sourceAbilityId: 'divine-purification',
            value: 0,
            timestamp: 401,
        });

        expect(resolvedEvents.some(event => event.type === 'DAMAGE_DEALT')).toBe(false);
        expect(resolvedEvents).toContainEqual(expect.objectContaining({
            type: 'HEAL_APPLIED',
            payload: expect.objectContaining({ targetId: '0', amount: heal }),
        }));
        const interactionEvent = resolvedEvents.find((event): event is Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }> => (
            event.type === 'INTERACTION_REQUESTED'
        ));
        expect(interactionEvent?.payload.interaction.type).toBe('selectStatus');
        expect(interactionEvent?.payload.interaction.targetPlayerIds).toEqual(['0']);
    });

    it('神圣净化选择自己时先治疗清状态，之后仍触发咒缚海盗火药桶', () => {
        let state = createHeroMatchup('tianshi', 'cursed_pirate')(['0', '1'], createQueuedRandom([1]));
        setPlayerBoardFace(state, '1', 'cursed');
        state.core.players['0'].statusEffects[STATUS_IDS.POISON] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 40;

        const toOffensiveRoll = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ADVANCE_PHASE', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(toOffensiveRoll.success).toBe(true);
        if (!toOffensiveRoll.success) return;
        state = toOffensiveRoll.state;

        const roll = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ROLL_DICE', '0'),
            createQueuedRandom([5, 5, 6, 1, 1]),
            playerIds,
        );
        expect(roll.success).toBe(true);
        if (!roll.success) return;
        state = roll.state;

        const confirm = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('CONFIRM_ROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(confirm.success).toBe(true);
        if (!confirm.success) return;
        state = confirm.state;

        const selectAbility = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'divine-purification' }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(selectAbility.success).toBe(true);
        if (!selectAbility.success) return;
        state = selectAbility.state;

        const preDefense = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ADVANCE_PHASE', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(preDefense.success).toBe(true);
        if (!preDefense.success) return;

        const targetPrompt = getSimpleChoicePrompt(preDefense.state, 'divine-purification');
        const selfOption = targetPrompt.options.find(option => option.value.value === 0);
        expect(selfOption).toBeDefined();
        if (!selfOption) return;

        const selfChoice = respondToPrompt(preDefense.state, selfOption.id, '0', createQueuedRandom([1]), playerIds);
        expect(selfChoice.success).toBe(true);
        if (!selfChoice.success) return;
        expect(selfChoice.events).toContainEqual(expect.objectContaining({
            type: 'HEAL_APPLIED',
            payload: expect.objectContaining({ targetId: '0', amount: 4 }),
        }));
        expect(getCardInteractionPrompt(selfChoice.state, 'divine-purification').type).toBe('selectStatus');

        const removeStatus = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            selfChoice.state,
            command('REMOVE_STATUS', '0', {
                targetPlayerId: '0',
                statusId: STATUS_IDS.POISON,
            }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(removeStatus.success).toBe(true);
        if (!removeStatus.success) return;

        const allEvents = [...selfChoice.events, ...removeStatus.events];
        const healIndex = allEvents.findIndex(event => event.type === 'HEAL_APPLIED');
        const removeIndex = allEvents.findIndex(event => (
            event.type === 'STATUS_REMOVED'
            && event.payload.targetId === '0'
            && event.payload.statusId === STATUS_IDS.POISON
        ));
        const powderIndex = allEvents.findIndex(event => (
            event.type === 'STATUS_APPLIED'
            && event.payload.targetId === '0'
            && event.payload.statusId === STATUS_IDS.POWDER_KEG
        ));
        expect(healIndex).toBeGreaterThanOrEqual(0);
        expect(removeIndex).toBeGreaterThan(healIndex);
        expect(powderIndex).toBeGreaterThan(removeIndex);
        expect(removeStatus.state.sys.phase).toBe('main2');
        expect(removeStatus.state.core.players['0'].statusEffects[STATUS_IDS.POWDER_KEG] ?? 0).toBe(1);
    });

    it('神圣净化只面对正面飞行标记时不应把飞行列入负面状态移除交互', () => {
        const state = createTianshiState();
        state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] = 1;
        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'divine-purification');
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'divine-purification',
            state: state.core,
            damageDealt: 0,
            timestamp: 430,
        };

        const choiceEvents = resolveEffectsToEvents(ability?.effects ?? [], 'preDefense', context, {
            random: createQueuedRandom([1]),
        });
        const choiceEvent = choiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(choiceEvent).toBeDefined();
        if (!choiceEvent) return;

        const customId = choiceEvent.payload.options[0]?.customId;
        expect(customId).toBe('tianshi-divine-purification-target');
        if (!customId) return;

        const resolveChoice = getChoiceResolvedEventHandler(customId);
        expect(resolveChoice).toBeDefined();
        if (!resolveChoice) return;
        const resolvedEvents = resolveChoice({
            state: state.core,
            playerId: '0',
            customId,
            sourceAbilityId: 'divine-purification',
            value: 0,
            timestamp: 431,
        });

        expect(resolvedEvents.some(event => event.type === 'INTERACTION_REQUESTED')).toBe(false);
    });

    it.each([
        { label: '基础版', ability: TIANSHI_ABILITIES.find(entry => entry.id === 'divine-punishment'), damagePerBlade: 2 },
        { label: '升级版', ability: DIVINE_PUNISHMENT_2, damagePerBlade: 2 },
    ])('神圣惩戒 $label 先额外投 4 骰，再按额外骰面完成最终结算', ({ ability, damagePerBlade }) => {
        const state = createTianshiState();
        const initialHp = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'divine-punishment',
            state: state.core,
            damageDealt: 0,
            timestamp: 450,
        };

        const events = resolveEffectsToEvents(ability?.effects ?? [], 'preDefense', context, {
            random: createQueuedRandom([1, 4, 5, 6]),
        });
        const bonusDice = events.filter((event): event is Extract<DiceThroneEvent, { type: 'BONUS_DIE_ROLLED' }> => (
            event.type === 'BONUS_DIE_ROLLED'
        ));
        expect(bonusDice).toHaveLength(4);
        expect(bonusDice.map(event => event.payload.value)).toEqual([1, 4, 5, 6]);

        const afterRoll = applyEvents(state.core, events);
        expect(afterRoll.players['1'].resources[RESOURCE_IDS.HP]).toBe(initialHp);
        expect(afterRoll.pendingBonusDiceSettlement?.dice).toHaveLength(4);
        expect(afterRoll.pendingBonusDiceSettlement?.maxRerollCount).toBe(0);
        expect(afterRoll.pendingBonusDiceSettlement?.allowDiceModification).toBe(true);

        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            { ...state, core: afterRoll },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(settled.success).toBe(true);
        if (settled.success) {
            expect(settled.state.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(settled.events).toContainEqual(expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({ targetId: '1', amount: damagePerBlade, unblockable: true }),
            }));
            expect(settled.events).toContainEqual(expect.objectContaining({
                type: 'TOKEN_GRANTED',
                payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.FLIGHT, amount: 1 }),
            }));
            expect(settled.events).toContainEqual(expect.objectContaining({
                type: 'TOKEN_GRANTED',
                payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.PURIFY, amount: 1 }),
            }));
            expect(settled.events).toContainEqual(expect.objectContaining({
                type: 'STATUS_APPLIED',
                payload: expect.objectContaining({ targetId: '1', statusId: STATUS_IDS.DAZZLE, stacks: 1 }),
            }));
            expect(settled.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(initialHp - damagePerBlade);
        }
    });

    it('福音临世作为升级后技能分支时，只有一名合法对手也保留玩家目标选择', () => {
        const state = createTianshiState();
        const variant = SUPREME_POWER_2.variants?.find(entry => entry.id === 'gospel-arrival');
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: variant?.id ?? 'gospel-arrival',
            state: state.core,
            damageDealt: 0,
            timestamp: 550,
        };

        const events = resolveEffectsToEvents(variant?.effects ?? [], 'preDefense', context);
        const interaction = events.find((event): event is Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }> => (
            event.type === 'INTERACTION_REQUESTED'
        ));
        expect(interaction?.payload.interaction.targetPlayerIds).toEqual(['1']);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.DIVINE_ARRIVAL, amount: 1 }),
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.FLIGHT, amount: 2 }),
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.PURIFY, amount: 2 }),
        }));
        expect(events.some(event => event.type === 'STATUS_APPLIED')).toBe(false);

        const resolver = getCustomActionHandler('tianshi-gospel-arrival-target');
        expect(resolver).toBeDefined();
        if (!resolver) return;
        const resolved = resolver({
            ctx: context,
            targetId: '1',
            attackerId: '0',
            sourceAbilityId: context.sourceAbilityId,
            state: state.core,
            timestamp: 551,
            action: { type: 'custom', target: 'self', customActionId: 'tianshi-gospel-arrival-target' },
        });
        expect(resolved).toContainEqual(expect.objectContaining({
            type: 'STATUS_APPLIED',
            payload: expect.objectContaining({ targetId: '1', statusId: STATUS_IDS.DAZZLE, stacks: 1 }),
        }));
    });

    it('AI 打出飞升时应把飞行给自己而不是敌人', async () => {
        let state = createTianshiState();
        const ascension = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-ascension');
        if (!ascension) throw new Error('缺少飞升卡牌定义');
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].hand = [ascension];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;

        const played = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('PLAY_CARD', '0', { cardId: ascension.id }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(played.success).toBe(true);
        if (!played.success) return;
        state = played.state;

        const prompt = getCardInteractionPrompt(state, ascension.id);
        expect(prompt.targetPlayerIds).toEqual(['0', '1']);
        expect(prompt.tokenGrantConfig).toEqual({ tokenId: TOKEN_IDS.FLIGHT, amount: 1 });

        const { action } = await decideWithBaselineAi(state, '0');
        expect(action?.kind).toBe('interaction-select-player');
        expect(action?.commands[0]).toMatchObject({
            type: 'RESOLVE_INTERACTION',
            payload: { selectedPlayerIds: ['0'] },
        });
    });

    it('至高圣洁投出非圣洁吊坠时抽一张牌，而不是获得飞行和净化', () => {
        const state = createTianshiState();
        const card = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-supreme-holiness');
        const drawCard = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-ascension');
        state.core.players['0'].hand = [];
        state.core.players['0'].deck = drawCard ? [drawCard] : [];
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: card?.id ?? 'card-tianshi-supreme-holiness',
            state: state.core,
            damageDealt: 0,
            timestamp: 560,
        };

        const events = resolveEffectsToEvents(card?.effects ?? [], 'immediate', context, {
            random: createQueuedRandom([1]),
        });
        expect(events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DIE_ROLLED',
            payload: expect.objectContaining({ value: 1, face: 'blade' }),
        }));
        expect(events.filter(event => event.type === 'CARD_DRAWN')).toHaveLength(0);
        expect(events.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.FLIGHT)).toBe(false);
        expect(events.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.PURIFY)).toBe(false);

        const afterRoll = applyEvents(state.core, events);
        expect(afterRoll.pendingBonusDiceSettlement).toMatchObject({
            allowDiceModification: true,
            maxRerollCount: 0,
            dice: [{ value: 1, face: 'blade' }],
        });

        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            { ...state, core: afterRoll },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(settled.success).toBe(true);
        if (!settled.success) return;
        expect(settled.state.core.players['0'].hand.map(cardEntry => cardEntry.id)).toEqual(['card-tianshi-ascension']);
        expect(settled.state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] ?? 0).toBe(0);
        expect(settled.state.core.players['0'].tokens[TOKEN_IDS.PURIFY] ?? 0).toBe(0);
    });

    it('至高圣洁没有可用改骰牌时也必须普通确认右侧奖励骰盘后结算', () => {
        const state = createTianshiState();
        const supremeHoliness = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-supreme-holiness');
        if (!supremeHoliness) throw new Error('缺少至高圣洁卡牌定义');
        state.sys.phase = 'main1';
        state.core.players['0'].hand = [supremeHoliness];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 2;

        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('PLAY_CARD', '0', { cardId: supremeHoliness.id }),
            createQueuedRandom([6]),
            playerIds,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.state.core.pendingBonusDiceSettlement).toMatchObject({
            displayOnly: true,
            allowDiceModification: true,
            dice: [{ value: 6 }],
        });
        expect(result.state.core.currentRollContext).toMatchObject({
            kind: 'bonus',
            status: 'open',
        });
        expect(result.state.sys.interaction?.current?.kind).toBe('dt:bonus-dice');
        expect(result.state.sys.responseWindow?.current).toBeUndefined();
        expect(result.state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] ?? 0).toBe(0);
        expect(result.state.core.players['0'].tokens[TOKEN_IDS.PURIFY] ?? 0).toBe(0);

        const confirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            result.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(confirmed.success).toBe(true);
        if (!confirmed.success) return;
        expect(confirmed.state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(confirmed.state.core.players['0'].tokens[TOKEN_IDS.FLIGHT]).toBe(2);
        expect(confirmed.state.core.players['0'].tokens[TOKEN_IDS.PURIFY]).toBe(2);
    });

    it('至高圣洁在主要阶段掷出奖励骰时，不会放开来个六', () => {
        const state = createTianshiState();
        const supremeHoliness = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-supreme-holiness');
        const playSix = getCardById('card-play-six');
        if (!supremeHoliness) throw new Error('缺少至高圣洁卡牌定义');
        state.sys.phase = 'main1';
        state.core.players['0'].hand = [supremeHoliness, playSix];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 2;

        const rolled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('PLAY_CARD', '0', { cardId: supremeHoliness.id }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(rolled.success).toBe(true);
        if (!rolled.success) return;
        expect(rolled.state.core.pendingBonusDiceSettlement?.dice).toMatchObject([{ value: 1 }]);
        expect(rolled.state.sys.interaction?.current).toMatchObject({
            kind: 'dt:bonus-dice',
            playerId: '0',
        });
        expect(checkPlayCard(
            rolled.state.core,
            '0',
            playSix,
            'main1',
        )).toEqual({ ok: false, reason: 'wrongPhaseForRoll' });
    });

    it('至高圣洁在主要阶段产生的奖励骰不能让来个六越过阶段限制', () => {
        const state = createTianshiState();
        const supremeHoliness = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-supreme-holiness');
        const playSix = getCardById('card-play-six');
        state.core.players['0'].hand = [playSix];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 2;
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: supremeHoliness?.id ?? 'card-tianshi-supreme-holiness',
            state: state.core,
            damageDealt: 0,
            timestamp: 570,
        };

        const rollEvents = resolveEffectsToEvents(supremeHoliness?.effects ?? [], 'immediate', context, {
            random: createQueuedRandom([1]),
        });
        const afterRoll = applyEvents(state.core, rollEvents);
        expect(afterRoll.currentRollContext).toMatchObject({
            kind: 'bonus',
            dice: [{ value: 1 }],
            policy: { allowDiceCardTargeting: true },
        });

        const playSixResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            { ...state, core: afterRoll },
            command('PLAY_CARD', '0', { cardId: 'card-play-six' }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(playSixResult.success).toBe(false);
        if (playSixResult.success) return;
        expect(playSixResult.error).toBe('wrongPhaseForRoll');
        expect(playSixResult.state.core.players['0'].hand).toMatchObject([{ id: 'card-play-six' }]);
    });

    it('圣刃 II / 智天使作为升级后技能分支时，只获得飞行和神圣降临，不额外获得净化', () => {
        const state = createTianshiState();
        const variant = HOLY_BLADE_2.variants?.find(entry => entry.id === 'cherub');
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: variant?.id ?? 'cherub',
            state: state.core,
            damageDealt: 0,
            timestamp: 565,
        };

        const events = resolveEffectsToEvents(variant?.effects ?? [], 'preDefense', context);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.FLIGHT, amount: 1 }),
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.DIVINE_ARRIVAL, amount: 1 }),
        }));
        expect(events.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.PURIFY)).toBe(false);
    });

    it('起飞的不可防御直接伤害仍会触发目标的神圣祝福致死保护', () => {
        const state = createTianshiState();
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 2;
        state.core.players['1'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] = 1;
        const resolver = getCustomActionHandler('tianshi-takeoff-target');
        expect(resolver).toBeDefined();
        if (!resolver) return;

        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'upgrade-tianshi-holy-radiance-2-takeoff',
            state: state.core,
            damageDealt: 0,
            timestamp: 570,
        };
        const events = resolver({
            ctx: context,
            targetId: '1',
            attackerId: '0',
            sourceAbilityId: context.sourceAbilityId,
            state: state.core,
            timestamp: 570,
            action: { type: 'custom', target: 'self', customActionId: 'tianshi-takeoff-target' },
        });

        const after = applyEvents(state.core, events);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'DAMAGE_DEALT',
            payload: expect.objectContaining({
                targetId: '1',
                amount: 3,
            }),
        }));
        expect(events.some(event => event.type === 'PREVENT_DAMAGE')).toBe(false);
        expect(after.players['1'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0).toBe(0);
        expect(after.players['1'].resources[RESOURCE_IDS.HP]).toBe(1);
    });

    it.each([
        { value: 1, expectedDamage: 2 },
        { value: 4, expectedFlight: 1 },
        { value: 5, expectedShield: 2 },
        { value: 6, expectedShield: 3 },
    ])('天使斗篷普通防御骰面 $value 落到正确的防御结果', ({ value, expectedDamage, expectedFlight, expectedShield }) => {
        const state = createTianshiState();
        state.sys.phase = 'defensiveRoll';
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: true,
            damage: 5,
        };
        state.core.rollCount = 1;
        state.core.rollDiceCount = 1;
        state.core.currentRollContext = {
            kind: 'defensive',
            phase: 'defensiveRoll',
            ownerPlayerId: '0',
            dice: [{ ...state.core.dice[0], id: 0, value, ownerId: '0' }],
            status: 'settling',
            policy: { blocksPhaseFlow: true, allowReroll: true, allowModification: true },
            display: { surface: 'diceTray', replayOnly: false },
        } as any;
        state.core.dice = state.core.currentRollContext.dice;
        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'angelic-cloak');
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'angelic-cloak',
            state: state.core,
            damageDealt: 5,
            timestamp: 580,
            isDefensiveContext: true,
        };

        const events = resolveEffectsToEvents(ability?.effects ?? [], 'withDamage', context);
        expect(events.some(event => event.type === 'BONUS_DICE_REROLL_REQUESTED')).toBe(false);
        const settled = { events, state: { ...state, core: applyEvents(state.core, events) } };
        if (expectedDamage !== undefined) {
            expect(settled.events).toContainEqual(expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({ targetId: '1', amount: expectedDamage, unblockable: true }),
            }));
        }
        if (expectedFlight !== undefined) {
            expect(settled.events).toContainEqual(expect.objectContaining({
                type: 'TOKEN_GRANTED',
                payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.FLIGHT, amount: expectedFlight }),
            }));
        }
        if (expectedShield !== undefined) {
            expect(settled.events).toContainEqual(expect.objectContaining({
                type: 'DAMAGE_SHIELD_GRANTED',
                payload: expect.objectContaining({ targetId: '0', value: expectedShield }),
            }));
        }
    });

    it('防御阶段先选择天使斗篷后，飞行失败不会取消已激活的防御能力，且需确认骰面', () => {
        let state = createTianshiState();
        state.sys.phase = 'defensiveRoll';
        state.sys.currentPlayerIndex = 1;
        state.core.activePlayerId = '1';
        state.core.turnPhase = 'defensiveRoll';
        state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] = 1;
        state.core.players['1'].hand = [getCardById('card-give-hand')];
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 10;
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: true,
            damage: 5,
        };

        const selectDefense = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'angelic-cloak' }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(selectDefense.success).toBe(true);
        if (!selectDefense.success) return;
        state = selectDefense.state;
        expect(state.core.pendingAttack?.defenseAbilityId).toBe('angelic-cloak');
        state.core.rollCount = 1;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.dice = state.core.dice.map((die, index) => ({
            ...die,
            id: index,
            value: [3, 3, 3, 3, 3][index] ?? 3,
            ownerId: '0',
        }));
        state.sys.responseWindow = {
            current: {
                windowId: 'afterRollConfirmed-defense-flight',
                responderQueue: ['1'],
                currentResponderIndex: 0,
                windowType: 'afterRollConfirmed',
                sourceId: 'defense-roll-confirmed-before-flight',
            } as any,
        };

        const flight = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.FLIGHT, amount: 1 }),
            createQueuedRandom([1, 2]),
            playerIds,
        );
        expect(flight.success).toBe(true);
        if (!flight.success) return;
        expect(flight.events.filter(event => event.type === 'BONUS_DIE_ROLLED').map(event => event.payload.value)).toEqual([1, 2]);
        expect(flight.events.some(event => event.type === 'PENDING_ATTACK_UPDATED')).toBe(false);
        expect(flight.state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] ?? 0).toBe(0);
        expect(flight.state.core.pendingAttack?.defenseAbilityId).toBe('angelic-cloak');
        expect(flight.state.core.pendingAttack?.defensiveFlightActivated).not.toBe(true);
        expect(flight.state.core.currentRollContext).toMatchObject({
            kind: 'bonus',
            status: 'open',
            display: { replayOnly: false },
            dice: [{ value: 1 }, { value: 2 }],
        });
        expect(flight.state.sys.responseWindow?.current?.windowType).toBe('afterRollConfirmed');
        expect(flight.state.sys.interaction?.current).toMatchObject({
            kind: 'dt:bonus-dice',
            playerId: '0',
        });

        const confirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            flight.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(confirmed.success).toBe(true);
        if (!confirmed.success) return;
        expect(confirmed.state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(confirmed.state.core.currentRollContext).toMatchObject({
            kind: 'defensive',
            ownerPlayerId: '0',
            status: 'settling',
            display: { replayOnly: false },
            dice: [{ value: 3 }, { value: 3 }, { value: 3 }, { value: 3 }, { value: 3 }],
        });
        expect(confirmed.state.sys.responseWindow?.current?.windowType).toBe('afterRollConfirmed');

        const giveHand = getCardById('card-give-hand');
        expect(checkPlayCard(confirmed.state.core, '1', giveHand, 'defensiveRoll', 'afterRollConfirmed')).toEqual({ ok: true });

        const played = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            confirmed.state,
            command('PLAY_CARD', '1', { cardId: 'card-give-hand' }),
            createQueuedRandom([6]),
            playerIds,
        );
        expect(played.success).toBe(true);
        if (!played.success) return;
        const rerollPrompt = getMultistepChoicePrompt(played.state);
        expect(rerollPrompt.playerId).toBe('1');
        expect((rerollPrompt.meta as { diceOwnerId?: string } | undefined)?.diceOwnerId).toBe('0');
        expect(rerollPrompt.allowedDieIds).toEqual([0, 1, 2, 3, 4]);

        const rerolled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            played.state,
            command('REROLL_DIE', '1', { dieId: 0 }),
            createQueuedRandom([6]),
            playerIds,
        );
        expect(rerolled.success).toBe(true);
        if (!rerolled.success) return;
        expect(rerolled.state.core.dice[0]?.value).toBe(6);
    });

    it.each([
        { defenseRoll: 1, expectedCounterDamage: 2, expectedShield: undefined, expectedHpLoss: 8 },
        { defenseRoll: 5, expectedCounterDamage: undefined, expectedShield: 2, expectedHpLoss: 6 },
        { defenseRoll: 6, expectedCounterDamage: undefined, expectedShield: 3, expectedHpLoss: 5 },
    ])('僧侣 8 点攻击经过天使斗篷骰面 $defenseRoll 后应按防御结果扣血', ({
        defenseRoll,
        expectedCounterDamage,
        expectedShield,
        expectedHpLoss,
    }) => {
        let state = createHeroMatchup('monk', 'tianshi')(playerIds, createQueuedRandom([defenseRoll]));
        const defenderHpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;

        const run = (step: DiceThroneCommand, randomValues: number[] = [1]) => {
            const result = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                step,
                createQueuedRandom(randomValues),
                playerIds,
            );
            expect(result.success).toBe(true);
            if (!result.success) return undefined;
            state = result.state;
            return result;
        };

        run(command('ADVANCE_PHASE', '0'));
        run(command('ROLL_DICE', '0'), [1, 1, 1, 1, 1]);
        run(command('CONFIRM_ROLL', '0'));
        const attackSelected = run(command('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }));
        expect(attackSelected?.events).toContainEqual(expect.objectContaining({
            type: 'ATTACK_INITIATED',
            payload: expect.objectContaining({
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'fist-technique-5',
            }),
        }));

        run(command('ADVANCE_PHASE', '0'));
        expect(state.sys.phase).toBe('defensiveRoll');
        expect(state.core.pendingAttack?.defenseAbilityId).toBe('angelic-cloak');
        const defenseRolled = run(command('ROLL_DICE', '1'), [defenseRoll]);
        expect(defenseRolled?.events).toContainEqual(expect.objectContaining({
            type: 'DICE_ROLLED',
            payload: expect.objectContaining({
                phase: 'defensiveRoll',
                rollerId: '1',
                results: [defenseRoll],
            }),
        }));
        const defenseConfirmed = run(command('CONFIRM_ROLL', '1'));
        expect(defenseConfirmed?.events.some(event => event.type === 'BONUS_DICE_REROLL_REQUESTED')).toBe(false);

        const resolved = run(command('ADVANCE_PHASE', '1'));
        if (expectedCounterDamage !== undefined) {
            expect(resolved?.events).toContainEqual(expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: '0',
                    amount: expectedCounterDamage,
                    unblockable: true,
                }),
            }));
        }
        if (expectedShield !== undefined) {
            expect(resolved?.events).toContainEqual(expect.objectContaining({
                type: 'DAMAGE_SHIELD_GRANTED',
                payload: expect.objectContaining({
                    targetId: '1',
                    value: expectedShield,
                    sourceId: 'angelic-cloak',
                }),
            }));
        }
        const mainAttackDamage = resolved?.events.find((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => (
            event.type === 'DAMAGE_DEALT'
            && event.payload.targetId === '1'
            && event.payload.sourceAbilityId === 'fist-technique-5'
        ));
        expect(mainAttackDamage?.payload).toMatchObject({
            amount: 8,
            actualDamage: expectedHpLoss,
            sourceAbilityId: 'fist-technique-5',
        });
        if (expectedShield !== undefined) {
            expect(mainAttackDamage?.payload.shieldsConsumed).toContainEqual(expect.objectContaining({
                sourceId: 'angelic-cloak',
                value: expectedShield,
                absorbed: expectedShield,
            }));
        }
        expect(state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHpBefore - expectedHpLoss);
        expect(state.core.pendingAttack).toBeNull();
        expect(state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(state.sys.phase).toBe('main2');
    });

    it('神圣祝福在炽天使持有者遭受致死伤害时消耗标记并保留 1 点生命', () => {
        const state = createTianshiState();
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 3;
        state.core.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] = 1;
        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'heavenly-severing');
        const context: EffectContext = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'heavenly-severing',
            state: state.core,
            damageDealt: 0,
            timestamp: 500,
        };

        const events = resolveEffectsToEvents(ability?.effects ?? [], 'withDamage', context);
        expect(events.some(event => event.type === 'PREVENT_DAMAGE')).toBe(false);
        expect(events.some(event => event.type === 'TOKEN_CONSUMED' && event.payload.tokenId === TOKEN_IDS.BLESSING_OF_DIVINITY)).toBe(false);
        expect(events.some(event => event.type === 'DAMAGE_DEALT' && event.payload.targetId === '0' && event.payload.amount === 13)).toBe(true);

        const after = applyEvents(state.core, events);
        expect(after.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0).toBe(0);
        expect(after.players['0'].resources[RESOURCE_IDS.HP]).toBe(1);
    });

    it('天使斗篷免费重投使用普通防御骰，并限制为一颗骰一次', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1, 1, 6]);
        let state = createHeroMatchup('monk', 'tianshi')(playerIds, random);
        state.core.players['1'].abilities = [ANGELIC_CLOAK_2];
        const steps = [
            command('ADVANCE_PHASE', '0'),
            command('ROLL_DICE', '0'),
            command('CONFIRM_ROLL', '0'),
            command('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
            command('ADVANCE_PHASE', '0'),
            command('ROLL_DICE', '1'),
            command('CONFIRM_ROLL', '1'),
            command('SELECT_ABILITY', '1', { abilityId: 'angelic-cloak' }),
            command('ROLL_DICE', '1'),
            command('CONFIRM_ROLL', '1'),
        ];
        for (const step of steps) {
            const result = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                step,
                random,
                playerIds,
            );
            if (!result.success) throw new Error(`防御重投流程失败: ${result.error ?? 'unknown_error'}`);
            state = result.state;
        }
        expect(state.core.dice[0]?.value).toBe(6);
        const secondReroll = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('ROLL_DICE', '1'),
            createQueuedRandom([2]),
            playerIds,
        );
        expect(secondReroll.success).toBe(false);
        if (!secondReroll.success) expect(secondReroll.error).toBe('roll_limit_reached');
    });

    it('神圣裁决先选择玩家施加眩光，再选择玩家获得 2 个飞行和净化', () => {
        const state = createTianshiThreePlayerState();
        const card = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-divine-arbitration');
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'card-tianshi-divine-arbitration',
            state: state.core,
            damageDealt: 0,
            timestamp: 700,
        };

        const events = resolveEffectsToEvents(card?.effects ?? [], 'immediate', context);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({
                targetId: '0',
                tokenId: TOKEN_IDS.DIVINE_ARRIVAL,
                amount: 1,
            }),
        }));
        const firstChoice = events.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(firstChoice?.payload.options.map(option => option.value)).toEqual([0, 1, 2]);
        expect(firstChoice?.payload.options[0]?.customId).toBe('tianshi-divine-arbitration-dazzle');
        if (!firstChoice) return;

        // 第一段允许选择任意玩家；这里选对手 1，单独验证自选资格由选项集合保留。
        expect(firstChoice.payload.options[0]?.labelParams).toMatchObject({ player: 'characters.tianshi' });
        expect(firstChoice.payload.options[1]?.labelParams).toMatchObject({ player: 'characters.monk' });

        const resolveFirstChoice = getChoiceResolvedEventHandler(firstChoice.payload.options[0]?.customId ?? '');
        expect(resolveFirstChoice).toBeDefined();
        if (!resolveFirstChoice) return;
        const secondChoiceEvents = resolveFirstChoice({
            state: state.core,
            playerId: '0',
            customId: firstChoice.payload.options[0]?.customId ?? '',
            sourceAbilityId: 'card-tianshi-divine-arbitration',
            value: 1,
            timestamp: 701,
        });
        expect(secondChoiceEvents).toContainEqual(expect.objectContaining({
            type: 'STATUS_APPLIED',
            payload: expect.objectContaining({
                targetId: '1',
                statusId: STATUS_IDS.DAZZLE,
                stacks: 1,
            }),
        }));
        const secondChoice = secondChoiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(secondChoice?.payload.options.map(option => option.value)).toEqual([0, 1, 2]);
        expect(secondChoice?.payload.options[0]?.customId).toBe('tianshi-divine-arbitration-flight');
        if (!secondChoice) return;

        const resolveSecondChoice = getChoiceResolvedEventHandler(secondChoice.payload.options[0]?.customId ?? '');
        expect(resolveSecondChoice).toBeDefined();
        if (!resolveSecondChoice) return;
        const thirdChoiceEvents = resolveSecondChoice({
            state: state.core,
            playerId: '0',
            customId: secondChoice.payload.options[0]?.customId ?? '',
            sourceAbilityId: 'card-tianshi-divine-arbitration',
            value: 0,
            timestamp: 702,
        });
        expect(thirdChoiceEvents).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({
                targetId: '0',
                tokenId: TOKEN_IDS.FLIGHT,
                amount: 2,
            }),
        }));
        const thirdChoice = thirdChoiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(thirdChoice?.payload.options[0]?.customId).toBe('tianshi-divine-arbitration-purify');
        if (!thirdChoice) return;

        const resolveThirdChoice = getChoiceResolvedEventHandler(thirdChoice.payload.options[0]?.customId ?? '');
        expect(resolveThirdChoice).toBeDefined();
        if (!resolveThirdChoice) return;
        const finalEvents = resolveThirdChoice({
            state: state.core,
            playerId: '0',
            customId: thirdChoice.payload.options[0]?.customId ?? '',
            sourceAbilityId: 'card-tianshi-divine-arbitration',
            value: 2,
            timestamp: 703,
        });
        expect(finalEvents).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({
                targetId: '2',
                tokenId: TOKEN_IDS.PURIFY,
                amount: 1,
            }),
        }));
    });

    it('AI 处理神圣裁决的飞行选择时应选自己而不是敌人', async () => {
        let state = createTianshiState();
        const card = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-divine-arbitration');
        if (!card) throw new Error('缺少神圣裁决卡牌定义');
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].hand = [card];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;

        const played = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('PLAY_CARD', '0', { cardId: card.id }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(played.success).toBe(true);
        if (!played.success) return;
        state = played.state;

        const dazzlePrompt = getSimpleChoicePrompt(state, card.id);
        const enemyDazzleOption = dazzlePrompt.options.find((option) => {
            return option.value?.customId === 'tianshi-divine-arbitration-dazzle'
                && option.value?.labelParams?.player === 'characters.monk';
        });
        expect(enemyDazzleOption).toBeDefined();
        if (!enemyDazzleOption) return;

        const dazzleResolved = respondToPrompt(state, enemyDazzleOption.id, '0');
        expect(dazzleResolved.success).toBe(true);
        if (!dazzleResolved.success) return;
        state = dazzleResolved.state;

        const flightPrompt = getSimpleChoicePrompt(state, card.id);
        const selfFlightOption = flightPrompt.options.find((option) => {
            return option.value?.customId === 'tianshi-divine-arbitration-flight'
                && option.value?.labelParams?.player === 'characters.tianshi';
        });
        const enemyFlightOption = flightPrompt.options.find((option) => {
            return option.value?.customId === 'tianshi-divine-arbitration-flight'
                && option.value?.labelParams?.player === 'characters.monk';
        });
        expect(selfFlightOption).toBeDefined();
        expect(enemyFlightOption).toBeDefined();
        if (!selfFlightOption || !enemyFlightOption) return;
        expect(selfFlightOption.value?.targetPlayerId).toBe('0');
        expect(selfFlightOption.value?.tokenGrantConfig).toEqual({ tokenId: TOKEN_IDS.FLIGHT, amount: 2 });
        expect(enemyFlightOption.value?.targetPlayerId).toBe('1');
        expect(enemyFlightOption.value?.tokenGrantConfig).toEqual({ tokenId: TOKEN_IDS.FLIGHT, amount: 2 });

        const { action } = await decideWithBaselineAi(state, '0');
        expect(action?.kind).toBe('interaction-choice');
        const aiSelectedOptionId = action?.metadata?.optionId;
        expect(aiSelectedOptionId).toBe(selfFlightOption.id);
        expect(aiSelectedOptionId).not.toBe(enemyFlightOption.id);
        if (!aiSelectedOptionId) return;

        const flightResolved = respondToPrompt(state, aiSelectedOptionId, '0');
        expect(flightResolved.success).toBe(true);
        if (!flightResolved.success) return;
        expect(flightResolved.state.core.players['0'].tokens[TOKEN_IDS.FLIGHT]).toBe(2);
        expect(flightResolved.state.core.players['1'].tokens[TOKEN_IDS.FLIGHT] ?? 0).toBe(0);
    });
});
