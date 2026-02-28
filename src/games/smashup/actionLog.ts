/**
 * SmashUp - ActionLog 格式化
 * 
 * 使用 i18n segment 延迟翻译，避免服务端无 i18n 环境导致显示 raw key。
 */

import type {
    ActionLogEntry,
    ActionLogSegment,
    Command,
    GameEvent,
    MatchState,
    PlayerId,
} from '../../engine/types';
import { FLOW_COMMANDS } from '../../engine';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { SU_COMMANDS, SU_EVENTS } from './domain';
import type { SmashUpCore, MinionPowerBreakdown } from './domain/types';
import { getSmashUpCardPreviewMeta } from './ui/cardPreviewHelper';
import { buildDamageBreakdownSegment, type DamageSourceResolver } from '../../engine/primitives/actionLogHelpers';

// ============================================================================
// 白名单定义
// ============================================================================

/**
 * 操作日志白名单：记录所有有意义的玩家操作。
 * 
 * 包含 INTERACTION_COMMANDS.RESPOND：交互解决后产生的事件（如 Igor onDestroy 产生的 POWER_COUNTER_ADDED）
 * 需要被记录到 ActionLog。
 */
export const ACTION_ALLOWLIST = [
    SU_COMMANDS.PLAY_MINION,
    SU_COMMANDS.PLAY_ACTION,
    SU_COMMANDS.USE_TALENT,
    SU_COMMANDS.DISCARD_TO_LIMIT,
    FLOW_COMMANDS.ADVANCE_PHASE,
    INTERACTION_COMMANDS.RESPOND,  // ✅ 新增：记录交互解决后产生的事件
] as const;

/**
 * 撤回快照白名单：只包含"玩家主动决策点"命令。
 * 连锁/系统命令不产生独立快照：
 * - ADVANCE_PHASE：触发回合结束链条（scoreBases→draw→endTurn→startTurn），
 *   不是独立决策点，撤回应回到最后一次出牌前
 * - DISCARD_TO_LIMIT：draw 阶段手牌超限时的弃牌，是 ADVANCE_PHASE 的连锁操作
 */
export const UNDO_ALLOWLIST = [
    SU_COMMANDS.PLAY_MINION,
    SU_COMMANDS.PLAY_ACTION,
    SU_COMMANDS.USE_TALENT,
] as const;

const SU_NS = 'game-smashup';

/** i18n segment 工厂 */
const i18nSeg = (
    key: string,
    params?: Record<string, string | number>,
    paramI18nKeys?: string[],
): ActionLogSegment => ({
    type: 'i18n' as const,
    ns: SU_NS,
    key,
    ...(params ? { params } : {}),
    ...(paramI18nKeys ? { paramI18nKeys } : {}),
});

const textSegment = (text: string): ActionLogSegment => ({ type: 'text', text });

/** 构建原因后缀 segment 列表：优先用卡牌预览，fallback 为纯文本 */
const buildReasonSegments = (
    reason: string,
    buildCardSeg: (cardId?: string) => ActionLogSegment | null,
): ActionLogSegment[] => {
    const cardSeg = buildCardSeg(reason);
    if (cardSeg && cardSeg.type === 'card') {
        // 卡牌预览：（原因：[卡牌名]）
        return [i18nSeg('actionLog.reasonPrefix'), cardSeg, textSegment('）')];
    }
    // fallback：纯文本
    return [i18nSeg('actionLog.reasonSuffix', { reason })];
};

// ============================================================================
// DamageSourceResolver（力量 breakdown 来源解析）
// ============================================================================

/**
 * SmashUp 力量来源解析器
 *
 * 将 sourceDefId 翻译为可显示标签（卡牌名称 i18n key）。
 * 特殊 key（永久/临时修正）直接返回 i18n key。
 */
export const suPowerSourceResolver: DamageSourceResolver = {
    resolve(sourceId: string) {
        // 永久/临时修正的特殊 key
        if (sourceId.startsWith('actionLog.powerModifier.')) {
            return { label: sourceId, isI18n: true, ns: SU_NS };
        }
        // 卡牌名称
        const meta = getSmashUpCardPreviewMeta(sourceId);
        if (meta?.name) {
            const isI18n = meta.name.includes('.');
            return { label: meta.name, isI18n, ns: isI18n ? SU_NS : undefined };
        }
        return null;
    },
};



// ============================================================================
// ActionLog 格式化
// ============================================================================

export function formatSmashUpActionEntry({
    command,
    state: _state,
    events,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | ActionLogEntry[] | null {
    const state = _state as MatchState<SmashUpCore>;
    const { core } = state;
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const actorId = command.playerId;
    const entries: ActionLogEntry[] = [];

    const buildCardSegment = (cardId?: string): ActionLogSegment | null => {
        if (!cardId) return null;
        const meta = getSmashUpCardPreviewMeta(cardId);
        if (!meta?.name) return textSegment(cardId);
        const isI18nKey = meta.name.includes('.');
        if (meta.previewRef) {
            return {
                type: 'card',
                cardId,
                previewText: meta.name,
                previewRef: meta.previewRef,
                ...(isI18nKey ? { previewTextNs: SU_NS } : {}),
            };
        }
        if (isI18nKey) {
            return i18nSeg(meta.name);
        }
        return textSegment(meta.name);
    };
    const withCardSegments = (i18nKey: string, cardId?: string, params?: Record<string, string | number>, paramI18nKeys?: string[]): ActionLogSegment[] => {
        const segments: ActionLogSegment[] = [i18nSeg(i18nKey, params, paramI18nKeys)];
        const cardSeg = buildCardSegment(cardId);
        if (cardSeg) segments.push(cardSeg);
        return segments;
    };
    const getBaseDefId = (baseIndex?: number) => (
        baseIndex === undefined ? undefined : core.bases?.[baseIndex]?.defId
    );
    const formatBaseLabel = (baseDefId?: string, baseIndex?: number) => {
        if (baseDefId) {
            const meta = getSmashUpCardPreviewMeta(baseDefId);
            if (meta?.name) return meta.name;
        }
        if (baseIndex !== undefined) {
            // 基地名称无法延迟翻译（作为其他 i18n key 的参数），直接用索引
            return `#${baseIndex + 1}`;
        }
        return '?';
    };
    const pushEntry = (
        kind: string,
        segments: ActionLogSegment[],
        entryActorId: PlayerId = actorId,
        entryTimestamp: number = timestamp,
        index = entries.length
    ) => {
        entries.push({
            id: `${kind}-${entryActorId}-${entryTimestamp}-${index}`,
            timestamp: entryTimestamp,
            actorId: entryActorId,
            kind,
            segments,
        });
    };

    events.forEach((event, index) => {
        const entryTimestamp = typeof event.timestamp === 'number' ? event.timestamp : timestamp;
        switch (event.type) {
            case SU_EVENTS.MINION_PLAYED: {
                const payload = event.payload as { defId: string; baseIndex: number; baseDefId?: string };
                // 优先使用 payload 中的 baseDefId（事件发生时的基地），fallback 到当前状态查找
                const baseLabel = formatBaseLabel(payload.baseDefId ?? getBaseDefId(payload.baseIndex), payload.baseIndex);
                const segments = withCardSegments('actionLog.minionPlayed', payload.defId);
                if (baseLabel) {
                    segments.push(i18nSeg('actionLog.onBase', { base: baseLabel }, ['base']));
                }
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.ACTION_PLAYED: {
                const payload = event.payload as { defId: string };
                const segments = withCardSegments('actionLog.actionPlayed', payload.defId);
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.MINION_DESTROYED: {
                const payload = event.payload as { minionDefId: string; fromBaseIndex: number; reason?: string };
                const baseLabel = formatBaseLabel(getBaseDefId(payload.fromBaseIndex), payload.fromBaseIndex);
                const segments = withCardSegments('actionLog.minionDestroyed', payload.minionDefId);
                if (baseLabel) {
                    segments.push(i18nSeg('actionLog.onBase', { base: baseLabel }, ['base']));
                }
                // 添加原因说明（如果有）
                if (payload.reason) {
                    segments.push({ type: 'text', text: ` （原因： ${payload.reason}）` });
                }
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.MINION_MOVED: {
                const payload = event.payload as { minionDefId: string; fromBaseIndex: number; toBaseIndex: number; reason?: string };
                const fromLabel = formatBaseLabel(getBaseDefId(payload.fromBaseIndex), payload.fromBaseIndex);
                const toLabel = formatBaseLabel(getBaseDefId(payload.toBaseIndex), payload.toBaseIndex);
                const segments = withCardSegments('actionLog.minionMoved', payload.minionDefId);
                segments.push(i18nSeg('actionLog.fromTo', { from: fromLabel, to: toLabel }, ['from', 'to']));
                // 添加原因说明（如果有）
                if (payload.reason) {
                    segments.push({ type: 'text', text: ` （原因： ${payload.reason}）` });
                }
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.MINION_RETURNED: {
                const payload = event.payload as { minionDefId: string; fromBaseIndex: number; toPlayerId: PlayerId };
                const baseLabel = formatBaseLabel(getBaseDefId(payload.fromBaseIndex), payload.fromBaseIndex);
                const segments = withCardSegments('actionLog.minionReturned', payload.minionDefId, { playerId: payload.toPlayerId });
                if (baseLabel) {
                    segments.push(i18nSeg('actionLog.onBase', { base: baseLabel }, ['base']));
                }
                pushEntry(event.type, segments, payload.toPlayerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.POWER_COUNTER_ADDED: {
                const payload = event.payload as { minionUid: string; amount: number; baseIndex: number; reason?: string };
                const baseLabel = formatBaseLabel(getBaseDefId(payload.baseIndex), payload.baseIndex);
                // 从 minionUid 查找随从的 defId（优先从场上查找，fallback 到 reason 字段）
                const minion = core.bases?.[payload.baseIndex]?.minions.find(m => m.uid === payload.minionUid);
                const minionDefId = minion?.defId ?? payload.reason ?? payload.minionUid;
                const segments = withCardSegments('actionLog.powerCounterAdded', minionDefId, { amount: payload.amount });
                if (baseLabel) {
                    segments.push(i18nSeg('actionLog.onBase', { base: baseLabel }, ['base']));
                }
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.POWER_COUNTER_REMOVED: {
                const payload = event.payload as { minionUid: string; amount: number; baseIndex: number; reason?: string };
                const baseLabel = formatBaseLabel(getBaseDefId(payload.baseIndex), payload.baseIndex);
                // 从 minionUid 查找随从的 defId（优先从场上查找，fallback 到 reason 字段）
                const minion = core.bases?.[payload.baseIndex]?.minions.find(m => m.uid === payload.minionUid);
                const minionDefId = minion?.defId ?? payload.reason ?? payload.minionUid;
                const segments = withCardSegments('actionLog.powerCounterRemoved', minionDefId, { amount: payload.amount });
                if (baseLabel) {
                    segments.push(i18nSeg('actionLog.onBase', { base: baseLabel }, ['base']));
                }
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.ONGOING_ATTACHED: {
                const payload = event.payload as { defId: string; targetType: 'base' | 'minion'; targetBaseIndex: number; targetMinionUid?: string };
                const segments = withCardSegments('actionLog.ongoingAttached', payload.defId);
                if (payload.targetType === 'base') {
                    const baseLabel = formatBaseLabel(getBaseDefId(payload.targetBaseIndex), payload.targetBaseIndex);
                    segments.push(i18nSeg('actionLog.onBase', { base: baseLabel }, ['base']));
                } else if (payload.targetMinionUid) {
                    segments.push(textSegment(' → '));
                    const targetSegment = buildCardSegment(payload.targetMinionUid);
                    if (targetSegment) segments.push(targetSegment);
                }
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.ONGOING_DETACHED: {
                const payload = event.payload as { defId: string; reason?: string };
                const segments = withCardSegments('actionLog.ongoingDetached', payload.defId);
                if (payload.reason) {
                    segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
                }
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.TALENT_USED: {
                const payload = event.payload as { defId: string; baseIndex: number };
                const baseLabel = formatBaseLabel(getBaseDefId(payload.baseIndex), payload.baseIndex);
                const segments = withCardSegments('actionLog.talentUsed', payload.defId);
                if (baseLabel) {
                    segments.push(i18nSeg('actionLog.onBase', { base: baseLabel }, ['base']));
                }
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.BASE_SCORED: {
                const payload = event.payload as {
                    baseDefId: string;
                    rankings: { playerId: PlayerId; power: number; vp: number }[];
                    minionBreakdowns?: Record<PlayerId, MinionPowerBreakdown[]>;
                };
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.baseScored')];
                const baseSegment = buildCardSegment(payload.baseDefId);
                if (baseSegment) segments.push(baseSegment);
                payload.rankings.forEach((ranking) => {
                    segments.push(textSegment(' '));
                    // 检查该玩家的随从是否有力量修正
                    const breakdowns = payload.minionBreakdowns?.[ranking.playerId];
                    const hasModifiers = breakdowns?.some(bd => bd.modifiers.length > 0);
                    if (hasModifiers && breakdowns) {
                        // 有修正：显示玩家 + 力量 breakdown tooltip + VP
                        const totalPower = breakdowns.reduce((sum, bd) => sum + bd.finalPower, 0);
                        // 构建总力量 breakdown：合并所有随从的基础力量和修正
                        const allModifiers = breakdowns.flatMap(bd => bd.modifiers.map(m => ({
                            type: 'flat',
                            value: m.value,
                            sourceId: m.sourceDefId,
                            sourceName: m.sourceName,
                        })));
                        const breakdownSeg = buildDamageBreakdownSegment(
                            totalPower,
                            {
                                damage: totalPower,
                                modifiers: allModifiers,
                            },
                            suPowerSourceResolver,
                            SU_NS,
                        );
                        segments.push(i18nSeg('actionLog.baseScoredRankingWithBreakdown', {
                            playerId: ranking.playerId,
                            vp: ranking.vp,
                        }));
                        segments.push(breakdownSeg);
                    } else {
                        // 无修正：保持原格式
                        segments.push(i18nSeg('actionLog.baseScoredRanking', {
                            playerId: ranking.playerId,
                            vp: ranking.vp,
                        }));
                    }
                });
                
                // 添加 VP 快照（用于审计和 bug 追溯）
                const vpSnapshot = Object.entries(core.players)
                    .map(([pid, p]) => `${pid}:${p?.vp ?? 0}`)
                    .join(' ');
                segments.push(textSegment(` [总VP: ${vpSnapshot}]`));
                
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.VP_AWARDED: {
                const payload = event.payload as { playerId: PlayerId; amount: number; reason?: string };
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.vpAwarded', {
                    playerId: payload.playerId,
                    amount: payload.amount,
                })];
                if (payload.reason) {
                    segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
                }
                
                // 添加 VP 快照（用于审计和 bug 追溯）
                const vpSnapshot = Object.entries(core.players)
                    .map(([pid, p]) => `${pid}:${p?.vp ?? 0}`)
                    .join(' ');
                segments.push(textSegment(` [总VP: ${vpSnapshot}]`));
                
                pushEntry(event.type, segments, payload.playerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.CARDS_DRAWN: {
                const payload = event.payload as { playerId: PlayerId; count: number };
                pushEntry(event.type, [i18nSeg('actionLog.cardsDrawn', {
                    playerId: payload.playerId,
                    count: payload.count,
                })], payload.playerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.CARDS_DISCARDED: {
                const payload = event.payload as { playerId: PlayerId; cardUids: string[] };
                pushEntry(event.type, [i18nSeg('actionLog.cardsDiscarded', {
                    playerId: payload.playerId,
                    count: payload.cardUids?.length ?? 0,
                })], payload.playerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.TURN_STARTED: {
                const payload = event.payload as { playerId: PlayerId };
                pushEntry(event.type, [i18nSeg('actionLog.turnStarted', {
                    playerId: payload.playerId,
                })], payload.playerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.TURN_ENDED: {
                const payload = event.payload as { playerId: PlayerId };
                pushEntry(event.type, [i18nSeg('actionLog.turnEnded', {
                    playerId: payload.playerId,
                })], payload.playerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.BASE_REPLACED: {
                const payload = event.payload as { oldBaseDefId: string; newBaseDefId: string; keepCards?: boolean };
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.baseReplaced')];
                const oldSeg = buildCardSegment(payload.oldBaseDefId);
                const newSeg = buildCardSegment(payload.newBaseDefId);
                if (oldSeg) segments.push(oldSeg);
                segments.push(textSegment(' → '));
                if (newSeg) segments.push(newSeg);
                if (payload.keepCards) {
                    segments.push(i18nSeg('actionLog.baseReplacedKeep'));
                }
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.DECK_RESHUFFLED: {
                const payload = event.payload as { playerId: PlayerId };
                pushEntry(event.type, [i18nSeg('actionLog.deckReshuffled', {
                    playerId: payload.playerId,
                })], payload.playerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.LIMIT_MODIFIED: {
                const payload = event.payload as { playerId: PlayerId; limitType: 'minion' | 'action'; delta: number; reason?: string };
                const limitTypeKey = `actionLog.limitType.${payload.limitType}`;
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.limitModified', {
                    playerId: payload.playerId,
                    limitType: limitTypeKey,
                    delta: payload.delta > 0 ? `+${payload.delta}` : `${payload.delta}`,
                }, ['limitType'])];
                if (payload.reason) {
                    segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
                }
                pushEntry(event.type, segments, payload.playerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.CARD_TO_DECK_TOP: {
                const payload = event.payload as { ownerId: PlayerId; reason?: string };
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.cardToDeckTop', {
                    playerId: payload.ownerId,
                })];
                if (payload.reason) {
                    segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
                }
                pushEntry(event.type, segments, payload.ownerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.CARD_TO_DECK_BOTTOM: {
                const payload = event.payload as { ownerId: PlayerId; reason?: string };
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.cardToDeckBottom', {
                    playerId: payload.ownerId,
                })];
                if (payload.reason) {
                    segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
                }
                pushEntry(event.type, segments, payload.ownerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.CARD_TRANSFERRED: {
                const payload = event.payload as { fromPlayerId: PlayerId; toPlayerId: PlayerId; reason?: string };
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.cardTransferred', {
                    fromPlayerId: payload.fromPlayerId,
                    toPlayerId: payload.toPlayerId,
                })];
                if (payload.reason) {
                    segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
                }
                pushEntry(event.type, segments, payload.toPlayerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.CARD_RECOVERED_FROM_DISCARD: {
                const payload = event.payload as { playerId: PlayerId; cardUids: string[]; reason?: string };
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.cardRecovered', {
                    playerId: payload.playerId,
                    count: payload.cardUids?.length ?? 0,
                })];
                if (payload.reason) {
                    segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
                }
                pushEntry(event.type, segments, payload.playerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.HAND_SHUFFLED_INTO_DECK: {
                const payload = event.payload as { playerId: PlayerId; reason?: string };
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.handShuffledIntoDeck', {
                    playerId: payload.playerId,
                })];
                if (payload.reason) {
                    segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
                }
                pushEntry(event.type, segments, payload.playerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.MADNESS_DRAWN: {
                const payload = event.payload as { playerId: PlayerId; count: number; reason?: string };
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.madnessDrawn', {
                    playerId: payload.playerId,
                    count: payload.count,
                })];
                if (payload.reason) {
                    segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
                }
                pushEntry(event.type, segments, payload.playerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.MADNESS_RETURNED: {
                const payload = event.payload as { playerId: PlayerId; reason?: string };
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.madnessReturned', {
                    playerId: payload.playerId,
                })];
                if (payload.reason) {
                    segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
                }
                pushEntry(event.type, segments, payload.playerId, entryTimestamp, index);
                break;
            }
            case SU_EVENTS.BASE_DECK_REORDERED: {
                const payload = event.payload as { reason?: string };
                const segments: ActionLogSegment[] = [i18nSeg('actionLog.baseDeckReordered')];
                if (payload.reason) {
                    segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
                }
                pushEntry(event.type, segments, actorId, entryTimestamp, index);
                break;
            }
            default:
                break;
        }
    });

    if (entries.length === 0) return null;
    if (entries.length === 1) return entries[0];
    return entries;
}
