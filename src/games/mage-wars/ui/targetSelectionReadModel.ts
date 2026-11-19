import type { ChoiceRequestDirectSelectionTarget } from '../../../engine/systems';
import type { MatchState, PlayerId } from '../../../engine/types';
import {
    MAGE_WARS_COMMANDS,
    MageWarsDomain,
    type MageWarsCore,
} from '../domain';
import type { MageWarsCastSpellCommand, MageWarsDeclareEquipmentAttackCommand } from '../domain/commands';
import type {
    ArenaZoneId,
    MageWarsWallEdgeId,
} from '../domain/ids';
import type { MageWarsMageAbilityActivationChoiceValue } from '../domain/mageAbilityRuntime';
import type { MageWarsObjectAbilityActivationChoiceValue } from '../domain/objectAbilityRuntime';
import {
    doesMageWarsWallBlockLineOfSight,
    isArenaZoneId,
} from '../domain/utils';
import type { MageWarsSpellCastChoiceValue } from '../domain/spellCastRuntime';
import { getMageWarsAvailableSpellbookCopyCount } from '../domain/spellbook';
import { getMageWarsSpellbookDisplayEntries } from './spellbookPresentation';
import {
    getMageWarsObjectAttackProfiles,
    isMageWarsObjectAttackTargetInRange,
    type MageWarsObjectAttackProfile,
} from '../domain/spellRules';

type EquipmentAttackPayload = MageWarsDeclareEquipmentAttackCommand['payload'];

export function buildObjectSpellPlanningChoices(
    state: MatchState<MageWarsCore>,
    playerId: PlayerId,
    mageDraft: readonly number[],
) {
    const bySource = new Map<string, ReadonlyMap<number, string | null>>();
    const player = state.core.players[playerId];
    if (state.sys.phase !== 'planning' || !player || state.core.phaseReadyPlayerIds?.includes(playerId)) return bySource;

    const spellbook = getMageWarsSpellbookDisplayEntries(player);
    for (const object of Object.values(state.core.objects)) {
        if (object.ownerId !== playerId || !object.spellcastingSource || object.preparedSpellCardId !== undefined) continue;
        const choices = new Map<number, string | null>();
        for (const { spellCardId } of spellbook) {
            const validation = MageWarsDomain.validate(state, {
                type: MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL,
                playerId,
                payload: { objectId: object.id, spellCardId },
            });
            const draftedCopies = mageDraft.filter((draftedId) => draftedId === spellCardId).length;
            const deniedReason = !validation.valid
                ? validation.error ?? 'actionUnavailable'
                : getMageWarsAvailableSpellbookCopyCount(state.core, playerId, spellCardId) <= draftedCopies
                    ? 'tooManyPreparedSpellCopies'
                    : null;
            choices.set(spellCardId, deniedReason);
        }
        if ([...choices.values()].some((reason) => reason === null)) bySource.set(object.id, choices);
    }
    return bySource;
}

export function buildEquipmentAttackTargetsBySource(state: MatchState<MageWarsCore>, playerId: PlayerId) {
    const bySource = new Map<string, {
        objects: Map<string, EquipmentAttackPayload>;
        players: Map<PlayerId, EquipmentAttackPayload>;
    }>();
    if (state.sys.phase !== 'creatureAction' || !state.core.players[playerId]?.actionReady
        || state.sys.responseWindow?.current || state.sys.interaction?.current) return bySource;

    const objects = Object.values(state.core.objects);
    const enemyTargets = objects.filter((object) => object.ownerId !== playerId
        && (object.kind === 'creature' || object.kind === 'conjuration'));
    const enemyPlayers = Object.keys(state.core.players).filter((id) => id !== playerId);
    for (const equipment of objects) {
        if (equipment.kind !== 'equipment' || equipment.anchoredToPlayerId !== playerId) continue;
        const objectTargets = new Map<string, EquipmentAttackPayload>();
        const playerTargets = new Map<PlayerId, EquipmentAttackPayload>();
        for (const profile of getMageWarsObjectAttackProfiles(equipment)) {
            const base = { equipmentObjectId: equipment.id, attackProfileId: profile.id };
            for (const target of enemyTargets) {
                const payload = { ...base, targetObjectId: target.id };
                if (MageWarsDomain.validate(state, { type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK, playerId, payload }).valid) {
                    objectTargets.set(target.id, payload);
                }
            }
            for (const targetPlayerId of enemyPlayers) {
                const payload = { ...base, targetPlayerId };
                if (MageWarsDomain.validate(state, { type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK, playerId, payload }).valid) {
                    playerTargets.set(targetPlayerId, payload);
                }
            }
        }
        if (objectTargets.size || playerTargets.size) {
            bySource.set(equipment.id, { objects: objectTargets, players: playerTargets });
        }
    }
    return bySource;
}

export function hasEnabledChoiceCandidate(
    candidates: readonly { disabled?: boolean; stale?: boolean }[] | undefined,
): boolean {
    return candidates?.some((candidate) => candidate.disabled !== true && candidate.stale !== true) === true;
}

export function compareMageAbilityTargets(
    left: ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>,
    right: ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>,
): number {
    const leftStatusCount = left.value?.statusTokenIds.length ?? 0;
    const rightStatusCount = right.value?.statusTokenIds.length ?? 0;
    if (leftStatusCount !== rightStatusCount) return rightStatusCount - leftStatusCount;

    const leftManaCost = left.value?.manaCost ?? 0;
    const rightManaCost = right.value?.manaCost ?? 0;
    if (leftManaCost !== rightManaCost) return rightManaCost - leftManaCost;

    return left.id.localeCompare(right.id);
}

export function buildMageAbilityTargetsByObjectId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>[] | undefined,
): Map<string, ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>[]> {
    const map = new Map<string, ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale || typeof target.targetRef !== 'string') continue;
        const current = map.get(target.targetRef) ?? [];
        current.push(target);
        map.set(target.targetRef, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort(compareMageAbilityTargets);
    }
    return map;
}

export function compareObjectAbilityTargets(
    left: ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>,
    right: ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>,
): number {
    const modeRank = (mode: MageWarsObjectAbilityActivationChoiceValue['mode']): number => {
        if (mode === 'melee-bonus') return 0;
        if (mode === 'heal') return 1;
        return 2;
    };
    const leftModeRank = modeRank(left.value?.mode);
    const rightModeRank = modeRank(right.value?.mode);
    if (leftModeRank !== rightModeRank) return leftModeRank - rightModeRank;
    return left.id.localeCompare(right.id);
}

export function buildObjectAbilityTargetsByObjectId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>[] | undefined,
): Map<string, ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>[]> {
    const map = new Map<string, ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale || typeof target.targetRef !== 'string') continue;
        const current = map.get(target.targetRef) ?? [];
        current.push(target);
        map.set(target.targetRef, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort(compareObjectAbilityTargets);
    }
    return map;
}

export function buildSpellCastTargetsByObjectId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[] | undefined,
): Map<string, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]> {
    const map = new Map<string, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale) continue;
        const objectId = readMageWarsCastSpellPayload(target)?.targetObjectId;
        if (!objectId) continue;
        const current = map.get(objectId) ?? [];
        current.push(target);
        map.set(objectId, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort((left, right) => left.id.localeCompare(right.id));
    }
    return map;
}

export function buildSpellCastTargetsByPlayerId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[] | undefined,
): Map<PlayerId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]> {
    const map = new Map<PlayerId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale) continue;
        const playerId = readMageWarsCastSpellPayload(target)?.targetPlayerId;
        if (!playerId) continue;
        const current = map.get(playerId) ?? [];
        current.push(target);
        map.set(playerId, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort((left, right) => left.id.localeCompare(right.id));
    }
    return map;
}

export function buildSpellCastTargetsByZoneId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[] | undefined,
): Map<ArenaZoneId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]> {
    const map = new Map<ArenaZoneId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale || !isArenaZoneId(target.targetRef)) continue;
        const current = map.get(target.targetRef) ?? [];
        current.push(target);
        map.set(target.targetRef, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort((left, right) => left.id.localeCompare(right.id));
    }
    return map;
}

export function buildSpellCastTargetsByWallEdgeId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[] | undefined,
): Map<MageWarsWallEdgeId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]> {
    const map = new Map<MageWarsWallEdgeId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale) continue;
        const payload = readMageWarsCastSpellPayload(target);
        const edgeId = payload?.targetWallEdgeId;
        if (!edgeId) continue;
        const current = map.get(edgeId) ?? [];
        current.push(target);
        map.set(edgeId, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort((left, right) => left.id.localeCompare(right.id));
    }
    return map;
}

export function readMageWarsCastSpellPayload(
    targetSelection: ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>,
): MageWarsCastSpellCommand['payload'] | null {
    const command = targetSelection.commandPreview.find((candidateCommand) => (
        candidateCommand.type === MAGE_WARS_COMMANDS.CAST_SPELL
    ));
    if (!command || !command.payload || typeof command.payload !== 'object') return null;
    return command.payload as MageWarsCastSpellCommand['payload'];
}

export function readMageWarsCastSpellChainObjectIds(
    targetSelection: ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>,
): string[] {
    const payload = readMageWarsCastSpellPayload(targetSelection);
    if (!payload?.targetObjectId) return [];
    return [
        payload.targetObjectId,
        ...(payload.chainLightningTargets ?? []).map((target) => target.targetObjectId),
    ];
}

export function startsWithObjectPath(path: readonly string[], prefix: readonly string[]): boolean {
    return prefix.length <= path.length && prefix.every((objectId, index) => path[index] === objectId);
}

export function hasSameObjectPath(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && startsWithObjectPath(left, right);
}

export function buildNonEmptySet<T>(values: Iterable<T>): Set<T> | undefined {
    const set = new Set(values);
    return set.size > 0 ? set : undefined;
}

export function isMageWarsObjectAttackTargetSelectable(
    core: MageWarsCore,
    attackerZoneId: ArenaZoneId,
    targetZoneId: ArenaZoneId,
    profile: MageWarsObjectAttackProfile,
): boolean {
    if (!isMageWarsObjectAttackTargetInRange(core, attackerZoneId, targetZoneId, profile)) return false;
    return profile.rangeKind !== 'ranged'
        || !doesMageWarsWallBlockLineOfSight(core, attackerZoneId, targetZoneId);
}
