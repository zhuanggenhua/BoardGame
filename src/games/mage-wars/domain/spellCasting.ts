import type { MageWarsConfigSpellCard } from '../data/configPackage';
import type { MageWarsArenaObjectState, MageWarsCore, MageWarsPhase, MageWarsSpellCasterRef, MageWarsSpellcastingSource } from './core-types';

export type MageWarsSpellcastingSourceKind = 'familiar' | 'spawn-point';
export type MageWarsSpellCastMode = 'quickcast' | 'action' | 'deployment';

export function getMageWarsSpellcastingSourceKind(
    source: MageWarsSpellcastingSource | undefined,
): MageWarsSpellcastingSourceKind | undefined {
    if (!source) return undefined;
    return source.kind ?? 'familiar';
}

export function isMageWarsConfiguredSpellcastingSource(
    source: MageWarsSpellcastingSource | undefined,
): boolean {
    const channeling = source?.channeling;
    return Boolean(
        source
        && source.kind
        && source.phase
        && source.allowedSpellTypes?.length
        && Number.isInteger(channeling)
        && channeling !== undefined
        && channeling >= 0,
    );
}

export function isMageWarsSpellcastingObject(object: MageWarsArenaObjectState): boolean {
    const kind = getMageWarsSpellcastingSourceKind(object.spellcastingSource);
    return (kind === 'familiar' && object.kind === 'creature')
        || (kind === 'spawn-point' && object.kind === 'conjuration');
}

export function isMageWarsSpellCasterRef(value: unknown): value is MageWarsSpellCasterRef {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    if (candidate.kind === 'mage') {
        return typeof candidate.playerId === 'string';
    }
    return candidate.kind === 'arena-object'
        && typeof candidate.objectId === 'string'
        && typeof candidate.ownerId === 'string';
}

export function resolveMageWarsSpellCasterRef(
    core: MageWarsCore,
    controllerId: string,
    casterObjectId?: string,
): MageWarsSpellCasterRef | undefined {
    if (casterObjectId === undefined) {
        return { kind: 'mage', playerId: controllerId };
    }

    const object = core.objects[casterObjectId];
    if (
        !object
        || object.ownerId !== controllerId
        || !isMageWarsSpellcastingObject(object)
    ) {
        return undefined;
    }

    return {
        kind: 'arena-object',
        objectId: object.id,
        ownerId: object.ownerId,
    };
}

export function resolveMageWarsMageSpellCastMode(
    phase: MageWarsPhase,
    spell: Pick<MageWarsConfigSpellCard, 'spellActionSpeed'>,
    options: { stunned?: boolean } = {},
): MageWarsSpellCastMode | undefined {
    if (phase === 'deployment') return 'deployment';
    if (spell.spellActionSpeed === 'quick') {
        if (phase === 'creatureAction' && options.stunned) return 'action';
        return phase === 'initiativeQuickcast' || phase === 'finalQuickcast' || phase === 'creatureAction'
            ? 'quickcast'
            : undefined;
    }
    if (spell.spellActionSpeed === 'standard') {
        return phase === 'creatureAction' ? 'action' : undefined;
    }
    return undefined;
}

export function resolveMageWarsSpellCastMode(
    phase: MageWarsPhase,
    caster: MageWarsSpellCasterRef,
    spell: Pick<MageWarsConfigSpellCard, 'spellActionSpeed'>,
    options: { stunned?: boolean } = {},
): MageWarsSpellCastMode | undefined {
    if (caster.kind === 'mage') return resolveMageWarsMageSpellCastMode(phase, spell, options);
    if (phase === 'deployment') return 'deployment';
    if (phase === 'creatureAction') return 'action';
    return undefined;
}
