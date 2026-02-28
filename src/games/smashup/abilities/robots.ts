/**
 * 大杀四方 - 机器人派系能力
 *
 * 主题：微型机联动、从牌库打出随从、额外出牌
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { grantExtraMinion, destroyMinion, getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions, peekDeckTop, buildAbilityFeedback } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, MinionPlayedEvent } from '../domain/types';
import type { MinionCardDef } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import { getCardDef, getBaseDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { drawCards, isDiscardMicrobot, MICROBOT_DEF_IDS } from '../domain/utils';
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
    // 核弹机器人?onDestroy：被消灭后消灭同基地其他玩家所有随从
    registerAbility('robot_nukebot', 'onDestroy', robotNukebotOnDestroy);

    // 注册 ongoing 拦截器?
    registerRobotOngoingEffects();
}

/** 微型机守护者?onPlay：消灭力量低于己方随从数量的随从 */
function robotMicrobotGuard(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const myMinionCount = base.minions.filter(m => m.controller === ctx.playerId).length + 1;
    const targets = base.minions.filter(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) < myMinionCount
    );
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    // Prompt 选择
    const options = targets.map(t => {
        const power = getMinionPower(ctx.state, t, ctx.baseIndex);
        return { uid: t.uid, defId: t.defId, baseIndex: ctx.baseIndex, label: `cards.${t.defId}.name (力量 ${power})` };
    });
    const interaction = createSimpleChoice(
        `robot_microbot_guard_${ctx.now}`, ctx.playerId,
        '选择要消灭的随从（力量低于己方随从数量）',
        buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        { sourceId: 'robot_microbot_guard', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 微型机修理者 onPlay：如果是本回合第一个随从，额外出牌 */
function robotMicrobotFixer(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // onPlay 在 reduce 之后执行，第一个随从打出后 minionsPlayed 已从 0 变为 1
    // 所以 minionsPlayed > 1 表示"之前已经打过随从"，此时不触发
    if (player.minionsPlayed > 1) return { events: [] };
    return { events: [grantExtraMinion(ctx.playerId, 'robot_microbot_fixer', ctx.now)] };
}

/** 微型机回收者 onPlay：如果是本回合第一个随从，额外出牌；将弃牌堆中的微型机洗回牌库 */
function robotMicrobotReclaimer(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const events: SmashUpEvent[] = [];

    // onPlay 在 reduce 之后执行，第一个随从打出后 minionsPlayed 已从 0 变为 1
    // 所以 minionsPlayed === 1 表示"这是本回合第一个随从"
    if (player.minionsPlayed === 1) {
        events.push(grantExtraMinion(ctx.playerId, 'robot_microbot_reclaimer', ctx.now));
    }

    // 将弃牌堆中的微型机洗回牌库（"任意数量"：玩家选择）
    // alpha 在场时所有己方随从卡都算微型机
    const microbotsInDiscard = player.discard.filter(
        c => isDiscardMicrobot(ctx.state, c, ctx.playerId)
    );
    if (microbotsInDiscard.length === 0) return { events };

    const options = microbotsInDiscard.map((c, i) => {
        return { 
            id: `microbot-${i}`, 
            label: `cards.${c.defId}.name`, 
            value: { cardUid: c.uid, defId: c.defId },
            displayMode: 'card' as const,
        };
    });
    const skipOption = { id: 'skip', label: '跳过（不洗回）', value: { skip: true } };
    const interaction = createSimpleChoice(
        `robot_microbot_reclaimer_${ctx.now}`, ctx.playerId,
        '选择要洗回牌库的微型机（任意数量，可跳过）', [...options, skipOption],
        { sourceId: 'robot_microbot_reclaimer', multi: { min: 0, max: microbotsInDiscard.length } },
    );
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

// 盘旋机器人交互计数器（用于生成稳定的交互 ID）
let robotHoverbotCounter = 0;

/** 重置盘旋机器人计数器（仅用于测试） */
export function resetRobotHoverbotCounter(): void {
    robotHoverbotCounter = 0;
}

/** 盘旋机器人 onPlay：展示牌库顶，如果是随从"你可以"将其作为额外随从打出 */
function robotHoverbot(ctx: AbilityContext): AbilityResult {
    console.error('╔═══════════════════════════════════════════════════════════════╗');
    console.error('║ [robotHoverbot] FUNCTION ENTRY - SERVER SIDE CODE             ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝');
    console.error('[robotHoverbot] Context:', {
        playerId: ctx.playerId,
        cardUid: ctx.cardUid,
        defId: ctx.defId,
        baseIndex: ctx.baseIndex,
        deckLength: ctx.state.players[ctx.playerId]?.deck?.length,
        deckTopUid: ctx.state.players[ctx.playerId]?.deck?.[0]?.uid,
        deckTopDefId: ctx.state.players[ctx.playerId]?.deck?.[0]?.defId,
    });
    
    const peek = peekDeckTop(
        ctx.state.players[ctx.playerId], ctx.playerId,
        'all', 'robot_hoverbot', ctx.now,
    );
    
    console.error('[robotHoverbot] After peekDeckTop:', {
        hasPeek: !!peek,
        peekCardUid: peek?.card.uid,
        peekCardDefId: peek?.card.defId,
        peekCardType: peek?.card.type,
        deckLength: ctx.state.players[ctx.playerId]?.deck?.length,
        deckTopUid: ctx.state.players[ctx.playerId]?.deck?.[0]?.uid,
    });
    
    if (!peek) {
        console.error('[robotHoverbot] No peek, deck empty');
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    }
    const events: SmashUpEvent[] = [peek.revealEvent];
    
    if (peek.card.type === 'minion') {
        console.error('[robotHoverbot] Peek card is minion, creating interaction');
        const def = getCardDef(peek.card.defId) as MinionCardDef | undefined;
        const power = def?.power ?? 0;
        
        console.error('[robotHoverbot] Creating interaction:', {
            cardUid: peek.card.uid,
            defId: peek.card.defId,
            power,
            counter: robotHoverbotCounter,
        });
        
        // "你可以" → 创建交互让玩家选择是否打出该特定随从
        // 使用静态计数器而非时间戳，确保交互 ID 稳定（防止重复处理时 ID 变化）
        // 标题和选项 label 使用 i18n key，由 UI 层的 resolveI18nKeys 翻译
        const interaction = createSimpleChoice(
            `robot_hoverbot_${robotHoverbotCounter++}`, ctx.playerId,
            `牌库顶是 cards.${peek.card.defId}.name（力量 ${power}），是否作为额外随从打出？`,
            [
                { 
                    id: 'play', 
                    label: `打出 cards.${peek.card.defId}.name`, 
                    value: { cardUid: peek.card.uid, defId: peek.card.defId, power },
                    displayMode: 'card' as const,
                    _source: 'static' as const,  // ✅ 关键修复：显式声明为静态选项，防止框架层自动刷新时误判为手牌选项
                },
                { id: 'skip', label: '放回牌库顶', value: { skip: true } },
            ],
            'robot_hoverbot',
        );
        
        /* ========== optionsGenerator 方案（已注释，待调试） ==========
         * 问题：displayMode 在传输过程中丢失，导致客户端无法识别为卡牌选项
         * 
        const initialOptions = [
            { 
                id: 'play', 
                label: `打出 cards.${peek.card.defId}.name`, 
                value: { cardUid: peek.card.uid, defId: peek.card.defId, power },
                displayMode: 'card' as const,
                _source: 'static' as const,
            },
            { id: 'skip', label: '放回牌库顶', value: { skip: true } },
        ];
        
        console.error('[robotHoverbot] Creating interaction with initial options:', initialOptions);
        
        const interaction = createSimpleChoice(
            `robot_hoverbot_${robotHoverbotCounter++}`, ctx.playerId,
            `牌库顶是 cards.${peek.card.defId}.name（力量 ${power}），是否作为额外随从打出？`,
            initialOptions,
            'robot_hoverbot',
        );
        
        console.error('[robotHoverbot] Interaction created:', {
            interactionId: interaction.id,
            optionsCount: (interaction.data as any).options?.length,
            options: (interaction.data as any).options,
            cardUid: peek.card.uid,
            defId: peek.card.defId,
        });
        
        // ⚠️ 关键：必须先设置 continuationContext，再设置 optionsGenerator
        // 因为 optionsGenerator 可能在交互创建时立即被调用（如果没有 current 交互）
        const interactionData = interaction.data as any;
        interactionData.continuationContext = {
            cardUid: peek.card.uid,
            defId: peek.card.defId,
            power,
        };
        
        console.error('[robotHoverbot] Set continuationContext:', interactionData.continuationContext);
        
        // 手动提供 optionsGenerator：从 continuationContext 读取卡牌信息，而不是从牌库顶读取
        // 这样即使牌库顶变化了，交互选项仍然显示原来看到的那张卡
        interactionData.optionsGenerator = (state: any, iData: any) => {
            const ctx = iData?.continuationContext as { cardUid: string; defId: string; power: number } | undefined;
            
            console.error('[robotHoverbot optionsGenerator] CALLED:', {
                hasContext: !!ctx,
                hasiData: !!iData,
                iDataKeys: iData ? Object.keys(iData) : [],
                contextCardUid: ctx?.cardUid,
                contextDefId: ctx?.defId,
                contextPower: ctx?.power,
            });
            
            if (!ctx) {
                console.error('[robotHoverbot optionsGenerator] No continuationContext found! iData:', iData);
                return [{ id: 'skip', label: '跳过', value: { skip: true } }];
            }
            
            // 从 continuationContext 读取卡牌信息（不依赖牌库顶状态）
            const result = [
                { 
                    id: 'play', 
                    label: `打出 cards.${ctx.defId}.name`, 
                    value: { cardUid: ctx.cardUid, defId: ctx.defId, power: ctx.power },
                    displayMode: 'card' as const,
                },
                { id: 'skip', label: '放回牌库顶', value: { skip: true } },
            ];
            
            console.error('[robotHoverbot optionsGenerator] Returning options:', result);
            return result;
        };
        ========== optionsGenerator 方案结束 ========== */
        
        console.error('[robotHoverbot] Returning with interaction');
        return { events, matchState: queueInteraction(ctx.matchState, interaction) };
    }
    
    // 非随从→放回牌库顶（peek 不移除卡，无需操作）
    console.error('[robotHoverbot] Not a minion, skipping');
    return { events };
}

/** 高速机器人 onPlay：你可以打出一张力量≤2的额外随从（+1额度，力量限制由验证层自动检查） */
function robotZapbot(ctx: AbilityContext): AbilityResult {
    return { events: [grantExtraMinion(ctx.playerId, 'robot_zapbot', ctx.now, undefined, { powerMax: 2 })] };
}

/** 技术中心?onPlay：选择一个基地，该基地上你每有一个随从就抽一张牌 */
function robotTechCenter(ctx: AbilityContext): AbilityResult {
    // 收集有己方随从的基地
    const candidates: { baseIndex: number; count: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const count = ctx.state.bases[i].minions.filter(m => m.controller === ctx.playerId).length;
        if (count > 0) {
            const baseDefId = ctx.state.bases[i].defId;
            candidates.push({ baseIndex: i, count, label: `cards.${baseDefId}.name (${count} 个随从)` });
        }
    }
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    // Prompt 选择（包含取消选项）
    const interaction = createSimpleChoice(
        `robot_tech_center_${ctx.now}`, ctx.playerId,
        '选择一个基地（按该基地上你的随从数抽牌）', buildBaseTargetOptions(candidates, ctx.state),
        { sourceId: 'robot_tech_center', targetType: 'base', autoCancelOption: true }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 核弹机器人 onDestroy：被消灭后消灭同基地其他玩家所有随从*/
function robotNukebotOnDestroy(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    // 消灭同基地上不属于自己的所有随从
    const targets = base.minions.filter(
        m => m.uid !== ctx.cardUid && m.controller !== ctx.playerId
    );
    if (targets.length === 0) return { events: [] };
    return {
        events: targets.map(t =>
            destroyMinion(t.uid, t.defId, ctx.baseIndex, t.owner, undefined, 'robot_nukebot', ctx.now)
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
        const selectedCards = Array.isArray(value) ? value : (value ? [value] : []);
        if (selectedCards.length === 0) return { state, events: [] };
        const cardUids = selectedCards.map((v: any) => v.cardUid).filter(Boolean) as string[];
        if (cardUids.length === 0) return { state, events: [] };
        const player = state.core.players[playerId];
        const selectedUidSet = new Set(cardUids);
        const microbotsFromDiscard = player.discard.filter(c => selectedUidSet.has(c.uid));
        const newDeck = [...player.deck, ...microbotsFromDiscard];
        const shuffled = random.shuffle([...newDeck]);
        // DECK_REORDERED：包含弃牌堆中选中的卡 UID，reducer 会自动从弃牌堆移除
        return { state, events: [{
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: shuffled.map(c => c.uid) },
            timestamp,
        }] };
    });

    // 微型机守护者：选择目标后消灭
    registerInteractionHandler('robot_microbot_guard', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'robot_microbot_guard', timestamp)] };
    });

    // 技术中心：选择基地后按随从数抽牌
    registerInteractionHandler('robot_tech_center', (state, playerId, value, _iData, _random, timestamp) => {
        // 检查取消标记
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
        return { state, events: [{
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: actualDraw, cardUids: drawnUids },
            timestamp,
        }] };
    });

    // 盘旋机器人：选择是否打出牌库顶随从
    registerInteractionHandler('robot_hoverbot', (state, playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };
        const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
        if (!cardUid) return undefined;
        // 该卡必须在牌库顶
        const player = state.core.players[playerId];
        if (player.deck.length === 0 || player.deck[0].uid !== cardUid) return undefined;
        // 单基地直接打出
        if (state.core.bases.length === 1) {
            const playedEvt: MinionPlayedEvent = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: { 
                    playerId, 
                    cardUid, 
                    defId, 
                    baseIndex: 0, 
                    baseDefId: state.core.bases[0].defId,
                    power 
                },
                timestamp,
            };
            return { state, events: [
                grantExtraMinion(playerId, 'robot_hoverbot', timestamp),
                playedEvt,
            ] };
        }
        // 多基地→链式选基地
        const baseCandidates = state.core.bases.map((b, i) => {
            const bd = getBaseDef(b.defId);
            return { baseIndex: i, label: bd?.name ?? `基地 ${i + 1}` };
        });
        const next = createSimpleChoice(
            `robot_hoverbot_base_${timestamp}`, playerId, '选择打出随从的基地', buildBaseTargetOptions(baseCandidates, state.core), { sourceId: 'robot_hoverbot_base', targetType: 'base' }
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
        const ctx = iData?.continuationContext as { cardUid: string; defId: string; power: number } | undefined;
        if (!ctx) return undefined;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid: ctx.cardUid, defId: ctx.defId, baseIndex, power: ctx.power },
            timestamp,
        };
        return { state, events: [
            grantExtraMinion(playerId, 'robot_hoverbot', timestamp),
            playedEvt,
        ] };
    });
}

// ============================================================================
// Ongoing 拦截器注册?
// ============================================================================

/** 注册机器人派系的 ongoing 拦截器?*/
function registerRobotOngoingEffects(): void {
    // 战争机器人：不能被消灭
    registerProtection('robot_warbot', 'destroy', (ctx) => {
        return ctx.targetMinion.defId === 'robot_warbot';
    });

    // 微型机档案馆：微型机被消灭后控制者抽1张牌
    // alpha 联动：当 alpha 在场时，同控制者的所有随从均视为微型机
    registerTrigger('robot_microbot_archive', 'onMinionDestroyed', (trigCtx) => {
        if (!trigCtx.triggerMinionDefId) return [];

        // 找到 microbot_archive 的拥有者
        let archiveOwner: string | undefined;
        for (const base of trigCtx.state.bases) {
            const archive = base.minions.find(m => m.defId === 'robot_microbot_archive');
            if (archive) {
                archiveOwner = archive.controller;
                break;
            }
        }
        if (!archiveOwner) return [];

        // "你的"微型机 — 被消灭随从必须属于 archive 控制者
        if (trigCtx.playerId !== archiveOwner) return [];

        // 判断被消灭的随从是否算微型机
        const isOriginalMicrobot = MICROBOT_DEF_IDS.has(trigCtx.triggerMinionDefId);
        if (!isOriginalMicrobot) {
            // 非原始微型机 defId → 检查 alpha 联动
            // alpha 在场 = 同控制者所有随从视为微型机
            const alphaOnField = trigCtx.state.bases.some(base =>
                base.minions.some(m => m.defId === 'robot_microbot_alpha' && m.controller === archiveOwner)
            );
            if (!alphaOnField) return [];
        }

        // ?张牌
        const player = trigCtx.state.players[archiveOwner];
        if (!player || player.deck.length === 0) return [];
        const { drawnUids } = drawCards(player, 1, trigCtx.random);
        if (drawnUids.length === 0) return [];

        return [{
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: archiveOwner, count: 1, cardUids: drawnUids },
            timestamp: trigCtx.now,
        }];
    });
}
