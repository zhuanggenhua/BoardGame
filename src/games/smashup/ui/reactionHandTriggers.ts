import { isSmashUpReactionHandPlayValue } from '../domain/reactionChoiceInteraction';

/** 仅将可唯一对应手牌的可选触发映射到卡牌，冲突项保留原交互入口。 */
export function getReactionHandTriggerOptions(
    options: readonly { id: string; disabled?: boolean; value?: unknown }[],
    triggers: readonly { id: string; resolutionClass?: string; sourceCardUid?: string }[],
    hand: readonly { uid: string }[],
): { optionIds: Set<string>; optionIdsByCardUid: Map<string, string> } {
    const optionIds = new Set<string>();
    const optionIdsByCardUid = new Map<string, string>();
    const handUids = new Set(hand.map(card => card.uid));
    const directPlayUids = new Set(options.flatMap(option =>
        !option.disabled && isSmashUpReactionHandPlayValue(option.value) ? [option.value.cardUid] : [],
    ));
    const candidates: Array<{ cardUid: string; optionId: string }> = [];
    for (const option of options) {
        if (option.disabled) continue;
        const value = option.value as { kind?: string; triggerId?: string } | undefined;
        if (value?.kind !== 'trigger' || !value.triggerId) continue;
        const trigger = triggers.find(candidate => candidate.id === value.triggerId);
        if (trigger?.resolutionClass !== 'optional' || !trigger.sourceCardUid || !handUids.has(trigger.sourceCardUid)) continue;
        candidates.push({ cardUid: trigger.sourceCardUid, optionId: option.id });
    }
    for (const candidate of candidates) {
        if (directPlayUids.has(candidate.cardUid) || candidates.filter(item => item.cardUid === candidate.cardUid).length !== 1) continue;
        optionIds.add(candidate.optionId);
        optionIdsByCardUid.set(candidate.cardUid, candidate.optionId);
    }
    return { optionIds, optionIdsByCardUid };
}
