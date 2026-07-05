import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';

export const QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID = 'qidahen:hand-limit-discard';
export const QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID = 'qidahen:recruit';
export const QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID = 'qidahen:diplomacy';
export const QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID = 'qidahen:dispatch-targeting';
export const QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID = 'qidahen:internal-dispatch';
export const QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID = 'qidahen:ma-shi-trade';
export const QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID = 'qidahen:khan-edict';
export const QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID = 'qidahen:drive-tiger-consent';
export const QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID = 'qidahen:fortification-maintenance';
export const QIDAHEN_EVENT_CHARACTER_TARGET_INTERACTION_SOURCE_ID = 'qidahen:event-character-target';
export const QIDAHEN_EVENT_OPPONENT_HAND_CHOICE_INTERACTION_SOURCE_ID = 'qidahen:event-opponent-hand-choice';
export const QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID = 'qidahen:pending-target';
export const QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID = 'qidahen:post-battle';

const QIDAHEN_INTERACTION_SOURCE_IDS = [
    QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID,
    QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID,
    QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID,
    QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID,
    QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID,
    QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID,
    QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID,
    QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID,
    QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID,
    QIDAHEN_EVENT_CHARACTER_TARGET_INTERACTION_SOURCE_ID,
    QIDAHEN_EVENT_OPPONENT_HAND_CHOICE_INTERACTION_SOURCE_ID,
    QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
    QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
] as const;

export type QidahenInteractionSourceId = (typeof QIDAHEN_INTERACTION_SOURCE_IDS)[number];

export function isQidahenInteractionSourceId(value: unknown): value is QidahenInteractionSourceId {
    return typeof value === 'string'
        && (QIDAHEN_INTERACTION_SOURCE_IDS as readonly string[]).includes(value);
}

export function getInteractionSourceId(
    interaction?: InteractionDescriptor | null,
): QidahenInteractionSourceId | null {
    if (!interaction || !interaction.data || typeof interaction.data !== 'object') {
        return null;
    }
    const sourceId = (interaction.data as { sourceId?: unknown }).sourceId;
    return isQidahenInteractionSourceId(sourceId) ? sourceId : null;
}
