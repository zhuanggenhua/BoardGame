/**
 * 大杀四方 - 僵尸派系能力
 *
 * 主题：从弃牌堆复活随从、弃牌堆操作
 */

import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext } from '../domain/abilityRegistry';
import { SU_EVENTS } from '../domain/types';
import type {
    DeckReorderedEvent,
    SmashUpEvent,
    SmashUpCore,
    MinionCardDef,
    MinionPlayedEvent,
    CardsMilledEvent,
    CardInstance,
} from '../domain/types';
import { recoverCardsFromDiscard, grantContextualExtraMinion, buildBaseTargetOptions, buildAbilityFeedback, peekDeckTop } from '../domain/abilityHelpers';
import type { MatchState, PlayerId } from '../../../engine/types';
import { registerRestriction } from '../domain/ongoingEffects';
import type { RestrictionCheckContext } from '../domain/ongoingEffects';
import { getCardDef, getBaseDef } from '../data/cards';
import { validateDiscardMinionPlaySemantics } from '../domain/playLegality';
import { registerDiscardPlayProvider } from '../domain/discardPlayability';
import {
    createAbilityRuntimeSimpleChoice,
    createBranchProgram,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';

type ZombiePromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type ZombieDiscardOption = {
    cardUid: string;
    defId: string;
    label: string;
    type?: CardInstance['type'];
    power?: number;
};

type ZombieDiscardChoice = {
    cardUid?: string;
    defId?: string;
    power?: number;
    baseIndex?: number;
    skip?: boolean;
    done?: boolean;
    action?: 'discard' | 'keep';
};

type ZombieBaseChoice = {
    baseIndex?: number;
};

type ZombieGraveDiggerContext = ZombiePromptContext & {
    minionsInDiscard: ZombieDiscardOption[];
};

type ZombieWalkerContext = ZombiePromptContext & {
    peekEvents: SmashUpEvent[];
    cardUid: string;
    defId: string;
    cardName: string;
};

type ZombieGraveRobbingContext = ZombiePromptContext & {
    discardCards: ZombieDiscardOption[];
};

type ZombieNotEnoughBulletsContext = ZombiePromptContext & {
    groups: Array<{ defId: string; name: string; count: number }>;
};

type ZombieLendAHandContext = ZombiePromptContext & {
    discardCards: ZombieDiscardOption[];
};

type ZombieOutbreakContext = ZombiePromptContext & {
    emptyBases: Array<{ baseIndex: number; label: string }>;
};

type ZombieMallCrawlContext = ZombiePromptContext & {
    groups: Array<{ defId: string; label: string }>;
};

type ZombieTheyKeepComingContext = ZombiePromptContext & {
    discardMinions: ZombieDiscardOption[];
    allowedBaseIndices: number[];
};

type ZombieLordContext = ZombiePromptContext & {
    emptyBases: Array<{ baseIndex: number; label: string }>;
    availableMinions: ZombieDiscardOption[];
    usedCardUids: string[];
    filledBases: number[];
};

/** 注册僵尸派系所有能力*/
export function registerZombieAbilities(): void {
    registerAbilityProgram('zombie_grave_digger', 'onPlay', { program: zombieGraveDiggerProgram, createContext: createZombieGraveDiggerContext });
    registerAbilityProgram('zombie_walker', 'onPlay', { program: zombieWalkerProgram, createContext: createZombieWalkerContext });
    registerAbilityProgram('zombie_grave_robbing', 'onPlay', { program: zombieGraveRobbingProgram, createContext: createZombieGraveRobbingContext });
    registerAbilityProgram('zombie_not_enough_bullets', 'onPlay', { program: zombieNotEnoughBulletsProgram, createContext: createZombieNotEnoughBulletsContext });
    registerAbilityProgram('zombie_lend_a_hand', 'onPlay', { program: zombieLendAHandProgram, createContext: createZombieLendAHandContext });
    registerAbilityProgram('zombie_outbreak', 'onPlay', { program: zombieOutbreakProgram, createContext: createZombieOutbreakContext });
    registerAbilityProgram('zombie_mall_crawl', 'onPlay', { program: zombieMallCrawlProgram, createContext: createZombieMallCrawlContext });
    registerAbilityProgram('zombie_lord', 'onPlay', { program: zombieLordProgram, createContext: createZombieLordContext });
    // 它们不断来临：从弃牌堆额外打出一个随从
    registerAbilityProgram('zombie_they_keep_coming', 'onPlay', { program: zombieTheyKeepComingProgram, createContext: createZombieTheyKeepComingContext });
    registerAbilityProgram('zombie_they_keep_coming_pod', 'onPlay', { program: zombieTheyKeepComingProgram, createContext: createZombieTheyKeepComingContext }); // POD 规则没变

    // 常规行动/随从也映射 POD
    registerAbilityProgram('zombie_grave_digger_pod', 'onPlay', { program: zombieGraveDiggerProgram, createContext: createZombieGraveDiggerContext });
    registerAbilityProgram('zombie_walker_pod', 'onPlay', { program: zombieWalkerProgram, createContext: createZombieWalkerContext });
    registerAbilityProgram('zombie_grave_robbing_pod', 'onPlay', { program: zombieGraveRobbingProgram, createContext: createZombieGraveRobbingContext });
    registerAbilityProgram('zombie_not_enough_bullets_pod', 'onPlay', { program: zombieNotEnoughBulletsProgram, createContext: createZombieNotEnoughBulletsContext });
    registerAbilityProgram('zombie_lend_a_hand_pod', 'onPlay', { program: zombieLendAHandProgram, createContext: createZombieLendAHandContext });
    registerAbilityProgram('zombie_outbreak_pod', 'onPlay', { program: zombieOutbreakProgram, createContext: createZombieOutbreakContext });
    registerAbilityProgram('zombie_mall_crawl_pod', 'onPlay', { program: zombieMallCrawlProgram, createContext: createZombieMallCrawlContext });
    registerAbilityProgram('zombie_lord_pod', 'onPlay', { program: zombieLordProgram, createContext: createZombieLordContext });

    // === ongoing 效果注册 ===
    // 泛滥横行：这里只注册“其他玩家不能打随从到此基地”；到期离场由卡牌定义里的 lifecycle 统一注册。
    registerRestriction('zombie_overrun', 'play_minion', zombieOverrunRestriction);
    registerAbility('zombie_overrun', 'onPlay', () => []);

    registerRestriction('zombie_overrun_pod', 'play_minion', zombieOverrunRestriction);
    registerAbility('zombie_overrun_pod', 'onPlay', () => []);

    // === 弃牌堆出牌能力注册 ===
    // 顽强丧尸：被动，弃牌堆中可作为额外随从打出（每回合限一次）
    registerDiscardPlayProvider({
        id: 'zombie_tenacious_z',
        getPlayableCards(core, playerId) {
            const player = core.players[playerId];
            if (!player) return [];
            // 每回合限一次（能力级别限制，不是卡牌级别）
            if (player.usedDiscardPlayAbilities?.includes('zombie_tenacious_z')) return [];
            const cards = player.discard.filter(c => c.defId === 'zombie_tenacious_z' || c.defId === 'zombie_tenacious_z_pod');
            if (cards.length === 0) return [];
            // 返回所有同 defId 的卡牌，用户选哪张都行（同名卡无区别）
            return cards.map(card => {
                const def = getCardDef(card.defId) as MinionCardDef | undefined;
                return {
                    card,
                    allowedBaseIndices: 'all' as const,
                    consumesNormalLimit: false, // 额外打出，不消耗正常额度
                    sourceId: 'zombie_tenacious_z',
                    defId: card.defId,
                    power: def?.power ?? 0,
                    name: def?.name ?? card.defId,
                }
            });
        },
    });

    // 它们为你而来（ongoing 行动卡）：在该基地打随从时，可从弃牌堆而不是手牌打出。
    // 这不是“额外打出”，而是替代正常随从来源，因此会消耗正常随从额度。
    registerDiscardPlayProvider({
        id: 'zombie_theyre_coming_to_get_you',
        getPlayableCards(core, playerId) {
            const player = core.players[playerId];
            if (!player) return [];
            // 找到所有附着了此 ongoing 卡的基地
            const allowedBases: number[] = [];

            for (let i = 0; i < core.bases.length; i++) {
                const base = core.bases[i];
                for (const o of base.ongoingActions) {
                    const ongoingControllerId = (o.metadata?.sourceControllerId as PlayerId | undefined) ?? o.ownerId;
                    if (ongoingControllerId === playerId && (o.defId === 'zombie_theyre_coming_to_get_you' || o.defId === 'zombie_theyre_coming_to_get_you_pod')) {
                        allowedBases.push(i);
                    }
                }
            }
            if (allowedBases.length === 0) return [];
            // 弃牌堆中所有随从都可打出到这些基地
            const minions = player.discard.filter(c => c.type === 'minion');
            return minions.flatMap(card => {
                const def = getCardDef(card.defId) as MinionCardDef | undefined;
                const options = [];
                for (const bIndex of allowedBases) {
                    options.push({
                        card,
                        allowedBaseIndices: [bIndex], // 每个基地由于可能额度消耗不同，必须拆分选项
                        consumesNormalLimit: true,
                        sourceId: 'zombie_theyre_coming_to_get_you',
                        defId: card.defId,
                        power: def?.power ?? 0,
                        name: def?.name ?? card.defId,
                    });
                }
                return options;
            });
        },
    });
}
/** 掘墓者 onPlay：从弃牌堆取回一个随从到手牌 */
function createZombieGraveDiggerContext(ctx: AbilityContext): ZombieGraveDiggerContext {
    const player = ctx.state.players[ctx.playerId];
    const minionsInDiscard = player.discard
        .filter((card) => card.type === 'minion')
        .map((card) => {
            const def = getCardDef(card.defId);
            const name = def?.name ?? card.defId;
            return { cardUid: card.uid, defId: card.defId, label: name, type: card.type };
        });
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        minionsInDiscard,
    };
}
function createZombieWalkerContext(ctx: AbilityContext): ZombieWalkerContext {
    const peek = peekDeckTop(
        ctx.state,
        ctx.random,
        ctx.playerId,
        'none',
        'zombie_walker',
        ctx.now,
    );
    if (!peek) {
        return {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            peekEvents: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)],
            cardUid: '',
            defId: '',
            cardName: '',
        };
    }
    const topCard = peek.card;
    const def = getCardDef(topCard.defId);
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        peekEvents: peek.events,
        cardUid: topCard.uid,
        defId: topCard.defId,
        cardName: def?.name ?? topCard.defId,
    };
}

function createZombieGraveRobbingContext(ctx: AbilityContext): ZombieGraveRobbingContext {
    const player = ctx.state.players[ctx.playerId];
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        discardCards: player.discard.map((card) => {
            const def = getCardDef(card.defId);
            const name = def?.name ?? card.defId;
            return {
                cardUid: card.uid,
                defId: card.defId,
                label: `${name} (${card.type === 'minion' ? '随从' : '行动'})`,
                type: card.type,
            };
        }),
    };
}

function createZombieNotEnoughBulletsContext(ctx: AbilityContext): ZombieNotEnoughBulletsContext {
    const player = ctx.state.players[ctx.playerId];
    const groups = new Map<string, { defId: string; name: string; count: number }>();
    for (const card of player.discard.filter((entry) => entry.type === 'minion')) {
        if (!groups.has(card.defId)) {
            const def = getCardDef(card.defId);
            groups.set(card.defId, { defId: card.defId, name: def?.name ?? card.defId, count: 0 });
        }
        groups.get(card.defId)!.count += 1;
    }
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        groups: Array.from(groups.values()),
    };
}

function createZombieLendAHandContext(ctx: AbilityContext): ZombieLendAHandContext {
    const player = ctx.state.players[ctx.playerId];
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        discardCards: player.discard.map((card) => {
            const def = getCardDef(card.defId);
            const name = def?.name ?? card.defId;
            return {
                cardUid: card.uid,
                defId: card.defId,
                label: `${name} (${card.type === 'minion' ? '随从' : '行动'})`,
                type: card.type,
            };
        }),
    };
}

function createZombieOutbreakContext(ctx: AbilityContext): ZombieOutbreakContext {
    const emptyBases: Array<{ baseIndex: number; label: string }> = [];
    for (let index = 0; index < ctx.state.bases.length; index += 1) {
        if (!ctx.state.bases[index].minions.some((minion) => minion.controller === ctx.playerId)) {
            const baseDef = getBaseDef(ctx.state.bases[index].defId);
            emptyBases.push({ baseIndex: index, label: baseDef?.name ?? `基地 ${index + 1}` });
        }
    }
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        emptyBases,
    };
}

function createZombieMallCrawlContext(ctx: AbilityContext): ZombieMallCrawlContext {
    const player = ctx.state.players[ctx.playerId];
    const groups = new Map<string, { defId: string; label: string }>();
    for (const card of player.deck) {
        if (groups.has(card.defId)) continue;
        const count = player.deck.filter((entry) => entry.defId === card.defId).length;
        const def = getCardDef(card.defId);
        const name = def?.name ?? card.defId;
        groups.set(card.defId, { defId: card.defId, label: `${name} (×${count})` });
    }
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        groups: Array.from(groups.values()),
    };
}

function createZombieTheyKeepComingContext(ctx: AbilityContext): ZombieTheyKeepComingContext {
    const player = ctx.state.players[ctx.playerId];
    const discardMinions = player.discard
        .filter((card) => card.type === 'minion')
        .map((card) => {
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            const name = def?.name ?? card.defId;
            const power = def?.power ?? 0;
            return {
                cardUid: card.uid,
                defId: card.defId,
                label: `${name} (力量 ${power})`,
                type: card.type,
                power,
            };
        });
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        discardMinions,
        allowedBaseIndices: ctx.state.bases.map((_, index) => index),
    };
}

function createZombieLordContext(ctx: AbilityContext): ZombieLordContext {
    const outbreakContext = createZombieOutbreakContext(ctx);
    const player = ctx.state.players[ctx.playerId];
    const availableMinions = player.discard
        .filter((card) => {
            if (card.type !== 'minion') return false;
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            return def != null && def.power <= 2;
        })
        .map((card) => {
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            const name = def?.name ?? card.defId;
            return {
                cardUid: card.uid,
                defId: card.defId,
                power: def?.power ?? 0,
                label: `${name} (力量 ${def?.power ?? 0})`,
                type: card.type,
            };
        });
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        emptyBases: outbreakContext.emptyBases,
        availableMinions,
        usedCardUids: [],
        filledBases: [],
    };
}

function buildZombieDiscardCardOptions(cards: ZombieDiscardOption[]) {
    return cards.map((card, index) => ({
        id: `card-${index}`,
        label: card.label,
        value: {
            cardUid: card.cardUid,
            defId: card.defId,
            ...(card.power !== undefined ? { power: card.power } : {}),
        },
        _source: 'discard' as const,
        displayMode: 'card' as const,
    }));
}

function attachOptionsGenerator<T>(
    interaction: ReturnType<typeof createAbilityRuntimeSimpleChoice<T>>,
    optionsGenerator: (state: MatchState<SmashUpCore>) => unknown[],
) {
    (interaction.data as Record<string, unknown>).optionsGenerator = optionsGenerator;
    return interaction;
}

const zombieGraveDiggerPromptProgram = createPromptProgram<ZombieGraveDiggerContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zombie_grave_digger',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `zombie_grave_digger_${context.now}`,
            context.playerId,
            '选择要从弃牌堆取回的随从（可跳过）',
            [
                ...buildZombieDiscardCardOptions(context.minionsInDiscard),
                {
                    id: 'skip',
                    label: '跳过',
                    labelKey: 'ui.zombie_grave_digger_skip_option',
                    value: { skip: true },
                    displayMode: 'button' as const,
                },
            ],
            {
                sourceId: 'zombie_grave_digger',
                titleKey: 'ui.zombie_grave_digger_title',
                targetType: 'generic',
            },
        ),
        (state) => {
            const player = state.core.players[context.playerId];
            const minions = player.discard
                .filter((card) => card.type === 'minion')
                .map((card) => {
                    const def = getCardDef(card.defId);
                    const name = def?.name ?? card.defId;
                    return { cardUid: card.uid, defId: card.defId, label: name };
                });
            return [
                ...buildZombieDiscardCardOptions(minions),
                {
                    id: 'skip',
                    label: '跳过',
                    labelKey: 'ui.zombie_grave_digger_skip_option',
                    value: { skip: true },
                    displayMode: 'button' as const,
                },
            ];
        },
    ),
    onResolve: ({ playerId, value, timestamp }) => {
        const choice = value as ZombieDiscardChoice;
        if (choice.skip || !choice.cardUid) return { events: [] };
        return { events: [recoverCardsFromDiscard(playerId, [choice.cardUid], 'zombie_grave_digger', timestamp)] };
    },
});

const zombieGraveDiggerProgram = createBranchProgram<ZombieGraveDiggerContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.minionsInDiscard.length === 0,
    then: createEffectProgram((context) => ({ events: [buildAbilityFeedback(context.playerId, 'feedback.discard_empty', context.now)] })),
    else: zombieGraveDiggerPromptProgram,
});

const zombieWalkerChoiceProgram = createPromptProgram<ZombieWalkerContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zombie_walker',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `zombie_walker_${context.now}`,
        context.playerId,
        `牌库顶是「${context.cardName}」，选择处理方式`,
        [
            {
                id: 'discard',
                label: '弃掉',
                labelKey: 'ui.zombie_walker_discard_option',
                value: { action: 'discard' },
                displayMode: 'button' as const,
            },
            {
                id: 'keep',
                label: '放回牌库顶',
                labelKey: 'ui.zombie_walker_keep_option',
                value: { action: 'keep' },
                displayMode: 'button' as const,
            },
        ],
        { sourceId: 'zombie_walker', targetType: 'button', displayCard: { defId: context.defId, cardUid: context.cardUid } },
    ),
    onResolve: ({ context, playerId, value, timestamp }) => {
        const choice = value as ZombieDiscardChoice;
        if (choice.action !== 'discard' || !context.cardUid) {
            return { events: [] };
        }
        return {
            events: [{
                type: SU_EVENTS.CARDS_MILLED,
                payload: { playerId, cardUids: [context.cardUid], reason: 'zombie_walker' },
                timestamp,
            } as CardsMilledEvent],
        };
    },
});

const zombieWalkerProgram = createEffectProgram<ZombieWalkerContext, SmashUpCore, SmashUpEvent>((context) => {
    if (!context.cardUid) {
        return { events: context.peekEvents };
    }
    const promptResult = executeAbilityProgram(zombieWalkerChoiceProgram, context);
    return {
        events: [...context.peekEvents, ...promptResult.events],
        matchState: promptResult.matchState,
        suspended: promptResult.suspended,
        continuationId: promptResult.continuationId,
    };
});

const zombieGraveRobbingPromptProgram = createPromptProgram<ZombieGraveRobbingContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zombie_grave_robbing',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `zombie_grave_robbing_${context.now}`,
            context.playerId,
            '选择要从弃牌堆取回的卡牌',
            buildZombieDiscardCardOptions(context.discardCards),
            {
                sourceId: 'zombie_grave_robbing',
                titleKey: 'ui.zombie_grave_robbing_title',
                targetType: 'generic',
            },
        ),
        (state) => {
            const player = state.core.players[context.playerId];
            return buildZombieDiscardCardOptions(player.discard.map((card) => {
                const def = getCardDef(card.defId);
                const name = def?.name ?? card.defId;
                return {
                    cardUid: card.uid,
                    defId: card.defId,
                    label: `${name} (${card.type === 'minion' ? '随从' : '行动'})`,
                    type: card.type,
                };
            }));
        },
    ),
    onResolve: ({ playerId, value, timestamp }) => {
        const choice = value as ZombieDiscardChoice;
        if (!choice.cardUid) return { events: [] };
        return { events: [recoverCardsFromDiscard(playerId, [choice.cardUid], 'zombie_grave_robbing', timestamp)] };
    },
});

const zombieGraveRobbingProgram = createBranchProgram<ZombieGraveRobbingContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.discardCards.length === 0,
    then: createEffectProgram((context) => ({ events: [buildAbilityFeedback(context.playerId, 'feedback.discard_empty', context.now)] })),
    else: zombieGraveRobbingPromptProgram,
});

const zombieNotEnoughBulletsPromptProgram = createPromptProgram<ZombieNotEnoughBulletsContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zombie_not_enough_bullets',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `zombie_not_enough_bullets_${context.now}`,
        context.playerId,
        '选择要取回的随从名（取回所有同名随从）',
        context.groups.map((group, index) => ({
            id: `group-${index}`,
            label: `${group.name} (×${group.count})`,
            value: { defId: group.defId },
        })),
        {
            sourceId: 'zombie_not_enough_bullets',
            titleKey: 'ui.zombie_not_enough_bullets_title',
            targetType: 'generic',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as ZombieDiscardChoice;
        if (!choice.defId) return { events: [] };
        const player = state.core.players[playerId];
        const sameNameMinions = player.discard.filter((card) => card.type === 'minion' && card.defId === choice.defId);
        if (sameNameMinions.length === 0) return { events: [] };
        return {
            events: [recoverCardsFromDiscard(playerId, sameNameMinions.map((card) => card.uid), 'zombie_not_enough_bullets', timestamp)],
        };
    },
});

const zombieNotEnoughBulletsProgram = createBranchProgram<ZombieNotEnoughBulletsContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.groups.length === 0,
    then: createEffectProgram((context) => ({ events: [buildAbilityFeedback(context.playerId, 'feedback.discard_empty', context.now)] })),
    else: zombieNotEnoughBulletsPromptProgram,
});

const zombieLendAHandPromptProgram = createPromptProgram<ZombieLendAHandContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zombie_lend_a_hand',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `zombie_lend_a_hand_${context.now}`,
            context.playerId,
            '借把手：选择要洗回牌库的卡牌（任意数量，可不选）',
            buildZombieDiscardCardOptions(context.discardCards),
            {
                sourceId: 'zombie_lend_a_hand',
                titleKey: 'ui.zombie_lend_a_hand_title',
                targetType: 'generic',
                multi: { min: 0, max: context.discardCards.length },
            },
        ),
        (state) => {
            const player = state.core.players[context.playerId];
            return buildZombieDiscardCardOptions(player.discard.map((card) => {
                const def = getCardDef(card.defId);
                const name = def?.name ?? card.defId;
                return {
                    cardUid: card.uid,
                    defId: card.defId,
                    label: `${name} (${card.type === 'minion' ? '随从' : '行动'})`,
                    type: card.type,
                };
            }));
        },
    ),
    onResolve: ({ state, playerId, value, random, timestamp }) => {
        const selections = (Array.isArray(value) ? value : [value]) as ZombieDiscardChoice[];
        const selectedUids = new Set(selections.map((selection) => selection.cardUid).filter(Boolean));
        if (selectedUids.size === 0) return { events: [] };
        const player = state.core.players[playerId];
        const selectedCards = player.discard.filter((card) => selectedUids.has(card.uid));
        const cardsByOwner = new Map<PlayerId, CardInstance[]>();
        for (const card of selectedCards) {
            const ownerCards = cardsByOwner.get(card.owner) ?? [];
            ownerCards.push(card);
            cardsByOwner.set(card.owner, ownerCards);
        }
        const events: DeckReorderedEvent[] = [];
        for (const [ownerId, cards] of cardsByOwner) {
            const owner = state.core.players[ownerId];
            if (!owner) continue;
            const combined = [...owner.deck, ...cards];
            const shuffled = random.shuffle([...combined]);
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    deckUids: shuffled.map((card) => card.uid),
                    ...(ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
                },
                timestamp,
            } as DeckReorderedEvent);
        }
        return { events };
    },
});

const zombieLendAHandProgram = createBranchProgram<ZombieLendAHandContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.discardCards.length === 0,
    then: createEffectProgram((context) => ({ events: [buildAbilityFeedback(context.playerId, 'feedback.discard_empty', context.now)] })),
    else: zombieLendAHandPromptProgram,
});

const zombieOutbreakChooseBasePromptProgram = createPromptProgram<ZombieOutbreakContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zombie_outbreak_choose_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `zombie_outbreak_base_${context.now}`,
        context.playerId,
        '爆发：选择一个没有你随从的基地',
        buildBaseTargetOptions(context.emptyBases, context.matchState.core),
        {
            sourceId: 'zombie_outbreak_choose_base',
            titleKey: 'ui.zombie_outbreak_choose_base_title',
            targetType: 'base',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as ZombieBaseChoice;
        if (choice.baseIndex === undefined) return { events: [] };
        return {
            events: [grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'zombie_outbreak', choice.baseIndex)],
        };
    },
});

const zombieOutbreakProgram = createBranchProgram<ZombieOutbreakContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.emptyBases.length === 0,
    then: createEffectProgram((context) => ({ events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] })),
    else: createBranchProgram({
        when: (context) => !context.matchState,
        then: createEffectProgram(() => ({ events: [] })),
        else: zombieOutbreakChooseBasePromptProgram,
    }),
});

function buildZombieMallCrawlEvents(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    defId: string,
    random: { shuffle<T>(items: T[]): T[] },
    timestamp: number,
): SmashUpEvent[] {
    const player = state.core.players[playerId];
    const sameNameCards = player.deck.filter((card) => card.defId === defId);
    if (sameNameCards.length === 0) {
        const shuffled = random.shuffle([...player.deck]);
        return [
            { type: SU_EVENTS.DECK_REORDERED, payload: { playerId, deckUids: shuffled.map((card) => card.uid) }, timestamp } as DeckReorderedEvent,
            buildAbilityFeedback(playerId, 'feedback.deck_search_no_match', timestamp),
        ];
    }
    const uids = sameNameCards.map((card) => card.uid);
    const remainingDeck = player.deck.filter((card) => card.defId !== defId);
    const shuffledRemaining = random.shuffle([...remainingDeck]);
    const deckUids = [...uids, ...shuffledRemaining.map((card) => card.uid)];
    return [
        { type: SU_EVENTS.DECK_REORDERED, payload: { playerId, deckUids }, timestamp } as DeckReorderedEvent,
        { type: SU_EVENTS.CARDS_MILLED, payload: { playerId, cardUids: uids, reason: 'zombie_mall_crawl' }, timestamp } as CardsMilledEvent,
    ];
}

const zombieMallCrawlPromptProgram = createPromptProgram<ZombieMallCrawlContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zombie_mall_crawl',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `zombie_mall_crawl_${context.now}`,
        context.playerId,
        '选择一个卡名，将牌库中所有同名卡放入弃牌堆',
        context.groups.map((group, index) => ({ id: `group-${index}`, label: group.label, value: { defId: group.defId } })),
        {
            sourceId: 'zombie_mall_crawl',
            titleKey: 'ui.zombie_mall_crawl_title',
            targetType: 'generic',
        },
    ),
    onResolve: ({ state, playerId, value, random, timestamp }) => {
        const choice = value as ZombieDiscardChoice;
        if (!choice.defId) return { events: [] };
        return { events: buildZombieMallCrawlEvents(state, playerId, choice.defId, random, timestamp) };
    },
});

const zombieMallCrawlProgram = createBranchProgram<ZombieMallCrawlContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.groups.length === 0,
    then: createEffectProgram((context) => ({ events: [buildAbilityFeedback(context.playerId, 'feedback.deck_empty', context.now)] })),
    else: zombieMallCrawlPromptProgram,
});

const zombieTheyKeepComingPromptProgram = createPromptProgram<ZombieTheyKeepComingContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zombie_they_keep_coming',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `zombie_they_keep_coming_${context.now}`,
            context.playerId,
            '它们不断来临：选择弃牌堆中的随从，然后点击目标基地',
            buildZombieDiscardCardOptions(context.discardMinions),
            {
                sourceId: 'zombie_they_keep_coming',
                titleKey: 'ui.zombie_they_keep_coming_title',
                targetType: 'discard_minion',
            },
        );
        (interaction.data as Record<string, unknown>).allowedBaseIndices = context.allowedBaseIndices;
        return attachOptionsGenerator(interaction, (state) => {
            const player = state.core.players[context.playerId];
            const discardMinions = player.discard
                .filter((card) => card.type === 'minion')
                .map((card) => {
                    const def = getCardDef(card.defId) as MinionCardDef | undefined;
                    const name = def?.name ?? card.defId;
                    return {
                        cardUid: card.uid,
                        defId: card.defId,
                        label: `${name} (力量 ${def?.power ?? 0})`,
                        power: def?.power ?? 0,
                    };
                });
            return buildZombieDiscardCardOptions(discardMinions);
        });
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as ZombieDiscardChoice;
        if (!selected.cardUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const player = state.core.players[playerId];
        const discardCard = player?.discard.find((card) => card.uid === selected.cardUid && card.type === 'minion');
        if (!discardCard) return { events: [] };
        if (selected.baseIndex < 0 || selected.baseIndex >= state.core.bases.length) return { events: [] };
        if (!validateDiscardMinionPlaySemantics(state.core, playerId, {
            cardUid: discardCard.uid,
            baseIndex: selected.baseIndex,
            consumesNormalLimit: false,
        }).valid) {
            return { events: [] };
        }
        const def = getCardDef(discardCard.defId) as MinionCardDef | undefined;
        return {
            events: [{
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId,
                    cardUid: discardCard.uid,
                    defId: discardCard.defId,
                    ownerId: discardCard.owner,
                    baseIndex: selected.baseIndex,
                    power: def?.power ?? 0,
                    fromDiscard: true,
                    consumesNormalLimit: false,
                },
                timestamp,
            } as MinionPlayedEvent],
        };
    },
});

const zombieTheyKeepComingProgram = createBranchProgram<ZombieTheyKeepComingContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.discardMinions.length === 0,
    then: createEffectProgram((context) => ({ events: [buildAbilityFeedback(context.playerId, 'feedback.discard_empty', context.now)] })),
    else: zombieTheyKeepComingPromptProgram,
});

function buildZombieLordInteraction(context: ZombieLordContext) {
    const interaction = createAbilityRuntimeSimpleChoice(
        `zombie_lord_${context.now}`,
        context.playerId,
        '僵尸领主：选择弃牌堆中的随从，然后点击目标基地',
        [
            ...buildZombieDiscardCardOptions(context.availableMinions),
            {
                id: 'done',
                label: '完成',
                labelKey: 'ui.zombie_lord_done_option',
                value: { done: true },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'zombie_lord_pick',
            titleKey: 'ui.zombie_lord_title',
            targetType: 'discard_minion',
        },
    );
    (interaction.data as Record<string, unknown>).allowedBaseIndices = context.emptyBases
        .filter((base) => !context.filledBases.includes(base.baseIndex))
        .map((base) => base.baseIndex);
    return attachOptionsGenerator(interaction, (state) => {
        const player = state.core.players[context.playerId];
        const minions = player.discard
            .filter((card) => {
                if (card.type !== 'minion') return false;
                if (context.usedCardUids.includes(card.uid)) return false;
                const def = getCardDef(card.defId) as MinionCardDef | undefined;
                return def != null && def.power <= 2;
            })
            .map((card) => {
                const def = getCardDef(card.defId) as MinionCardDef | undefined;
                const name = def?.name ?? card.defId;
                return {
                    cardUid: card.uid,
                    defId: card.defId,
                    power: def?.power ?? 0,
                    label: `${name} (力量 ${def?.power ?? 0})`,
                };
            });
        return [
            ...buildZombieDiscardCardOptions(minions),
            {
                id: 'done',
                label: '完成',
                labelKey: 'ui.zombie_lord_done_option',
                value: { done: true },
                displayMode: 'button' as const,
            },
        ];
    });
}

function resolveZombieLordChoice(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: ZombieDiscardChoice,
    context: ZombieLordContext,
    timestamp: number,
): { events: SmashUpEvent[]; nextContext?: ZombieLordContext } {
    if (value.done) {
        return { events: [] };
    }
    if (!value.cardUid) {
        return { events: [] };
    }

    const player = state.core.players[playerId];
    if (!player) return { events: [] };

    const discardCard = player.discard.find((card) => card.uid === value.cardUid && card.type === 'minion');
    if (!discardCard) return { events: [] };

    const discardDef = getCardDef(discardCard.defId) as MinionCardDef | undefined;
    if (!discardDef || discardDef.power > 2) return { events: [] };

    const remainingBaseIndices = context.emptyBases
        .map((base) => base.baseIndex)
        .filter((baseIndex) => Number.isInteger(baseIndex) && baseIndex >= 0 && baseIndex < state.core.bases.length && !context.filledBases.includes(baseIndex));
    if (remainingBaseIndices.length === 0) return { events: [] };

    const resolvedBaseIndex = (typeof value.baseIndex === 'number' && remainingBaseIndices.includes(value.baseIndex))
        ? value.baseIndex
        : remainingBaseIndices[0];

    if (!validateDiscardMinionPlaySemantics(state.core, playerId, {
        cardUid: discardCard.uid,
        baseIndex: resolvedBaseIndex,
        consumesNormalLimit: false,
    }).valid) {
        return { events: [] };
    }

    const playedEvt: MinionPlayedEvent = {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid: discardCard.uid,
            defId: discardCard.defId,
            ownerId: discardCard.owner,
            baseIndex: resolvedBaseIndex,
            baseDefId: state.core.bases[resolvedBaseIndex]?.defId,
            power: discardDef.power,
            fromDiscard: true,
            consumesNormalLimit: false,
        },
        timestamp,
    };

    const usedCardUids = [...context.usedCardUids, discardCard.uid];
    const filledBases = [...context.filledBases, resolvedBaseIndex];
    const remainingBases = context.emptyBases.filter((base) => !filledBases.includes(base.baseIndex));
    if (remainingBases.length === 0) {
        return { events: [playedEvt] };
    }

    const remainingMinions = player.discard
        .filter((card) => {
            if (card.type !== 'minion') return false;
            if (usedCardUids.includes(card.uid)) return false;
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            return def != null && def.power <= 2;
        })
        .map((card) => {
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            const name = def?.name ?? card.defId;
            return {
                cardUid: card.uid,
                defId: card.defId,
                power: def?.power ?? 0,
                label: `${name} (力量 ${def?.power ?? 0})`,
            };
        });
    if (remainingMinions.length === 0) {
        return { events: [playedEvt] };
    }

    return {
        events: [playedEvt],
        nextContext: {
            matchState: state,
            playerId,
            now: timestamp,
            emptyBases: context.emptyBases,
            availableMinions: remainingMinions,
            usedCardUids,
            filledBases,
        },
    };
}

const zombieLordPickPromptProgram = createPromptProgram<ZombieLordContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zombie_lord_pick',
    buildInteraction: (context) => buildZombieLordInteraction(context),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const result = resolveZombieLordChoice(state, playerId, value as ZombieDiscardChoice, context, timestamp);
        return result.nextContext
            ? { events: result.events, context: result.nextContext, nextProgram: zombieLordPickPromptProgram }
            : { events: result.events };
    },
});

const zombieLordProgram = createBranchProgram<ZombieLordContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.emptyBases.length === 0,
    then: createEffectProgram((context) => ({ events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] })),
    else: createBranchProgram({
        when: (context) => context.availableMinions.length === 0,
        then: createEffectProgram((context) => ({ events: [buildAbilityFeedback(context.playerId, 'feedback.discard_empty', context.now)] })),
        else: zombieLordPickPromptProgram,
    }),
});
// ============================================================================

/** 泛滥横行限制：其他玩家不收回能打随从到此基地 */
function zombieOverrunRestriction(ctx: RestrictionCheckContext): boolean {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return false;
    return base.ongoingActions.some((overrun) => {
        if (overrun.defId !== 'zombie_overrun' && overrun.defId !== 'zombie_overrun_pod') return false;
        const controllerId = (overrun.metadata?.sourceControllerId as PlayerId | undefined) ?? overrun.ownerId;
        return ctx.playerId !== controllerId;
    });
}
