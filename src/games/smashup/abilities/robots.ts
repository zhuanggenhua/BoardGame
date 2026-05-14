/**
 * 大杀四方 - 机器人派系能力
 *
 * 主题：微型机联动、从牌库打出随从、额外出牌
 */

import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    grantContextualExtraMinion,
    destroyMinion,
    getMinionPower,
    buildMinionTargetOptions,
    buildBaseTargetOptions,
    peekDeckTop,
    buildAbilityFeedback,
    buildStandardDrawEvents,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, MinionPlayedEvent, SmashUpCore, CardInstance } from '../domain/types';
import type { MinionCardDef } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import { getCardDef, getBaseDef } from '../data/cards';
import {
    createAbilityRuntimeSimpleChoice,
    createBranchProgram,
    createEffectProgram,
    createPromptProgram,
    createSequenceProgram,
} from '../domain/abilityRuntime';
import type { MatchState, PlayerId } from '../../../engine/types';
import type { InteractionDescriptor, PromptOption } from '../../../engine/systems/InteractionSystem';
import { isDiscardMicrobot, isMicrobot, matchesDefId, MICROBOT_DEF_IDS } from '../domain/utils';

type RobotPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type RobotMicrobotGuardContext = RobotPromptContext & {
    baseIndex: number;
    sourceCardUid: string;
    sourceDefId: string;
    options: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
};

type RobotMicrobotReclaimerContext = RobotPromptContext & {
    initialEvents: SmashUpEvent[];
    options: PromptOption<{ cardUid: string; defId: string }>[];
};

type RobotHoverbotChoice = {
    cardUid?: string;
    defId?: string;
    power?: number;
    baseIndex?: number;
    skip?: boolean;
};

type RobotHoverbotContext = RobotPromptContext & {
    revealEvents: SmashUpEvent[];
    topCard?: CardInstance;
    topPower?: number;
};

type RobotHoverbotBaseContext = RobotPromptContext & {
    cardUid: string;
    defId: string;
    power: number;
};

type RobotTechCenterContext = RobotPromptContext & {
    candidates: Array<{ baseIndex: number; count: number; label: string }>;
};

function attachOptionsGenerator<T>(
    interaction: InteractionDescriptor<T>,
    optionsGenerator: (state: MatchState<SmashUpCore>, data: Record<string, unknown> | undefined) => unknown[],
): InteractionDescriptor<T> {
    return {
        ...interaction,
        data: {
            ...(interaction.data ?? {}),
            optionsGenerator,
        },
    };
}

/** 注册机器人派系所有能力*/
export function registerRobotAbilities(): void {
    registerAbilityProgram('robot_microbot_guard', 'onPlay', {
        program: robotMicrobotGuardProgram,
        createContext: createRobotMicrobotGuardContext,
    });
    registerSimpleAbility('robot_microbot_fixer', 'onPlay', robotMicrobotFixer);
    registerAbilityProgram('robot_microbot_reclaimer', 'onPlay', {
        program: robotMicrobotReclaimerProgram,
        createContext: createRobotMicrobotReclaimerContext,
    });
    registerAbilityProgram('robot_hoverbot', 'onPlay', {
        program: robotHoverbotProgram,
        createContext: createRobotHoverbotContext,
    });
    // 高速机器人：额外打出力量≤2的随从
    registerSimpleAbility('robot_zapbot', 'onPlay', robotZapbot);
    // 技术中心（行动卡）：按基地上随从数抽牌
    registerAbilityProgram('robot_tech_center', 'onPlay', {
        program: robotTechCenterProgram,
        createContext: createRobotTechCenterContext,
    });
    // 核弹机器人 onDestroy：被消灭后消灭同基地其他玩家所有随从
    registerSimpleAbility('robot_nukebot', 'onDestroy', robotNukebotOnDestroy);

    // 注册 ongoing 拦截器
    registerRobotOngoingEffects();
}

function getRobotMicrobotGuardTargets(
    state: AbilityContext['state'],
    baseIndex: number,
    playerId: string,
    sourceCardUid: string,
) {
    const base = state.bases[baseIndex];
    if (!base) return [];

    const myMinionCount = base.minions.filter(minion => minion.controller === playerId).length;
    return base.minions.filter(
        minion => minion.uid !== sourceCardUid && getMinionPower(state, minion, baseIndex) < myMinionCount,
    );
}

function buildRobotMicrobotGuardOptions(
    state: AbilityContext['state'],
    baseIndex: number,
    playerId: string,
    sourceCardUid: string,
) {
    const targets = getRobotMicrobotGuardTargets(state, baseIndex, playerId, sourceCardUid);
    return targets.map(target => {
        const def = getCardDef(target.defId) as MinionCardDef | undefined;
        const name = def?.name ?? target.defId;
        const power = getMinionPower(state, target, baseIndex);
        return {
            uid: target.uid,
            defId: target.defId,
            baseIndex,
            label: `${name} (力量 ${power})`,
        };
    });
}

function buildRobotMicrobotReclaimerOptions(
    state: AbilityContext['state'],
    playerId: string,
): PromptOption<{ cardUid: string; defId: string }>[] {
    const player = state.players[playerId];
    if (!player) return [];

    return player.discard
        .filter(card => isDiscardMicrobot(state, card, playerId))
        .map((card, index) => {
            const def = getCardDef(card.defId);
            const name = def?.name ?? card.defId;
            return {
                id: `microbot-${index}`,
                label: name,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            };
        });
}

function createRobotMicrobotGuardContext(ctx: AbilityContext): RobotMicrobotGuardContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex: ctx.baseIndex,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        options: buildRobotMicrobotGuardOptions(ctx.state, ctx.baseIndex, ctx.playerId, ctx.cardUid),
    };
}

const robotMicrobotGuardPromptProgram = createPromptProgram<RobotMicrobotGuardContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'robot_microbot_guard',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `robot_microbot_guard_${context.now}`,
            context.playerId,
            '选择要消灭的随从（力量低于己方随从数量）',
            buildMinionTargetOptions(context.options, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId,
                effectType: 'destroy',
            }),
            { sourceId: 'robot_microbot_guard', targetType: 'minion', responseValidationMode: 'live' },
        ),
        (state) => buildMinionTargetOptions(
            buildRobotMicrobotGuardOptions(
                state.core,
                context.baseIndex,
                context.playerId,
                context.sourceCardUid,
            ),
            {
                state: state.core,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId,
                effectType: 'destroy',
            },
        ),
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as { minionUid?: string; baseIndex?: number };
        if (!choice.minionUid || choice.baseIndex === undefined) return { events: [] };
        const candidates = getRobotMicrobotGuardTargets(
            state.core,
            choice.baseIndex,
            playerId,
            context.sourceCardUid,
        );
        const selected = candidates.find((minion) => minion.uid === choice.minionUid);
        if (!selected) return { events: [] };
        return {
            events: [
                destroyMinion(
                    selected.uid,
                    selected.defId,
                    choice.baseIndex,
                    selected.owner,
                    playerId,
                    'robot_microbot_guard',
                    timestamp,
                ),
            ],
        };
    },
});

const robotMicrobotGuardProgram = createBranchProgram<RobotMicrobotGuardContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.options.length === 0,
    then: createEffectProgram((context) => ({ events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] })),
    else: robotMicrobotGuardPromptProgram,
});

/** 微型机修理者 onPlay：如果是本回合第一个随从，额外出牌 */
function robotMicrobotFixer(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // onPlay 在 reduce 之后执行，第一个随从打出后 minionsPlayed 已从 0 变为 1
    // 所以 minionsPlayed > 1 表示“之前已经打过随从”，此时不触发
    if (player.minionsPlayed > 1) return { events: [] };
    return { events: [grantContextualExtraMinion(ctx, 'robot_microbot_fixer')] };
}

function createRobotMicrobotReclaimerContext(ctx: AbilityContext): RobotMicrobotReclaimerContext {
    const player = ctx.state.players[ctx.playerId];
    const initialEvents: SmashUpEvent[] = [];
    if (player.minionsPlayed === 1) {
        initialEvents.push(grantContextualExtraMinion(ctx, 'robot_microbot_reclaimer'));
    }
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        initialEvents,
        options: buildRobotMicrobotReclaimerOptions(ctx.state, ctx.playerId),
    };
}

const robotMicrobotReclaimerPromptProgram = createPromptProgram<RobotMicrobotReclaimerContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'robot_microbot_reclaimer',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `robot_microbot_reclaimer_${context.now}`,
            context.playerId,
            '选择要洗回牌库的微型机（任意数量，可不选）',
            context.options,
            {
                sourceId: 'robot_microbot_reclaimer',
                targetType: 'generic',
                multi: { min: 0, max: context.options.length },
                autoRefresh: 'discard',
                responseValidationMode: 'live',
            },
        ),
        (state) => buildRobotMicrobotReclaimerOptions(state.core, context.playerId),
    ),
    onResolve: ({ state, playerId, value, random, timestamp }) => {
        const selectedCards = Array.isArray(value) ? value : value ? [value] : [];
        if (selectedCards.length === 0) return { events: [] };
        const cardUids = selectedCards
            .map((entry) => (entry as { cardUid?: string }).cardUid)
            .filter((cardUid): cardUid is string => typeof cardUid === 'string');
        if (cardUids.length === 0) return { events: [] };
        const player = state.core.players[playerId];
        const selectedUidSet = new Set(cardUids);
        const microbotsFromDiscard = player.discard.filter((card) => selectedUidSet.has(card.uid));
        const newDeck = [...player.deck, ...microbotsFromDiscard];
        const shuffled = random.shuffle([...newDeck]);
        return {
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId, deckUids: shuffled.map((card) => card.uid) },
                timestamp,
            }],
        };
    },
});

const robotMicrobotReclaimerProgram = createSequenceProgram<RobotMicrobotReclaimerContext, SmashUpCore, SmashUpEvent>(
    createEffectProgram((context) => ({ events: context.initialEvents })),
    createBranchProgram({
        when: (context) => context.options.length > 0,
        then: robotMicrobotReclaimerPromptProgram,
    }),
);

// 盘旋机器人交互计数器（用于生成稳定的交互 ID）
let robotHoverbotCounter = 0;

/** 重置盘旋机器人计数器（仅用于测试） */
export function resetRobotHoverbotCounter(): void {
    robotHoverbotCounter = 0;
}

function createRobotHoverbotContext(ctx: AbilityContext): RobotHoverbotContext {
    const peek = peekDeckTop(ctx.state, ctx.random, ctx.playerId, 'all', 'robot_hoverbot', ctx.now);
    if (!peek) {
        return {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            revealEvents: [],
        };
    }
    const topCard = peek.card;
    const def = topCard.type === 'minion' ? getCardDef(topCard.defId) as MinionCardDef | undefined : undefined;
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        revealEvents: [...peek.events],
        topCard,
        topPower: def?.power ?? 0,
    };
}

const robotHoverbotBasePromptProgram = createPromptProgram<RobotHoverbotBaseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'robot_hoverbot_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `robot_hoverbot_base_${context.now}`,
        context.playerId,
        '选择打出随从的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases.map((base, index) => ({
                baseIndex: index,
                label: getBaseDef(base.defId)?.name ?? `基地 ${index + 1}`,
            })),
            context.matchState.core,
        ),
        { sourceId: 'robot_hoverbot_base', targetType: 'base' },
    ),
    onResolve: ({ state, playerId, value, timestamp, context }) => {
        const choice = value as RobotHoverbotChoice;
        if (choice.baseIndex === undefined || !state.core.bases[choice.baseIndex]) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId,
                    cardUid: context.cardUid,
                    defId: context.defId,
                    baseIndex: choice.baseIndex,
                    baseDefId: state.core.bases[choice.baseIndex]?.defId,
                    power: context.power,
                    fromDeck: true,
                    consumesNormalLimit: false,
                },
                timestamp,
            } as MinionPlayedEvent],
        };
    },
});

const robotHoverbotPromptProgram = createPromptProgram<RobotHoverbotContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'robot_hoverbot',
    buildInteraction: (context) => {
        const topCard = context.topCard!;
        const power = context.topPower ?? 0;
        return attachOptionsGenerator(
            createAbilityRuntimeSimpleChoice(
                `robot_hoverbot_${robotHoverbotCounter++}`,
                context.playerId,
                `牌库顶是 cards.${topCard.defId}.name（力量 ${power}），是否作为额外随从打出？`,
                [
                    {
                        id: 'play',
                        label: `打出 cards.${topCard.defId}.name`,
                        value: { cardUid: topCard.uid, defId: topCard.defId, power },
                        displayMode: 'card' as const,
                        _source: 'static' as const,
                    },
                    {
                        id: 'skip',
                        label: '放回牌库顶',
                        value: { skip: true },
                        displayMode: 'button' as const,
                    },
                ],
                { sourceId: 'robot_hoverbot', targetType: 'generic', responseValidationMode: 'live' },
            ),
            (state) => {
                const topUid = state?.core?.players?.[context.playerId]?.deck?.[0]?.uid;
                if (typeof topUid !== 'string' || topUid !== topCard.uid) {
                    return [
                        { id: 'skip', label: '放回牌库顶', value: { skip: true }, displayMode: 'button' as const },
                    ];
                }
                return [
                    {
                        id: 'play',
                        label: `打出 cards.${topCard.defId}.name`,
                        value: { cardUid: topCard.uid, defId: topCard.defId, power },
                        displayMode: 'card' as const,
                        _source: 'static' as const,
                    },
                    { id: 'skip', label: '放回牌库顶', value: { skip: true }, displayMode: 'button' as const },
                ];
            },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as RobotHoverbotChoice;
        if (choice.skip) return { events: [] };
        if (!choice.cardUid || !choice.defId) return { events: [] };
        const player = state.core.players[playerId];
        if (player.deck.length === 0 || player.deck[0].uid !== choice.cardUid) {
            throw new Error(`卡牌 ${choice.cardUid} 不在牌库顶，无法打出`);
        }
        if (state.core.bases.length === 1) {
            return {
                events: [{
                    type: SU_EVENTS.MINION_PLAYED,
                    payload: {
                        playerId,
                        cardUid: choice.cardUid,
                        defId: choice.defId,
                        baseIndex: 0,
                        baseDefId: state.core.bases[0].defId,
                        power: choice.power ?? 0,
                        fromDeck: true,
                        consumesNormalLimit: false,
                    },
                    timestamp,
                } as MinionPlayedEvent],
            };
        }
        return {
            events: [],
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                cardUid: choice.cardUid,
                defId: choice.defId,
                power: choice.power ?? 0,
            },
            nextProgram: robotHoverbotBasePromptProgram,
        };
    },
});

const robotHoverbotProgram = createSequenceProgram<RobotHoverbotContext, SmashUpCore, SmashUpEvent>(
    createEffectProgram((context) => {
        if (!context.topCard) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.deck_empty', context.now)] };
        }
        return { events: context.revealEvents };
    }),
    createBranchProgram({
        when: (context) => context.topCard?.type === 'minion',
        then: robotHoverbotPromptProgram,
    }),
);

/** 高速机器人 onPlay：你可以打出一张力量≤2的额外随从（+1 额度，力量限制由验证层自动检查） */
function robotZapbot(ctx: AbilityContext): AbilityResult {
    return {
        events: [grantContextualExtraMinion(ctx, 'robot_zapbot', undefined, { powerMax: 2 })],
    };
}

function createRobotTechCenterContext(ctx: AbilityContext): RobotTechCenterContext {
    const candidates: Array<{ baseIndex: number; count: number; label: string }> = [];
    for (let index = 0; index < ctx.state.bases.length; index += 1) {
        const count = ctx.state.bases[index].minions.filter((minion) => minion.controller === ctx.playerId).length;
        if (count > 0) {
            const baseName = getBaseDef(ctx.state.bases[index].defId)?.name ?? `基地 ${index + 1}`;
            candidates.push({ baseIndex: index, count, label: `${baseName} (${count} 个随从)` });
        }
    }
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        candidates,
    };
}

const robotTechCenterPromptProgram = createPromptProgram<RobotTechCenterContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'robot_tech_center',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `robot_tech_center_${context.now}`,
            context.playerId,
            '选择一个基地（按该基地上你的随从数抽牌）',
            buildBaseTargetOptions(context.candidates, context.matchState.core),
            { sourceId: 'robot_tech_center', targetType: 'base', autoCancelOption: true },
        ),
        (state) => {
            const candidates = state.core.bases
                .map((base, index) => {
                    const count = base.minions.filter((minion) => minion.controller === context.playerId).length;
                    if (count <= 0) return null;
                    const baseName = getBaseDef(base.defId)?.name ?? `基地 ${index + 1}`;
                    return { baseIndex: index, count, label: `${baseName} (${count} 个随从)` };
                })
                .filter(Boolean) as RobotTechCenterContext['candidates'];
            return buildBaseTargetOptions(candidates, state.core);
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        if ((value as { __cancel__?: boolean }).__cancel__) return { events: [] };
        const choice = value as { baseIndex?: number };
        if (choice.baseIndex === undefined) return { events: [] };
        const base = state.core.bases[choice.baseIndex];
        if (!base) return { events: [] };
        const count = base.minions.filter((minion) => minion.controller === playerId).length;
        const player = state.core.players[playerId];
        if (count === 0 || !player) return { events: [] };
        return {
            events: buildStandardDrawEvents(state.core, playerId, count, random, timestamp),
        };
    },
});

const robotTechCenterProgram = createBranchProgram<RobotTechCenterContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.candidates.length === 0,
    then: createEffectProgram((context) => ({ events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] })),
    else: robotTechCenterPromptProgram,
});

/** 核弹机器人 onDestroy：被消灭后消灭同基地其他玩家所有随从 */
function robotNukebotOnDestroy(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    const targets = base.minions.filter(
        m => m.uid !== ctx.cardUid && m.controller !== ctx.playerId,
    );
    if (targets.length === 0) return { events: [] };

    return {
        events: targets.map(t =>
            destroyMinion(t.uid, t.defId, ctx.baseIndex, t.owner, undefined, 'robot_nukebot', ctx.now),
        ),
    };
}

// ============================================================================
// Ongoing 拦截器注册
// ============================================================================

/** 注册机器人派系的 ongoing 拦截器 */
function registerRobotOngoingEffects(): void {
    // 战争机器人：不能被消灭
    registerProtection('robot_warbot', 'destroy', ctx =>
        matchesDefId(ctx.targetMinion.defId, 'robot_warbot'),
    );

    // 寰瀷鏈烘。妗堥锛氬井鍨嬫満琚秷鐏悗鎺у埗鑰呮娊 1 寮犵墝锛堟敮鎸?Alpha 鈥滆涓哄井鍨嬫満鈥濓級
    // 微型机档案馆：微型机被消灭后控制者抽1张牌
        // 1. 需要有被消灭随从的 defId 或 uid，否则无法判断

        // 2. 找到被消灭的随从实例，用统一的 isMicrobot 判定是否是“微型机”
        //    - 优先使用 triggerMinion（如果有快照）
        //    - 否则在当前状态中按 uid 回溯（destroy pipeline 会在 reduce 之后触发，该随从可能已不在场，所以这是 best-effort）
    // 微型机档案馆：微型机被消灭后控制者抽 1 张牌（支持 Alpha “视为微型机”）
    registerTrigger('robot_microbot_archive', 'onMinionDestroyed', trigCtx => {
        // 必须有触发随从的基本信息
        if (!trigCtx.triggerMinionDefId && !trigCtx.triggerMinionUid && !trigCtx.triggerMinion) {
            return [];
        }

        // 尝试拿到被消灭随从的实体
        let destroyedMinion = trigCtx.triggerMinion;
        if (!destroyedMinion && trigCtx.triggerMinionUid) {
            for (const base of trigCtx.state.bases) {
                const found = base.minions.find(m => m.uid === trigCtx.triggerMinionUid);
                if (found) {
                    destroyedMinion = found;
                    break;
                }
            }
        }

        // 若找不到实体，只能根据原始 defId 判断是否是“印刷微型机”
        if (!destroyedMinion) {
            if (!trigCtx.triggerMinionDefId) return [];
            if (!Array.from(MICROBOT_DEF_IDS).some(defId => matchesDefId(trigCtx.triggerMinionDefId, defId))) {
                return [];
            }
        } else {
            // 有实体时，用统一的 isMicrobot 判定（支持 Alpha“视为微型机”）
            if (!isMicrobot(trigCtx.state, destroyedMinion)) return [];
        }

        // 3. 找到任意一个 Microbot Archive 实例，确定控制者（Archive 控制者即该能力的收益方）
        if (!destroyedMinion) {
            // 没有实体，只能按原始 defId 判断是否是“印刷微型机”
            if (!trigCtx.triggerMinionDefId) return [];
            if (
                !Array.from(MICROBOT_DEF_IDS).some(defId =>
                    matchesDefId(trigCtx.triggerMinionDefId, defId),
                )
            ) {
                return [];
            }
        } else {
            // 有实体时，按统一规则判断是否为微型机（支持 Alpha 视为）
            if (!isMicrobot(trigCtx.state, destroyedMinion)) return [];
        }

        // 找到 Archive 的控制者
        let archiveCount = 0;
        for (const base of trigCtx.state.bases) {
            for (const minion of base.minions) {
                if (
                    matchesDefId(minion.defId, 'robot_microbot_archive')
                    && minion.controller === trigCtx.playerId
                ) {
                    archiveCount++;
                }
            }
        }
        if (archiveCount === 0) return [];

        // 4. "你的微型机" → 被消灭随从必须属于 archive 控制者（控制关系由 trigCtx.playerId 表示）

        // 5. 抽 1 张牌（按全局抽牌规则处理牌库为空 / 手牌上限）
        // “你的 Microbot” → 被消灭随从必须由 Archive 控制者控制

        return buildStandardDrawEvents(trigCtx.state, trigCtx.playerId, archiveCount, trigCtx.random, trigCtx.now);
    }, {
    });
}
