import { useEffect } from 'react';

import { useEventStreamCursor } from '../../../engine/hooks';
import type { EventStreamEntry } from '../../../engine/types';
import { CARDIA_EVENTS } from '../domain/events';

interface CardiaEventAnimations {
    triggerAbilityFlash: () => void;
    addModifierToken: (from: HTMLElement | null, to: HTMLElement, value: number) => void;
    addOngoingMarker: (target: HTMLElement) => void;
    addSignetMove: (from: HTMLElement, to: HTMLElement) => void;
}

interface UseCardiaEventAnimationsConfig {
    eventStreamEntries: EventStreamEntry[];
    animations: CardiaEventAnimations;
    toast: { warning: (message: string) => void };
    t: (key: string, fallback?: string) => string;
    cardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
}

export function useCardiaEventAnimations(config: UseCardiaEventAnimationsConfig): void {
    const { eventStreamEntries, animations, toast, t, cardRefs } = config;
    const { consumeNew } = useEventStreamCursor({ entries: eventStreamEntries });

    useEffect(() => {
        const { entries: newEntries, didReset, didOptimisticRollback } = consumeNew();
        if (didReset || didOptimisticRollback || newEntries.length === 0) {
            return;
        }

        newEntries.forEach((entry) => {
            const event = entry.event;

            if (event.type === CARDIA_EVENTS.ABILITY_ACTIVATED.type) {
                animations.triggerAbilityFlash();
            }

            if (event.type === CARDIA_EVENTS.ABILITY_NO_VALID_TARGET.type) {
                const payload = event.payload as { reason?: string } | undefined;
                if (payload?.reason === 'no_markers') {
                    toast.warning(t('ability.noValidTarget.noMarkers', '场上没有带有修正标记或持续标记的卡牌'));
                }
            }

            if (event.type === CARDIA_EVENTS.MODIFIER_TOKEN_PLACED.type) {
                const payload = event.payload as { cardId?: string; value?: number } | undefined;
                const targetElement = payload?.cardId ? cardRefs.current.get(payload.cardId) : undefined;
                if (targetElement && typeof payload?.value === 'number') {
                    animations.addModifierToken(null, targetElement, payload.value);
                }
            }

            if (event.type === CARDIA_EVENTS.ONGOING_ABILITY_PLACED.type) {
                const payload = event.payload as { cardId?: string } | undefined;
                const targetElement = payload?.cardId ? cardRefs.current.get(payload.cardId) : undefined;
                if (targetElement) {
                    animations.addOngoingMarker(targetElement);
                }
            }

            if (event.type === CARDIA_EVENTS.SIGNET_MOVED.type) {
                const payload = event.payload as { fromCardId?: string; toCardId?: string } | undefined;
                const fromElement = payload?.fromCardId ? cardRefs.current.get(payload.fromCardId) : undefined;
                const toElement = payload?.toCardId ? cardRefs.current.get(payload.toCardId) : undefined;
                if (fromElement && toElement) {
                    animations.addSignetMove(fromElement, toElement);
                }
            }
        });
    }, [animations, cardRefs, consumeNew, eventStreamEntries, t, toast]);
}
