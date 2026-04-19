/**
 * 大杀四方 - 机器人派系能力
 *
 * 主题：微型机联动、从牌库打出随从、额外出牌
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    grantContextualExtraMinion,
    grantExtraMinion,
    destroyMinion,
    getMinionPower,
    buildMinionTargetOptions,
    buildBaseTargetOptions,
    peekDeckTop,
    buildAbilityFeedback,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, MinionPlayedEvent } from '../domain/types';
import type { MinionCardDef } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import { getCardDef, getBaseDef } from '../data/cards';
import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { drawCards, isDiscardMicrobot, isMicrobot, matchesDefId, MICROBOT_DEF_IDS } from '../domain/utils';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';

/** 注册机器人派系所有能力*/
export function registerRobotAbilities(): void {
    registerAbility('robot_microbot_guard', 'onPlay', robotMicrobotGuard);
    registerAbility('robot_microbot_fixer', 'onPlay', robotMicrobotFixer);
    registerAbility('robot_microbot_reclaimer', 'onPlay', robotMicrobotReclaimer);
    registerAbility('robot_hoverbot', 'onPlay', robotHoverbot);
    // 高速机器人：额外打出力量≤2的随从
    registerAbility('robot_zapbot', 'onPlay', robotZapbot);
    // 技术中心（行动卡）：按基地上随从数抽牌
    registerAbility('robot_tech_center', 'onPlay', robotTechCenter);
    // 核弹机器人 onDestroy：被消灭后消灭同基地其他玩家所有随从
    registerAbility('robot_nukebot', 'onDestroy', robotNukebotOnDestroy);

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

/** 微型机守护者 onPlay：消灭力量低于己方随从数量的随从 */
function robotMicrobotGuard(ctx: AbilityContext): AbilityResult {
    const options = buildRobotMicrobotGuardOptions(ctx.state, ctx.baseIndex, ctx.playerId, ctx.cardUid);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `robot_microbot_guard_${ctx.now}`,
        ctx.playerId,
        '选择要消灭的随从（力量低于己方随从数量）',
        buildMinionTargetOptions(options, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            effectType: 'destroy',
        }),
        { sourceId: 'robot_microbot_guard', targetType: 'minion', responseValidationMode: 'live' },
    );
    (interaction.data as SimpleChoiceData<unknown> & {
        continuationContext?: { baseIndex: number; sourceCardUid: string; sourcePlayerId: string };
        optionsGenerator?: typeof interaction.data.optionsGenerator;
    }).continuationContext = {
        baseIndex: ctx.baseIndex,
        sourceCardUid: ctx.cardUid,
        sourcePlayerId: ctx.playerId,
    };
    (interaction.data as SimpleChoiceData<unknown> & {
        continuationContext?: { baseIndex: number; sourceCardUid: string; sourcePlayerId: string };
        optionsGenerator?: typeof interaction.data.optionsGenerator;
    }).optionsGenerator = (state, data) => {
        const continuationContext = data.continuationContext as
            | { baseIndex: number; sourceCardUid: string; sourcePlayerId: string }
            | undefined;
        if (!continuationContext) return [];
        return buildMinionTargetOptions(
            buildRobotMicrobotGuardOptions(
                state.core,
                continuationContext.baseIndex,
                continuationContext.sourcePlayerId,
                continuationContext.sourceCardUid,
            ),
            {
                state: state.core,
                sourcePlayerId: continuationContext.sourcePlayerId,
                sourceDefId: ctx.defId,
                effectType: 'destroy',
            },
        );
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 微型机修理者 onPlay：如果是本回合第一个随从，额外出牌 */
function robotMicrobotFixer(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // onPlay 在 reduce 之后执行，第一个随从打出后 minionsPlayed 已从 0 变为 1
    // 所以 minionsPlayed > 1 表示“之前已经打过随从”，此时不触发
    if (player.minionsPlayed > 1) return { events: [] };
    return { events: [grantContextualExtraMinion(ctx, 'robot_microbot_fixer')] };
}

/** 微型机回收者 onPlay：如果是本回合第一个随从，额外出牌；将弃牌堆中的微型机洗回牌库 */
function robotMicrobotReclaimer(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const events: SmashUpEvent[] = [];

    // onPlay 在 reduce 之后执行，第一个随从打出后 minionsPlayed 已从 0 变为 1
    // 所以 minionsPlayed === 1 表示“这是本回合第一个随从”
    if (player.minionsPlayed === 1) {
        events.push(grantContextualExtraMinion(ctx, 'robot_microbot_reclaimer'));
    }

    // 将弃牌堆中的微型机洗回牌库（“任意数量”：玩家选择）
    // Alpha 在场时所有己方随从卡都算微型机
    const options = buildRobotMicrobotReclaimerOptions(ctx.state, ctx.playerId);
    if (options.length === 0) return { events };

    const interaction = createSimpleChoice<{ cardUid: string; defId: string }>(
        `robot_microbot_reclaimer_${ctx.now}`,
        ctx.playerId,
        '选择要洗回牌库的微型机（任意数量，可不选）',
        options,
        {
            sourceId: 'robot_microbot_reclaimer',
            targetType: 'generic',
            multi: { min: 0, max: options.length },
            autoRefresh: 'discard',
            responseValidationMode: 'live',
        },
    );
    (interaction.data as {
        optionsGenerator?: typeof interaction.data.optionsGenerator;
    }).optionsGenerator = (state) => buildRobotMicrobotReclaimerOptions(state.core, ctx.playerId);

    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

// 盘旋机器人交互计数器（用于生成稳定的交互 ID）
let robotHoverbotCounter = 0;

/** 重置盘旋机器人计数器（仅用于测试） */
export function resetRobotHoverbotCounter(): void {
    robotHoverbotCounter = 0;
}

/** 盘旋机器人 onPlay：展示牌库顶，如果是随从“你可以”将其作为额外随从打出 */
function robotHoverbot(ctx: AbilityContext): AbilityResult {
    const peek = peekDeckTop(ctx.state, ctx.random, ctx.playerId, 'all', 'robot_hoverbot', ctx.now);
    if (!peek) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    }
    const events: SmashUpEvent[] = [...peek.events];
    if (peek.card.type === 'minion') {
        const def = getCardDef(peek.card.defId) as MinionCardDef | undefined;
        const power = def?.power ?? 0;

        const initialOptions: PromptOption<
            { cardUid: string; defId: string; power: number } | { skip: true }
        >[] = [
            {
                id: 'play',
                label: `打出 cards.${peek.card.defId}.name`,
                value: { cardUid: peek.card.uid, defId: peek.card.defId, power },
                displayMode: 'card' as const,
                _source: 'static' as const,
            },
            {
                id: 'skip',
                label: '放回牌库顶',
                value: { skip: true },
                displayMode: 'button' as const,
            },
        ];

        const interaction = createSimpleChoice<{ cardUid: string; defId: string; power: number } | { skip: true }>(
            `robot_hoverbot_${robotHoverbotCounter++}`,
            ctx.playerId,
            `牌库顶是 cards.${peek.card.defId}.name（力量 ${power}），是否作为额外随从打出？`,
            initialOptions,
            // 必须 live 校验：牌库顶可能在交互出现后被其他效果改变；
            // 若仍按 snapshot 接受旧选项，会导致点“play”后进入 handler throw / 无解交互。
            { sourceId: 'robot_hoverbot', targetType: 'generic', responseValidationMode: 'live' },
        );

        const interactionData = interaction.data as any;
        interactionData.continuationContext = {
            cardUid: peek.card.uid,
            defId: peek.card.defId,
            power,
        };

        interactionData.optionsGenerator = (state: any, iData: any) => {
            const c = iData?.continuationContext as { cardUid: string; defId: string; power: number } | undefined;
            if (!c) {
                return [
                    { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
                ];
            }

            // 强口径：这类“看牌库顶并可额外打出”的交互必须对 deck-top 变更敏感。
            // 否则当牌库顶在交互弹出后被其他效果改变时，玩家/AI 会看到一个“过期的打出选项”，
            // 可能导致 validate 失败、重复提示、甚至进入无解交互/卡死。
            //
            // 规则语义：若揭示的牌已不再位于牌库顶，则不再提供“打出该牌”的选项，仅允许跳过。
            const topUid = state?.core?.players?.[ctx.playerId]?.deck?.[0]?.uid;
            if (typeof topUid !== 'string' || topUid !== c.cardUid) {
                return [
                    { id: 'skip', label: '放回牌库顶', value: { skip: true }, displayMode: 'button' as const },
                ];
            }
            return [
                {
                    id: 'play',
                    label: `打出 cards.${c.defId}.name`,
                    value: { cardUid: c.cardUid, defId: c.defId, power: c.power },
                    displayMode: 'card' as const,
                    _source: 'static' as const,
                },
                { id: 'skip', label: '放回牌库顶', value: { skip: true }, displayMode: 'button' as const },
            ];
        };

        return { events, matchState: queueInteraction(ctx.matchState, interaction) };
    }

    // 非随从 → 只展示并放回牌库顶（peek 不移除卡，无需额外事件）
    return { events };
}

/** 高速机器人 onPlay：你可以打出一张力量≤2的额外随从（+1 额度，力量限制由验证层自动检查） */
function robotZapbot(ctx: AbilityContext): AbilityResult {
    return {
        events: [grantContextualExtraMinion(ctx, 'robot_zapbot', undefined, { powerMax: 2 })],
    };
}

/** 技术中心 onPlay：选择一个基地，该基地上你每有一个随从就抽一张牌 */
function robotTechCenter(ctx: AbilityContext): AbilityResult {
    const candidates: { baseIndex: number; count: number; label: string }[] = [];

    for (let i = 0; i < ctx.state.bases.length; i++) {
        const count = ctx.state.bases[i].minions.filter(m => m.controller === ctx.playerId).length;
        if (count > 0) {
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            candidates.push({ baseIndex: i, count, label: `${baseName} (${count} 个随从)` });
        }
    }

    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `robot_tech_center_${ctx.now}`,
        ctx.playerId,
        '选择一个基地（按该基地上你的随从数抽牌）',
        buildBaseTargetOptions(candidates, ctx.state),
        { sourceId: 'robot_tech_center', targetType: 'base', autoCancelOption: true },
    );

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

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
// 交互解决处理函数（InteractionHandler）
// ============================================================================

/** 注册机器人派系的交互解决处理函数 */
export function registerRobotInteractionHandlers(): void {
    // 微型机回收者：玩家选择任意数量的微型机洗回牌库
    registerInteractionHandler('robot_microbot_reclaimer', (state, playerId, value, _iData, random, timestamp) => {
        const selectedCards = Array.isArray(value) ? value : value ? [value] : [];
        if (selectedCards.length === 0) return { state, events: [] };

        const cardUids = selectedCards.map((v: any) => v.cardUid).filter(Boolean) as string[];
        if (cardUids.length === 0) return { state, events: [] };

        const player = state.core.players[playerId];
        const selectedUidSet = new Set(cardUids);
        const microbotsFromDiscard = player.discard.filter(c => selectedUidSet.has(c.uid));
        const newDeck = [...player.deck, ...microbotsFromDiscard];
        const shuffled = random.shuffle([...newDeck]);

        return {
            state,
            events: [
                {
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId, deckUids: shuffled.map(c => c.uid) },
                    timestamp,
                },
            ],
        };
    });

    // 微型机守护者：选择目标后消灭
    registerInteractionHandler('robot_microbot_guard', (state, sourcePlayerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const continuationContext = (iData as {
            continuationContext?: { sourceCardUid?: string };
        } | undefined)?.continuationContext;
        const sourceCardUid = continuationContext?.sourceCardUid;
        if (!sourceCardUid) return undefined;

        const target = getRobotMicrobotGuardTargets(
            state.core,
            baseIndex,
            sourcePlayerId,
            sourceCardUid,
        ).find(minion => minion.uid === minionUid);
        if (!target) return undefined;

        return {
            state,
            events: [
                destroyMinion(
                    target.uid,
                    target.defId,
                    baseIndex,
                    target.owner,
                    sourcePlayerId,
                    'robot_microbot_guard',
                    timestamp,
                ),
            ],
        };
    });

    // 技术中心：选择基地后按随从数抽牌
    registerInteractionHandler('robot_tech_center', (state, playerId, value, _iData, _random, timestamp) => {
        if ((value as any).__cancel__) return { state, events: [] };

        const { baseIndex } = value as { baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;

        const count = base.minions.filter(m => m.controller === playerId).length;
        if (count === 0) return undefined;

        const player = state.core.players[playerId];
        if (!player || player.deck.length === 0) return undefined;

        const actualDraw = Math.min(count, player.deck.length);
        const drawnUids = player.deck.slice(0, actualDraw).map(c => c.uid);

        return {
            state,
            events: [
                {
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId, count: actualDraw, cardUids: drawnUids },
                    timestamp,
                },
            ],
        };
    });

    // 盘旋机器人：选择是否打出牌库顶随从
    registerInteractionHandler('robot_hoverbot', (state, playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };

        const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
        if (!cardUid) return undefined;

        const player = state.core.players[playerId];
        if (player.deck.length === 0 || player.deck[0].uid !== cardUid) {
            throw new Error(`卡牌 ${cardUid} 不在牌库顶，无法打出`);
        }

        if (state.core.bases.length === 1) {
            const playedEvt: MinionPlayedEvent = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId,
                    cardUid,
                    defId,
                    baseIndex: 0,
                    baseDefId: state.core.bases[0].defId,
                    power,
                    fromDeck: true,
                    consumesNormalLimit: false,
                },
                timestamp,
            };

            return { state, events: [playedEvt] };
        }

        const baseCandidates = state.core.bases.map((b, i) => {
            const bd = getBaseDef(b.defId);
            return { baseIndex: i, label: bd?.name ?? `基地 ${i + 1}` };
        });

        const next = createSimpleChoice(
            `robot_hoverbot_base_${timestamp}`,
            playerId,
            '选择打出随从的基地',
            buildBaseTargetOptions(baseCandidates, state.core),
            { sourceId: 'robot_hoverbot_base', targetType: 'base' },
        );

        return {
            state: queueInteraction(state, {
                ...next,
                data: { ...next.data, continuationContext: { cardUid, defId, power } },
            }),
            events: [],
        };
    });

    // 盘旋机器人：选基地后打出
    registerInteractionHandler('robot_hoverbot_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const ctx = iData?.continuationContext as
            | { cardUid: string; defId: string; power: number }
            | undefined;

        if (!ctx) return undefined;

        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid: ctx.cardUid,
                defId: ctx.defId,
                baseIndex,
                power: ctx.power,
                fromDeck: true,
                consumesNormalLimit: false,
            },
            timestamp,
        };

        return { state, events: [playedEvt] };
    });
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

        const player = trigCtx.state.players[trigCtx.playerId];
        // “你的 Microbot” → 被消灭随从必须由 Archive 控制者控制
        if (!player || player.deck.length === 0) return [];

        const { drawnUids } = drawCards(player, archiveCount, trigCtx.random);
        if (drawnUids.length === 0) return [];

        return [
            {
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: trigCtx.playerId, count: drawnUids.length, cardUids: drawnUids },
                timestamp: trigCtx.now,
            },
        ];
    });
}
