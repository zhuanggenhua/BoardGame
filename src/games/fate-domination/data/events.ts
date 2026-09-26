import type { EventCardDefinition } from '../domain/types';
import { DEMO_EVENTS } from './demo-data';

export const FATE_EVENTS: EventCardDefinition[] = DEMO_EVENTS.map((event) => ({
    id: event.id,
    name: event.name,
    assetPath: `fate-domination/events/${event.id}`,
    victoryPoints: event.victoryPoints,
    sourceStatus: 'verified',
    effectSummary: event.desc,
}));
const fallbackEvents: EventCardDefinition[] = [
    { id: 'event-fate-battle', name: '命运之战', assetPath: 'fate-domination/events/fate-battle', victoryPoints: 3, sourceStatus: 'verified', effectSummary: '此战场上基本威力 1 和 2 的攻击基本威力增加至 5。' },
];
if (FATE_EVENTS.length === 0) FATE_EVENTS.push(...fallbackEvents);

export const FATE_EVENT_BACK = 'fate-domination/events/back';
