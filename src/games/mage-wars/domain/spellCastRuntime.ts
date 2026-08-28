import {
    createAbilityChoiceContract,
    createAbilityOpportunity,
    type AbilityDef,
} from '../../../engine/primitives/ability';
import { createTimingPoint, type Opportunity } from '../../../engine/TimingOpportunity';
import type { MatchState } from '../../../engine/types';
import {
    getMageWarsSpellCardFromConfig,
    type MageWarsConfigSpellCard,
} from '../data/configPackage';
import { MAGE_WARS_COMMANDS, type MageWarsCastSpellCommand } from './commands';
import {
    getMageWarsWallEdgeId,
    MAGE_WARS_GAME_ID,
    type ArenaZoneId,
    type MageWarsWallEdgeId,
} from './ids';
import {
    getMageWarsZoneDistance,
    isMageWarsChainLightningTargetObject,
    isMageWarsElementalStaffSpell,
    isMageWarsElementalStaffBindableSpell,
    isMageWarsLegalHiddenResponseEnchantmentTarget,
    isMageWarsLegalStealEnchantmentNewTarget,
    isMageWarsLivingArenaObject,
    isMageWarsSameEnchantmentAnchor,
    isMageWarsVisibleAttachedEnchantmentArenaObject,
    isMageWarsWallEdgeTargetInRange,
    parseMageWarsSpellAttackProfile,
    resolveMageWarsSpellCastChoiceFamily,
    resolveMageWarsEnchantmentTotalManaCost,
    resolveMageWarsEquipmentManaCost,
    resolveMageWarsExplodeManaCostForTarget,
    resolveMageWarsRouseTheBeastManaCostForTarget,
    resolveMageWarsSleepSpellManaCostForTarget,
    resolveMageWarsSpellRawCostTotal,
    resolveMageWarsStealEnchantmentManaCost,
    resolveMageWarsStealEnchantmentNewTargetZoneId,
    resolveMageWarsTeleportSpellManaCostForTargetZone,
    type MageWarsSpellCastChoiceFamily,
} from './spellRules';
import type {
    MageWarsArenaObjectState,
    MageWarsCore,
    MageWarsPhase,
    MageWarsPlayerState,
} from './types';
import { areAdjacentZones } from './utils';
import { validateCommand } from './validate';
import { getMageWarsPlayerSpellbookCardIds } from './spellbook';

type MageWarsSpellCastTrigger = 'spell:cast';
type MageWarsSpellCastTargetMode =
    | 'direct-object'
    | 'direct-player'
    | 'object-chain'
    | 'object-push-zone'
    | 'player-push-zone'
    | 'target-push-zone'
    | 'object-target-zone'
    | 'object-new-anchor'
    | 'zone'
    | 'no-target'
    | 'player-bound-spell'
    | 'wall-edge';

interface MageWarsSpellCastEffect {
    kind: 'spell-cast';
}

type MageWarsSpellCastAbilityDef = AbilityDef<MageWarsSpellCastEffect, MageWarsSpellCastTrigger> & {
    id: string;
    trigger: MageWarsSpellCastTrigger;
    meta: {
        spellCardId: number;
        spellType: string;
        targetMode: MageWarsSpellCastTargetMode;
    };
};

export interface MageWarsSpellCastChoiceValue {
    action: 'cast-spell';
    playerId: string;
    spellCardId: number;
    manaCost: number;
    targetPlayerId?: string;
    targetObjectId?: string;
    targetZoneId?: ArenaZoneId;
    targetWallEdgeId?: MageWarsWallEdgeId;
    newTargetPlayerId?: string;
    newTargetObjectId?: string;
    newTargetZoneId?: ArenaZoneId;
    chainLightningTargets?: Array<{ targetObjectId: string }>;
    pushToZoneId?: ArenaZoneId;
    boundSpellCardId?: number;
}

function resolveMageWarsSpellCastBaseTargetMode(
    family: MageWarsSpellCastChoiceFamily,
): MageWarsSpellCastTargetMode {
    if (family === 'wall') return 'wall-edge';
    if (family === 'elemental-staff-binding') return 'player-bound-spell';
    if (family === 'self-equipment') return 'direct-player';
    if (family === 'steal-enchantment') return 'object-new-anchor';
    if (family === 'chain-lightning') return 'object-chain';
    if (family === 'jet-stream') return 'target-push-zone';
    if (family === 'force-push') return 'object-push-zone';
    if (
        family === 'summon-creature'
        || family === 'zone-attack'
        || family === 'zone-healing'
        || family === 'visible-area-enchantment'
    ) return 'zone';
    if (family === 'call-of-the-wild') return 'no-target';
    return 'direct-object';
}

function buildMageWarsSpellCastDef(
    spell: MageWarsConfigSpellCard,
    family: MageWarsSpellCastChoiceFamily,
): MageWarsSpellCastAbilityDef {
    const targetMode = resolveMageWarsSpellCastBaseTargetMode(family);
    return {
        id: `mw.spell.cast.${spell.spellCardId}`,
        name: spell.name,
        description: spell.rulesText,
        trigger: 'spell:cast',
        effects: [{ kind: 'spell-cast' }],
        meta: {
            spellCardId: spell.spellCardId,
            spellType: spell.spellType,
            targetMode,
        },
    };
}

function isMageWarsDirectAttackTargetObject(object: MageWarsArenaObjectState): boolean {
    return object.kind === 'creature' || object.kind === 'conjuration';
}

function resolveDirectObjectSpellManaCost(
    spell: MageWarsConfigSpellCard,
    family: MageWarsSpellCastChoiceFamily,
    targetObject: MageWarsArenaObjectState,
): number | undefined {
    switch (family) {
        case 'rouse-the-beast':
            return resolveMageWarsRouseTheBeastManaCostForTarget(targetObject);
        case 'sleep':
            return resolveMageWarsSleepSpellManaCostForTarget(targetObject);
        case 'dissolve':
            return resolveMageWarsEquipmentManaCost(targetObject);
        case 'dispel':
            return resolveMageWarsEnchantmentTotalManaCost(targetObject);
        case 'explode':
            return resolveMageWarsExplodeManaCostForTarget(targetObject);
        case 'bloodstrike':
        case 'charge-on':
        case 'tanglevine':
        case 'visible-object-enchantment':
            return resolveMageWarsSpellRawCostTotal(spell);
        default:
            return undefined;
    }
}

function createMageWarsSpellCastCommand(args: {
    playerId: string;
    spellCardId: number;
    manaCost: number;
    targetPlayerId?: string;
    targetObjectId?: string;
    targetZoneId?: ArenaZoneId;
    targetWallEdgeId?: MageWarsWallEdgeId;
    newTargetPlayerId?: string;
    newTargetObjectId?: string;
    newTargetZoneId?: ArenaZoneId;
    chainLightningTargets?: Array<{ targetObjectId: string }>;
    pushToZoneId?: ArenaZoneId;
    boundSpellCardId?: number;
    timestamp?: number;
}): MageWarsCastSpellCommand {
    return {
        type: MAGE_WARS_COMMANDS.CAST_SPELL,
        playerId: args.playerId,
        payload: {
            spellCardId: args.spellCardId,
            manaCost: args.manaCost,
            ...(args.targetPlayerId ? { targetPlayerId: args.targetPlayerId } : {}),
            ...(args.targetObjectId ? { targetObjectId: args.targetObjectId } : {}),
            ...(args.targetZoneId ? { targetZoneId: args.targetZoneId } : {}),
            ...(args.targetWallEdgeId ? { targetWallEdgeId: args.targetWallEdgeId } : {}),
            ...(args.newTargetPlayerId ? { newTargetPlayerId: args.newTargetPlayerId } : {}),
            ...(args.newTargetObjectId ? { newTargetObjectId: args.newTargetObjectId } : {}),
            ...(args.newTargetZoneId ? { newTargetZoneId: args.newTargetZoneId } : {}),
            ...(args.chainLightningTargets && args.chainLightningTargets.length > 0
                ? { chainLightningTargets: args.chainLightningTargets }
                : {}),
            ...(args.pushToZoneId ? { pushToZoneId: args.pushToZoneId } : {}),
            ...(args.boundSpellCardId !== undefined ? { boundSpellCardId: args.boundSpellCardId } : {}),
        },
        ...(typeof args.timestamp === 'number' ? { timestamp: args.timestamp } : {}),
    };
}

function buildMageWarsSpellCastTiming(args: {
    state: MatchState<MageWarsCore>;
    player: MageWarsPlayerState;
    spell: MageWarsConfigSpellCard;
    family: MageWarsSpellCastChoiceFamily;
    timestamp?: number;
}) {
    const phase = args.state.sys.phase as MageWarsPhase;
    const command = createMageWarsSpellCastCommand({
        playerId: args.player.id,
        spellCardId: args.spell.spellCardId,
        manaCost: 0,
        timestamp: args.timestamp,
    });
    const targetMode = resolveMageWarsSpellCastBaseTargetMode(args.family);

    return createTimingPoint<MageWarsCastSpellCommand>({
        gameId: MAGE_WARS_GAME_ID,
        position: 'before',
        factKind: 'command',
        command,
        source: {
            kind: 'card',
            id: `spell:${args.spell.spellCardId}`,
            ownerId: args.player.id,
            controllerId: args.player.id,
            zoneId: args.player.mageZoneId,
            metadata: {
                spellCardId: args.spell.spellCardId,
                spellType: args.spell.spellType,
            },
        },
        controllerId: args.player.id,
        timestamp: args.timestamp,
        metadata: {
            phase,
            playerId: args.player.id,
            spellCardId: args.spell.spellCardId,
            targetMode,
        },
    });
}

function buildMageWarsSpellCastCandidates(args: {
    state: MatchState<MageWarsCore>;
    player: MageWarsPlayerState;
    spell: MageWarsConfigSpellCard;
    family: MageWarsSpellCastChoiceFamily;
    phase: MageWarsPhase;
    timestamp?: number;
}) {
    const buildCandidate = (candidateArgs: {
        targetObject?: MageWarsArenaObjectState;
        targetPlayer?: MageWarsPlayerState;
        newTargetObject?: MageWarsArenaObjectState;
        newTargetPlayer?: MageWarsPlayerState;
        newTargetZoneId?: ArenaZoneId;
        chainLightningTargets?: Array<{ targetObjectId: string }>;
        manaCost: number;
        id?: string;
        targetZoneId?: ArenaZoneId;
        targetWallEdgeId?: MageWarsWallEdgeId;
        pushToZoneId?: ArenaZoneId;
        boundSpellCardId?: number;
        targetMode?: MageWarsSpellCastTargetMode;
        label?: string;
    }) => {
        const targetMode = candidateArgs.targetMode ?? (candidateArgs.pushToZoneId
            ? candidateArgs.targetPlayer ? 'player-push-zone' : 'object-push-zone'
            : candidateArgs.targetWallEdgeId
                ? 'wall-edge'
                : candidateArgs.targetPlayer && isMageWarsElementalStaffSpell(args.spell)
                    ? 'player-bound-spell'
                    : candidateArgs.targetPlayer
                        ? 'direct-player'
                : candidateArgs.targetObject && candidateArgs.chainLightningTargets
                    ? 'object-chain'
                    : candidateArgs.targetObject && (
                    candidateArgs.newTargetObject
                    || candidateArgs.newTargetPlayer
                    || candidateArgs.newTargetZoneId
                )
                    ? 'object-new-anchor'
                    : candidateArgs.targetObject && candidateArgs.targetZoneId
                        ? 'object-target-zone'
                    : candidateArgs.targetZoneId
                        ? 'zone'
                            : 'direct-object');
        const zoneId = candidateArgs.pushToZoneId ?? candidateArgs.targetZoneId;
        const newTargetZoneId = candidateArgs.newTargetZoneId
            ?? candidateArgs.newTargetObject?.zoneId
            ?? candidateArgs.newTargetPlayer?.mageZoneId;
        const command = createMageWarsSpellCastCommand({
            playerId: args.player.id,
            spellCardId: args.spell.spellCardId,
            manaCost: candidateArgs.manaCost,
            targetPlayerId: candidateArgs.targetPlayer?.id,
            targetObjectId: candidateArgs.targetObject?.id,
            targetZoneId: candidateArgs.targetZoneId,
            targetWallEdgeId: candidateArgs.targetWallEdgeId,
            newTargetObjectId: candidateArgs.newTargetObject?.id,
            newTargetPlayerId: candidateArgs.newTargetPlayer?.id,
            newTargetZoneId: candidateArgs.newTargetZoneId,
            chainLightningTargets: candidateArgs.chainLightningTargets,
            pushToZoneId: candidateArgs.pushToZoneId,
            boundSpellCardId: candidateArgs.boundSpellCardId,
            timestamp: args.timestamp,
        });
        const validation = validateCommand(args.state, command);
        const targetObjectId = candidateArgs.targetObject?.id;
        const targetPlayerId = candidateArgs.targetPlayer?.id;
        const targetZoneId = candidateArgs.targetObject?.zoneId
            ?? candidateArgs.targetPlayer?.mageZoneId
            ?? candidateArgs.targetZoneId;
        const chainTargetObjectIds = targetObjectId && candidateArgs.chainLightningTargets
            ? [
                targetObjectId,
                ...candidateArgs.chainLightningTargets.map((target) => target.targetObjectId),
            ]
            : undefined;
        const newTargetLabel = candidateArgs.newTargetObject?.name
            ?? candidateArgs.newTargetPlayer?.mageId
            ?? candidateArgs.newTargetZoneId;
        const label = candidateArgs.label ?? (candidateArgs.targetObject
            ? chainTargetObjectIds
                ? chainTargetObjectIds
                    .map((objectId) => args.state.core.objects[objectId]?.name ?? objectId)
                    .join(' -> ')
                : newTargetLabel
                ? `${candidateArgs.targetObject.name} -> ${newTargetLabel}`
                : zoneId
                    ? `${candidateArgs.targetObject.name} -> ${zoneId}`
                    : candidateArgs.targetObject.name
            : candidateArgs.targetPlayer
                ? candidateArgs.boundSpellCardId !== undefined
                    ? `${candidateArgs.targetPlayer.mageId} -> ${getMageWarsSpellCardFromConfig(candidateArgs.boundSpellCardId)?.name ?? candidateArgs.boundSpellCardId}`
                    : targetMode === 'player-bound-spell'
                        ? `${candidateArgs.targetPlayer.mageId} -> 不绑定法术`
                        : candidateArgs.targetPlayer.mageId
            : candidateArgs.targetWallEdgeId ?? candidateArgs.targetZoneId ?? 'zone');
        return {
            id: candidateArgs.id
                ?? (targetObjectId
                    ? `target:${targetObjectId}`
                    : targetPlayerId
                        ? `target-player:${targetPlayerId}`
                    : candidateArgs.targetWallEdgeId
                        ? `target-wall-edge:${candidateArgs.targetWallEdgeId}`
                        : `target-zone:${candidateArgs.targetZoneId}`),
            label,
            value: {
                action: 'cast-spell' as const,
                playerId: args.player.id,
                spellCardId: args.spell.spellCardId,
                manaCost: candidateArgs.manaCost,
                ...(targetPlayerId ? { targetPlayerId } : {}),
                ...(targetObjectId ? { targetObjectId } : {}),
                ...(candidateArgs.targetZoneId ? { targetZoneId: candidateArgs.targetZoneId } : {}),
                ...(candidateArgs.targetWallEdgeId ? { targetWallEdgeId: candidateArgs.targetWallEdgeId } : {}),
                ...(candidateArgs.newTargetObject ? { newTargetObjectId: candidateArgs.newTargetObject.id } : {}),
                ...(candidateArgs.newTargetPlayer ? { newTargetPlayerId: candidateArgs.newTargetPlayer.id } : {}),
                ...(candidateArgs.newTargetZoneId ? { newTargetZoneId: candidateArgs.newTargetZoneId } : {}),
                ...(candidateArgs.chainLightningTargets && candidateArgs.chainLightningTargets.length > 0
                    ? { chainLightningTargets: candidateArgs.chainLightningTargets }
                    : {}),
                ...(candidateArgs.pushToZoneId ? { pushToZoneId: candidateArgs.pushToZoneId } : {}),
                ...(candidateArgs.boundSpellCardId !== undefined ? { boundSpellCardId: candidateArgs.boundSpellCardId } : {}),
            },
            displayMode: 'card' as const,
            commands: [{
                type: MAGE_WARS_COMMANDS.CAST_SPELL,
                payload: command.payload,
            }],
            metadata: {
                ...(targetPlayerId ? { targetPlayerId } : {}),
                ...(targetObjectId ? { targetObjectId } : {}),
                ...(candidateArgs.targetObject ? { targetOwnerId: candidateArgs.targetObject.ownerId } : {}),
                ...(candidateArgs.targetPlayer ? { targetOwnerId: candidateArgs.targetPlayer.id } : {}),
                ...(targetZoneId ? { targetZoneId } : {}),
                ...(candidateArgs.targetZoneId ? { destinationZoneId: candidateArgs.targetZoneId } : {}),
                ...(candidateArgs.targetWallEdgeId ? { targetWallEdgeId: candidateArgs.targetWallEdgeId } : {}),
                ...(candidateArgs.newTargetObject ? { newTargetObjectId: candidateArgs.newTargetObject.id } : {}),
                ...(candidateArgs.newTargetObject ? { newTargetOwnerId: candidateArgs.newTargetObject.ownerId } : {}),
                ...(candidateArgs.newTargetPlayer ? { newTargetPlayerId: candidateArgs.newTargetPlayer.id } : {}),
                ...(candidateArgs.newTargetZoneId ? { newTargetZoneId: candidateArgs.newTargetZoneId } : {}),
                ...(newTargetZoneId ? { newTargetResolvedZoneId: newTargetZoneId } : {}),
                ...(newTargetZoneId ? { destinationZoneId: newTargetZoneId } : {}),
                ...(chainTargetObjectIds ? { chainTargetObjectIds } : {}),
                ...(candidateArgs.pushToZoneId ? { pushToZoneId: candidateArgs.pushToZoneId } : {}),
                ...(candidateArgs.boundSpellCardId !== undefined ? { boundSpellCardId: candidateArgs.boundSpellCardId } : {}),
                spellCardId: args.spell.spellCardId,
                targetMode,
            },
            actionKind: 'mage-wars-spell-cast-target',
            actionKeyParts: [
                'spell',
                'cast',
                args.player.id,
                args.spell.spellCardId,
                targetObjectId
                    ? 'target'
                    : targetPlayerId
                        ? 'player'
                        : candidateArgs.targetWallEdgeId
                            ? 'wall-edge'
                            : candidateArgs.targetZoneId
                                ? 'zone'
                                : 'confirm',
                targetObjectId ?? targetPlayerId ?? candidateArgs.targetWallEdgeId ?? candidateArgs.targetZoneId ?? candidateArgs.id,
                ...(candidateArgs.chainLightningTargets
                    ? ['chain', ...candidateArgs.chainLightningTargets.map((target) => target.targetObjectId)]
                    : []),
                ...(candidateArgs.newTargetObject ? ['new-object', candidateArgs.newTargetObject.id] : []),
                ...(candidateArgs.newTargetPlayer ? ['new-player', candidateArgs.newTargetPlayer.id] : []),
                ...(candidateArgs.newTargetZoneId ? ['new-zone', candidateArgs.newTargetZoneId] : []),
                ...(zoneId ? ['zone', zoneId] : []),
                ...(targetMode === 'player-bound-spell'
                    ? ['bound-spell', candidateArgs.boundSpellCardId ?? 'none']
                    : []),
            ],
            ...(validation.valid
                ? {}
                : {
                    disabled: true,
                    disabledReason: validation.error ?? 'invalidSpellTarget',
                }),
        };
    };
    const targetObjects = Object.values(args.state.core.objects)
        .sort((left, right) => left.id.localeCompare(right.id));
    const players = Object.values(args.state.core.players)
        .sort((left, right) => left.id.localeCompare(right.id));
    const wallEdgeIds = args.state.core.arena.flatMap((zone) => {
        const right = args.state.core.arena.find((candidate) => candidate.row === zone.row && candidate.col === zone.col + 1);
        const down = args.state.core.arena.find((candidate) => candidate.row === zone.row + 1 && candidate.col === zone.col);
        return [
            ...(right ? [getMageWarsWallEdgeId(zone.id, right.id)] : []),
            ...(down ? [getMageWarsWallEdgeId(zone.id, down.id)] : []),
        ];
    }).sort((left, right) => left.localeCompare(right));
    const candidates = (() => {
        if (args.family === 'wall') {
            const manaCost = args.spell.manaCost ?? resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            return wallEdgeIds
                .filter((edgeId) => isMageWarsWallEdgeTargetInRange(args.state.core, args.player, args.spell, edgeId))
                .map((edgeId) => buildCandidate({
                    manaCost,
                    id: `target-wall-edge:${edgeId}`,
                    targetWallEdgeId: edgeId,
                }));
        }
        if (args.family === 'self-equipment') {
            const manaCost = args.spell.manaCost ?? resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            return [buildCandidate({
                targetPlayer: args.player,
                manaCost,
                id: `target-player:${args.player.id}`,
            })];
        }
        if (args.family === 'elemental-staff-binding') {
            const manaCost = args.spell.manaCost ?? resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            const bindableSpellCardIds = Array.from(new Set(getMageWarsPlayerSpellbookCardIds(args.player)))
                .sort((left, right) => left - right)
                .filter((spellCardId) => {
                    const bindableSpell = getMageWarsSpellCardFromConfig(spellCardId);
                    return bindableSpell ? isMageWarsElementalStaffBindableSpell(bindableSpell) : false;
                });

            return [
                buildCandidate({
                    targetPlayer: args.player,
                    manaCost,
                    id: `target-player:${args.player.id}:bound-spell:none`,
                }),
                ...bindableSpellCardIds.map((boundSpellCardId) => buildCandidate({
                    targetPlayer: args.player,
                    manaCost,
                    boundSpellCardId,
                    id: `target-player:${args.player.id}:bound-spell:${boundSpellCardId}`,
                })),
            ];
        }
        if (args.family === 'direct-attack') {
            const manaCost = args.spell.manaCost ?? resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            return [
                ...targetObjects
                    .filter(isMageWarsDirectAttackTargetObject)
                    .map((targetObject) => buildCandidate({ targetObject, manaCost })),
                ...players
                    .filter((targetPlayer) => targetPlayer.id !== args.player.id)
                    .map((targetPlayer) => buildCandidate({
                        targetPlayer,
                        manaCost,
                        id: `target-player:${targetPlayer.id}`,
                    })),
            ];
        }
        if (args.family === 'jet-stream') {
            const manaCost = args.spell.manaCost ?? resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            return [
                ...targetObjects
                    .filter(isMageWarsDirectAttackTargetObject)
                    .flatMap((targetObject) => args.state.core.arena
                    .filter((zone) => areAdjacentZones(args.state.core, targetObject.zoneId, zone.id))
                    .map((zone) => buildCandidate({
                        targetObject,
                        manaCost,
                        id: `target:${targetObject.id}:push-zone:${zone.id}`,
                        pushToZoneId: zone.id,
                    }))),
                ...players
                    .filter((targetPlayer) => targetPlayer.id !== args.player.id)
                    .flatMap((targetPlayer) => args.state.core.arena
                        .filter((zone) => areAdjacentZones(args.state.core, targetPlayer.mageZoneId, zone.id))
                        .map((zone) => buildCandidate({
                            targetPlayer,
                            manaCost,
                            id: `target-player:${targetPlayer.id}:push-zone:${zone.id}`,
                            pushToZoneId: zone.id,
                        }))),
            ];
        }
        if (args.family === 'hidden-response-enchantment') {
            const manaCost = args.spell.manaCost ?? resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            return [
                ...targetObjects.flatMap((targetObject) => (
                    isMageWarsLegalHiddenResponseEnchantmentTarget(args.state.core, args.spell, {
                        targetObjectId: targetObject.id,
                    })
                        ? [buildCandidate({ targetObject, manaCost })]
                        : []
                )),
                ...players.flatMap((targetPlayer) => (
                    isMageWarsLegalHiddenResponseEnchantmentTarget(args.state.core, args.spell, {
                        targetPlayerId: targetPlayer.id,
                    })
                        ? [buildCandidate({
                            targetPlayer,
                            manaCost,
                            id: `target-player:${targetPlayer.id}`,
                        })]
                        : []
                )),
            ];
        }
        if (args.family === 'single-healing') {
            const manaCost = args.spell.manaCost ?? resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            return [
                ...targetObjects
                    .filter(isMageWarsLivingArenaObject)
                    .map((targetObject) => buildCandidate({ targetObject, manaCost })),
                ...players.map((targetPlayer) => buildCandidate({
                    targetPlayer,
                    manaCost,
                    id: `target-player:${targetPlayer.id}`,
                })),
            ];
        }
        if (args.family === 'life-drain') {
            const manaCost = args.spell.manaCost ?? resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            return [
                ...targetObjects
                    .filter(isMageWarsLivingArenaObject)
                    .map((targetObject) => buildCandidate({ targetObject, manaCost })),
                ...players
                    .filter((targetPlayer) => targetPlayer.id !== args.player.id)
                    .map((targetPlayer) => buildCandidate({
                        targetPlayer,
                        manaCost,
                        id: `target-player:${targetPlayer.id}`,
                    })),
            ];
        }
        if (args.family === 'force-push') {
            const manaCost = resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            return targetObjects.flatMap((targetObject) => args.state.core.arena
                .filter((zone) => areAdjacentZones(args.state.core, targetObject.zoneId, zone.id))
                .map((zone) => buildCandidate({
                    targetObject,
                    manaCost,
                    id: `target:${targetObject.id}:push-zone:${zone.id}`,
                    pushToZoneId: zone.id,
                })));
        }
        if (args.family === 'teleport') {
            return targetObjects.flatMap((targetObject) => args.state.core.arena
                .map((zone) => buildCandidate({
                    targetObject,
                    manaCost: resolveMageWarsTeleportSpellManaCostForTargetZone(
                        args.state.core,
                        targetObject,
                        zone.id,
                    )?.manaCost ?? 0,
                    id: `target:${targetObject.id}:zone:${zone.id}`,
                    targetZoneId: zone.id,
                })));
        }
        if (args.family === 'steal-enchantment') {
            return targetObjects
                .filter(isMageWarsVisibleAttachedEnchantmentArenaObject)
                .flatMap((targetObject) => {
                    const manaCost = resolveMageWarsStealEnchantmentManaCost(targetObject) ?? 0;
                    const canAttachToNewTarget = (payload: MageWarsCastSpellCommand['payload']): boolean => (
                        !isMageWarsSameEnchantmentAnchor(targetObject, payload)
                        && isMageWarsLegalStealEnchantmentNewTarget(args.state.core, targetObject, payload)
                        && resolveMageWarsStealEnchantmentNewTargetZoneId(args.state.core, payload) !== undefined
                    );
                    const newObjectCandidates = targetObjects.flatMap((newTargetObject) => {
                        const payload: MageWarsCastSpellCommand['payload'] = {
                            spellCardId: args.spell.spellCardId,
                            manaCost,
                            targetObjectId: targetObject.id,
                            newTargetObjectId: newTargetObject.id,
                        };
                        return canAttachToNewTarget(payload)
                            ? [buildCandidate({
                                targetObject,
                                newTargetObject,
                                manaCost,
                                id: `target:${targetObject.id}:new-object:${newTargetObject.id}`,
                            })]
                            : [];
                    });
                    const newPlayerCandidates = players.flatMap((newTargetPlayer) => {
                        const payload: MageWarsCastSpellCommand['payload'] = {
                            spellCardId: args.spell.spellCardId,
                            manaCost,
                            targetObjectId: targetObject.id,
                            newTargetPlayerId: newTargetPlayer.id,
                        };
                        return canAttachToNewTarget(payload)
                            ? [buildCandidate({
                                targetObject,
                                newTargetPlayer,
                                manaCost,
                                id: `target:${targetObject.id}:new-player:${newTargetPlayer.id}`,
                            })]
                            : [];
                    });
                    const newZoneCandidates = args.state.core.arena.flatMap((zone) => {
                        const payload: MageWarsCastSpellCommand['payload'] = {
                            spellCardId: args.spell.spellCardId,
                            manaCost,
                            targetObjectId: targetObject.id,
                            newTargetZoneId: zone.id,
                        };
                        return canAttachToNewTarget(payload)
                            ? [buildCandidate({
                                targetObject,
                                newTargetZoneId: zone.id,
                                manaCost,
                                id: `target:${targetObject.id}:new-zone:${zone.id}`,
                            })]
                            : [];
                    });

                    return [
                        ...newObjectCandidates,
                        ...newPlayerCandidates,
                        ...newZoneCandidates,
                    ];
                });
        }
        if (args.family === 'chain-lightning') {
            const manaCost = args.spell.manaCost ?? resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            const attackProfile = parseMageWarsSpellAttackProfile(args.spell);
            const maxTargetCount = Math.max(1, attackProfile?.diceCount ?? 1);
            const chainTargetObjects = targetObjects.filter(isMageWarsChainLightningTargetObject);
            const chainCandidates: ReturnType<typeof buildCandidate>[] = [];

            const buildChainId = (path: MageWarsArenaObjectState[]): string => {
                const [firstTarget, ...chainTargets] = path;
                return `target:${firstTarget.id}:chain:${chainTargets.map((target) => target.id).join(':') || 'end'}`;
            };
            const appendChainPath = (path: MageWarsArenaObjectState[]) => {
                const [firstTarget, ...chainTargets] = path;
                const candidate = buildCandidate({
                    targetObject: firstTarget,
                    chainLightningTargets: chainTargets.map((target) => ({ targetObjectId: target.id })),
                    manaCost,
                    id: buildChainId(path),
                });
                if (candidate.disabled === true) return;

                chainCandidates.push(candidate);
                if (path.length >= maxTargetCount) return;

                const lastTarget = path[path.length - 1];
                const usedTargetIds = new Set(path.map((target) => target.id));
                for (const nextTarget of chainTargetObjects) {
                    if (usedTargetIds.has(nextTarget.id)) continue;
                    const distance = getMageWarsZoneDistance(args.state.core, lastTarget.zoneId, nextTarget.zoneId);
                    if (distance === undefined || distance > 1) continue;
                    appendChainPath([...path, nextTarget]);
                }
            };

            for (const firstTarget of chainTargetObjects) {
                appendChainPath([firstTarget]);
            }
            return chainCandidates;
        }
        if (
            args.family === 'summon-creature'
            || args.family === 'zone-attack'
            || args.family === 'zone-healing'
            || args.family === 'visible-area-enchantment'
        ) {
            const manaCost = args.spell.manaCost ?? resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            return args.state.core.arena.map((zone) => buildCandidate({
                manaCost,
                id: `target-zone:${zone.id}`,
                targetZoneId: zone.id,
            }));
        }
        if (args.family === 'call-of-the-wild') {
            const manaCost = args.spell.manaCost ?? resolveMageWarsSpellRawCostTotal(args.spell) ?? 0;
            return [buildCandidate({
                manaCost,
                id: `confirm:${args.spell.spellCardId}`,
                label: args.spell.name,
                targetMode: 'no-target',
            })];
        }
        return targetObjects.map((targetObject) => buildCandidate({
            targetObject,
            manaCost: resolveDirectObjectSpellManaCost(args.spell, args.family, targetObject) ?? 0,
        }));
    })();
    const firstDisabledReason = candidates.find((candidate) => candidate.disabled)?.disabledReason;
    return {
        candidates,
        condition: candidates.some((candidate) => candidate.disabled !== true)
            ? { satisfied: true }
            : { satisfied: false, reason: firstDisabledReason ?? 'missingTarget' },
        aiPolicyId: args.family === 'call-of-the-wild'
            ? 'choice-request:confirm-current'
            : 'choice-request:simple-target',
    };
}

export function buildMageWarsSpellCastOpportunity(args: {
    state: MatchState<MageWarsCore>;
    playerId: string;
    spellCardId: number;
    timestamp?: number;
}): Opportunity<MageWarsSpellCastChoiceValue> | null {
    const player = args.state.core.players[args.playerId];
    const spell = getMageWarsSpellCardFromConfig(args.spellCardId);
    if (!player || !spell) return null;
    const family = resolveMageWarsSpellCastChoiceFamily(spell);
    if (!family) return null;

    const phase = args.state.sys.phase as MageWarsPhase;
    const targetMode = resolveMageWarsSpellCastBaseTargetMode(family);
    const usesMixedObjectPlayerTargets = (
        family === 'single-healing'
        || family === 'life-drain'
        || family === 'direct-attack'
        || family === 'jet-stream'
        || (
            family === 'hidden-response-enchantment'
            && spell.semantics?.attachment?.anchor === 'creature'
        )
    );
    const spellDef = buildMageWarsSpellCastDef(spell, family);
    const lifecycle = {
        sourceId: `spell:${spell.spellCardId}`,
        sourceKind: 'card' as const,
        controllerId: player.id,
        ownerId: player.id,
        phase: 'activation' as const,
        trigger: spellDef.trigger,
        metadata: {
            playerId: player.id,
            spellCardId: spell.spellCardId,
            spellType: spell.spellType,
        },
    };
    const timing = buildMageWarsSpellCastTiming({
        state: args.state,
        player,
        spell,
        family,
        timestamp: args.timestamp,
    });
    const targetRequest = {
        kind: usesMixedObjectPlayerTargets
            ? 'choose-option' as const
            : targetMode === 'zone'
            ? 'select-zone' as const
            : targetMode === 'player-bound-spell'
                ? 'choose-option' as const
            : targetMode === 'direct-player'
                ? 'select-player' as const
            : targetMode === 'wall-edge'
                ? 'select-position' as const
            : targetMode === 'no-target'
                ? 'confirm' as const
                : 'select-object' as const,
        min: 1,
        max: 1,
        description: spell.name,
        metadata: {
            targetMode,
            spellCardId: spell.spellCardId,
        },
    };
    const candidateContract = buildMageWarsSpellCastCandidates({
        state: args.state,
        player,
        spell,
        family,
        phase,
        timestamp: args.timestamp,
    });

    return createAbilityOpportunity({
        def: spellDef,
        timing,
        lifecycle,
        condition: candidateContract.condition,
        targetRequest,
        resolution: { type: 'choice-request' },
        choice: createAbilityChoiceContract<MageWarsSpellCastEffect, MageWarsSpellCastTrigger, MageWarsSpellCastChoiceValue>({
            def: spellDef,
            lifecycle,
            targetRequest,
            candidates: candidateContract.candidates,
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'candidate-commands' },
            ai: { status: 'shared-policy', policyId: candidateContract.aiPolicyId },
            metadata: {
                phase,
                playerId: player.id,
                spellCardId: spell.spellCardId,
                targetMode,
            },
        }),
        metadata: {
            phase,
            playerId: player.id,
            spellCardId: spell.spellCardId,
            targetMode,
        },
    });
}
