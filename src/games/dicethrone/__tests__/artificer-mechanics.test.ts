import { describe, expect, it } from 'vitest';
import { DiceThroneDomain } from '../domain';
import type { CharacterId, DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { resolveOffensivePreDefenseEffects } from '../domain/attack';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';
import { initializeCustomActions } from '../domain/customActions';
import { buildHeroAbilitiesForFace, initHeroState } from '../domain/characters';
import { resolveEffectsToEvents } from '../domain/effects';
import { getChoiceResolvedEventHandler } from '../domain/choiceResolvedEvents';
import { createDiceThroneEventSystem } from '../domain/systems';
import { RESOURCE_IDS } from '../domain/resources';
import { ARTIFICER_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { getPlayerDieFace } from '../domain/rules';
import { checkPlayCard } from '../domain/rules';
import { shouldOpenTokenResponse } from '../domain/tokenResponse';
import { ARTIFICER_CARDS } from '../heroes/artificer/cards';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, PlayerId } from '../../../engine/types';
import { executePipeline } from '../../../engine/pipeline';
import { createHeroMatchup, createQueuedRandom, fixedRandom, getCardInteractionPrompt, getCurrentInteractionId, getSimpleChoicePrompt, respondToPrompt, testSystems } from './test-utils';

initializeCustomActions();

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const resolveChoiceWithFollowups = (
    core: DiceThroneCore,
    args: {
        playerId: string;
        customId: string;
        sourceAbilityId: string;
        value: number;
        timestamp: number;
        random?: typeof fixedRandom;
    },
) => {
    const resolvedEvent = {
        type: 'CHOICE_RESOLVED',
        payload: {
            playerId: args.playerId,
            customId: args.customId,
            sourceAbilityId: args.sourceAbilityId,
            value: args.value,
        },
        sourceCommandType: 'RESOLVE_CHOICE',
        timestamp: args.timestamp,
    } as DiceThroneEvent;
    const stateAfterChoice = reduce(core, resolvedEvent);
    const followupHandler = getChoiceResolvedEventHandler(args.customId);
    const followupEvents = followupHandler ? followupHandler({
        state: core,
        playerId: args.playerId,
        customId: args.customId,
        sourceAbilityId: args.sourceAbilityId,
        value: args.value,
        timestamp: args.timestamp,
        random: args.random,
    }) : [];
    const nextState = applyEvents(stateAfterChoice, followupEvents);
    return { resolvedEvent, followupEvents, nextState };
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

const eventsOfType = <T extends DiceThroneEvent['type']>(events: DiceThroneEvent[], type: T) =>
    events.filter((event): event is Extract<DiceThroneEvent, { type: T }> => event.type === type);

const confirmBonusDice = (
    state: MatchState<DiceThroneCore>,
    core: DiceThroneCore,
    playerId: string,
) => {
    const events = execute(
        { ...state, core },
        command('SKIP_BONUS_DICE_REROLL', playerId),
        fixedRandom,
    );
    return { events, nextState: applyEvents(core, events) };
};

const getArtificerCard = (cardId: string) => {
    const card = ARTIFICER_CARDS.find(entry => entry.id === cardId);
    if (!card) {
        throw new Error(`未找到工匠卡牌 ${cardId}`);
    }
    return card;
};

const createFourPlayerArtificerState = () => {
    const playerIds: PlayerId[] = ['0', '1', '2', '3'];
    const heroByPlayer: Record<PlayerId, CharacterId> = {
        '0': 'artificer',
        '1': 'monk',
        '2': 'treant',
        '3': 'samurai',
    };
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
    core.teamIdByPlayerId = { '0': 'A', '1': 'B', '2': 'A', '3': 'B' };

    return {
        core,
        sys: createInitialSystemState(playerIds, testSystems, undefined),
    } as MatchState<DiceThroneCore>;
};

const getArtificerAbility = (state: DiceThroneCore, abilityId: string) => {
    const ability = state.players['0'].abilities.find(entry => entry.id === abilityId);
    if (!ability) {
        throw new Error(`未找到工匠技能 ${abilityId}`);
    }
    return ability;
};

const setArtificerAbilityLevel = (state: DiceThroneCore, abilityId: string, level: number) => {
    state.players['0'].abilityLevels[abilityId] = level;
    state.players['0'].abilities = buildHeroAbilitiesForFace(
        'artificer',
        state.players['0'].playerBoardFace,
        state.players['0'].abilityLevels,
    );
};

const setPlayerDiceValues = (state: DiceThroneCore, playerId: string, values: number[]) => {
    state.rollDiceCount = values.length;
    state.dice = values.map((value, index) => {
        const existing = state.dice[index];
        const symbol = getPlayerDieFace(state, playerId, value);
        return {
            ...(existing ?? {
                id: index,
                definitionId: `${state.players[playerId]?.characterId ?? 'artificer'}-dice`,
                isKept: false,
            }),
            value,
            symbol,
            symbols: symbol ? [symbol] : [],
        };
    });
};

const createArtificerCardPlayState = (cardId: string) => {
    const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
    state.sys.phase = 'main1';
    state.core.activePlayerId = '0';
    state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
    state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
    state.core.players['0'].hand = [getArtificerCard(cardId)];
    return state;
};

const createOpponentTurnArtificerCardPlayState = (cardId: string) => {
    const state = createHeroMatchup('monk', 'artificer')(['0', '1'], fixedRandom);
    state.sys.phase = 'main1';
    state.core.activePlayerId = '0';
    state.core.players['1'].resources[RESOURCE_IDS.CP] = 10;
    state.core.players['1'].tokens[TOKEN_IDS.SYNTH] = 0;
    state.core.players['1'].hand = [getArtificerCard(cardId)];
    return state;
};

const setArtificerBot = (
    state: DiceThroneCore,
    playerId: string,
    tokenId: typeof TOKEN_IDS.NANOBOT | typeof TOKEN_IDS.SHOCK_BOT | typeof TOKEN_IDS.HEAL_BOT,
    options?: { upgraded?: boolean; activationsUsedThisTurn?: number },
) => {
    const upgraded = options?.upgraded ?? false;
    state.players[playerId].tokens[tokenId] = 1;
    state.players[playerId].tokenStackLimits = {
        ...(state.players[playerId].tokenStackLimits ?? {}),
        [tokenId]: upgraded ? 2 : 1,
    };
    state.players[playerId].artificerBotState = {
        ...(state.players[playerId].artificerBotState ?? {}),
        [tokenId]: {
            built: true,
            upgraded,
            activationsUsedThisTurn: options?.activationsUsedThisTurn ?? 0,
        },
    };
};

const createFourPlayerArtificerCardPlayState = (cardId: string) => {
    const state = createFourPlayerArtificerState();
    state.sys.phase = 'main1';
    state.core.activePlayerId = '0';
    state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
    state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
    state.core.players['0'].hand = [getArtificerCard(cardId)];
    return state;
};

const enterUpkeep = (core: DiceThroneCore, random = fixedRandom): DiceThroneEvent[] => {
    const state = {
        core,
        sys: { phase: 'discard' },
    };
    const result = diceThroneFlowHooks.onPhaseEnter?.({
        state,
        from: 'discard',
        to: 'upkeep',
        command: command('ADVANCE_PHASE', core.activePlayerId),
        random,
        exitEvents: [],
    } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]);
    return (Array.isArray(result) ? result : []) as DiceThroneEvent[];
};

describe('DiceThrone 工匠 L2 核心机制', () => {
    it('收集配件在工匠自己的维护阶段获得 1 合成器', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 6;

        const events = enterUpkeep(state.core, createQueuedRandom([3]));
        const next = applyEvents(state.core, events);
        const grant = eventsOfType(events, 'TOKEN_GRANTED')
            .find(event => event.payload.tokenId === TOKEN_IDS.SYNTH);

        expect(grant?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.SYNTH,
            amount: 1,
            newTotal: 7,
            sourceAbilityId: 'collect-parts',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(7);
    });

    it('收集配件 II 在维护阶段投出齿轮时获得 2 合成器', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 5;
        setArtificerAbilityLevel(state.core, 'collect-parts', 2);

        const events = enterUpkeep(state.core, createQueuedRandom([4]));
        const rolled = applyEvents(state.core, events);
        const { events: settlementEvents, nextState: next } = confirmBonusDice(state, rolled, '0');
        const roll = eventsOfType(events, 'BONUS_DIE_ROLLED')[0];
        const grant = eventsOfType(settlementEvents, 'TOKEN_GRANTED')
            .find(event => event.payload.tokenId === TOKEN_IDS.SYNTH);

        expect(roll?.payload).toMatchObject({
            value: 4,
            face: 'gear',
            effectKey: 'bonusDie.effect.artificerCollectPartsGear',
        });
        expect(grant?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.SYNTH,
            amount: 2,
            newTotal: 7,
            sourceAbilityId: 'collect-parts',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(7);
    });

    it('纳米爆弹在持有者维护阶段每层投骰，投出 6 时移除 1 层', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.core.players['0'].statusEffects[STATUS_IDS.NANOBOMB] = 3;

        const events = enterUpkeep(state.core, createQueuedRandom([6, 3, 6]));
        const next = applyEvents(state.core, events);
        const rolls = eventsOfType(events, 'BONUS_DIE_ROLLED')
            .filter(event => event.payload.effectKey === 'bonusDie.effect.artificerNanobombUpkeep');
        const removal = eventsOfType(events, 'STATUS_REMOVED')
            .find(event => event.payload.statusId === STATUS_IDS.NANOBOMB);

        expect(rolls.map(event => event.payload.value)).toEqual([6, 3, 6]);
        expect(removal?.payload).toMatchObject({
            targetId: '0',
            statusId: STATUS_IDS.NANOBOMB,
            stacks: 2,
        });
        expect(next.players['0'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(1);
    });

    it('纳米机器人激活后会保留机器人本体，并引爆所有玩家的纳米爆弹', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'upkeep';
        state.core.activePlayerId = '0';
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        state.core.players['0'].statusEffects[STATUS_IDS.NANOBOMB] = 2;
        state.core.players['1'].statusEffects[STATUS_IDS.NANOBOMB] = 3;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 0,
        }), fixedRandom);
        const next = applyEvents(state.core, events);
        const nanobotDamageEvents = eventsOfType(events, 'DAMAGE_DEALT')
            .filter(event => event.payload.sourceAbilityId === 'artificer-nanobot-detonate');
        const damageByTarget = Object.fromEntries(
            nanobotDamageEvents
                .map(event => [event.payload.targetId, event.payload.amount]),
        );

        expect(next.players['0'].tokens[TOKEN_IDS.NANOBOT]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['0'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(damageByTarget).toEqual({ '0': 3, '1': 5 });
        expect(nanobotDamageEvents.every(event => (
            event.payload.damageScope === 'direct'
            && event.payload.unblockable === true
        ))).toBe(true);
        expect(next.players['0'].artificerBotState?.[TOKEN_IDS.NANOBOT]).toMatchObject({
            built: true,
            upgraded: false,
            activationsUsedThisTurn: 1,
        });
    });

    it('进攻阶段激活纳米机器人时，当前攻击目标的爆弹并入攻击修正，其他目标仍为附属伤害', () => {
        const state = createFourPlayerArtificerState();
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        state.core.players['1'].statusEffects[STATUS_IDS.NANOBOMB] = 2;
        state.core.players['3'].statusEffects[STATUS_IDS.NANOBOMB] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'maximum-power',
            isDefendable: true,
            damageResolved: false,
            resolvedDamage: 0,
            settlementStage: 'preDamage',
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolveOffensivePreDefenseEffects(state.core, fixedRandom, 289);
        const requestedState = applyEvents(state.core, requestEvents);
        const request = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];
        const nanobotOption = request?.payload.options.find(option => (
            option.labelKey === 'choices.artificerBotActivation.activateNanobotFree'
        ));

        expect(nanobotOption).toBeDefined();
        if (!nanobotOption) return;

        const resolution = resolveChoiceWithFollowups(requestedState, {
            playerId: '0',
            customId: nanobotOption.customId!,
            sourceAbilityId: 'maximum-power',
            value: nanobotOption.value!,
            timestamp: 290,
            random: fixedRandom,
        });

        const directDamage = eventsOfType(resolution.followupEvents, 'DAMAGE_DEALT')
            .find(event => event.payload.targetId === '3');
        expect(directDamage?.payload).toMatchObject({
            targetId: '3',
            amount: 1,
            actualDamage: 1,
            sourceAbilityId: 'artificer-nanobot-detonate',
            damageScope: 'direct',
            unblockable: true,
        });
        expect(eventsOfType(resolution.followupEvents, 'DAMAGE_DEALT')
            .some(event => event.payload.targetId === '1')).toBe(false);
        expect(resolution.nextState.players['1'].resources[RESOURCE_IDS.HP]).toBe(49);
        expect(resolution.nextState.players['3'].resources[RESOURCE_IDS.HP]).toBe(49);
        expect(resolution.nextState.pendingAttack?.bonusDamage).toBe(5);
        expect(resolution.nextState.pendingAttack?.attackModifierBonusDamage ?? 0).toBe(0);
        expect(resolution.nextState.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(resolution.nextState.players['3'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
    });

    it('高级纳米机器人在维护阶段只需花费 1 合成器即可引爆，且不会消失', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'upkeep';
        state.core.activePlayerId = '0';
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT, { upgraded: true });
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 1;
        state.core.players['1'].statusEffects[STATUS_IDS.NANOBOMB] = 2;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 1,
        }), fixedRandom);
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.NANOBOT]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(next.players['0'].artificerBotState?.[TOKEN_IDS.NANOBOT]).toMatchObject({
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 1,
        });
    });

    it('工匠可花费 4 合成器给对手施加 1 个纳米爆弹', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 4;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 2,
        }), fixedRandom);
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });

    it('工匠在 4 人组队局花费 4 合成器施加纳米爆弹时，会先创建仅列敌方的选目标交互', () => {
        const state = createFourPlayerArtificerState();
        state.sys.phase = 'main1';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 4;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 2,
        }), fixedRandom);
        const reducedCore = applyEvents(state.core, events);
        const system = createDiceThroneEventSystem();
        const afterEvents = system.afterEvents?.({
            state: { ...state, core: reducedCore },
            events,
            random: fixedRandom,
        } as any);

        if (!afterEvents || Array.isArray(afterEvents) || !('state' in afterEvents)) {
            throw new Error('工匠工坊纳米爆弹未创建多人目标选择交互');
        }

        const promptState = afterEvents.state as MatchState<DiceThroneCore>;
        const interaction = getCardInteractionPrompt(promptState, 'artificer-workshop');

        expect(interaction).toMatchObject({
            type: 'selectPlayer',
            sourceCardId: 'artificer-workshop',
            selectCount: 1,
            resolveCustomActionId: 'artificer-synth-inflict-nanobomb-selected',
        });
        expect(interaction.targetPlayerIds).toEqual(['1', '3']);
        expect(reducedCore.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(reducedCore.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(reducedCore.players['2'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(reducedCore.players['3'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
    });

    it('工匠在 4 人组队局解析纳米爆弹目标后，只会把状态写到被选中的敌方', () => {
        const state = createFourPlayerArtificerState();
        state.sys.phase = 'main1';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 4;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 2,
        }), fixedRandom);
        const reducedCore = applyEvents(state.core, events);
        const system = createDiceThroneEventSystem();
        const afterEvents = system.afterEvents?.({
            state: { ...state, core: reducedCore },
            events,
            random: fixedRandom,
        } as any);

        if (!afterEvents || Array.isArray(afterEvents) || !('state' in afterEvents)) {
            throw new Error('工匠工坊纳米爆弹未创建多人目标选择交互');
        }

        const promptState = afterEvents.state as MatchState<DiceThroneCore>;
        const resolveEvents = execute(promptState, command('RESOLVE_INTERACTION', '0', {
            selectedPlayerIds: ['3'],
        }), fixedRandom);
        const next = applyEvents(promptState.core, resolveEvents);

        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(next.players['2'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(next.players['3'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
        expect(eventsOfType(resolveEvents, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '3',
            statusId: STATUS_IDS.NANOBOMB,
            stacks: 1,
            sourceAbilityId: 'artificer-workshop',
        });
    });

    it('工匠可花费 2 合成器制造基础机器人使用机会', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 3,
        }), fixedRandom);
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.NANOBOT]).toBe(1);
    });

    it('基础机器人已满额时制造动作不可用且不会扣合成器', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        state.core.players['0'].tokens[TOKEN_IDS.NANOBOT] = 1;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 3,
        }), fixedRandom);

        expect(events).toHaveLength(0);
        expect(state.core.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(2);
        expect(state.core.players['0'].tokens[TOKEN_IDS.NANOBOT]).toBe(1);
    });

    it('机器人已升级为高级后，不应再提供制造该基础机器人的工坊动作', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT, { upgraded: true });

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 3,
        }), fixedRandom);

        expect(events).toHaveLength(0);
        expect(state.core.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(2);
        expect(state.core.players['0'].tokens[TOKEN_IDS.NANOBOT]).toBe(1);
        expect(state.core.players['0'].artificerBotState?.[TOKEN_IDS.NANOBOT]).toMatchObject({
            built: true,
            upgraded: true,
        });
    });

    it('工匠可花费 3 合成器将基础机器人升级为 2 次使用机会', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 3;
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 7,
        }), fixedRandom);
        const next = applyEvents(state.core, events);
        const limitEvent = eventsOfType(events, 'TOKEN_LIMIT_CHANGED')
            .find(event => event.payload.tokenId === TOKEN_IDS.SHOCK_BOT);

        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(1);
        expect(next.players['0'].tokenStackLimits?.[TOKEN_IDS.SHOCK_BOT]).toBe(2);
        expect(next.players['0'].artificerBotState?.[TOKEN_IDS.SHOCK_BOT]).toMatchObject({
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 0,
        });
        expect(limitEvent?.payload).toMatchObject({
            playerId: '0',
            tokenId: TOKEN_IDS.SHOCK_BOT,
            newLimit: 2,
            sourceAbilityId: 'artificer-workshop',
        });
    });

    it('没有基础机器人时升级动作不可用且不会扣合成器', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 3;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 7,
        }), fixedRandom);

        expect(events).toHaveLength(0);
        expect(state.core.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(3);
        expect(state.core.players['0'].tokens[TOKEN_IDS.SHOCK_BOT] ?? 0).toBe(0);
    });

    it('电能机器人在攻击加伤窗口消耗 1 个并让本次攻击伤害 +3', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.pendingDamage = {
            id: 'damage-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'shock-bot',
            damageScope: 'attack',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const events = execute(state, command('USE_TOKEN', '0', {
            tokenId: TOKEN_IDS.SHOCK_BOT,
            amount: 1,
        }), fixedRandom);
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.pendingDamage?.currentDamage).toBe(9);
        expect(next.pendingAttack?.bonusDamage).toBe(3);
        expect(next.players['0'].artificerBotState?.[TOKEN_IDS.SHOCK_BOT]?.activationsUsedThisTurn).toBe(1);
    });

    it('高级电能机器人激活时只花费 1 合成器', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT, { upgraded: true });
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.pendingDamage = {
            id: 'damage-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'shock-bot',
            damageScope: 'attack',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const events = execute(state, command('USE_TOKEN', '0', {
            tokenId: TOKEN_IDS.SHOCK_BOT,
            amount: 1,
        }), fixedRandom);
        const next = applyEvents(state.core, events);

        expect(next.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.pendingDamage?.currentDamage).toBe(9);
        expect(next.players['0'].artificerBotState?.[TOKEN_IDS.SHOCK_BOT]).toMatchObject({
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 1,
        });
    });

    it('治疗机器人只在至少 6 点攻击伤害窗口可用，并按工匠骰面治疗 1 或 2', () => {
        const state = createHeroMatchup('monk', 'artificer')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '1', TOKEN_IDS.HEAL_BOT);
        state.core.players['1'].tokens[TOKEN_IDS.SYNTH] = 2;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 40;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist-technique',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.pendingDamage = {
            id: 'damage-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'fist-technique',
            damageScope: 'attack',
            responseType: 'beforeDamageReceived',
            responderId: '1',
            isFullyEvaded: false,
        };

        const events = execute(state, command('USE_TOKEN', '1', {
            tokenId: TOKEN_IDS.HEAL_BOT,
            amount: 1,
        }), createQueuedRandom([4]));
        const rolled = applyEvents(state.core, events);
        const settlementEvents = execute(
            { ...state, core: rolled },
            command('SKIP_BONUS_DICE_REROLL', '1'),
            fixedRandom,
        );
        const next = applyEvents(rolled, settlementEvents);

        expect(next.players['1'].tokens[TOKEN_IDS.HEAL_BOT]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(42);
        expect(next.pendingDamage?.currentDamage).toBe(6);
        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')[0]?.payload.face).toBe('gear');
        expect(eventsOfType(settlementEvents, 'BONUS_DICE_SETTLED')).toHaveLength(1);
        expect(next.pendingBonusDiceSettlement).toBeUndefined();
        expect(next.players['1'].artificerBotState?.[TOKEN_IDS.HEAL_BOT]?.activationsUsedThisTurn).toBe(1);
    });

    it('治疗机器人满足受击条件时，应触发防御方 token 响应窗口而不是被系统跳过', () => {
        const state = createHeroMatchup('monk', 'artificer')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '1', TOKEN_IDS.HEAL_BOT);
        state.core.players['1'].tokens[TOKEN_IDS.SYNTH] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist-technique',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];

        expect(shouldOpenTokenResponse(state.core, '0', '1', 5, false, 'attack')).toBeNull();
        expect(shouldOpenTokenResponse(state.core, '0', '1', 6, false, 'attack')).toBe('defenderMitigation');
    });

    it('高级治疗机器人激活时只花费 1 合成器', () => {
        const state = createHeroMatchup('monk', 'artificer')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '1', TOKEN_IDS.HEAL_BOT, { upgraded: true });
        state.core.players['1'].tokens[TOKEN_IDS.SYNTH] = 1;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 40;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist-technique',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.pendingDamage = {
            id: 'damage-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'fist-technique',
            damageScope: 'attack',
            responseType: 'beforeDamageReceived',
            responderId: '1',
            isFullyEvaded: false,
        };

        const events = execute(state, command('USE_TOKEN', '1', {
            tokenId: TOKEN_IDS.HEAL_BOT,
            amount: 1,
        }), createQueuedRandom([1]));
        const rolled = applyEvents(state.core, events);
        const settlementEvents = execute(
            { ...state, core: rolled },
            command('SKIP_BONUS_DICE_REROLL', '1'),
            fixedRandom,
        );
        const next = applyEvents(rolled, settlementEvents);

        expect(next.players['1'].tokens[TOKEN_IDS.HEAL_BOT]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(41);
        expect(eventsOfType(settlementEvents, 'BONUS_DICE_SETTLED')).toHaveLength(1);
        expect(next.pendingBonusDiceSettlement).toBeUndefined();
        expect(next.players['1'].artificerBotState?.[TOKEN_IDS.HEAL_BOT]).toMatchObject({
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 1,
        });
    });

    it('机器人作为不可移除同伴，不会被 REMOVE_STATUS 清掉', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT, { upgraded: true });

        const removeEvents = execute(state, command('REMOVE_STATUS', '0', {
            targetPlayerId: '0',
            statusId: TOKEN_IDS.SHOCK_BOT,
        }), fixedRandom);

        expect(removeEvents).toHaveLength(0);
    });

    it('机器人作为不可移除同伴，不会被 TRANSFER_STATUS 转移走', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '0', TOKEN_IDS.HEAL_BOT, { upgraded: true });

        const transferEvents = execute(state, command('TRANSFER_STATUS', '0', {
            fromPlayerId: '0',
            toPlayerId: '1',
            statusId: TOKEN_IDS.HEAL_BOT,
        }), fixedRandom);

        expect(transferEvents).toHaveLength(0);
    });

    it('扳手攻击在无合成器时会追加投 1 骰，投出扳手时本次攻击伤害 +1', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'wrench-strike-3',
            isDefendable: true,
            damage: 3,
            bonusDamage: 0,
        } as DiceThroneCore['pendingAttack'];

        const events = resolveOffensivePreDefenseEffects(state.core, createQueuedRandom([1]), 100);
        const rolled = applyEvents(state.core, events);
        const { events: settlementEvents, nextState: next } = confirmBonusDice(state, rolled, '0');

        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 1,
            face: 'wrench',
            effectKey: 'bonusDie.effect.artificerWrenchStrikeWrench',
        });
        expect(eventsOfType(settlementEvents, 'BONUS_DAMAGE_ADDED')[0]?.payload).toMatchObject({
            playerId: '0',
            amount: 1,
            sourceCardId: 'wrench-strike-3',
        });
        expect(next.pendingAttack?.bonusDamage).toBe(1);
    });

    it('扳手攻击 II 在有合成器时可选择花费 1 合成器改为齿轮分支，令本次攻击伤害 +2', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].abilityLevels['wrench-strike'] = 2;
        state.core.players['0'].abilities = buildHeroAbilitiesForFace(
            'artificer',
            state.core.players['0'].playerBoardFace,
            state.core.players['0'].abilityLevels,
        );
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'wrench-strike-2-3',
            isDefendable: true,
            damage: 4,
            bonusDamage: 0,
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolveOffensivePreDefenseEffects(state.core, fixedRandom, 110);
        const requestState = applyEvents(state.core, requestEvents);
        const choiceEvent = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];

        expect(choiceEvent?.payload.options).toMatchObject([
            { customId: 'artificer-wrench-strike-roll', value: 0 },
            { customId: 'artificer-wrench-strike-spend-wrench', tokenId: TOKEN_IDS.SYNTH, value: -1 },
            { customId: 'artificer-wrench-strike-spend-gear', tokenId: TOKEN_IDS.SYNTH, value: -1 },
            { customId: 'artificer-wrench-strike-spend-electricity', tokenId: TOKEN_IDS.SYNTH, value: -1 },
        ]);

        const chosenState = reduce(requestState, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.SYNTH,
                value: -1,
                customId: 'artificer-wrench-strike-spend-gear',
                sourceAbilityId: 'wrench-strike-2-3',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 111,
        } as DiceThroneEvent);

        const resolvedEvents = resolveOffensivePreDefenseEffects(chosenState, fixedRandom, 112);
        const rolled = applyEvents(chosenState, resolvedEvents);
        const { events: settlementEvents, nextState: resolvedState } = confirmBonusDice(state, rolled, '0');

        expect(eventsOfType(resolvedEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            face: 'gear',
            effectKey: 'bonusDie.effect.artificerWrenchStrikeGear',
            presentationKind: 'choice',
        });
        expect(eventsOfType(settlementEvents, 'BONUS_DAMAGE_ADDED')[0]?.payload.amount).toBe(2);
        expect(resolvedState.pendingAttack?.bonusDamage).toBe(2);
        expect(resolvedState.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
    });

    it('扳手攻击 II 在有合成器时可选择电能分支并获得 1 合成器', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].abilityLevels['wrench-strike'] = 2;
        state.core.players['0'].abilities = buildHeroAbilitiesForFace(
            'artificer',
            state.core.players['0'].playerBoardFace,
            state.core.players['0'].abilityLevels,
        );
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'wrench-strike-2-3',
            isDefendable: true,
            damage: 4,
            bonusDamage: 0,
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolveOffensivePreDefenseEffects(state.core, fixedRandom, 120);
        const requestState = applyEvents(state.core, requestEvents);
        const chosenState = reduce(requestState, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.SYNTH,
                value: -1,
                customId: 'artificer-wrench-strike-spend-electricity',
                sourceAbilityId: 'wrench-strike-2-3',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 121,
        } as DiceThroneEvent);

        const resolvedEvents = resolveOffensivePreDefenseEffects(chosenState, fixedRandom, 122);
        const rolled = applyEvents(chosenState, resolvedEvents);
        const { events: settlementEvents, nextState: resolvedState } = confirmBonusDice(state, rolled, '0');

        expect(eventsOfType(resolvedEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            face: 'electricity',
            effectKey: 'bonusDie.effect.artificerWrenchStrikeElectricity',
            presentationKind: 'choice',
        });
        expect(eventsOfType(settlementEvents, 'TOKEN_GRANTED')[0]?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.SYNTH,
            amount: 1,
        });
        expect(resolvedState.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(1);
    });

    it('扳手攻击 II 在正式命令链中可由升级后玩家板能力进入电能分支并推进到 defensiveRoll', () => {
        const playerIds: PlayerId[] = ['0', '1'];
        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);

        state.sys = createInitialSystemState(playerIds, testSystems, undefined);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollConfirmed = true;
        state.core.players['0'].abilityLevels['wrench-strike'] = 2;
        state.core.players['0'].abilities = buildHeroAbilitiesForFace(
            'artificer',
            state.core.players['0'].playerBoardFace,
            state.core.players['0'].abilityLevels,
        );
        state.core.players['0'].upgradeCardByAbilityId = {
            ...(state.core.players['0'].upgradeCardByAbilityId ?? {}),
            'wrench-strike': { cardId: 'upgrade-artificer-wrench-strike-2', cpCost: 1 },
        };
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 9;
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 1;
        state.core.players['0'].hand = [];
        state.core.dice = [
            { id: 0, definitionId: 'artificer-die', value: 1, symbol: 'wrench', symbols: ['wrench'], isKept: false, isLocked: false, playerId: '0' },
            { id: 1, definitionId: 'artificer-die', value: 1, symbol: 'wrench', symbols: ['wrench'], isKept: false, isLocked: false, playerId: '0' },
            { id: 2, definitionId: 'artificer-die', value: 1, symbol: 'wrench', symbols: ['wrench'], isKept: false, isLocked: false, playerId: '0' },
            { id: 3, definitionId: 'artificer-die', value: 6, symbol: 'gear', symbols: ['gear'], isKept: false, isLocked: false, playerId: '0' },
            { id: 4, definitionId: 'artificer-die', value: 2, symbol: 'wrench', symbols: ['wrench'], isKept: false, isLocked: false, playerId: '0' },
        ];

        const selected = executePipeline(
            pipelineConfig,
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'wrench-strike-2-4' }),
            fixedRandom,
            playerIds,
        );
        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack?.sourceAbilityId).toBe('wrench-strike-2-4');

        const advanced = executePipeline(
            pipelineConfig,
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            playerIds,
        );
        expect(advanced.success).toBe(true);
        expect(advanced.state.sys.phase).toBe('offensiveRoll');
        const prompt = getSimpleChoicePrompt(advanced.state, 'wrench-strike-2-4');
        const choiceOptions = prompt.options ?? [];
        const electricityOption = choiceOptions.find(
            (option: { id?: string; value?: { customId?: string } }) =>
                option?.value?.customId === 'artificer-wrench-strike-spend-electricity',
        );
        expect(electricityOption?.id).toBeTruthy();

        const responded = respondToPrompt(
            advanced.state,
            electricityOption!.id!,
            '0',
            fixedRandom,
            playerIds,
        );
        expect(responded.success).toBe(true);
        expect(responded.state.core.pendingBonusDiceSettlement).toMatchObject({
            displayOnly: true,
            customResolutionId: 'artificer-wrench-strike-branch',
            maxRerollCount: 0,
            allowDiceModification: true,
            dice: [{
                value: 6,
                face: 'electricity',
                effectKey: 'bonusDie.effect.artificerWrenchStrikeElectricity',
                presentationKind: 'choice',
            }],
        });

        const bonusDie = eventsOfType(responded.events as DiceThroneEvent[], 'BONUS_DIE_ROLLED')[0];
        expect(bonusDie?.payload).toMatchObject({
            value: 6,
            face: 'electricity',
            effectKey: 'bonusDie.effect.artificerWrenchStrikeElectricity',
            presentationKind: 'choice',
        });
        const settled = executePipeline(
            pipelineConfig,
            responded.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            fixedRandom,
            playerIds,
        );
        expect(settled.success).toBe(true);
        if (!settled.success) return;
        expect(settled.state.sys.phase).toBe('defensiveRoll');
        expect(getCurrentInteractionId(settled.state)).toBeUndefined();
        expect(settled.state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(settled.state.core.pendingAttack?.sourceAbilityId).toBe('wrench-strike-2-4');
        expect(settled.state.core.pendingAttack?.preDefenseResolved).toBe(true);
        expect(settled.state.core.pendingAttack?.defenseAbilityId).toBe('meditation');
        expect(settled.state.core.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(1);
        const tokenGranted = eventsOfType(settled.events as DiceThroneEvent[], 'TOKEN_GRANTED')[0];
        expect(tokenGranted?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.SYNTH,
            amount: 1,
            sourceAbilityId: 'wrench-strike-2-4',
        });
    });

    it('电能脉冲 III 在正式命令链中可由升级后玩家板能力进入机械大军分支并推进到 defensiveRoll', () => {
        const playerIds: PlayerId[] = ['0', '1'];
        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);

        state.sys = createInitialSystemState(playerIds, testSystems, undefined);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollConfirmed = true;
        state.core.players['0'].abilityLevels['shock-bot'] = 3;
        state.core.players['0'].abilities = buildHeroAbilitiesForFace(
            'artificer',
            state.core.players['0'].playerBoardFace,
            state.core.players['0'].abilityLevels,
        );
        state.core.players['0'].upgradeCardByAbilityId = {
            ...(state.core.players['0'].upgradeCardByAbilityId ?? {}),
            'shock-bot': { cardId: 'upgrade-artificer-shock-bot-3', cpCost: 2 },
        };
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 8;
        state.core.players['0'].hand = [];
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT, { upgraded: true });
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);
        state.core.dice = [
            { id: 0, definitionId: 'artificer-die', value: 2, symbol: 'wrench', symbols: ['wrench'], isKept: false, isLocked: false, playerId: '0' },
            { id: 1, definitionId: 'artificer-die', value: 3, symbol: 'wrench', symbols: ['wrench'], isKept: false, isLocked: false, playerId: '0' },
            { id: 2, definitionId: 'artificer-die', value: 4, symbol: 'gear', symbols: ['gear'], isKept: false, isLocked: false, playerId: '0' },
            { id: 3, definitionId: 'artificer-die', value: 5, symbol: 'gear', symbols: ['gear'], isKept: false, isLocked: false, playerId: '0' },
            { id: 4, definitionId: 'artificer-die', value: 6, symbol: 'electricity', symbols: ['electricity'], isKept: false, isLocked: false, playerId: '0' },
        ];

        const selected = executePipeline(
            pipelineConfig,
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'shock-bot-3-mechanical-army' }),
            fixedRandom,
            playerIds,
        );
        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack?.sourceAbilityId).toBe('shock-bot-3-mechanical-army');

        const advanced = executePipeline(
            pipelineConfig,
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            playerIds,
        );
        expect(advanced.success).toBe(true);
        expect(advanced.state.sys.phase).toBe('defensiveRoll');
        expect(getCurrentInteractionId(advanced.state)).toBeUndefined();
        expect(advanced.state.core.pendingAttack?.sourceAbilityId).toBe('shock-bot-3-mechanical-army');
        expect(advanced.state.core.pendingAttack?.defenseAbilityId).toBe('meditation');
        expect(advanced.state.core.pendingAttack?.bonusDamage ?? 0).toBe(0);
        expect(advanced.state.core.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(advanced.state.core.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(advanced.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);
    });

    it('机械的反击可在受击响应时打出，授予 2 点伤害护盾并对攻击者施加纳米爆弹', () => {
        const state = createArtificerCardPlayState('card-artificer-mechanical-strike');
        state.sys.phase = 'defensiveRoll';
        state.core.activePlayerId = '1';
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'fist-technique',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];

        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-mechanical-strike',
        }), fixedRandom);
        const next = applyEvents(state.core, events);

        expect(next.players['0'].damageShields).toEqual([
            expect.objectContaining({
                sourceId: 'card-artificer-mechanical-strike',
                value: 2,
                preventStatus: false,
            }),
        ]);
        expect(eventsOfType(events, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.NANOBOMB,
            sourceAbilityId: 'card-artificer-mechanical-strike',
        });
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
        expect(next.players['0'].hand).toHaveLength(0);
        expect(next.players['0'].discard.map(card => card.id)).toContain('card-artificer-mechanical-strike');
    });

    it('电弧盾在待结算伤害窗口可防止 2 点伤害，并作为响应型升级牌进入弃牌堆', () => {
        const state = createArtificerCardPlayState('upgrade-artificer-shock-bot-2');
        state.sys.phase = 'defensiveRoll';
        state.core.activePlayerId = '1';
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'fist-technique',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.pendingDamage = {
            id: 'arc-shield-damage',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 5,
            currentDamage: 5,
            sourceAbilityId: 'fist-technique',
            damageScope: 'attack',
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };

        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'upgrade-artificer-shock-bot-2',
        }), fixedRandom);
        const next = applyEvents(state.core, events);

        expect(next.pendingDamage?.currentDamage).toBe(3);
        expect(next.players['0'].hand).toHaveLength(0);
        expect(next.players['0'].discard.map(card => card.id)).toContain('upgrade-artificer-shock-bot-2');
    });

    it('电弧盾在有合成器时可选择花费 1 合成器防止 3 点伤害', () => {
        const state = createArtificerCardPlayState('upgrade-artificer-shock-bot-2');
        state.sys.phase = 'defensiveRoll';
        state.core.activePlayerId = '1';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 1;
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'fist-technique',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.pendingDamage = {
            id: 'arc-shield-damage',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 5,
            currentDamage: 5,
            sourceAbilityId: 'fist-technique',
            damageScope: 'attack',
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };

        const playEvents = execute(state, command('PLAY_CARD', '0', {
            cardId: 'upgrade-artificer-shock-bot-2',
        }), fixedRandom);
        const afterRequest = applyEvents(state.core, playEvents);
        const choiceEvent = eventsOfType(playEvents, 'CHOICE_REQUESTED')[0];

        expect(choiceEvent?.payload.options).toMatchObject([
            { customId: 'artificer-arc-shield-prevent-2', value: 2 },
            { customId: 'artificer-arc-shield-prevent-3', value: 3 },
        ]);

        const resolved = reduce(afterRequest, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                value: 3,
                customId: 'artificer-arc-shield-prevent-3',
                sourceAbilityId: 'upgrade-artificer-shock-bot-2',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(resolved.pendingDamage?.currentDamage).toBe(2);
        expect(resolved.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(resolved.currentChoiceSourceAbilityId).toBeUndefined();
    });

    it('合成大师投出电能时获得 5 合成器，否则抽 1 张牌', () => {
        const electricityState = createArtificerCardPlayState('card-artificer-masterpiece');
        const electricityEvents = execute(electricityState, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-masterpiece',
        }), createQueuedRandom([6]));
        const electricityRolled = applyEvents(electricityState.core, electricityEvents);
        const { events: electricitySettlementEvents, nextState: afterElectricity } = confirmBonusDice(
            electricityState,
            electricityRolled,
            '0',
        );

        expect(eventsOfType(electricityEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 6,
            face: 'electricity',
            effectKey: 'bonusDie.effect.artificerMasterpieceElectricity',
        });
        expect(afterElectricity.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(5);
        expect(eventsOfType(electricitySettlementEvents, 'CARD_DRAWN')).toHaveLength(0);

        const drawState = createArtificerCardPlayState('card-artificer-masterpiece');
        drawState.core.players['0'].deck = [getArtificerCard('card-artificer-voltage')];
        const drawEvents = execute(drawState, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-masterpiece',
        }), createQueuedRandom([1]));
        const drawRolled = applyEvents(drawState.core, drawEvents);
        const { events: drawSettlementEvents, nextState: afterDraw } = confirmBonusDice(drawState, drawRolled, '0');

        expect(eventsOfType(drawEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 1,
            face: 'wrench',
            effectKey: 'bonusDie.effect.artificerMasterpieceOther',
        });
        expect(eventsOfType(drawSettlementEvents, 'CARD_DRAWN')).toHaveLength(1);
        expect(afterDraw.players['0'].hand.map(card => card.id)).toEqual(['card-artificer-voltage']);
    });

    it('超高电压获得 2 合成器，纳米袭击对默认对手施加 1 个纳米爆弹', () => {
        const voltageState = createArtificerCardPlayState('card-artificer-voltage');
        const voltageEvents = execute(voltageState, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-voltage',
        }), fixedRandom);
        const afterVoltage = applyEvents(voltageState.core, voltageEvents);

        expect(afterVoltage.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(2);

        const nanoState = createArtificerCardPlayState('card-artificer-nano-attack');
        const nanoEvents = execute(nanoState, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-nano-attack',
        }), fixedRandom);
        const afterNano = applyEvents(nanoState.core, nanoEvents);

        expect(eventsOfType(nanoEvents, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.NANOBOMB,
            sourceAbilityId: 'card-artificer-nano-attack',
        });
        expect(afterNano.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });

    it('纳米袭击在 4 人组队局会先创建仅列敌方的选目标交互', () => {
        const state = createFourPlayerArtificerCardPlayState('card-artificer-nano-attack');
        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-nano-attack',
        }), fixedRandom);
        const reducedCore = applyEvents(state.core, events);
        const system = createDiceThroneEventSystem();
        const afterEvents = system.afterEvents?.({
            state: { ...state, core: reducedCore },
            events,
            random: fixedRandom,
        } as any);

        if (!afterEvents || Array.isArray(afterEvents) || !('state' in afterEvents)) {
            throw new Error('纳米袭击未创建多人目标选择交互');
        }

        const promptState = afterEvents.state as MatchState<DiceThroneCore>;
        const interaction = getCardInteractionPrompt(promptState, 'card-artificer-nano-attack');

        expect(interaction).toMatchObject({
            type: 'selectPlayer',
            sourceCardId: 'card-artificer-nano-attack',
            selectCount: 1,
            resolveCustomActionId: 'resolve-card-effects-on-selected-opponent',
        });
        expect(interaction.targetPlayerIds).toEqual(['1', '3']);
    });

    it('纳米袭击在 4 人组队局解析目标后，只会把纳米爆弹写到被选中的敌方', () => {
        const state = createFourPlayerArtificerCardPlayState('card-artificer-nano-attack');
        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-nano-attack',
        }), fixedRandom);
        const reducedCore = applyEvents(state.core, events);
        const system = createDiceThroneEventSystem();
        const afterEvents = system.afterEvents?.({
            state: { ...state, core: reducedCore },
            events,
            random: fixedRandom,
        } as any);

        if (!afterEvents || Array.isArray(afterEvents) || !('state' in afterEvents)) {
            throw new Error('纳米袭击未创建多人目标选择交互');
        }

        const promptState = afterEvents.state as MatchState<DiceThroneCore>;
        const resolveEvents = execute(promptState, command('RESOLVE_INTERACTION', '0', {
            selectedPlayerIds: ['3'],
        }), fixedRandom);
        const next = applyEvents(promptState.core, resolveEvents);

        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(next.players['2'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(next.players['3'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });

    it('万能电流按扳手、齿轮、电能分支结算', () => {
        const wrenchState = createArtificerCardPlayState('card-artificer-overdrive');
        wrenchState.core.players['0'].resources[RESOURCE_IDS.HP] = 38;
        const wrenchEvents = execute(wrenchState, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-overdrive',
        }), createQueuedRandom([1]));
        const wrenchRolled = applyEvents(wrenchState.core, wrenchEvents);
        const { nextState: afterWrench } = confirmBonusDice(wrenchState, wrenchRolled, '0');

        expect(eventsOfType(wrenchEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 1,
            face: 'wrench',
            effectKey: 'bonusDie.effect.artificerOverdriveWrench',
        });
        expect(afterWrench.players['0'].resources[RESOURCE_IDS.HP]).toBe(40);

        const gearState = createArtificerCardPlayState('card-artificer-overdrive');
        const gearEvents = execute(gearState, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-overdrive',
        }), createQueuedRandom([4]));
        const gearRolled = applyEvents(gearState.core, gearEvents);
        const { nextState: afterGear } = confirmBonusDice(gearState, gearRolled, '0');

        expect(eventsOfType(gearEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 4,
            face: 'gear',
            effectKey: 'bonusDie.effect.artificerOverdriveGear',
        });
        expect(afterGear.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(1);

        const electricityState = createArtificerCardPlayState('card-artificer-overdrive');
        const electricityEvents = execute(electricityState, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-overdrive',
        }), createQueuedRandom([6]));
        const electricityRolled = applyEvents(electricityState.core, electricityEvents);
        const { nextState: afterElectricity } = confirmBonusDice(electricityState, electricityRolled, '0');

        expect(eventsOfType(electricityEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 6,
            face: 'electricity',
            effectKey: 'bonusDie.effect.artificerOverdriveElectricity',
        });
        expect(afterElectricity.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });

    it('万能电流在 4 人组队局会先创建仅列敌方的选目标交互，并在选定目标后按电能分支施加纳米爆弹', () => {
        const state = createFourPlayerArtificerCardPlayState('card-artificer-overdrive');
        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
        const played = executePipeline(
            pipelineConfig,
            state,
            command('PLAY_CARD', '0', { cardId: 'card-artificer-overdrive' }),
            createQueuedRandom([6]),
            ['0', '1', '2', '3'],
        );
        expect(played.success).toBe(true);
        if (!played.success) return;
        const promptState = played.state;
        const interaction = getCardInteractionPrompt(promptState, 'card-artificer-overdrive');
        expect(interaction).toMatchObject({
            type: 'selectPlayer',
            sourceCardId: 'card-artificer-overdrive',
            selectCount: 1,
            resolveCustomActionId: 'resolve-card-effects-on-selected-opponent',
        });
        expect(interaction.targetPlayerIds).toEqual(['1', '3']);

        const selectedTarget = executePipeline(
            pipelineConfig,
            promptState,
            command('RESOLVE_INTERACTION', '0', { selectedPlayerIds: ['3'] }),
            createQueuedRandom([6]),
            ['0', '1', '2', '3'],
        );
        expect(selectedTarget.success).toBe(true);
        if (!selectedTarget.success) return;
        const next = selectedTarget.state.core;
        expect(next.pendingBonusDiceSettlement).toMatchObject({
            sourceAbilityId: 'card-artificer-overdrive',
            targetId: '3',
            maxRerollCount: 0,
            allowDiceModification: true,
            dice: [{
                value: 6,
                face: 'electricity',
                effectKey: 'bonusDie.effect.artificerOverdriveElectricity',
            }],
        });
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(next.players['3'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);

        const confirmed = executePipeline(
            pipelineConfig,
            selectedTarget.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            fixedRandom,
            ['0', '1', '2', '3'],
        );
        expect(confirmed.success).toBe(true);
        if (!confirmed.success) return;
        expect(confirmed.state.core.pendingBonusDiceSettlement).toBeUndefined();

        expect(confirmed.state.core.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(confirmed.state.core.players['3'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });

    it('万能电流作为红色即时牌在普通对方回合也可打出并结算合成器', () => {
        const state = createOpponentTurnArtificerCardPlayState('card-artificer-overdrive');
        const played = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('PLAY_CARD', '1', { cardId: 'card-artificer-overdrive' }),
            createQueuedRandom([4]),
            ['0', '1'],
        );

        expect(state.sys.phase).toBe('main1');
        expect(state.core.activePlayerId).toBe('0');
        expect(played.success).toBe(true);
        if (!played.success) return;
        expect(eventsOfType(played.events as DiceThroneEvent[], 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 4,
            face: 'gear',
            effectKey: 'bonusDie.effect.artificerOverdriveGear',
        });
        expect(played.state.core.pendingBonusDiceSettlement).toMatchObject({
            sourceAbilityId: 'card-artificer-overdrive',
            attackerId: '1',
            targetId: '0',
            maxRerollCount: 0,
            allowDiceModification: true,
            dice: [{
                value: 4,
                face: 'gear',
                effectKey: 'bonusDie.effect.artificerOverdriveGear',
            }],
        });
        expect(played.state.core.players['1'].hand.map(card => card.id)).not.toContain('card-artificer-overdrive');
        expect(played.state.core.players['1'].discard.map(card => card.id)).toContain('card-artificer-overdrive');
        expect(played.state.core.players['1'].tokens[TOKEN_IDS.SYNTH] ?? 0).toBe(0);

        const confirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            played.state,
            command('SKIP_BONUS_DICE_REROLL', '1'),
            fixedRandom,
            ['0', '1'],
        );

        expect(confirmed.success).toBe(true);
        if (!confirmed.success) return;
        expect(confirmed.state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(confirmed.state.core.players['1'].tokens[TOKEN_IDS.SYNTH]).toBe(1);
    });

    it('这玩意儿真棒在奖励骰确认后按骰值一半向上取整获得合成器', () => {
        const state = createArtificerCardPlayState('card-artificer-perfectly-calibrated');
        const played = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('PLAY_CARD', '0', { cardId: 'card-artificer-perfectly-calibrated' }),
            createQueuedRandom([5]),
            ['0', '1'],
        );

        expect(played.success).toBe(true);
        if (!played.success) return;
        expect(eventsOfType(played.events as DiceThroneEvent[], 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 5,
            face: 'gear',
            effectKey: 'bonusDie.effect.artificerPerfectlyCalibrated',
        });
        expect(played.state.core.pendingBonusDiceSettlement).toMatchObject({
            displayOnly: true,
            customResolutionId: 'artificer-perfectly-calibrated-roll',
            maxRerollCount: 0,
            allowDiceModification: true,
            dice: [{
                value: 5,
                face: 'gear',
                effectKey: 'bonusDie.effect.artificerPerfectlyCalibrated',
                effectParams: { value: 5, synth: 3, synthGain: 3 },
            }],
        });
        expect(played.state.core.players['0'].tokens[TOKEN_IDS.SYNTH] ?? 0).toBe(0);

        const confirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            played.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            fixedRandom,
            ['0', '1'],
        );

        expect(confirmed.success).toBe(true);
        if (!confirmed.success) return;
        expect(eventsOfType(confirmed.events as DiceThroneEvent[], 'BONUS_DICE_SETTLED')).toHaveLength(1);
        expect(confirmed.state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(confirmed.state.core.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(3);
    });

    it('这玩意儿真棒作为红色即时牌在普通对方回合也可打出，并在奖励骰确认后结算合成器', () => {
        const state = createOpponentTurnArtificerCardPlayState('card-artificer-perfectly-calibrated');
        const played = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('PLAY_CARD', '1', { cardId: 'card-artificer-perfectly-calibrated' }),
            createQueuedRandom([5]),
            ['0', '1'],
        );

        expect(state.sys.phase).toBe('main1');
        expect(state.core.activePlayerId).toBe('0');
        expect(played.success).toBe(true);
        if (!played.success) return;
        expect(eventsOfType(played.events as DiceThroneEvent[], 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 5,
            face: 'gear',
            effectKey: 'bonusDie.effect.artificerPerfectlyCalibrated',
        });
        expect(played.state.core.pendingBonusDiceSettlement).toMatchObject({
            displayOnly: true,
            customResolutionId: 'artificer-perfectly-calibrated-roll',
            maxRerollCount: 0,
            allowDiceModification: true,
            dice: [{
                value: 5,
                face: 'gear',
                effectKey: 'bonusDie.effect.artificerPerfectlyCalibrated',
                effectParams: { value: 5, synth: 3, synthGain: 3 },
            }],
        });
        expect(played.state.core.players['1'].hand.map(card => card.id)).not.toContain('card-artificer-perfectly-calibrated');
        expect(played.state.core.players['1'].discard.map(card => card.id)).toContain('card-artificer-perfectly-calibrated');
        expect(played.state.core.players['1'].tokens[TOKEN_IDS.SYNTH] ?? 0).toBe(0);

        const confirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            played.state,
            command('SKIP_BONUS_DICE_REROLL', '1'),
            fixedRandom,
            ['0', '1'],
        );

        expect(confirmed.success).toBe(true);
        if (!confirmed.success) return;
        expect(eventsOfType(confirmed.events as DiceThroneEvent[], 'BONUS_DICE_SETTLED')).toHaveLength(1);
        expect(confirmed.state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(confirmed.state.core.players['1'].tokens[TOKEN_IDS.SYNTH]).toBe(3);
    });

    it('电路图 II 额外获得 2 CP', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 4;
        setArtificerAbilityLevel(state.core, 'schematics', 2);
        const ability = getArtificerAbility(state.core, 'schematics');

        const events = resolveEffectsToEvents(ability.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'schematics',
            state: state.core,
            damageDealt: 0,
            timestamp: 200,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);
        const cpEvent = eventsOfType(events, 'CP_CHANGED')[0];

        expect(cpEvent?.payload).toMatchObject({
            playerId: '0',
            delta: 2,
            newValue: 6,
            sourceAbilityId: 'schematics',
        });
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(6);
    });

    it('超频运行 II 的能量提升改为 3 电能并施加 3 纳米爆弹', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        setArtificerAbilityLevel(state.core, 'overclock', 2);
        const ability = getArtificerAbility(state.core, 'overclock');
        const variant = ability.variants?.find(entry => entry.id === 'overclock-2-energy-boost');

        expect(variant?.trigger).toMatchObject({
            type: 'diceSet',
            faces: { [ARTIFICER_DICE_FACE_IDS.ELECTRICITY]: 3 },
        });

        const events = resolveEffectsToEvents(variant?.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'overclock-2-energy-boost',
            state: state.core,
            damageDealt: 0,
            timestamp: 210,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);
        const nanobomb = eventsOfType(events, 'STATUS_APPLIED')[0];

        expect(nanobomb?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.NANOBOMB,
            stacks: 3,
            newTotal: 3,
            sourceAbilityId: 'overclock-2-energy-boost',
        });
        expect(eventsOfType(events, 'TOKEN_GRANTED')).toHaveLength(0);
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(3);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH] ?? 0).toBe(0);
    });

    it('唤醒机械 II 的精密制造分支按 3 扳手 + 1 电能获得 5 合成器', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        setArtificerAbilityLevel(state.core, 'activate-bots', 2);
        const ability = getArtificerAbility(state.core, 'activate-bots');
        const variant = ability.variants?.find(entry => entry.id === 'activate-bots-2-precision-fabrication');

        expect(variant?.trigger).toMatchObject({
            type: 'diceSet',
            faces: {
                [ARTIFICER_DICE_FACE_IDS.WRENCH]: 3,
                [ARTIFICER_DICE_FACE_IDS.ELECTRICITY]: 1,
            },
        });

        const events = resolveEffectsToEvents(variant?.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'activate-bots-2-precision-fabrication',
            state: state.core,
            damageDealt: 0,
            timestamp: 220,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'TOKEN_GRANTED')[0]?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.SYNTH,
            amount: 5,
            newTotal: 5,
            sourceAbilityId: 'activate-bots-2-precision-fabrication',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(5);
    });

    it('电能脉冲 III 的机械大军按拥有的机器人种类数额外加伤', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT, { upgraded: true });
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);
        setArtificerAbilityLevel(state.core, 'shock-bot', 3);
        const ability = getArtificerAbility(state.core, 'shock-bot');
        const variant = ability.variants?.find(entry => entry.id === 'shock-bot-3-mechanical-army');

        expect(variant?.trigger).toMatchObject({
            type: 'diceSet',
            faces: {
                [ARTIFICER_DICE_FACE_IDS.WRENCH]: 1,
                [ARTIFICER_DICE_FACE_IDS.GEAR]: 2,
                [ARTIFICER_DICE_FACE_IDS.ELECTRICITY]: 1,
            },
        });

        const events = resolveEffectsToEvents(variant?.effects ?? [], 'withDamage', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot-3-mechanical-army',
            state: state.core,
            damageDealt: 0,
            timestamp: 225,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);
        const damageEvent = eventsOfType(events, 'DAMAGE_DEALT')[0];

        expect(damageEvent?.payload).toMatchObject({
            targetId: '1',
            amount: 7,
            actualDamage: 7,
            sourceAbilityId: 'shock-bot-3-mechanical-army',
            damageScope: 'attack',
        });
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(43);
    });

    it('稍作调整 II 在 2 扳手 2 齿轮 1 电能时反击 1、获得 2 合成器并施加 1 纳米爆弹', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 3;
        setArtificerAbilityLevel(state.core, 'tinker', 2);
        setPlayerDiceValues(state.core, '0', [1, 2, 4, 5, 6]);
        const ability = getArtificerAbility(state.core, 'tinker');

        const events = resolveEffectsToEvents(ability.effects ?? [], 'withDamage', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'tinker',
            state: state.core,
            damageDealt: 0,
            timestamp: 226,
            isDefensiveContext: true,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 1,
            actualDamage: 1,
            sourceAbilityId: 'tinker',
            damageScope: 'direct',
        });
        expect(eventsOfType(events, 'TOKEN_GRANTED')[0]?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.SYNTH,
            amount: 2,
            newTotal: 5,
            sourceAbilityId: 'tinker',
        });
        expect(eventsOfType(events, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.NANOBOMB,
            stacks: 1,
            newTotal: 1,
            sourceAbilityId: 'tinker',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(5);
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(49);
    });

    it('基础版稍作调整按齿轮数量获得合成器，且只要投出电能就施加 1 纳米爆弹', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        setPlayerDiceValues(state.core, '0', [6, 4, 5, 2]);
        const ability = getArtificerAbility(state.core, 'tinker');

        const events = resolveEffectsToEvents(ability.effects ?? [], 'withDamage', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'tinker',
            state: state.core,
            damageDealt: 0,
            timestamp: 227,
            isDefensiveContext: true,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'TOKEN_GRANTED')[0]?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.SYNTH,
            amount: 2,
            newTotal: 2,
            sourceAbilityId: 'tinker',
        });
        expect(eventsOfType(events, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.NANOBOMB,
            stacks: 1,
            newTotal: 1,
            sourceAbilityId: 'tinker',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(2);
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });

    it('基础版稍作调整在没有齿轮时不会平白获得合成器，但投出电能仍会施加 1 纳米爆弹', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        setPlayerDiceValues(state.core, '0', [6, 2, 3, 1]);
        const ability = getArtificerAbility(state.core, 'tinker');

        const events = resolveEffectsToEvents(ability.effects ?? [], 'withDamage', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'tinker',
            state: state.core,
            damageDealt: 0,
            timestamp: 228,
            isDefensiveContext: true,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'TOKEN_GRANTED')).toHaveLength(0);
        expect(eventsOfType(events, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.NANOBOMB,
            stacks: 1,
            newTotal: 1,
            sourceAbilityId: 'tinker',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });

    it('五条技能赠送的机器人激活都应忽略“然后”，在伤害结算前进入选择', () => {
        const cases = [
            { abilityId: 'overclock', sourceAbilityId: 'overclock', level: 1 },
            { abilityId: 'overclock', sourceAbilityId: 'overclock-2-main', level: 2 },
            { abilityId: 'shock-bot', sourceAbilityId: 'shock-bot', level: 1 },
            { abilityId: 'shock-bot', sourceAbilityId: 'shock-bot-3-main', level: 3 },
            { abilityId: 'maximum-power', sourceAbilityId: 'maximum-power', level: 1 },
        ];

        for (const entry of cases) {
            const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
            if (entry.level > 1) {
                setArtificerAbilityLevel(state.core, entry.abilityId, entry.level);
            }
            state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
            setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: entry.sourceAbilityId,
                isDefendable: true,
                damageResolved: false,
                resolvedDamage: 0,
                settlementStage: 'preDamage',
            } as DiceThroneCore['pendingAttack'];

            const events = resolveOffensivePreDefenseEffects(state.core, fixedRandom, 290);
            const request = eventsOfType(events, 'CHOICE_REQUESTED')[0];

            expect(request?.payload.options, entry.sourceAbilityId).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    labelKey: 'choices.artificerBotActivation.activateShockBotFree',
                    labelParams: undefined,
                }),
                expect.objectContaining({ labelKey: 'choices.artificerBotActivation.skip' }),
            ]));
            expect(eventsOfType(events, 'DAMAGE_DEALT'), entry.sourceAbilityId).toHaveLength(0);
        }
    });

    it('技能赠送的电能机器人激活应免费并入当前攻击，而不是伤害后另造成 3 点伤害', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 5;
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            isDefendable: true,
            damageResolved: false,
            resolvedDamage: 0,
            settlementStage: 'preDamage',
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolveOffensivePreDefenseEffects(state.core, fixedRandom, 291);
        const requestedState = applyEvents(state.core, requestEvents);
        const request = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];
        const shockOption = request?.payload.options.find(option => (
            option.labelKey === 'choices.artificerBotActivation.activateShockBotFree'
        ));

        expect(shockOption).toBeDefined();
        if (!shockOption) return;

        const resolution = resolveChoiceWithFollowups(requestedState, {
            playerId: '0',
            customId: shockOption.customId!,
            sourceAbilityId: 'shock-bot',
            value: shockOption.value!,
            timestamp: 292,
            random: fixedRandom,
        });

        expect(eventsOfType(resolution.followupEvents, 'TOKEN_USED')[0]?.payload).toMatchObject({
            playerId: '0',
            tokenId: TOKEN_IDS.SHOCK_BOT,
            amount: 1,
            effectType: 'damageBoost',
            damageModifier: 3,
        });
        expect(eventsOfType(resolution.followupEvents, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(resolution.nextState.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(5);
        expect(resolution.nextState.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(resolution.nextState.pendingAttack?.bonusDamage).toBe(3);
        expect(resolution.nextState.players['0'].artificerBotState?.[TOKEN_IDS.SHOCK_BOT]?.activationsUsedThisTurn).toBe(1);
    });

    it('技能赠送激活仍只允许已建造且本回合尚有次数的机器人', () => {
        const buildRequest = (built: boolean, activationsUsedThisTurn: number) => {
            const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
            state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
            if (built) {
                setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT, { activationsUsedThisTurn });
            }
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'shock-bot',
                isDefendable: true,
                damageResolved: false,
                resolvedDamage: 0,
                settlementStage: 'preDamage',
            } as DiceThroneCore['pendingAttack'];
            return eventsOfType(resolveOffensivePreDefenseEffects(state.core, fixedRandom, 293), 'CHOICE_REQUESTED')[0];
        };

        expect(buildRequest(false, 0)).toBeUndefined();
        expect(buildRequest(true, 1)).toBeUndefined();
        expect(buildRequest(true, 0)?.payload.options.map(option => option.labelKey)).toEqual([
            'choices.artificerBotActivation.activateShockBotFree',
            'choices.artificerBotActivation.skip',
        ]);
    });

    it('真本能量的机器人激活链会二次请求且第二次不能重复选择同一机器人', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 4;
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT);
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);
        state.core.players['1'].statusEffects[STATUS_IDS.NANOBOMB] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'maximum-power',
            damageResolved: false,
            resolvedDamage: 0,
            settlementStage: 'preDamage',
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolveOffensivePreDefenseEffects(state.core, fixedRandom, 300);
        const requestedState = applyEvents(state.core, requestEvents);
        const firstRequest = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];
        const nanobotOption = firstRequest?.payload.options.find(option => option.labelKey === 'choices.artificerBotActivation.activateNanobotFree');

        expect(firstRequest?.payload.titleKey).toBe('choices.artificerBotActivation.titleMultiple');
        expect(firstRequest?.payload.options.map(option => option.labelKey)).toEqual(expect.arrayContaining([
            'choices.artificerBotActivation.activateNanobotFree',
            'choices.artificerBotActivation.activateShockBotFree',
            'choices.artificerBotActivation.skip',
        ]));

        const firstResolution = resolveChoiceWithFollowups(requestedState, {
            playerId: '0',
            customId: nanobotOption!.customId!,
            sourceAbilityId: 'maximum-power',
            value: nanobotOption!.value!,
            timestamp: 301,
            random: fixedRandom,
        });
        const secondRequest = eventsOfType(firstResolution.followupEvents, 'CHOICE_REQUESTED')[0];

        expect(firstResolution.nextState.players['0'].tokens[TOKEN_IDS.NANOBOT]).toBe(1);
        expect(firstResolution.nextState.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(6);
        expect(firstResolution.nextState.players['0'].artificerBotState?.[TOKEN_IDS.NANOBOT]).toMatchObject({
            built: true,
            upgraded: false,
            activationsUsedThisTurn: 1,
        });
        expect(firstResolution.nextState.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(firstResolution.nextState.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(firstResolution.nextState.pendingAttack?.bonusDamage).toBe(5);
        expect(firstResolution.nextState.pendingAttack?.attackModifierBonusDamage ?? 0).toBe(0);
        expect(secondRequest?.payload.titleKey).toBe('choices.artificerBotActivation.titleSingle');
        expect(secondRequest?.payload.options.map(option => option.labelKey)).toEqual([
            'choices.artificerBotActivation.activateShockBotFree',
            'choices.artificerBotActivation.skip',
        ]);

        const shockOption = secondRequest!.payload.options.find(option => option.labelKey === 'choices.artificerBotActivation.activateShockBotFree')!;
        const secondResolution = resolveChoiceWithFollowups(firstResolution.nextState, {
            playerId: '0',
            customId: shockOption.customId!,
            sourceAbilityId: 'maximum-power',
            value: shockOption.value!,
            timestamp: 302,
            random: fixedRandom,
        });

        expect(eventsOfType(secondResolution.followupEvents, 'CHOICE_REQUESTED')).toHaveLength(0);
        expect(secondResolution.nextState.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(1);
        expect(secondResolution.nextState.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(6);
        expect(secondResolution.nextState.players['0'].artificerBotState?.[TOKEN_IDS.SHOCK_BOT]).toMatchObject({
            built: true,
            upgraded: false,
            activationsUsedThisTurn: 1,
        });
        expect(secondResolution.nextState.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(secondResolution.nextState.pendingAttack?.bonusDamage).toBe(8);
        expect(secondResolution.nextState.pendingAttack?.attackModifierBonusDamage ?? 0).toBe(0);
        expect(secondResolution.nextState.pendingAttack?.preDefenseResolved).toBe(true);
        expect(secondResolution.nextState.pendingAttack?.settlementStage).toBe('preDamage');
    });

    it('超频运行 II 在正式命令链中第一次激活后会继续请求第二个不同机器人', () => {
        const playerIds: PlayerId[] = ['0', '1'];
        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);

        state.sys = createInitialSystemState(playerIds, testSystems, undefined);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollConfirmed = true;
        setArtificerAbilityLevel(state.core, 'overclock', 2);
        state.core.players['0'].upgradeCardByAbilityId = {
            ...(state.core.players['0'].upgradeCardByAbilityId ?? {}),
            overclock: { cardId: 'upgrade-artificer-overclock-2', cpCost: 2 },
        };
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        state.core.players['0'].hand = [];
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT);
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);
        state.core.players['1'].statusEffects[STATUS_IDS.NANOBOMB] = 2;
        state.core.dice = [
            { id: 0, definitionId: 'artificer-die', value: 6, symbol: 'electricity', symbols: ['electricity'], isKept: false, isLocked: false, playerId: '0' },
            { id: 1, definitionId: 'artificer-die', value: 6, symbol: 'electricity', symbols: ['electricity'], isKept: false, isLocked: false, playerId: '0' },
            { id: 2, definitionId: 'artificer-die', value: 6, symbol: 'electricity', symbols: ['electricity'], isKept: false, isLocked: false, playerId: '0' },
            { id: 3, definitionId: 'artificer-die', value: 6, symbol: 'electricity', symbols: ['electricity'], isKept: false, isLocked: false, playerId: '0' },
            { id: 4, definitionId: 'artificer-die', value: 1, symbol: 'wrench', symbols: ['wrench'], isKept: false, isLocked: false, playerId: '0' },
        ];

        const selected = executePipeline(
            pipelineConfig,
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'overclock-2-main' }),
            fixedRandom,
            playerIds,
        );
        expect(selected.success).toBe(true);
        expect(selected.state.core.pendingAttack?.sourceAbilityId).toBe('overclock-2-main');

        const advanced = executePipeline(
            pipelineConfig,
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            playerIds,
        );
        expect(advanced.success).toBe(true);
        const firstPrompt = getSimpleChoicePrompt(advanced.state, 'overclock-2-main');
        const firstLabels = firstPrompt.options.map(option => option.labelKey);
        expect(firstLabels).toEqual(expect.arrayContaining([
            'choices.artificerBotActivation.activateNanobotFree',
            'choices.artificerBotActivation.activateShockBotFree',
            'choices.artificerBotActivation.skip',
        ]));

        const shockOption = firstPrompt.options.find(option => (
            option.labelKey === 'choices.artificerBotActivation.activateShockBotFree'
        ));
        expect(shockOption).toBeDefined();
        if (!shockOption) return;

        const afterShock = respondToPrompt(
            advanced.state,
            shockOption.id,
            '0',
            fixedRandom,
            playerIds,
        );

        expect(afterShock.success).toBe(true);
        const secondPrompt = getSimpleChoicePrompt(afterShock.state, 'overclock-2-main');
        expect(secondPrompt.options.map(option => option.labelKey)).toEqual([
            'choices.artificerBotActivation.activateNanobotFree',
            'choices.artificerBotActivation.skip',
        ]);
        expect(afterShock.state.core.players['0'].artificerBotState?.[TOKEN_IDS.SHOCK_BOT]).toMatchObject({
            built: true,
            upgraded: false,
            activationsUsedThisTurn: 1,
        });
        expect(afterShock.state.core.pendingAttack?.bonusDamage).toBe(3);
    });

    it('超频运行 II 先激活治疗机器人时，奖励骰确认后仍会继续请求第二个不同机器人', () => {
        const playerIds: PlayerId[] = ['0', '1'];
        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);

        state.sys = createInitialSystemState(playerIds, testSystems, undefined);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollConfirmed = true;
        setArtificerAbilityLevel(state.core, 'overclock', 2);
        state.core.players['0'].upgradeCardByAbilityId = {
            ...(state.core.players['0'].upgradeCardByAbilityId ?? {}),
            overclock: { cardId: 'upgrade-artificer-overclock-2', cpCost: 2 },
        };
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 40;
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        state.core.players['0'].hand = [];
        setArtificerBot(state.core, '0', TOKEN_IDS.HEAL_BOT);
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);
        state.core.dice = [
            { id: 0, definitionId: 'artificer-die', value: 6, symbol: 'electricity', symbols: ['electricity'], isKept: false, isLocked: false, playerId: '0' },
            { id: 1, definitionId: 'artificer-die', value: 6, symbol: 'electricity', symbols: ['electricity'], isKept: false, isLocked: false, playerId: '0' },
            { id: 2, definitionId: 'artificer-die', value: 6, symbol: 'electricity', symbols: ['electricity'], isKept: false, isLocked: false, playerId: '0' },
            { id: 3, definitionId: 'artificer-die', value: 6, symbol: 'electricity', symbols: ['electricity'], isKept: false, isLocked: false, playerId: '0' },
            { id: 4, definitionId: 'artificer-die', value: 1, symbol: 'wrench', symbols: ['wrench'], isKept: false, isLocked: false, playerId: '0' },
        ];

        const selected = executePipeline(
            pipelineConfig,
            state,
            command('SELECT_ABILITY', '0', { abilityId: 'overclock-2-main' }),
            fixedRandom,
            playerIds,
        );
        expect(selected.success).toBe(true);

        const advanced = executePipeline(
            pipelineConfig,
            selected.state,
            command('ADVANCE_PHASE', '0'),
            fixedRandom,
            playerIds,
        );
        expect(advanced.success).toBe(true);
        const firstPrompt = getSimpleChoicePrompt(advanced.state, 'overclock-2-main');
        const healOption = firstPrompt.options.find(option => (
            option.labelKey === 'choices.artificerBotActivation.activateHealBotFree'
        ));
        expect(healOption).toBeDefined();
        if (!healOption) return;

        const afterHeal = respondToPrompt(
            advanced.state,
            healOption.id,
            '0',
            createQueuedRandom([4]),
            playerIds,
        );
        expect(afterHeal.success).toBe(true);
        expect(afterHeal.state.core.pendingBonusDiceSettlement).toMatchObject({
            customResolutionId: 'artificer-heal-bot-use',
        });
        expect(afterHeal.state.core.players['0'].artificerBotState?.[TOKEN_IDS.HEAL_BOT]).toMatchObject({
            built: true,
            upgraded: false,
            activationsUsedThisTurn: 1,
        });

        const confirmedHeal = executePipeline(
            pipelineConfig,
            afterHeal.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            fixedRandom,
            playerIds,
        );
        expect(confirmedHeal.success).toBe(true);
        const secondPrompt = getSimpleChoicePrompt(confirmedHeal.state, 'overclock-2-main');
        expect(secondPrompt.options.map(option => option.labelKey)).toEqual([
            'choices.artificerBotActivation.activateShockBotFree',
            'choices.artificerBotActivation.skip',
        ]);
        expect(confirmedHeal.state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(42);
    });

    it('单次机器人激活窗口也应允许跳过，并在跳过后继续伤害前链路', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            damageResolved: false,
            resolvedDamage: 0,
            settlementStage: 'preDamage',
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolveOffensivePreDefenseEffects(state.core, fixedRandom, 312);
        const requestedState = applyEvents(state.core, requestEvents);
        const request = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];

        expect(request?.payload.options.map(option => option.labelKey)).toEqual([
            'choices.artificerBotActivation.activateShockBotFree',
            'choices.artificerBotActivation.skip',
        ]);

        const skipOption = request!.payload.options.find(option => option.labelKey === 'choices.artificerBotActivation.skip')!;
        const resolution = resolveChoiceWithFollowups(requestedState, {
            playerId: '0',
            customId: skipOption.customId!,
            sourceAbilityId: 'shock-bot',
            value: skipOption.value!,
            timestamp: 313,
            random: fixedRandom,
        });

        expect(eventsOfType(resolution.followupEvents, 'CHOICE_REQUESTED')).toHaveLength(0);
        expect(resolution.nextState.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(1);
        expect(resolution.nextState.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(2);
        expect(resolution.nextState.pendingAttack?.preDefenseResolved).toBe(true);
        expect(resolution.nextState.pendingAttack?.settlementStage).toBe('preDamage');
    });

    it('真本能量不能被防御方用卡牌、闪避或太极响应', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        const ability = getArtificerAbility(state.core, 'maximum-power');
        state.core.players['0'].hand = [];
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        const nextTime = state.core.players['1'].deck.find(card => card.id === 'card-next-time');
        expect(nextTime).toBeDefined();
        state.core.players['1'].deck = state.core.players['1'].deck.filter(card => card !== nextTime);
        state.core.players['1'].hand = [nextTime!];
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 1;
        state.core.players['1'].tokens[TOKEN_IDS.EVASIVE] = 1;
        state.core.players['1'].tokens[TOKEN_IDS.TAIJI] = 3;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'maximum-power',
            isDefendable: false,
            isUltimate: true,
            damage: 10,
            bonusDamage: 0,
            preDefenseResolved: true,
            damageResolved: false,
            attackFaceCounts: { [ARTIFICER_DICE_FACE_IDS.ELECTRICITY]: 5 },
        } as DiceThroneCore['pendingAttack'];

        const events = resolveEffectsToEvents(ability.effects ?? [], 'withDamage', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'maximum-power',
            state: state.core,
            damageDealt: 0,
            timestamp: 303,
        }, { random: fixedRandom });
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'TOKEN_RESPONSE_REQUESTED')).toHaveLength(0);
        expect(eventsOfType(events, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 10,
            actualDamage: 10,
            sourceAbilityId: 'maximum-power',
        });
        expect(next.players['1'].tokens[TOKEN_IDS.EVASIVE]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.TAIJI]).toBe(3);
        expect(next.players['1'].hand.map(card => card.id)).toEqual(['card-next-time']);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(40);
    });

    it('工匠 upkeep 存在可点纳米机器人时不应被 autoContinue 直接跳过', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT);

        const auto = diceThroneFlowHooks.onAutoContinueCheck?.({
            state: { ...state, sys: { ...state.sys, phase: 'upkeep' } },
            events: [{
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'discard', to: 'upkeep' },
            }],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onAutoContinueCheck>>[0]);

        expect(auto).toBeUndefined();
    });

    it('工匠 upkeep 只有任意时机动作时仍应自动推进，不创建空的下一阶段等待', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 4;

        const auto = diceThroneFlowHooks.onAutoContinueCheck?.({
            state: { ...state, sys: { ...state.sys, phase: 'upkeep' } },
            events: [{
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'discard', to: 'upkeep' },
            }],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onAutoContinueCheck>>[0]);

        expect(auto).toEqual({ autoContinue: true, playerId: '0' });
    });

    it('工匠受击响应牌在不可防御攻击的防御阶段仍应允许打出', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['0'].hand = [
            getArtificerCard('card-artificer-mechanical-strike'),
            getArtificerCard('upgrade-artificer-shock-bot-2'),
        ];
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'overclock',
            isDefendable: false,
        } as DiceThroneCore['pendingAttack'];

        expect(checkPlayCard(state.core, '0', getArtificerCard('card-artificer-mechanical-strike'), 'defensiveRoll')).toEqual({ ok: true });
        expect(checkPlayCard(state.core, '0', getArtificerCard('upgrade-artificer-shock-bot-2'), 'defensiveRoll')).toEqual({ ok: true });
    });

    it('工匠受击响应牌在攻击结算后的伤害窗口仍可用，不会被改骰窗口收紧误伤', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main2';
        state.core.activePlayerId = '1';
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['0'].hand = [
            getArtificerCard('card-artificer-mechanical-strike'),
            getArtificerCard('upgrade-artificer-shock-bot-2'),
        ];
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'fist-technique',
            isDefendable: true,
        } as DiceThroneCore['pendingAttack'];
        state.core.pendingDamage = {
            id: 'artificer-response-damage',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 5,
            currentDamage: 5,
            sourceAbilityId: 'fist-technique',
            damageScope: 'attack',
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };

        expect(checkPlayCard(
            state.core,
            '0',
            getArtificerCard('card-artificer-mechanical-strike'),
            'main2',
            'afterAttackResolved',
        )).toEqual({ ok: true });
        expect(checkPlayCard(
            state.core,
            '0',
            getArtificerCard('upgrade-artificer-shock-bot-2'),
            'main2',
            'afterAttackResolved',
        )).toEqual({ ok: true });
    });

    it('电能脉冲选择治疗机器人时会按工匠骰面真实治疗并继续伤害前链路', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        setArtificerBot(state.core, '0', TOKEN_IDS.HEAL_BOT);
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 40;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            damageResolved: false,
            resolvedDamage: 0,
            settlementStage: 'preDamage',
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolveOffensivePreDefenseEffects(state.core, fixedRandom, 310);
        const requestedState = applyEvents(state.core, requestEvents);
        const firstRequest = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];
        const healOption = firstRequest?.payload.options.find(option => option.labelKey === 'choices.artificerBotActivation.activateHealBotFree');

        const resolution = resolveChoiceWithFollowups(requestedState, {
            playerId: '0',
            customId: healOption!.customId!,
            sourceAbilityId: 'shock-bot',
            value: healOption!.value!,
            timestamp: 311,
            random: createQueuedRandom([4]),
        });

        expect(eventsOfType(resolution.followupEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 4,
            face: 'gear',
            effectKey: 'bonusDie.effect.artificerHealBot',
        });
        expect(resolution.nextState.pendingBonusDiceSettlement).toMatchObject({
            maxRerollCount: 0,
            customResolutionId: 'artificer-heal-bot-use',
        });
    });

    it('治疗机器人通过正式响应命令掷骰后，需普通确认右侧奖励骰盘再治疗并释放攻击流程', () => {
        const playerIds: PlayerId[] = ['0', '1'];
        const state = createHeroMatchup('artificer', 'monk')(playerIds, fixedRandom);
        state.sys = createInitialSystemState(playerIds, testSystems, undefined);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 40;
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        setArtificerBot(state.core, '0', TOKEN_IDS.HEAL_BOT);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            damageResolved: false,
            resolvedDamage: 6,
            settlementStage: 'preDamage',
        } as DiceThroneCore['pendingAttack'];
        state.core.pendingDamage = {
            id: 'heal-bot-response',
            responderId: '0',
            responseType: 'beforeDamageReceived',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 6,
            currentDamage: 6,
            damageScope: 'attack',
        } as DiceThroneCore['pendingDamage'];

        const used = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.HEAL_BOT, amount: 1 }),
            createQueuedRandom([4]),
            playerIds,
        );

        expect(used.success).toBe(true);
        expect(used.state.core.pendingBonusDiceSettlement).toMatchObject({
            displayOnly: true,
            customResolutionId: 'artificer-heal-bot-use',
            maxRerollCount: 0,
            allowDiceModification: true,
            dice: [{
                value: 4,
                face: 'gear',
                effectKey: 'bonusDie.effect.artificerHealBot',
                effectParams: { value: 4, heal: 2, healAmount: 2 },
            }],
        });
        expect(used.state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(40);

        const confirmed = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            used.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            fixedRandom,
            playerIds,
        );

        expect(confirmed.success).toBe(true);
        if (!confirmed.success) return;
        expect(eventsOfType(confirmed.events as DiceThroneEvent[], 'BONUS_DICE_SETTLED')).toHaveLength(1);
        expect(confirmed.state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(getCurrentInteractionId(confirmed.state)).toBeUndefined();
        expect(confirmed.state.sys.responseWindow?.current).toBeUndefined();
        expect(confirmed.state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(42);
        expect(confirmed.state.core.players['0'].artificerBotState?.[TOKEN_IDS.HEAL_BOT]).toMatchObject({
            built: true,
            upgraded: false,
            activationsUsedThisTurn: 1,
        });
    });

    it('伤害前机器人选择生成后应暂停攻击结算并保留 pendingAttack', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT);
        state.core.activePlayerId = '0';
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            damageResolved: false,
            resolvedDamage: 0,
            settlementStage: 'preDamage',
        } as DiceThroneCore['pendingAttack'];

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { ...state, sys: { ...state.sys, phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = (Array.isArray(result) ? result : (result?.events ?? [])) as DiceThroneEvent[];
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'CHOICE_REQUESTED')).toHaveLength(1);
        expect(eventsOfType(events, 'ATTACK_RESOLVED')).toHaveLength(0);
        expect(result && !Array.isArray(result) ? result.halt : false).toBe(true);
        expect(next.pendingAttack?.sourceAbilityId).toBe('shock-bot');
        expect(next.pendingAttack?.settlementStage).toBe('preDamage');
        expect(next.pendingAttack?.preDefenseResolved).toBe(true);
    });

    it('超频运行在技能送的激活链中无视正常激活条件，可免费激活基础和高级机器人', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 1;
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT);
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT, { upgraded: true });
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'overclock',
            damageResolved: false,
            resolvedDamage: 0,
            settlementStage: 'preDamage',
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolveOffensivePreDefenseEffects(state.core, fixedRandom, 320);
        const firstRequest = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];

        expect(firstRequest?.payload.options.map(option => ({
            labelKey: option.labelKey,
            synth: option.labelParams?.synth,
        }))).toEqual([
            { labelKey: 'choices.artificerBotActivation.activateNanobotFree', synth: undefined },
            { labelKey: 'choices.artificerBotActivation.activateShockBotFree', synth: undefined },
            { labelKey: 'choices.artificerBotActivation.skip', synth: undefined },
        ]);
    });

    it('超频运行在技能送的机器人激活链中应无视正常激活条件，不消耗合成器也允许激活基础机器人', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT);
        setArtificerBot(state.core, '0', TOKEN_IDS.SHOCK_BOT, { upgraded: true });
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'overclock',
            damageResolved: false,
            resolvedDamage: 0,
            settlementStage: 'preDamage',
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolveOffensivePreDefenseEffects(state.core, fixedRandom, 321);
        const requestedState = applyEvents(state.core, requestEvents);
        const firstRequest = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];
        const nanobotOption = firstRequest?.payload.options.find(option => option.labelKey === 'choices.artificerBotActivation.activateNanobotFree');

        expect(firstRequest?.payload.options.map(option => ({
            labelKey: option.labelKey,
            synth: option.labelParams?.synth,
        }))).toEqual([
            { labelKey: 'choices.artificerBotActivation.activateNanobotFree', synth: undefined },
            { labelKey: 'choices.artificerBotActivation.activateShockBotFree', synth: undefined },
            { labelKey: 'choices.artificerBotActivation.skip', synth: undefined },
        ]);

        const resolution = resolveChoiceWithFollowups(requestedState, {
            playerId: '0',
            customId: nanobotOption!.customId!,
            sourceAbilityId: 'overclock',
            value: nanobotOption!.value!,
            timestamp: 322,
            random: fixedRandom,
        });

        expect(resolution.nextState.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(resolution.nextState.players['0'].artificerBotState?.[TOKEN_IDS.NANOBOT]).toMatchObject({
            built: true,
            upgraded: false,
            activationsUsedThisTurn: 1,
        });
    });

    it('灵感突现 II 的从头构建可直接制造一个高级机器人', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        setArtificerAbilityLevel(state.core, 'eureka', 2);
        const ability = getArtificerAbility(state.core, 'eureka');
        const variant = ability.variants?.find(entry => entry.id === 'eureka-2-build-from-scratch');

        expect(variant?.trigger).toMatchObject({
            type: 'diceSet',
            faces: {
                [ARTIFICER_DICE_FACE_IDS.WRENCH]: 2,
                [ARTIFICER_DICE_FACE_IDS.GEAR]: 2,
            },
        });

        const requestEvents = resolveEffectsToEvents(variant?.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'eureka-2-build-from-scratch',
            state: state.core,
            damageDealt: 0,
            timestamp: 230,
        }, { random: fixedRandom });
        const requestedState = applyEvents(state.core, requestEvents);
        const choiceEvent = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];

        expect(choiceEvent?.payload.options).toMatchObject([
            { customId: 'artificer-build-from-scratch-resolve', value: 1 },
            { customId: 'artificer-build-from-scratch-resolve', value: 2 },
            { customId: 'artificer-build-from-scratch-resolve', value: 3 },
        ]);

        const resolvedState = reduce(requestedState, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                value: 2,
                customId: 'artificer-build-from-scratch-resolve',
                sourceAbilityId: 'eureka-2-build-from-scratch',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 231,
        } as DiceThroneEvent);

        expect(resolvedState.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(1);
        expect(resolvedState.players['0'].tokenStackLimits[TOKEN_IDS.SHOCK_BOT]).toBe(2);
        expect(resolvedState.players['0'].artificerBotState?.[TOKEN_IDS.SHOCK_BOT]).toMatchObject({
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 0,
        });
    });

    it('灵感突现 II 的从头构建也可把基础机器人升级为高级机器人', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        setArtificerBot(state.core, '0', TOKEN_IDS.NANOBOT);
        setArtificerAbilityLevel(state.core, 'eureka', 2);
        const ability = getArtificerAbility(state.core, 'eureka');
        const variant = ability.variants?.find(entry => entry.id === 'eureka-2-build-from-scratch');

        const requestEvents = resolveEffectsToEvents(variant?.effects ?? [], 'preDefense', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'eureka-2-build-from-scratch',
            state: state.core,
            damageDealt: 0,
            timestamp: 240,
        }, { random: fixedRandom });
        const requestedState = applyEvents(state.core, requestEvents);
        const choiceEvent = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];

        expect(choiceEvent?.payload.options).toEqual(expect.arrayContaining([
            expect.objectContaining({ customId: 'artificer-build-from-scratch-resolve', value: 4 }),
        ]));

        const resolvedState = reduce(requestedState, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                value: 4,
                customId: 'artificer-build-from-scratch-resolve',
                sourceAbilityId: 'eureka-2-build-from-scratch',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 241,
        } as DiceThroneEvent);

        expect(resolvedState.players['0'].tokens[TOKEN_IDS.NANOBOT]).toBe(1);
        expect(resolvedState.players['0'].tokenStackLimits[TOKEN_IDS.NANOBOT]).toBe(2);
        expect(resolvedState.players['0'].artificerBotState?.[TOKEN_IDS.NANOBOT]).toMatchObject({
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 0,
        });
    });
});
