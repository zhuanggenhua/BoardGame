import type { Command, GameEvent, GameOverResult, PlayerId } from '../../../engine/types';
import type { CopyExecutionContext, MovementMode } from '../../../engine/primitives';
import type { FateDefeatMarker, FateRuleState } from './mechanics';

export const FATE_DOMINATION_COMMANDS = {
    SELECT_MASTER: 'SELECT_MASTER',
    SELECT_SERVANT: 'SELECT_SERVANT',
    DEPLOY_MASTER: 'DEPLOY_MASTER',
    SELECT_ATTACK_CARD: 'SELECT_ATTACK_CARD',
    CONFIRM_ATTACK: 'CONFIRM_ATTACK',
    INSPECT_CARD: 'INSPECT_CARD',
    ADVANCE_PHASE: 'ADVANCE_PHASE',
    MOVE_PLAYER: 'MOVE_PLAYER',
    PASS_ACTION: 'PASS_ACTION',
    RESOLVE_LOCATION: 'RESOLVE_LOCATION',
    PLAY_SKILL: 'PLAY_SKILL',
} as const;

export type FateDominationCommandType = typeof FATE_DOMINATION_COMMANDS[keyof typeof FATE_DOMINATION_COMMANDS];
export type FatePhase = 'preparation' | 'outpost' | 'action' | 'battle' | 'complete';
export type LocationId = 'workshop' | 'miyama' | 'shinto' | 'recon';
export const FATE_BATTLE_LOCATION_ORDER: readonly LocationId[] = ['miyama', 'shinto', 'recon'];
export type SourceStatus = 'verified' | 'partial' | 'unverified';

export interface AttackCardDefinition {
    id: string;
    name: string;
    kind: 'attack' | 'skill';
    assetPath: string;
    manaCost: number;
    basePower: number;
    sourceStatus: SourceStatus;
    effectSummary?: string;
    type?: string;
    cost?: number;
    power?: number;
    desc?: string;
}

export interface CardInstance {
    id: string;
    definitionId: string;
    /** 复制/代理卡牌保留来源，不改变实例 UID 或打印定义。 */
    provenance?: {
        sourceCardId?: string;
        sourceDefinitionId?: string;
        copyContext?: CopyExecutionContext;
    };
}

export interface MasterDefinition {
    id: string;
    name: string;
    assetPath: string;
    sourceStatus: SourceStatus;
    initMana?: number;
    skills?: SkillDefinition[];
    ascensionSkill?: SkillDefinition;
}

export interface ServantDefinition {
    id: string;
    name: string;
    assetPath: string;
    skillAssetPaths: string[];
    sourceStatus: SourceStatus;
    class?: string;
    trueName?: string;
    deck?: string[];
    skillCards?: SkillDefinition[];
}

export interface SkillDefinition {
    id: string;
    name: string;
    type?: string;
    cost?: number;
    req?: number;
    power?: number;
    desc?: string;
    isMasterSkill?: boolean;
}

export interface SituationCardDefinition {
    id: string;
    name: string;
    assetPath: string;
    printedMana: number;
    sourceStatus: SourceStatus;
    effectSummary?: string;
    climax?: boolean;
}

export interface EventCardDefinition {
    id: string;
    name: string;
    assetPath: string;
    victoryPoints: number;
    sourceStatus: SourceStatus;
    effectSummary?: string;
    type?: string;
    desc?: string;
}

export interface PlayerState {
    id: PlayerId;
    masterId: string;
    servantId: string;
    locationId: LocationId | null;
    mana: number;
    victoryPoints: number;
    commandSpells: number;
    hand: CardInstance[];
    selectedAttackIds: string[];
    activeAttackIds: string[];
    discard: CardInstance[];
    deck: CardInstance[];
    hasPassedAction: boolean;
    eliminated: boolean;
    defeatMarkers: FateDefeatMarker[];
    eliminationProtectionUsed: boolean;
    isRevealed: boolean;
    activeSkills: string[];
    skills: SkillDefinition[];
}

export interface BattlefieldState {
    id: LocationId;
    label: string;
    movementCost: number;
    terrainPower: number;
    competitionVictoryPoints: number;
    capacity: number | null;
    playerIds: PlayerId[];
    eventCards: EventCardDefinition[];
}

export interface BattleResult {
    playerId: PlayerId;
    locationId: LocationId;
    power: number;
    eventVictoryPoints: number;
    competitionVictoryPoints: number;
    totalVictoryPoints: number;
    status: 'representative-win' | 'recon' | 'deferred';
}

export interface PendingChoice {
    kind: 'identity' | 'location' | 'attack-cards' | 'battle' | null;
    playerId?: PlayerId;
    minimum?: number;
    maximum?: number;
}

export type FateBattleResolutionStep = 'locations' | 'awards' | 'cleanup';

export interface FateBattleResolutionState {
    frameId: string;
    round: number;
    locationIds: LocationId[];
    resolvedLocationIds: LocationId[];
    step: FateBattleResolutionStep;
}

export interface FateDominationCore {
    gameId: 'fate-domination';
    round: number;
    phase: FatePhase;
    currentPlayerId: PlayerId;
    playerIds: PlayerId[];
    players: Record<PlayerId, PlayerState>;
    battlefield: Record<LocationId, BattlefieldState>;
    situation: SituationCardDefinition;
    miyamaEvent: EventCardDefinition;
    shintoEventFaceDown: boolean;
    situationDeckCount: number;
    eventDeckCount: number;
    eventDiscardCount: number;
    pendingChoice: PendingChoice;
    battleResult: BattleResult | null;
    actionNotice: string;
    turnOrder: PlayerId[];
    currentTurnIndex: number;
    actionLimit: number;
    actionCount: number;
    resolvedLocations: LocationId[];
    resolvedResults: BattleResult[];
    eventDeck: EventCardDefinition[];
    eventDiscard: EventCardDefinition[];
    currentEvents: Record<'miyama' | 'shinto', EventCardDefinition[]>;
    /** 规则事实：持续限制、保护、战力修正、延迟与复制代理。 */
    ruleState: FateRuleState;
    /** 业务层的战斗结算帧事实；与 sys.resolution 的系统帧一一对应。 */
    battleResolution?: FateBattleResolutionState;
    gameResult?: GameOverResult;
}

export type SelectMasterCommand = Command<'SELECT_MASTER', { masterId: string }>;
export type SelectServantCommand = Command<'SELECT_SERVANT', { servantId: string }>;
export type DeployMasterCommand = Command<'DEPLOY_MASTER', { locationId: LocationId }>;
export type SelectAttackCardCommand = Command<'SELECT_ATTACK_CARD', { cardId: string }>;
export type ConfirmAttackCommand = Command<'CONFIRM_ATTACK', Record<string, never>>;
export type InspectCardCommand = Command<'INSPECT_CARD', { cardId: string }>;
export type AdvancePhaseCommand = Command<'ADVANCE_PHASE', Record<string, never>>;
export type MovePlayerCommand = Command<'MOVE_PLAYER', { locationId: LocationId }>;
export type PassActionCommand = Command<'PASS_ACTION', Record<string, never>>;
export type ResolveLocationCommand = Command<'RESOLVE_LOCATION', { locationId: LocationId }>;
export type PlaySkillCommand = Command<'PLAY_SKILL', { skillId: string; targetPlayerId?: PlayerId; targetLocationId?: LocationId; targetCardId?: string }>;

export type FateDominationCommand =
    | SelectMasterCommand
    | SelectServantCommand
    | DeployMasterCommand
    | SelectAttackCardCommand
    | ConfirmAttackCommand
    | InspectCardCommand
    | AdvancePhaseCommand
    | MovePlayerCommand
    | PassActionCommand
    | ResolveLocationCommand
    | PlaySkillCommand;
    
    

export type FateDominationCommandMap = {
    SELECT_MASTER: SelectMasterCommand['payload'];
    SELECT_SERVANT: SelectServantCommand['payload'];
    DEPLOY_MASTER: DeployMasterCommand['payload'];
    SELECT_ATTACK_CARD: SelectAttackCardCommand['payload'];
    CONFIRM_ATTACK: ConfirmAttackCommand['payload'];
    INSPECT_CARD: InspectCardCommand['payload'];
    ADVANCE_PHASE: AdvancePhaseCommand['payload'];
    MOVE_PLAYER: MovePlayerCommand['payload'];
    PASS_ACTION: PassActionCommand['payload'];
    RESOLVE_LOCATION: ResolveLocationCommand['payload'];
    PLAY_SKILL: PlaySkillCommand['payload'];
};

export type MasterSelectedEvent = GameEvent<'MASTER_SELECTED', { playerId: PlayerId; masterId: string }>;
export type ServantSelectedEvent = GameEvent<'SERVANT_SELECTED', { playerId: PlayerId; servantId: string }>;
export type MasterDeployedEvent = GameEvent<'MASTER_DEPLOYED', { playerId: PlayerId; locationId: LocationId; manaGain: number }>;
export type AttackCardSelectedEvent = GameEvent<'ATTACK_CARD_SELECTED', { playerId: PlayerId; cardId: string; selected: boolean }>;
export type AttacksConfirmedEvent = GameEvent<'ATTACKS_CONFIRMED', { playerId: PlayerId; cardIds: string[]; power: number; manaSpent: number }>;
export type CardInspectedEvent = GameEvent<'CARD_INSPECTED', { playerId: PlayerId; cardId: string }>;
export type PhaseAdvancedEvent = GameEvent<'PHASE_ADVANCED', { phase: FatePhase; round: number; currentPlayerId: PlayerId }>;
export type BattleResolvedEvent = GameEvent<'BATTLE_RESOLVED', { result: BattleResult; nextRound: number; gameResult?: GameOverResult }>;
export type BattleResolutionStartedEvent = GameEvent<'FATE_BATTLE_RESOLUTION_STARTED', {
    frameId: string;
    round: number;
    locationIds: LocationId[];
}>;
export type PlayerMovedEvent = GameEvent<'PLAYER_MOVED', {
    playerId: PlayerId;
    from: LocationId;
    to: LocationId;
    path: LocationId[];
    mode: MovementMode;
    manaSpent: number;
    context?: {
        allowAnyDestination?: boolean;
        ignoreEngagement?: boolean;
        free?: boolean;
        excludedLocations?: LocationId[];
    };
}>;
export type ActionPassedEvent = GameEvent<'ACTION_PASSED', { playerId: PlayerId }>;
export type LocationResolvedEvent = GameEvent<'LOCATION_RESOLVED', { locationId: LocationId; results: BattleResult[] }>;
export type SkillPlayedEvent = GameEvent<'SKILL_PLAYED', { playerId: PlayerId; skillId: string; manaSpent: number; targetPlayerId?: PlayerId; targetLocationId?: LocationId; targetCardId?: string }>;
export type FateAbilityUnimplementedEvent = GameEvent<'FATE_ABILITY_UNIMPLEMENTED', {
    playerId: PlayerId;
    skillId: string;
}>;
export type FateRuleModifierAttachedEvent = GameEvent<'FATE_RULE_MODIFIER_ATTACHED', { modifier: FateRuleState['modifiers'][number] }>;
export type FateRuleModifierRemovedEvent = GameEvent<'FATE_RULE_MODIFIER_REMOVED', { modifierId: string }>;
export type FateCopyProxyCreatedEvent = GameEvent<'FATE_COPY_PROXY_CREATED', { record: FateRuleState['copies'][number] }>;
export type FateDefeatDeclaredEvent = GameEvent<'FATE_DEFEAT_DECLARED', {
    playerId: PlayerId;
    sourceId?: string;
    direct: boolean;
    unpreventable?: boolean;
    markerId: string;
}>;
export type FateDefeatAppliedEvent = GameEvent<'FATE_DEFEAT_APPLIED', {
    playerId: PlayerId;
    marker: FateDefeatMarker;
}>;
export type FateDefeatPreventedEvent = GameEvent<'FATE_DEFEAT_PREVENTED', {
    playerId: PlayerId;
    sourceId?: string;
    reason: string;
}>;
export type FateEliminationRequestedEvent = GameEvent<'FATE_ELIMINATION_REQUESTED', {
    playerId: PlayerId;
    reason: 'round-cut' | 'game-effect';
    sourceId?: string;
}>;
export type FateEliminationPreventedEvent = GameEvent<'FATE_ELIMINATION_PREVENTED', {
    playerId: PlayerId;
    reason: 'first-elimination-protection';
    penalty: 'lose-all-mana';
}>;
export type FatePlayerEliminatedEvent = GameEvent<'FATE_PLAYER_ELIMINATED', {
    playerId: PlayerId;
    reason: 'round-cut' | 'game-effect';
    sourceId?: string;
}>;

export type FateDominationEvent =
    | MasterSelectedEvent
    | ServantSelectedEvent
    | MasterDeployedEvent
    | AttackCardSelectedEvent
    | AttacksConfirmedEvent
    | CardInspectedEvent
    | PhaseAdvancedEvent
    | BattleResolutionStartedEvent
    | BattleResolvedEvent
    | PlayerMovedEvent
    | ActionPassedEvent
    | LocationResolvedEvent
    | SkillPlayedEvent
    | FateAbilityUnimplementedEvent
    | FateRuleModifierAttachedEvent
    | FateRuleModifierRemovedEvent
    | FateCopyProxyCreatedEvent
    | FateDefeatDeclaredEvent
    | FateDefeatAppliedEvent
    | FateDefeatPreventedEvent
    | FateEliminationRequestedEvent
    | FateEliminationPreventedEvent
    | FatePlayerEliminatedEvent;
    
    
