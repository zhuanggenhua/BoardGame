/**
 * Cardia - ActionLog 格式化
 * 
 * 使用 i18n segment 延迟翻译，避免服务端无 i18n 环境导致显示 raw key。
 */

import type {
    ActionLogEntry,
    ActionLogSegment,
    Command,
    GameEvent,
    MatchState,
} from '../../engine/types';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { CARDIA_COMMANDS } from './domain/commands';
import { CARDIA_EVENTS } from './domain/events';
import type { CardiaCore } from './domain/types';
import { getCardiaCardPreviewMeta } from './ui/cardPreviewHelper';

// ============================================================================
// 白名单定义
// ============================================================================

/**
 * 操作日志白名单：记录所有有意义的玩家操作。
 */
export const ACTION_ALLOWLIST = [
    CARDIA_COMMANDS.PLAY_CARD,
    CARDIA_COMMANDS.ACTIVATE_ABILITY,
    CARDIA_COMMANDS.SKIP_ABILITY,
    CARDIA_COMMANDS.END_TURN,
    CARDIA_COMMANDS.ADD_MODIFIER,
    CARDIA_COMMANDS.REMOVE_MODIFIER,
    INTERACTION_COMMANDS.RESPOND,  // 交互解决后产生的事件
] as const;

/**
 * 撤回快照白名单：只包含"玩家主动决策点"命令。
 */
export const UNDO_ALLOWLIST = [
    CARDIA_COMMANDS.PLAY_CARD,
    CARDIA_COMMANDS.ACTIVATE_ABILITY,
    CARDIA_COMMANDS.ADD_MODIFIER,
    CARDIA_COMMANDS.REMOVE_MODIFIER,
] as const;

const CARDIA_NS = 'game-cardia';

/** i18n segment 工厂 */
const i18nSeg = (
    key: string,
    params?: Record<string, string | number>,
    paramI18nKeys?: string[],
): ActionLogSegment => {
    const segment: ActionLogSegment = {
        type: 'i18n' as const,
        ns: CARDIA_NS,
        key,
    };
    
    // 只有当 params 存在且不为空对象时才添加
    if (params && Object.keys(params).length > 0) {
        segment.params = params;
    }
    
    // 只有当 paramI18nKeys 存在且不为空数组时才添加
    if (paramI18nKeys && paramI18nKeys.length > 0) {
        segment.paramI18nKeys = paramI18nKeys;
    }
    
    return segment;
};

const textSegment = (text: string): ActionLogSegment => ({ type: 'text', text });

/** 构建卡牌 segment */
const buildCardSegment = (cardId?: string): ActionLogSegment | null => {
    if (!cardId) return null;
    const meta = getCardiaCardPreviewMeta(cardId);
    if (!meta) return textSegment(cardId);
    
    const isI18nKey = meta.name.includes('.');
    if (meta.previewRef) {
        return {
            type: 'card',
            cardId,
            previewText: meta.name,
            previewRef: meta.previewRef,
            ...(isI18nKey ? { previewTextNs: CARDIA_NS } : {}),
        };
    }
    if (isI18nKey) {
        return i18nSeg(meta.name);
    }
    return textSegment(meta.name);
};

// ============================================================================
// ActionLog 格式化
// ============================================================================

export function formatCardiaActionEntry({
    command,
    state: _state,
    events,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | ActionLogEntry[] | null {
    const _internalState = _state as MatchState<CardiaCore>;
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const actorId = command.playerId;

    // 命令格式化
    switch (command.type) {
        case CARDIA_COMMANDS.PLAY_CARD: {
            const cardPlayedEvent = events.find(e => e.type === CARDIA_EVENTS.CARD_PLAYED.type);
            if (!cardPlayedEvent) return null;
            
            const { cardUid, slotIndex } = cardPlayedEvent.payload;
            
            const cardSeg = buildCardSegment(cardUid);
            if (!cardSeg) return null;

            // 防御性检查：确保 slotIndex 是有效数字
            const encounterNumber = typeof slotIndex === 'number' ? slotIndex + 1 : '?';

            return {
                id: `log-${timestamp}`,
                timestamp,
                actorId,
                kind: command.type,
                segments: [
                    i18nSeg('actionLog.playCard'),
                    cardSeg,
                    i18nSeg('actionLog.toSlot', { slot: encounterNumber }),
                ],
            };
        }

        case CARDIA_COMMANDS.ACTIVATE_ABILITY: {
            const abilityEvent = events.find(e => e.type === CARDIA_EVENTS.ABILITY_ACTIVATED.type);
            if (!abilityEvent) return null;
            
            const { cardId } = abilityEvent.payload;
            const cardSeg = buildCardSegment(cardId);
            if (!cardSeg) return null;

            // Cardia游戏中每张卡只有一个能力，能力名称就是卡牌名称
            // 所以只显示"激活[卡牌名]的能力"，不重复显示能力名
            return {
                id: `log-${timestamp}`,
                timestamp,
                actorId,
                kind: command.type,
                segments: [
                    i18nSeg('actionLog.activateAbility'),
                    cardSeg,
                ],
            };
        }

        case CARDIA_COMMANDS.SKIP_ABILITY: {
            return {
                id: `log-${timestamp}`,
                timestamp,
                actorId,
                kind: command.type,
                segments: [i18nSeg('actionLog.skipAbility')],
            };
        }

        case CARDIA_COMMANDS.END_TURN: {
            return {
                id: `log-${timestamp}`,
                timestamp,
                actorId,
                kind: command.type,
                segments: [i18nSeg('actionLog.endTurn')],
            };
        }

        case CARDIA_COMMANDS.ADD_MODIFIER: {
            const { cardUid, modifierValue } = command.payload;
            const cardSeg = buildCardSegment(cardUid);
            if (!cardSeg) return null;

            return {
                id: `log-${timestamp}`,
                timestamp,
                actorId,
                kind: command.type,
                segments: [
                    i18nSeg('actionLog.addModifier'),
                    cardSeg,
                    i18nSeg('actionLog.modifierValue', { value: modifierValue }),
                ],
            };
        }

        case CARDIA_COMMANDS.REMOVE_MODIFIER: {
            const { cardUid } = command.payload;
            const cardSeg = buildCardSegment(cardUid);
            if (!cardSeg) return null;

            return {
                id: `log-${timestamp}`,
                timestamp,
                actorId,
                kind: command.type,
                segments: [
                    i18nSeg('actionLog.removeModifier'),
                    cardSeg,
                ],
            };
        }

        case INTERACTION_COMMANDS.RESPOND: {
            // 交互解决后产生的事件（如选择卡牌、选择派系等）
            // 根据事件类型生成对应的日志条目
            const entries: ActionLogEntry[] = [];
            
            events.forEach((event, index) => {
                const eventTimestamp = timestamp + index + 1;
                let entry: ActionLogEntry | null = null;

                switch (event.type) {
                    case CARDIA_EVENTS.CARD_REPLACED: {
                        const { slotIndex, oldCardId, newCardId } = event.payload;
                        const oldCardSeg = buildCardSegment(oldCardId);
                        const newCardSeg = buildCardSegment(newCardId);
                        if (!oldCardSeg || !newCardSeg) break;

                        entry = {
                            id: `log-${eventTimestamp}`,
                            timestamp: eventTimestamp,
                            actorId,
                            kind: event.type,
                            segments: [
                                i18nSeg('actionLog.cardReplaced'),
                                oldCardSeg,
                                i18nSeg('actionLog.with'),
                                newCardSeg,
                                i18nSeg('actionLog.atSlot', { slot: slotIndex }),
                            ],
                        };
                        break;
                    }

                    case CARDIA_EVENTS.FACTION_SELECTED: {
                        const { faction } = event.payload;
                        entry = {
                            id: `log-${eventTimestamp}`,
                            timestamp: eventTimestamp,
                            actorId,
                            kind: event.type,
                            segments: [
                                i18nSeg('actionLog.factionSelected'),
                                i18nSeg(`factions.${faction}.name`),
                            ],
                        };
                        break;
                    }
                }

                if (entry) entries.push(entry);
            });

            return entries.length > 0 ? entries : null;
        }

        default:
            return null;
    }
}
