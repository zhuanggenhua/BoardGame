import type { GameOverResult, PlayerId } from '../../../engine/types';
import type { ArenaZoneId, MageId, MageWarsWallEdgeId, StatusTokenId } from './ids';
import type { MageWarsPlayerSpellbookEntry } from './spellbook';

export type MageWarsArenaObjectKind = 'creature' | 'conjuration' | 'equipment' | 'enchantment';

export type MageWarsSpellCasterRef =
    | { kind: 'mage'; playerId: PlayerId }
    | { kind: 'arena-object'; objectId: string; ownerId: PlayerId };

export interface MageWarsSpellcastingSource {
    abilityId: string;
    kind?: 'familiar' | 'spawn-point';
    phase?: 'creatureAction' | 'deployment';
    allowedSpellTypes?: string[];
    allowedTypeLineIncludes?: string[];
    allowedSchoolLineIncludes?: string[];
    maxSpellLevel?: number;
    minimumMana?: number;
    channeling?: number;
}

export type MageWarsPhase =
    | 'reset'
    | 'channel'
    | 'upkeep'
    | 'planning'
    | 'deployment'
    | 'initiativeQuickcast'
    | 'creatureAction'
    | 'finalQuickcast';

export const MAGE_WARS_PHASE_ORDER: MageWarsPhase[] = [
    'reset',
    'channel',
    'upkeep',
    'planning',
    'deployment',
    'initiativeQuickcast',
    'creatureAction',
    'finalQuickcast',
];

export interface MageWarsPlayerState {
    id: PlayerId;
    mageId: MageId;
    life: number;
    damage: number;
    mana: number;
    channeling: number;
    baseMeleeDice: number;
    actionReady: boolean;
    quickcastReady: boolean;
    guarding: boolean;
    defenseUsesThisRound?: Partial<Record<string, number>>;
    statusTokens: Partial<Record<StatusTokenId, number>>;
    mageZoneId: ArenaZoneId;
    spellbookCount: number;
    spellbookEntries?: readonly MageWarsPlayerSpellbookEntry[];
    preparedSpellSlots: number;
    preparedSpellCardIds: number[];
    discardSpellCardIds: number[];
    /** 被摧毁、仍可被起死回生选择的活体生物卡牌副本。 */
    defeatedLivingCreatureCardIds?: number[];
}

export interface MageWarsArenaObjectState {
    id: string;
    kind: MageWarsArenaObjectKind;
    ownerId: PlayerId;
    sourceSpellCardId: number;
    sourceObjectId: string;
    /** 领域内按对象效果开始生效顺序分配的稳定序号。 */
    createdAtSequence?: number;
    /** 记录创建或重新附属时的命令时间戳，供审计和回放使用。 */
    createdAtTimestamp?: number;
    spellcastingSource?: MageWarsSpellcastingSource;
    mana?: number;
    preparedSpellCardId?: number;
    preparedSpellCount?: number;
    combatProfilesSource?: 'config';
    combatTraitsSource?: 'config';
    name: string;
    zoneId: ArenaZoneId;
    life: number;
    damage: number;
    armor: number;
    actionReady: boolean;
    guarding: boolean;
    summonedTurnNumber?: number;
    rousedBySpellTurnNumber?: number;
    movementActionsUsedThisTurn?: number;
    movementActionsLimitThisTurn?: number;
    defenseUsesThisRound?: Partial<Record<string, number>>;
    temporaryTraits?: {
        swift?: boolean;
        teleportMovement?: boolean;
        elusive?: boolean;
        freeMoveUsedThisAction?: boolean;
        movedThisAction?: boolean;
        quickActionAfterMoveAvailable?: boolean;
        chargeDiceModifier?: number;
        meleeDiceModifier?: number;
        meleeDiceModifierUntilRoundNumber?: number;
        armorModifier?: number;
        armorModifierUntilRoundNumber?: number;
        vampiricNextMelee?: boolean;
        nextMeleePierceModifier?: number;
        nextMeleeUnavoidable?: boolean;
        battleFuryRoundNumber?: number;
        battleFuryExtraAttackAvailable?: boolean;
    };
    banished?: {
        remainingTokens: number;
        returnToZoneId: ArenaZoneId;
        sourceSpellCardId: number;
    };
    statusTokens: Partial<Record<StatusTokenId, number>>;
    typeLine?: string;
    schoolLine?: string;
    attackOrTraitLine?: string;
    rulesText?: string;
    revealed?: boolean;
    anchoredToObjectId?: string;
    anchoredToPlayerId?: PlayerId;
    anchoredToZoneId?: ArenaZoneId;
    boundSpellCardId?: number;
    restrainedByObjectId?: string;
    deathMarkRoundNumber?: number;
    deathMarkAttackerObjectIdsThisRound?: string[];
    mentalCalmRoundNumber?: number;
    mentalCalmAttackerObjectIdsThisRound?: string[];
    meleeAttackManaTaxRoundNumber?: number;
    meleeAttackManaTaxAttackerObjectIdsThisRound?: string[];
    damageBarrierRoundNumber?: number;
    damageBarrierAttackerIdsThisRound?: string[];
    pentagramRoundNumber?: number;
    pentagramTargetObjectIdsThisRound?: string[];
    fearHelmetRoundNumber?: number;
    fearHelmetAttackerObjectIdsThisRound?: string[];
    abilityUseRoundNumbers?: Partial<Record<string, number>>;
    abilityUseCountsThisRound?: Partial<Record<string, number>>;
}

export interface MageWarsArenaZone {
    id: ArenaZoneId;
    row: number;
    col: number;
    occupantIds: string[];
    objectIds: string[];
    conjurationIds: string[];
    fieldCardIds?: number[];
}

export interface MageWarsWallPassageDamage {
    amount: number;
    damageTypes: string[];
}

export interface MageWarsWallState {
    id: string;
    ownerId: PlayerId;
    sourceSpellCardId: number;
    sourceObjectId: string;
    name: string;
    edgeId: MageWarsWallEdgeId;
    zoneIds: [ArenaZoneId, ArenaZoneId];
    blocksLineOfSight: boolean;
    passageDamage?: MageWarsWallPassageDamage;
}

export interface MageWarsFoundationStatus {
    intakeComplete: boolean;
    openDesignArtifact: boolean;
    spellFxRequired: true;
    spellFxDriver: 'domain-events';
}

export interface MageWarsCore {
    playerOrder: PlayerId[];
    currentPlayerId: PlayerId;
    /** 下一个新建或重新附属对象使用的效果顺序序号。 */
    nextObjectSequence?: number;
    /** 当前准备/行动阶段真正拥有操作权的玩家；准备阶段可暂不设置。 */
    phaseActorId?: PlayerId;
    /** 当前阶段已经完成阶段动作的玩家。准备阶段双方都完成后才进入下一阶段。 */
    phaseReadyPlayerIds?: PlayerId[];
    turnNumber: number;
    players: Record<PlayerId, MageWarsPlayerState>;
    objects: Record<string, MageWarsArenaObjectState>;
    walls: Record<MageWarsWallEdgeId, MageWarsWallState>;
    arena: MageWarsArenaZone[];
    foundationStatus: MageWarsFoundationStatus;
    gameResult?: GameOverResult;
}
