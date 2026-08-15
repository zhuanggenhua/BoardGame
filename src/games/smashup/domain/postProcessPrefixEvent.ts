import type {
    ActionCounteredEvent,
    ActionPlayedEvent,
    BaseClearedEvent,
    BaseDeckReorderedEvent,
    BaseDeckShuffledEvent,
    BaseReplacedEvent,
    BaseScoredEvent,
    BaseAbilitySuppressedEvent,
    BuriedCardReturnedToHandEvent,
    CardBuriedEvent,
    CardRecoveredFromDiscardEvent,
    CardRemovedFromGameEvent,
    CardTransferredEvent,
    CardToDeckBottomEvent,
    CardToDeckTopEvent,
    CardsDiscardedEvent,
    CardsDrawnEvent,
    CardsMilledEvent,
    DeckInspectedEvent,
    DeckReorderedEvent,
    DeckReshuffledEvent,
    DuelEndedEvent,
    ExtraTurnQueuedEvent,
    HandShuffledIntoDeckEvent,
    LimitModifiedEvent,
    MadnessDrawnEvent,
    MadnessReturnedEvent,
    MinionControlChangedEvent,
    MinionMetadataUpdatedEvent,
    MinionMovedEvent,
    MinionDestroyedEvent,
    MinionPlayedEvent,
    MinionReturnedEvent,
    MunchkinMonsterDefeatedEvent,
    MunchkinMonsterPlayedEvent,
    MunchkinTreasureRewardDistributedEvent,
    MunchkinTreasureRewardRevealedEvent,
    OngoingAttachedEvent,
    OngoingDetachedEvent,
    PermanentPowerAddedEvent,
    BreakpointModifiedEvent,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    OngoingCardCounterChangedEvent,
    RevealDeckTopEvent,
    RevealHandEvent,
    SmashUpCore,
    SmashUpEvent,
    SpecialAfterScoringConsumedEvent,
    SpecialLimitUsedEvent,
    TalentUsedEvent,
    TempBasePowerModifiedEvent,
    TempPowerAddedEvent,
    TitanMetadataUpdatedEvent,
    TitanMovedEvent,
    TitanPlayedEvent,
    TitanPowerCounterAddedEvent,
    TitanPowerCounterRemovedEvent,
    TitanOngoingSuppressedEvent,
    TitanRemovedFromPlayEvent,
    TurnEndedEvent,
    VpAwardedEvent,
} from './types';
import { SU_EVENTS } from './types';
import { bindEntityScopedValue } from '../../../engine/primitives';
import {
    reduceActionCounteredEvent,
    reduceActionPlayedEvent,
    reduceAfterScoringClearedEvent,
    reduceAfterScoringTriggeredEvent,
    reduceBaseClearedEvent,
    reduceBaseDeckReorderedEvent,
    reduceBaseDeckShuffledEvent,
    reduceBaseReplacedEvent,
    reduceBaseScoredEvent,
    reduceBeforeScoringClearedEvent,
    reduceBeforeScoringTriggeredEvent,
    reduceBuriedCardReturnedToHandEvent,
    reduceCardBuriedEvent,
    reduceCardToDeckBottomEvent,
    reduceCardToDeckTopEvent,
    reduceCardRecoveredFromDiscardEvent,
    reduceCardRemovedFromGameEvent,
    reduceCardsDiscardedEvent,
    reduceCardsDrawnEvent,
    reduceCardsMilledEvent,
    reduceCardTransferredEvent,
    reduceDeckInspectionFactEvent,
    reduceDeckReorderedEvent,
    reduceDeckReshuffledEvent,
    reduceDuelEndedEvent,
    reduceExtraTurnQueuedEvent,
    reduceHandShuffledIntoDeckEvent,
    reduceLimitModifiedEvent,
    reduceMadnessDrawnEvent,
    reduceMadnessReturnedEvent,
    reduceMinionControlChangedEvent,
    reduceMinionMetadataUpdatedEvent,
    reduceMinionMovedEvent,
    reduceMinionDestroyedEvent,
    reduceMinionPlayedEvent,
    reduceMinionReturnedEvent,
    reduceMunchkinMonsterDefeatedEvent,
    reduceMunchkinMonsterPlayedEvent,
    reduceMunchkinTreasureRewardDistributedEvent,
    reduceMunchkinTreasureRewardRevealedEvent,
    reduceOngoingAttachedEvent,
    reduceOngoingDetachedEvent,
    reducePermanentPowerAddedEvent,
    reducePowerCounterAddedEvent,
    reducePowerCounterRemovedEvent,
    reduceScoringEligibleBasesLockedEvent,
    reduceSpecialAfterScoringConsumedEvent,
    reduceSpecialLimitUsedEvent,
    reduceTalentUsedEvent,
    reduceTempBasePowerModifiedEvent,
    reduceTempPowerAddedEvent,
    reduceTitanMetadataUpdatedEvent,
    reduceTitanMovedEvent,
    reduceTitanPlayedEvent,
    reduceTitanPowerCounterAddedEvent,
    reduceTitanPowerCounterRemovedEvent,
    reduceTitanOngoingSuppressedEvent,
    reduceTitanRemovedFromPlayEvent,
    reduceTurnEndedEvent,
    reduceTurnStartedEvent,
    reduceVpAwardedEvent,
    reduceWhenScoringClearedEvent,
    reduceWhenScoringTriggeredEvent,
} from './reduce';
import { applyTriggerQueueFactEvent } from './triggerQueueFacts';

function resolvePostProcessBaseInstanceId(
    state: SmashUpCore,
    baseIndex: number,
    explicitBaseInstanceId?: string,
): string | undefined {
    if (explicitBaseInstanceId && state.bases.some(base => base.instanceId === explicitBaseInstanceId)) {
        return explicitBaseInstanceId;
    }
    return state.bases[baseIndex]?.instanceId;
}

export function applyPostProcessPrefixEvent(core: SmashUpCore, event: SmashUpEvent): SmashUpCore {
    switch (event.type) {
        case SU_EVENTS.VP_AWARDED:
            return reduceVpAwardedEvent(core, event as VpAwardedEvent);
        case SU_EVENTS.BASE_SCORED:
            return reduceBaseScoredEvent(core, event as BaseScoredEvent);
        case SU_EVENTS.BASE_CLEARED:
            return reduceBaseClearedEvent(core, event as BaseClearedEvent);
        case SU_EVENTS.BASE_REPLACED:
            return reduceBaseReplacedEvent(core, event as BaseReplacedEvent);
        case SU_EVENTS.CARDS_DRAWN:
            return reduceCardsDrawnEvent(core, event as CardsDrawnEvent);
        case SU_EVENTS.CARDS_DISCARDED:
            return reduceCardsDiscardedEvent(core, event as CardsDiscardedEvent);
        case SU_EVENTS.CARDS_MILLED:
            return reduceCardsMilledEvent(core, event as CardsMilledEvent);
        case SU_EVENTS.MADNESS_DRAWN:
            return reduceMadnessDrawnEvent(core, event as MadnessDrawnEvent);
        case SU_EVENTS.MADNESS_RETURNED:
            return reduceMadnessReturnedEvent(core, event as MadnessReturnedEvent);
        case SU_EVENTS.MINION_PLAYED:
            return reduceMinionPlayedEvent(core, event as MinionPlayedEvent);
        case SU_EVENTS.MINION_DESTROYED:
            return reduceMinionDestroyedEvent(core, event as MinionDestroyedEvent);
        case SU_EVENTS.MINION_CONTROL_CHANGED:
            return reduceMinionControlChangedEvent(core, event as MinionControlChangedEvent);
        case SU_EVENTS.MINION_METADATA_UPDATED:
            return reduceMinionMetadataUpdatedEvent(core, event as MinionMetadataUpdatedEvent);
        case SU_EVENTS.ACTION_PLAYED:
            return reduceActionPlayedEvent(core, event as ActionPlayedEvent);
        case SU_EVENTS.ACTION_COUNTERED:
            return reduceActionCounteredEvent(core, event as ActionCounteredEvent);
        case SU_EVENTS.MINION_MOVED:
            return reduceMinionMovedEvent(core, event as MinionMovedEvent);
        case SU_EVENTS.MINION_RETURNED:
            return reduceMinionReturnedEvent(core, event as MinionReturnedEvent);
        case SU_EVENTS.CARD_TRANSFERRED:
            return reduceCardTransferredEvent(core, event as CardTransferredEvent);
        case SU_EVENTS.CARD_RECOVERED_FROM_DISCARD:
            return reduceCardRecoveredFromDiscardEvent(core, event as CardRecoveredFromDiscardEvent);
        case SU_EVENTS.CARD_REMOVED_FROM_GAME:
            return reduceCardRemovedFromGameEvent(core, event as CardRemovedFromGameEvent);
        case SU_EVENTS.CARD_BURIED:
            return reduceCardBuriedEvent(core, event as CardBuriedEvent);
        case SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND:
            return reduceBuriedCardReturnedToHandEvent(core, event as BuriedCardReturnedToHandEvent);
        case SU_EVENTS.CARD_TO_DECK_TOP:
            return reduceCardToDeckTopEvent(core, event as CardToDeckTopEvent);
        case SU_EVENTS.CARD_TO_DECK_BOTTOM:
            return reduceCardToDeckBottomEvent(core, event as CardToDeckBottomEvent);
        case SU_EVENTS.HAND_SHUFFLED_INTO_DECK:
            return reduceHandShuffledIntoDeckEvent(core, event as HandShuffledIntoDeckEvent);
        case SU_EVENTS.DECK_REORDERED:
            return reduceDeckReorderedEvent(core, event as DeckReorderedEvent);
        case SU_EVENTS.DECK_RESHUFFLED:
            return reduceDeckReshuffledEvent(core, event as DeckReshuffledEvent);
        case SU_EVENTS.LIMIT_MODIFIED:
            return reduceLimitModifiedEvent(core, event as LimitModifiedEvent);
        case SU_EVENTS.ONGOING_ATTACHED:
            return reduceOngoingAttachedEvent(core, event as OngoingAttachedEvent);
        case SU_EVENTS.ONGOING_DETACHED:
            return reduceOngoingDetachedEvent(core, event as OngoingDetachedEvent);
        case SU_EVENTS.MUNCHKIN_MONSTER_PLAYED:
            return reduceMunchkinMonsterPlayedEvent(core, event as MunchkinMonsterPlayedEvent);
        case SU_EVENTS.MUNCHKIN_MONSTER_DEFEATED:
            return reduceMunchkinMonsterDefeatedEvent(core, event as MunchkinMonsterDefeatedEvent);
        case SU_EVENTS.MUNCHKIN_TREASURE_REWARD_REVEALED:
            return reduceMunchkinTreasureRewardRevealedEvent(core, event as MunchkinTreasureRewardRevealedEvent);
        case SU_EVENTS.MUNCHKIN_TREASURE_REWARD_DISTRIBUTED:
            return reduceMunchkinTreasureRewardDistributedEvent(core, event as MunchkinTreasureRewardDistributedEvent);
        case SU_EVENTS.BASE_DECK_REORDERED:
            return reduceBaseDeckReorderedEvent(core, event as BaseDeckReorderedEvent);
        case SU_EVENTS.BASE_DECK_SHUFFLED:
            return reduceBaseDeckShuffledEvent(core, event as BaseDeckShuffledEvent);
        case SU_EVENTS.TALENT_USED:
            return reduceTalentUsedEvent(core, event as TalentUsedEvent);
        case SU_EVENTS.TITAN_PLAYED:
            return reduceTitanPlayedEvent(core, event as TitanPlayedEvent);
        case SU_EVENTS.TITAN_MOVED:
            return reduceTitanMovedEvent(core, event as TitanMovedEvent);
        case SU_EVENTS.TITAN_REMOVED_FROM_PLAY:
            return reduceTitanRemovedFromPlayEvent(core, event as TitanRemovedFromPlayEvent);
        case SU_EVENTS.TITAN_METADATA_UPDATED:
            return reduceTitanMetadataUpdatedEvent(core, event as TitanMetadataUpdatedEvent);
        case SU_EVENTS.TITAN_POWER_COUNTER_ADDED:
            return reduceTitanPowerCounterAddedEvent(core, event as TitanPowerCounterAddedEvent);
        case SU_EVENTS.TITAN_POWER_COUNTER_REMOVED:
            return reduceTitanPowerCounterRemovedEvent(core, event as TitanPowerCounterRemovedEvent);
        case SU_EVENTS.TITAN_ONGOING_SUPPRESSED:
            return reduceTitanOngoingSuppressedEvent(core, event as TitanOngoingSuppressedEvent);
        case SU_EVENTS.POWER_COUNTER_ADDED:
            return reducePowerCounterAddedEvent(core, event as PowerCounterAddedEvent);
        case SU_EVENTS.POWER_COUNTER_REMOVED:
            return reducePowerCounterRemovedEvent(core, event as PowerCounterRemovedEvent);
        case SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED: {
            const { cardUid, delta, metadataUpdate, replaceMode } = (event as OngoingCardCounterChangedEvent).payload;
            return {
                ...core,
                bases: core.bases.map(base => ({
                    ...base,
                    ongoingActions: base.ongoingActions.map(ongoing => {
                        if (ongoing.uid !== cardUid) return ongoing;
                        const previousPowerCounters = (ongoing.metadata?.powerCounters as number | undefined) ?? 0;
                        const nextPowerCounters = replaceMode
                            ? Math.max(0, typeof metadataUpdate?.powerCounters === 'number'
                                ? metadataUpdate.powerCounters
                                : previousPowerCounters)
                            : Math.max(0, previousPowerCounters + delta);
                        return {
                            ...ongoing,
                            metadata: {
                                ...ongoing.metadata,
                                ...(metadataUpdate ?? {}),
                                powerCounters: nextPowerCounters,
                            },
                        };
                    }),
                })),
            };
        }
        case SU_EVENTS.TEMP_POWER_ADDED:
            return reduceTempPowerAddedEvent(core, event as TempPowerAddedEvent);
        case SU_EVENTS.PERMANENT_POWER_ADDED:
            return reducePermanentPowerAddedEvent(core, event as PermanentPowerAddedEvent);
        case SU_EVENTS.TEMP_BASE_POWER_MODIFIED:
            return reduceTempBasePowerModifiedEvent(core, event as TempBasePowerModifiedEvent);
        case SU_EVENTS.BREAKPOINT_MODIFIED: {
            const { baseIndex, baseInstanceId, delta } = (event as BreakpointModifiedEvent).payload;
            const resolvedBaseInstanceId = resolvePostProcessBaseInstanceId(core, baseIndex, baseInstanceId);
            return {
                ...core,
                tempBreakpointModifiers: {
                    ...(core.tempBreakpointModifiers ?? {}),
                    [baseIndex]: (core.tempBreakpointModifiers?.[baseIndex] ?? 0) + delta,
                },
                tempBreakpointModifiersByBaseId: resolvedBaseInstanceId
                    ? bindEntityScopedValue(
                        core.tempBreakpointModifiersByBaseId,
                        { entityId: resolvedBaseInstanceId, kind: 'smashup:base' },
                        (core.tempBreakpointModifiersByBaseId?.[resolvedBaseInstanceId] ?? 0) + delta,
                    )
                    : core.tempBreakpointModifiersByBaseId,
            };
        }
        case SU_EVENTS.BASE_ABILITY_SUPPRESSED: {
            const { baseIndex, suppressorPlayerId } = (event as BaseAbilitySuppressedEvent).payload;
            const previous = core.suppressedBasesUntilTurnStart ?? [];
            if (previous.some(entry => entry.baseIndex === baseIndex && entry.suppressorPlayerId === suppressorPlayerId)) {
                return core;
            }
            return {
                ...core,
                suppressedBasesUntilTurnStart: [...previous, { baseIndex, suppressorPlayerId }],
            };
        }
        case SU_EVENTS.TURN_STARTED:
            return reduceTurnStartedEvent(core, event);
        case SU_EVENTS.TURN_ENDED:
            return reduceTurnEndedEvent(core, event as TurnEndedEvent);
        case SU_EVENTS.EXTRA_TURN_QUEUED:
            return reduceExtraTurnQueuedEvent(core, event as ExtraTurnQueuedEvent);
        case SU_EVENTS.DUEL_ENDED:
            return reduceDuelEndedEvent(core, event as DuelEndedEvent);
        case SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED:
            return reduceSpecialAfterScoringConsumedEvent(core, event as SpecialAfterScoringConsumedEvent);
        case SU_EVENTS.SPECIAL_LIMIT_USED:
            return reduceSpecialLimitUsedEvent(core, event as SpecialLimitUsedEvent);
        case SU_EVENTS.SCORING_ELIGIBLE_BASES_LOCKED:
            return reduceScoringEligibleBasesLockedEvent(core, event);
        case SU_EVENTS.BEFORE_SCORING_TRIGGERED:
            return reduceBeforeScoringTriggeredEvent(core, event);
        case SU_EVENTS.BEFORE_SCORING_CLEARED:
            return reduceBeforeScoringClearedEvent(core);
        case SU_EVENTS.WHEN_SCORING_TRIGGERED:
            return reduceWhenScoringTriggeredEvent(core, event);
        case SU_EVENTS.WHEN_SCORING_CLEARED:
            return reduceWhenScoringClearedEvent(core);
        case SU_EVENTS.AFTER_SCORING_TRIGGERED:
            return reduceAfterScoringTriggeredEvent(core, event);
        case SU_EVENTS.AFTER_SCORING_CLEARED:
            return reduceAfterScoringClearedEvent(core);
        case SU_EVENTS.TRIGGER_QUEUED:
        case SU_EVENTS.TRIGGER_CONSUMED:
            return applyTriggerQueueFactEvent(core, event);
        case SU_EVENTS.REVEAL_HAND:
        case SU_EVENTS.REVEAL_DECK_TOP:
        case SU_EVENTS.DECK_INSPECTED:
            return reduceDeckInspectionFactEvent(
                core,
                event as RevealHandEvent | RevealDeckTopEvent | DeckInspectedEvent,
            );
        // 这些事件会在后处理扫描“推进到下一个相关事件”时路过。
        // 当前扫描问题不依赖它们的临时落地；权威 pipeline reducer
        // 之后仍会正式应用一次。这里显式列出，避免未知事件被静默吞掉。
        case 'SYS_SMASHUP_ABILITY_RUNTIME_CONTINUE':
        case SU_EVENTS.FACTION_SELECTED:
        case SU_EVENTS.FACTION_DESELECTED:
        case SU_EVENTS.FACTION_BANNED:
        case SU_EVENTS.FACTION_READY_CONFIRMED:
        case SU_EVENTS.SEAT_SWAPPED:
        case SU_EVENTS.ALL_FACTIONS_SELECTED:
        case SU_EVENTS.ABILITY_FEEDBACK:
        case SU_EVENTS.ACTION_RETURN_TO_HAND_OPTION_ARMED:
        case SU_EVENTS.REACTION_PASS_REQUESTED:
            return core;
        default:
            throw new Error(
                `[smashup/postProcessPrefixEvent] unsupported prefix event: ${String(event.type)}`,
            );
    }
}
