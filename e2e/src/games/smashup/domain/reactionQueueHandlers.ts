import { registerInteractionHandler } from './abilityInteractionHandlers';
import { resolveSmashUpReactionChoice } from './reactionSession';

export function registerReactionQueueInteractionHandlers(): void {
    registerInteractionHandler('smashup_reaction_choose', (state, _playerId, value, _iData, random, timestamp) =>
        resolveSmashUpReactionChoice(state, random, timestamp, (value ?? { kind: 'pass' }) as any),
    );
}
