import { getCardDef } from '../data/cards';
import type {
    ActionCardDef,
    MinionCardDef,
    SmashUpActivatableAbility,
    SmashUpActivationKind,
    SmashUpActivationUseRequirement,
    SmashUpActivationWindow,
} from './types';

type SmashUpActivationCardFace = 'minion' | 'action';

export interface SmashUpActivationQuery {
    kind?: SmashUpActivationKind;
    zone?: SmashUpActivatableAbility['zone'];
    window?: SmashUpActivationWindow;
}

export interface SmashUpActivationLookupOptions {
    face?: SmashUpActivationCardFace;
}

function dedupeActivatableAbilities(
    abilities: SmashUpActivatableAbility[],
): SmashUpActivatableAbility[] {
    const seen = new Set<string>();
    const result: SmashUpActivatableAbility[] = [];
    for (const ability of abilities) {
        const key = [
            ability.kind,
            ability.zone,
            ability.window ?? '*',
            ability.sourceScope ?? '*',
            ability.useRequirement ?? '*',
        ].join(':');
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(ability);
    }
    return result;
}

function inferLegacyBoardActivationsFromTags(
    tags: MinionCardDef['abilityTags'] | ActionCardDef['abilityTags'],
): SmashUpActivatableAbility[] {
    const result: SmashUpActivatableAbility[] = [];
    if (tags?.includes('talent')) {
        result.push({ kind: 'talent', zone: 'board', window: 'playCards' });
    }
    if (tags?.includes('ongoingActivation')) {
        result.push({ kind: 'ongoing', zone: 'board', window: 'playCards' });
    }
    return result;
}

function inferActionSpecialActivations(def: ActionCardDef): SmashUpActivatableAbility[] {
    if (def.subtype !== 'special') return [];
    if (def.specialTiming !== 'beforeScoring' && def.specialTiming !== 'afterScoring') return [];
    return [{ kind: 'special', zone: 'hand', window: def.specialTiming }];
}

export function getCardDefActivatableAbilities(
    def: ReturnType<typeof getCardDef>,
    options: SmashUpActivationLookupOptions = {},
): SmashUpActivatableAbility[] {
    if (!def) return [];

    if (def.type === 'minion') {
        return dedupeActivatableAbilities([
            ...(def.activatableAbilities ?? []),
            ...inferLegacyBoardActivationsFromTags(def.abilityTags),
        ]);
    }

    if (def.type === 'action') {
        return dedupeActivatableAbilities([
            ...(def.activatableAbilities ?? []),
            ...inferActionSpecialActivations(def),
            ...inferLegacyBoardActivationsFromTags(def.abilityTags),
        ]);
    }

    if (def.type === 'fusion') {
        const face = options.face;
        const result: SmashUpActivatableAbility[] = [];
        if (!face || face === 'minion') {
            result.push(
                ...(def.minionActivatableAbilities ?? []),
                ...inferLegacyBoardActivationsFromTags(def.minionAbilityTags),
            );
        }
        if (!face || face === 'action') {
            result.push(
                ...(def.actionActivatableAbilities ?? []),
                ...inferLegacyBoardActivationsFromTags(def.actionAbilityTags),
            );
        }
        return dedupeActivatableAbilities(result);
    }

    return dedupeActivatableAbilities(def.activatableAbilities ?? []);
}

export function getCardActivatableAbilities(
    defId: string,
    options: SmashUpActivationLookupOptions = {},
): SmashUpActivatableAbility[] {
    return getCardDefActivatableAbilities(getCardDef(defId), options);
}

export function hasCardActivatableAbility(
    defId: string,
    query: SmashUpActivationQuery,
    options: SmashUpActivationLookupOptions = {},
): boolean {
    return getCardActivatableAbilities(defId, options).some((ability) => {
        if (query.kind && ability.kind !== query.kind) return false;
        if (query.zone && ability.zone !== query.zone) return false;
        if (query.window && ability.window && ability.window !== query.window) return false;
        return true;
    });
}

export function getBoardTalentUseRequirement(defId: string): SmashUpActivationUseRequirement | undefined {
    return getCardActivatableAbilities(defId).find(ability =>
        ability.kind === 'talent'
        && ability.zone === 'board'
        && (!ability.window || ability.window === 'playCards'))?.useRequirement;
}

export function shouldTrackActivationPlayedThisTurn(defId: string): boolean {
    const requirement = getBoardTalentUseRequirement(defId);
    return requirement === 'sourceInPlayAtStartOfTurn'
        || requirement === 'attachedToOwnMinionOrSourceInPlayAtStartOfTurn';
}

export function buildActivationPlayedThisTurnMetadata(defId: string): Record<string, unknown> | undefined {
    return shouldTrackActivationPlayedThisTurn(defId)
        ? { playedThisTurn: true }
        : undefined;
}

export function wasActivationSourcePlayedThisTurn(source: {
    playedThisTurn?: boolean;
    metadata?: Record<string, unknown>;
}): boolean {
    return source.playedThisTurn === true || source.metadata?.playedThisTurn === true;
}
