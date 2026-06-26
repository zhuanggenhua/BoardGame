import { describe, expect, it } from 'vitest';
import { DiceThroneDomain } from '../domain';
import type { CharacterId, DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { resolveOffensivePreDefenseEffects, resolvePostDamageEffects } from '../domain/attack';
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
import { ARTIFICER_CARDS } from '../heroes/artificer/cards';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, PlayerId } from '../../../engine/types';
import { executePipeline } from '../../../engine/pipeline';
import { createHeroMatchup, createQueuedRandom, fixedRandom, getCardInteractionPrompt, testSystems } from './test-utils';

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
        const next = applyEvents(state.core, events);
        const roll = eventsOfType(events, 'BONUS_DIE_ROLLED')[0];
        const grant = eventsOfType(events, 'TOKEN_GRANTED')
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

    it('纳米机器人可消耗 1 个并引爆所有玩家的纳米爆弹', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'upkeep';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.NANOBOT] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        state.core.players['0'].statusEffects[STATUS_IDS.NANOBOMB] = 2;
        state.core.players['1'].statusEffects[STATUS_IDS.NANOBOMB] = 3;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 0,
        }), fixedRandom);
        const next = applyEvents(state.core, events);
        const damageByTarget = Object.fromEntries(
            eventsOfType(events, 'DAMAGE_DEALT')
                .filter(event => event.payload.sourceAbilityId === 'artificer-nanobot-detonate')
                .map(event => [event.payload.targetId, event.payload.amount]),
        );

        expect(next.players['0'].tokens[TOKEN_IDS.NANOBOT]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['0'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(damageByTarget).toEqual({ '0': 3, '1': 5 });
    });

    it('高级纳米机器人在维护阶段只需花费 1 合成器即可引爆', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'upkeep';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.NANOBOT] = 2;
        state.core.players['0'].tokenStackLimits = { ...(state.core.players['0'].tokenStackLimits ?? {}), [TOKEN_IDS.NANOBOT]: 2 };
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

    it('工匠可花费 3 合成器将基础机器人升级为 2 次使用机会', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 3;
        state.core.players['0'].tokens[TOKEN_IDS.SHOCK_BOT] = 1;

        const events = execute(state, command('USE_PASSIVE_ABILITY', '0', {
            passiveId: 'artificer-workshop',
            actionIndex: 7,
        }), fixedRandom);
        const next = applyEvents(state.core, events);
        const limitEvent = eventsOfType(events, 'TOKEN_LIMIT_CHANGED')
            .find(event => event.payload.tokenId === TOKEN_IDS.SHOCK_BOT);

        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(2);
        expect(next.players['0'].tokenStackLimits?.[TOKEN_IDS.SHOCK_BOT]).toBe(2);
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
        state.core.players['0'].tokens[TOKEN_IDS.SHOCK_BOT] = 1;
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

        expect(next.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(0);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.pendingDamage?.currentDamage).toBe(9);
        expect(next.pendingAttack?.bonusDamage).toBe(3);
    });

    it('高级电能机器人激活时只花费 1 合成器', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SHOCK_BOT] = 2;
        state.core.players['0'].tokenStackLimits = { ...(state.core.players['0'].tokenStackLimits ?? {}), [TOKEN_IDS.SHOCK_BOT]: 2 };
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
    });

    it('治疗机器人只在至少 6 点攻击伤害窗口可用，并按工匠骰面治疗 1 或 2', () => {
        const state = createHeroMatchup('monk', 'artificer')(['0', '1'], fixedRandom);
        state.core.players['1'].tokens[TOKEN_IDS.HEAL_BOT] = 1;
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
        const next = applyEvents(state.core, events);

        expect(next.players['1'].tokens[TOKEN_IDS.HEAL_BOT]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(42);
        expect(next.pendingDamage?.currentDamage).toBe(6);
        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')[0]?.payload.face).toBe('gear');
    });

    it('高级治疗机器人激活时只花费 1 合成器', () => {
        const state = createHeroMatchup('monk', 'artificer')(['0', '1'], fixedRandom);
        state.core.players['1'].tokens[TOKEN_IDS.HEAL_BOT] = 2;
        state.core.players['1'].tokenStackLimits = { ...(state.core.players['1'].tokenStackLimits ?? {}), [TOKEN_IDS.HEAL_BOT]: 2 };
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
        const next = applyEvents(state.core, events);

        expect(next.players['1'].tokens[TOKEN_IDS.HEAL_BOT]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(41);
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
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 1,
            face: 'wrench',
            effectKey: 'bonusDie.effect.artificerWrenchStrikeWrench',
        });
        expect(eventsOfType(events, 'BONUS_DAMAGE_ADDED')[0]?.payload).toMatchObject({
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
        const resolvedState = applyEvents(chosenState, resolvedEvents);

        expect(eventsOfType(resolvedEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            face: 'gear',
            effectKey: 'bonusDie.effect.artificerWrenchStrikeGear',
        });
        expect(eventsOfType(resolvedEvents, 'BONUS_DAMAGE_ADDED')[0]?.payload.amount).toBe(2);
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
        const resolvedState = applyEvents(chosenState, resolvedEvents);

        expect(eventsOfType(resolvedEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            face: 'electricity',
            effectKey: 'bonusDie.effect.artificerWrenchStrikeElectricity',
        });
        expect(eventsOfType(resolvedEvents, 'TOKEN_GRANTED')[0]?.payload).toMatchObject({
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
        expect(advanced.state.sys.interaction.current?.kind).toBe('simple-choice');
        expect(advanced.state.sys.interaction.current?.data?.sourceId).toBe('wrench-strike-2-4');

        const choiceOptions = advanced.state.sys.interaction.current?.data?.options ?? [];
        const electricityOption = choiceOptions.find(
            (option: { id?: string; value?: { customId?: string } }) =>
                option?.value?.customId === 'artificer-wrench-strike-spend-electricity',
        );
        expect(electricityOption?.id).toBeTruthy();

        const responded = executePipeline(
            pipelineConfig,
            advanced.state,
            command('SYS_INTERACTION_RESPOND', '0', {
                interactionId: advanced.state.sys.interaction.current?.id,
                optionId: electricityOption?.id,
            }),
            fixedRandom,
            playerIds,
        );
        expect(responded.success).toBe(true);
        expect(responded.state.sys.phase).toBe('defensiveRoll');
        expect(responded.state.sys.interaction.current).toBeUndefined();
        expect(responded.state.core.pendingAttack?.sourceAbilityId).toBe('wrench-strike-2-4');
        expect(responded.state.core.pendingAttack?.preDefenseResolved).toBe(true);
        expect(responded.state.core.pendingAttack?.defenseAbilityId).toBe('meditation');
        expect(responded.state.core.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(1);

        const bonusDie = eventsOfType(responded.events as DiceThroneEvent[], 'BONUS_DIE_ROLLED')[0];
        expect(bonusDie?.payload).toMatchObject({
            value: 6,
            face: 'electricity',
            effectKey: 'bonusDie.effect.artificerWrenchStrikeElectricity',
        });
        const tokenGranted = eventsOfType(responded.events as DiceThroneEvent[], 'TOKEN_GRANTED')[0];
        expect(tokenGranted?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.SYNTH,
            amount: 1,
            sourceAbilityId: 'wrench-strike-2-4',
        });
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
        const afterElectricity = applyEvents(electricityState.core, electricityEvents);

        expect(eventsOfType(electricityEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 6,
            face: 'electricity',
            effectKey: 'bonusDie.effect.artificerMasterpieceElectricity',
        });
        expect(afterElectricity.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(5);
        expect(eventsOfType(electricityEvents, 'CARD_DRAWN')).toHaveLength(0);

        const drawState = createArtificerCardPlayState('card-artificer-masterpiece');
        drawState.core.players['0'].deck = [getArtificerCard('card-artificer-voltage')];
        const drawEvents = execute(drawState, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-masterpiece',
        }), createQueuedRandom([1]));
        const afterDraw = applyEvents(drawState.core, drawEvents);

        expect(eventsOfType(drawEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 1,
            face: 'wrench',
            effectKey: 'bonusDie.effect.artificerMasterpieceOther',
        });
        expect(eventsOfType(drawEvents, 'CARD_DRAWN')).toHaveLength(1);
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
        const afterWrench = applyEvents(wrenchState.core, wrenchEvents);

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
        const afterGear = applyEvents(gearState.core, gearEvents);

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
        const afterElectricity = applyEvents(electricityState.core, electricityEvents);

        expect(eventsOfType(electricityEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 6,
            face: 'electricity',
            effectKey: 'bonusDie.effect.artificerOverdriveElectricity',
        });
        expect(afterElectricity.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });

    it('万能电流在 4 人组队局会先创建仅列敌方的选目标交互，并在选定目标后按电能分支施加纳米爆弹', () => {
        const state = createFourPlayerArtificerCardPlayState('card-artificer-overdrive');
        const playEvents = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-overdrive',
        }), createQueuedRandom([6]));
        const reducedCore = applyEvents(state.core, playEvents);
        const system = createDiceThroneEventSystem();
        const afterPlay = system.afterEvents?.({
            state: { ...state, core: reducedCore },
            events: playEvents,
            random: createQueuedRandom([6]),
        } as any);

        if (!afterPlay || Array.isArray(afterPlay) || !('state' in afterPlay)) {
            throw new Error('万能电流未创建多人目标选择交互');
        }

        const promptState = afterPlay.state as MatchState<DiceThroneCore>;
        const interaction = getCardInteractionPrompt(promptState, 'card-artificer-overdrive');
        expect(interaction).toMatchObject({
            type: 'selectPlayer',
            sourceCardId: 'card-artificer-overdrive',
            selectCount: 1,
            resolveCustomActionId: 'resolve-card-effects-on-selected-opponent',
        });
        expect(interaction.targetPlayerIds).toEqual(['1', '3']);

        const resolveEvents = execute(promptState, command('RESOLVE_INTERACTION', '0', {
            selectedPlayerIds: ['3'],
        }), createQueuedRandom([6]));
        const next = applyEvents(promptState.core, resolveEvents);

        expect(eventsOfType(resolveEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 6,
            face: 'electricity',
            effectKey: 'bonusDie.effect.artificerOverdriveElectricity',
        });
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(next.players['3'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });

    it('这玩意儿真棒按骰值一半向上取整获得合成器', () => {
        const state = createArtificerCardPlayState('card-artificer-perfectly-calibrated');
        const events = execute(state, command('PLAY_CARD', '0', {
            cardId: 'card-artificer-perfectly-calibrated',
        }), createQueuedRandom([5]));
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 5,
            face: 'gear',
            effectKey: 'bonusDie.effect.artificerPerfectlyCalibrated',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(3);
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
        state.core.players['0'].tokens[TOKEN_IDS.NANOBOT] = 2;
        state.core.players['0'].tokenStackLimits = {
            ...(state.core.players['0'].tokenStackLimits ?? {}),
            [TOKEN_IDS.NANOBOT]: 2,
        };
        state.core.players['0'].tokens[TOKEN_IDS.SHOCK_BOT] = 1;
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

    it('基础版稍作调整获得 1 合成器，且只要投出电能就施加 1 纳米爆弹', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 0;
        setPlayerDiceValues(state.core, '0', [6, 1, 4, 2]);
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
            amount: 1,
            newTotal: 1,
            sourceAbilityId: 'tinker',
        });
        expect(eventsOfType(events, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.NANOBOMB,
            stacks: 1,
            newTotal: 1,
            sourceAbilityId: 'tinker',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(1);
        expect(next.players['1'].statusEffects[STATUS_IDS.NANOBOMB]).toBe(1);
    });

    it('真本能量的机器人激活链会二次请求且第二次不能重复选择同一机器人', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 4;
        state.core.players['0'].tokens[TOKEN_IDS.NANOBOT] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.SHOCK_BOT] = 1;
        state.core.players['1'].statusEffects[STATUS_IDS.NANOBOMB] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'maximum-power',
            damageResolved: true,
            resolvedDamage: 10,
            settlementStage: 'postDamagePending',
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolvePostDamageEffects(state.core, fixedRandom, 300);
        const requestedState = applyEvents(state.core, requestEvents);
        const firstRequest = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];
        const nanobotOption = firstRequest?.payload.options.find(option => option.labelKey === 'choices.artificerBotActivation.activateNanobot');

        expect(firstRequest?.payload.titleKey).toBe('choices.artificerBotActivation.titleMultiple');
        expect(firstRequest?.payload.options.map(option => option.labelKey)).toEqual(expect.arrayContaining([
            'choices.artificerBotActivation.activateNanobot',
            'choices.artificerBotActivation.activateShockBot',
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

        expect(firstResolution.nextState.players['0'].tokens[TOKEN_IDS.NANOBOT]).toBe(0);
        expect(firstResolution.nextState.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(2);
        expect(firstResolution.nextState.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0).toBe(0);
        expect(firstResolution.nextState.players['1'].resources[RESOURCE_IDS.HP]).toBe(47);
        expect(secondRequest?.payload.titleKey).toBe('choices.artificerBotActivation.titleSingle');
        expect(secondRequest?.payload.options.map(option => option.labelKey)).toEqual([
            'choices.artificerBotActivation.activateShockBot',
        ]);

        const shockOption = secondRequest!.payload.options[0]!;
        const secondResolution = resolveChoiceWithFollowups(firstResolution.nextState, {
            playerId: '0',
            customId: shockOption.customId!,
            sourceAbilityId: 'maximum-power',
            value: shockOption.value!,
            timestamp: 302,
            random: fixedRandom,
        });

        expect(eventsOfType(secondResolution.followupEvents, 'CHOICE_REQUESTED')).toHaveLength(0);
        expect(secondResolution.nextState.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(0);
        expect(secondResolution.nextState.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(secondResolution.nextState.players['1'].resources[RESOURCE_IDS.HP]).toBe(44);
        expect(secondResolution.nextState.pendingAttack?.postDamageFollowUpResolved).toBe(true);
        expect(secondResolution.nextState.pendingAttack?.settlementStage).toBe('readyToResolve');
    });

    it('电能脉冲选择治疗机器人时会按工匠骰面真实治疗并收口攻击链', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        state.core.players['0'].tokens[TOKEN_IDS.HEAL_BOT] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 40;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            damageResolved: true,
            resolvedDamage: 9,
            settlementStage: 'postDamagePending',
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolvePostDamageEffects(state.core, fixedRandom, 310);
        const requestedState = applyEvents(state.core, requestEvents);
        const firstRequest = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];
        const healOption = firstRequest?.payload.options.find(option => option.labelKey === 'choices.artificerBotActivation.activateHealBot');

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
        expect(resolution.nextState.players['0'].resources[RESOURCE_IDS.HP]).toBe(42);
        expect(resolution.nextState.players['0'].tokens[TOKEN_IDS.HEAL_BOT]).toBe(0);
        expect(resolution.nextState.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(0);
        expect(resolution.nextState.pendingAttack?.postDamageFollowUpResolved).toBe(true);
    });

    it('攻击后机器人选择生成后应暂停攻击结算并保留 pendingAttack', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        state.core.players['0'].tokens[TOKEN_IDS.SHOCK_BOT] = 1;
        state.core.activePlayerId = '0';
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shock-bot',
            damageResolved: true,
            resolvedDamage: 9,
            settlementStage: 'postDamagePending',
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
        expect(next.pendingAttack?.settlementStage).toBe('postDamagePending');
    });

    it('超频运行在合成器不足时不提供基础机器人，但高级机器人仍可被激活', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.NANOBOT] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.SHOCK_BOT] = 2;
        state.core.players['0'].tokenStackLimits = {
            ...(state.core.players['0'].tokenStackLimits ?? {}),
            [TOKEN_IDS.SHOCK_BOT]: 2,
        };
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'overclock',
            damageResolved: true,
            resolvedDamage: 6,
            settlementStage: 'postDamagePending',
        } as DiceThroneCore['pendingAttack'];

        const requestEvents = resolvePostDamageEffects(state.core, fixedRandom, 320);
        const firstRequest = eventsOfType(requestEvents, 'CHOICE_REQUESTED')[0];

        expect(firstRequest?.payload.options.map(option => ({
            labelKey: option.labelKey,
            synth: option.labelParams?.synth,
        }))).toEqual([
            { labelKey: 'choices.artificerBotActivation.activateShockBot', synth: 1 },
            { labelKey: 'choices.artificerBotActivation.skip', synth: undefined },
        ]);
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

        expect(resolvedState.players['0'].tokens[TOKEN_IDS.SHOCK_BOT]).toBe(2);
        expect(resolvedState.players['0'].tokenStackLimits[TOKEN_IDS.SHOCK_BOT]).toBe(2);
    });

    it('灵感突现 II 的从头构建也可把基础机器人升级为高级机器人', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.NANOBOT] = 1;
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

        expect(resolvedState.players['0'].tokens[TOKEN_IDS.NANOBOT]).toBe(2);
        expect(resolvedState.players['0'].tokenStackLimits[TOKEN_IDS.NANOBOT]).toBe(2);
    });
});
