import type { PlayerId } from '../../../engine/types';
import { getCardDef } from '../data/cards';
import type {
    CardInstance,
    CardTransferredEvent,
    CardType,
    SmashUpCardObjectRef,
    SmashUpCardProvenanceSnapshot,
    SmashUpCardZoneDestination,
} from './types';
import { SU_EVENT_TYPES as SU_EVENTS } from './events';

export function createCardDefaultDestination(playerId: PlayerId): SmashUpCardZoneDestination {
    return {
        zone: 'discard',
        playerId,
    };
}

export function createCardProvenanceSnapshot(args: {
    ownerId: PlayerId;
    defaultDestination?: SmashUpCardZoneDestination;
    sourceControllerId?: PlayerId;
}): SmashUpCardProvenanceSnapshot {
    return {
        ownerId: args.ownerId,
        defaultDestination: args.defaultDestination ?? createCardDefaultDestination(args.ownerId),
        ...(args.sourceControllerId ? { sourceControllerId: args.sourceControllerId } : {}),
    };
}

export function createCardObjectRef(args: {
    uid: string;
    defId: string;
    type?: CardType;
    ownerId: PlayerId;
    defaultDestination?: SmashUpCardZoneDestination;
    sourceControllerId?: PlayerId;
}): SmashUpCardObjectRef {
    return {
        uid: args.uid,
        defId: args.defId,
        ...(args.type ? { type: args.type } : {}),
        provenance: createCardProvenanceSnapshot({
            ownerId: args.ownerId,
            defaultDestination: args.defaultDestination,
            sourceControllerId: args.sourceControllerId,
        }),
    };
}

export function createCardObjectRefFromInstance(
    card: CardInstance,
    options?: {
        sourceControllerId?: PlayerId;
    },
): SmashUpCardObjectRef {
    return {
        uid: card.uid,
        defId: card.defId,
        type: card.type,
        provenance: card.provenance
            ? {
                ...card.provenance,
                ...(options?.sourceControllerId ? { sourceControllerId: options.sourceControllerId } : {}),
            }
            : createCardProvenanceSnapshot({
                ownerId: card.owner,
                sourceControllerId: options?.sourceControllerId,
            }),
    };
}

export function getCardTransferObjectRef(
    payload: CardTransferredEvent['payload'],
): SmashUpCardObjectRef | undefined {
    if (payload.objectRef) {
        return payload.objectRef;
    }
    if (!payload.ownerId) {
        return undefined;
    }
    return createCardObjectRef({
        uid: payload.cardUid,
        defId: payload.defId,
        ownerId: payload.ownerId,
    });
}

export function resolveCardOwnerIdFromObjectRef(ref: SmashUpCardObjectRef): PlayerId {
    return ref.provenance.ownerId;
}

export function buildCardInstanceFromObjectRef(ref: SmashUpCardObjectRef): CardInstance {
    return {
        uid: ref.uid,
        defId: ref.defId,
        type: ref.type ?? (getCardDef(ref.defId)?.type ?? 'minion'),
        owner: resolveCardOwnerIdFromObjectRef(ref),
        provenance: ref.provenance,
    };
}

export function enrichCardInstanceWithObjectRef(
    card: CardInstance,
    ref: SmashUpCardObjectRef | undefined,
): CardInstance {
    if (!ref) return card;
    return {
        ...card,
        owner: resolveCardOwnerIdFromObjectRef(ref),
        provenance: ref.provenance,
    };
}

export function createCardTransferEvent(args: {
    card: SmashUpCardObjectRef;
    fromPlayerId: PlayerId;
    toPlayerId: PlayerId;
    reason: string;
    timestamp: number;
}): CardTransferredEvent {
    return {
        type: SU_EVENTS.CARD_TRANSFERRED,
        payload: {
            cardUid: args.card.uid,
            defId: args.card.defId,
            fromPlayerId: args.fromPlayerId,
            toPlayerId: args.toPlayerId,
            ownerId: resolveCardOwnerIdFromObjectRef(args.card),
            objectRef: args.card,
            reason: args.reason,
        },
        timestamp: args.timestamp,
    };
}
