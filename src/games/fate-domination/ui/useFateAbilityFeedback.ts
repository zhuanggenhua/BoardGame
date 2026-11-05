import {useEffect} from 'react';
import {useEventStreamCursor} from '../../../engine/hooks/useEventStreamCursor';
import type {EventStreamEntry} from '../../../engine/types';
import {useToast} from '../../../contexts/ToastContext';
import type {FateDominationCore, FateAbilityUnimplementedEvent} from '../domain/types';
const EMPTY_EVENTS: EventStreamEntry[] = [];
/** Failed ability execution belongs to transient feedback, not a permanent instruction panel. */
export function useFateAbilityFeedback(core: FateDominationCore, viewerId: string | null, events?: EventStreamEntry[]) {
    const entries = events ?? EMPTY_EVENTS;
    const {consumeNew} = useEventStreamCursor({entries});
    const {warning} = useToast();
    useEffect(() => {
        for (const entry of consumeNew().entries) {
            if (entry.event.type !== 'FATE_ABILITY_UNIMPLEMENTED') continue;
            const {playerId, skillId} = (entry.event as FateAbilityUnimplementedEvent).payload;
            if (playerId !== viewerId) continue;
            const skill = core.players[playerId]?.skills.find(item => item.id === skillId);
            warning({kind:'i18n', ns:'game-fate-domination', key:skill ? 'feedback.skillUnavailable' : 'feedback.abilityUnavailable', params:skill ? {skill:skill.name} : undefined}, undefined, {dedupeKey:`fate-ability-unavailable:${entry.id}`});
        }
    }, [entries, consumeNew, core.players, viewerId, warning]);
}
