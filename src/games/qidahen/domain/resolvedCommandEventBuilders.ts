import type { MatchState, RandomFn } from '../../../engine/types';
import { QIDAHEN_COMMANDS } from './commands';
import {
    getQidahenDiplomacySelectionForCore,
    getQidahenDriveTigerConsentSelectionForCore,
    getQidahenEventCharacterTargetSelectionForCore,
    getQidahenEventOpponentHandChoiceSelectionForCore,
    getQidahenFortificationMaintenanceSelectionForCore,
    getQidahenGrantPardonSelectionForCore,
    getQidahenInternalDispatchSelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenPendingTargetActionForCore,
    getQidahenPostBattleSelectionForCore,
    getQidahenRecruitSelectionForCore,
} from './interactionSelectionAccessors';
import {
    createQidahenStructuredBattleRolls,
} from './battleRollMath';
import {
    applyRequestedCommittedTroops,
} from './pendingBattleCommittedTroops';
import type {
    QidahenCore,
    QidahenCommand,
    QidahenEvent,
    ResolveDiplomacyChoiceCommand,
    ResolveDriveTigerConsentCommand,
    ResolveEventCharacterTargetCommand,
    ResolveEventOpponentHandChoiceCommand,
    ResolveFortificationMaintenanceCommand,
    ResolveGaoDiDispatchCommand,
    ResolveGrantPardonChoiceCommand,
    HandLimitDiscardResolvedEvent,
    PendingActionResolvedEvent,
    PostBattleDecisionResolvedEvent,
    ResolveHandLimitDiscardCommand,
    ResolveInternalDispatchCommand,
    ResolveKhanEdictChoiceCommand,
    ResolveMaShiTradeChoiceCommand,
    ResolvePendingActionCommand,
    ResolvePostBattleDecisionCommand,
    ResolveRecruitChoiceCommand,
    ResolveSunYuanhuaTechCommand,
    SunYuanhuaTechResolvedEvent,
} from './types';

type QidahenResolvedCommandEventBuilder = (
    state: MatchState<QidahenCore>,
    command: QidahenCommand,
    random: RandomFn,
    timestamp: number,
) => QidahenEvent[] | null;

interface QidahenResolvedCommandEventBuilderSpec {
    commandTypes: readonly QidahenCommand['type'][];
    buildEvents: QidahenResolvedCommandEventBuilder;
}

interface QidahenActionWindowResolvedCommandDependencies {
    getQidahenInternalDispatchSelectionForCore: typeof getQidahenInternalDispatchSelectionForCore;
    getQidahenFortificationMaintenanceSelectionForCore: typeof getQidahenFortificationMaintenanceSelectionForCore;
    getQidahenDriveTigerConsentSelectionForCore: typeof getQidahenDriveTigerConsentSelectionForCore;
    getQidahenRecruitSelectionForCore: typeof getQidahenRecruitSelectionForCore;
    getQidahenGrantPardonSelectionForCore: typeof getQidahenGrantPardonSelectionForCore;
    getQidahenMaShiTradeSelectionForCore: typeof getQidahenMaShiTradeSelectionForCore;
    getQidahenKhanEdictSelectionForCore: typeof getQidahenKhanEdictSelectionForCore;
    getQidahenDiplomacySelectionForCore: typeof getQidahenDiplomacySelectionForCore;
    getQidahenEventCharacterTargetSelectionForCore: typeof getQidahenEventCharacterTargetSelectionForCore;
    getQidahenEventOpponentHandChoiceSelectionForCore: typeof getQidahenEventOpponentHandChoiceSelectionForCore;
}

interface QidahenPendingBattleResolvedCommandDependencies {
    getQidahenPendingTargetActionForCore: typeof getQidahenPendingTargetActionForCore;
    getQidahenPostBattleSelectionForCore: typeof getQidahenPostBattleSelectionForCore;
    applyRequestedCommittedTroops: typeof applyRequestedCommittedTroops;
    createStructuredBattleRolls: typeof createQidahenStructuredBattleRolls;
}

const buildQidahenHandLimitDiscardResolvedEvent = (
    command: ResolveHandLimitDiscardCommand,
    timestamp: number,
): HandLimitDiscardResolvedEvent => ({
    type: 'HAND_LIMIT_DISCARD_RESOLVED',
    payload: {
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenScenarioVoteCastEvent = (
    command: Extract<QidahenCommand, { type: 'CAST_SCENARIO_VOTE' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'SCENARIO_VOTE_CAST',
    payload: {
        playerId: command.playerId,
        scenarioId: command.payload.scenarioId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenFactionSelectedEvent = (
    command: Extract<QidahenCommand, { type: 'SELECT_FACTION' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'FACTION_SELECTED',
    payload: {
        playerId: command.playerId,
        factionId: command.payload.factionId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenSunYuanhuaTechResolvedEvent = (
    command: ResolveSunYuanhuaTechCommand,
    timestamp: number,
): SunYuanhuaTechResolvedEvent => ({
    type: 'SUN_YUANHUA_TECH_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenGaoDiDispatchResolvedEvent = (
    command: ResolveGaoDiDispatchCommand,
    timestamp: number,
): QidahenEvent => ({
    type: 'GAO_DI_DISPATCH_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenInternalDispatchResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolveInternalDispatchCommand,
    timestamp: number,
    dependencies: QidahenActionWindowResolvedCommandDependencies = {
        getQidahenInternalDispatchSelectionForCore,
        getQidahenFortificationMaintenanceSelectionForCore,
        getQidahenDriveTigerConsentSelectionForCore,
        getQidahenRecruitSelectionForCore,
        getQidahenMaShiTradeSelectionForCore,
        getQidahenKhanEdictSelectionForCore,
        getQidahenDiplomacySelectionForCore,
        getQidahenEventCharacterTargetSelectionForCore,
    },
): QidahenEvent => ({
    type: 'INTERNAL_DISPATCH_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
        selection: dependencies.getQidahenInternalDispatchSelectionForCore(state.core, state.sys.interaction?.current),
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenFortificationMaintenanceResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolveFortificationMaintenanceCommand,
    timestamp: number,
    dependencies: QidahenActionWindowResolvedCommandDependencies = {
        getQidahenInternalDispatchSelectionForCore,
        getQidahenFortificationMaintenanceSelectionForCore,
        getQidahenDriveTigerConsentSelectionForCore,
        getQidahenRecruitSelectionForCore,
        getQidahenMaShiTradeSelectionForCore,
        getQidahenKhanEdictSelectionForCore,
        getQidahenDiplomacySelectionForCore,
        getQidahenEventCharacterTargetSelectionForCore,
    },
): QidahenEvent => ({
    type: 'FORTIFICATION_MAINTENANCE_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
        attritionPriority: command.payload.attritionPriority,
        selection: dependencies.getQidahenFortificationMaintenanceSelectionForCore(state.core, state.sys.interaction?.current),
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenDriveTigerConsentResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolveDriveTigerConsentCommand,
    timestamp: number,
    dependencies: QidahenActionWindowResolvedCommandDependencies = {
        getQidahenInternalDispatchSelectionForCore,
        getQidahenFortificationMaintenanceSelectionForCore,
        getQidahenDriveTigerConsentSelectionForCore,
        getQidahenRecruitSelectionForCore,
        getQidahenMaShiTradeSelectionForCore,
        getQidahenKhanEdictSelectionForCore,
        getQidahenDiplomacySelectionForCore,
        getQidahenEventCharacterTargetSelectionForCore,
    },
): QidahenEvent => ({
    type: 'DRIVE_TIGER_CONSENT_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
        selection: dependencies.getQidahenDriveTigerConsentSelectionForCore(state.core, state.sys.interaction?.current),
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenRecruitChoiceResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolveRecruitChoiceCommand,
    timestamp: number,
    dependencies: QidahenActionWindowResolvedCommandDependencies = {
        getQidahenInternalDispatchSelectionForCore,
        getQidahenFortificationMaintenanceSelectionForCore,
        getQidahenDriveTigerConsentSelectionForCore,
        getQidahenRecruitSelectionForCore,
        getQidahenMaShiTradeSelectionForCore,
        getQidahenKhanEdictSelectionForCore,
        getQidahenDiplomacySelectionForCore,
        getQidahenEventCharacterTargetSelectionForCore,
    },
): QidahenEvent => ({
    type: 'RECRUIT_CHOICE_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
        selection: dependencies.getQidahenRecruitSelectionForCore(state.core, state.sys.interaction?.current),
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenGrantPardonChoiceResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolveGrantPardonChoiceCommand,
    timestamp: number,
    dependencies: QidahenActionWindowResolvedCommandDependencies = {
        getQidahenInternalDispatchSelectionForCore,
        getQidahenFortificationMaintenanceSelectionForCore,
        getQidahenDriveTigerConsentSelectionForCore,
        getQidahenRecruitSelectionForCore,
        getQidahenGrantPardonSelectionForCore,
        getQidahenMaShiTradeSelectionForCore,
        getQidahenKhanEdictSelectionForCore,
        getQidahenDiplomacySelectionForCore,
        getQidahenEventCharacterTargetSelectionForCore,
        getQidahenEventOpponentHandChoiceSelectionForCore,
    },
): QidahenEvent => ({
    type: 'GRANT_PARDON_CHOICE_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
        selection: dependencies.getQidahenGrantPardonSelectionForCore(state.core, state.sys.interaction?.current),
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenMaShiTradeChoiceResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolveMaShiTradeChoiceCommand,
    timestamp: number,
    dependencies: QidahenActionWindowResolvedCommandDependencies = {
        getQidahenInternalDispatchSelectionForCore,
        getQidahenFortificationMaintenanceSelectionForCore,
        getQidahenDriveTigerConsentSelectionForCore,
        getQidahenRecruitSelectionForCore,
        getQidahenMaShiTradeSelectionForCore,
        getQidahenKhanEdictSelectionForCore,
        getQidahenDiplomacySelectionForCore,
    },
): QidahenEvent => ({
    type: 'MA_SHI_TRADE_CHOICE_RESOLVED',
    payload: {
        playerId: command.playerId,
        troopCount: command.payload.troopCount,
        selection: dependencies.getQidahenMaShiTradeSelectionForCore(state.core, state.sys.interaction?.current),
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenKhanEdictChoiceResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolveKhanEdictChoiceCommand,
    timestamp: number,
    dependencies: QidahenActionWindowResolvedCommandDependencies = {
        getQidahenInternalDispatchSelectionForCore,
        getQidahenFortificationMaintenanceSelectionForCore,
        getQidahenDriveTigerConsentSelectionForCore,
        getQidahenRecruitSelectionForCore,
        getQidahenMaShiTradeSelectionForCore,
        getQidahenKhanEdictSelectionForCore,
        getQidahenDiplomacySelectionForCore,
    },
): QidahenEvent => ({
    type: 'KHAN_EDICT_CHOICE_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
        selection: dependencies.getQidahenKhanEdictSelectionForCore(state.core, state.sys.interaction?.current),
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenDiplomacyChoiceResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolveDiplomacyChoiceCommand,
    timestamp: number,
    dependencies: QidahenActionWindowResolvedCommandDependencies = {
        getQidahenInternalDispatchSelectionForCore,
        getQidahenFortificationMaintenanceSelectionForCore,
        getQidahenDriveTigerConsentSelectionForCore,
        getQidahenRecruitSelectionForCore,
        getQidahenMaShiTradeSelectionForCore,
        getQidahenKhanEdictSelectionForCore,
        getQidahenDiplomacySelectionForCore,
    },
): QidahenEvent => ({
    type: 'DIPLOMACY_CHOICE_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
        selection: dependencies.getQidahenDiplomacySelectionForCore(state.core, state.sys.interaction?.current),
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenEventCharacterTargetResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolveEventCharacterTargetCommand,
    timestamp: number,
    dependencies: QidahenActionWindowResolvedCommandDependencies = {
        getQidahenInternalDispatchSelectionForCore,
        getQidahenFortificationMaintenanceSelectionForCore,
        getQidahenDriveTigerConsentSelectionForCore,
        getQidahenRecruitSelectionForCore,
        getQidahenMaShiTradeSelectionForCore,
        getQidahenKhanEdictSelectionForCore,
        getQidahenDiplomacySelectionForCore,
        getQidahenEventCharacterTargetSelectionForCore,
    },
): QidahenEvent => ({
    type: 'EVENT_CHARACTER_TARGET_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
        selection: dependencies.getQidahenEventCharacterTargetSelectionForCore(
            state.core,
            state.sys.interaction?.current?.data != null ? state.sys.interaction.current : null,
        ),
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenEventOpponentHandChoiceResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolveEventOpponentHandChoiceCommand,
    timestamp: number,
    dependencies: QidahenActionWindowResolvedCommandDependencies = {
        getQidahenInternalDispatchSelectionForCore,
        getQidahenFortificationMaintenanceSelectionForCore,
        getQidahenDriveTigerConsentSelectionForCore,
        getQidahenRecruitSelectionForCore,
        getQidahenMaShiTradeSelectionForCore,
        getQidahenKhanEdictSelectionForCore,
        getQidahenDiplomacySelectionForCore,
        getQidahenEventCharacterTargetSelectionForCore,
        getQidahenEventOpponentHandChoiceSelectionForCore,
    },
): QidahenEvent => ({
    type: 'EVENT_OPPONENT_HAND_CHOICE_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
        selection: dependencies.getQidahenEventOpponentHandChoiceSelectionForCore(
            state.core,
            state.sys.interaction?.current?.data != null ? state.sys.interaction.current : null,
        ),
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildSingleResolvedCommandEvents = <TCommand>(
    buildEvent: (command: TCommand, timestamp: number) => QidahenEvent,
): QidahenResolvedCommandEventBuilder => (
    _state,
    command,
    _random,
    timestamp,
) => [buildEvent(command as TCommand, timestamp)];

const buildStatefulResolvedCommandEvents = <TCommand>(
    buildEvent: (state: MatchState<QidahenCore>, command: TCommand, timestamp: number) => QidahenEvent,
): QidahenResolvedCommandEventBuilder => (
    state,
    command,
    _random,
    timestamp,
) => [buildEvent(
    state,
    command as TCommand,
    timestamp,
)];

const buildQidahenPendingActionResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolvePendingActionCommand,
    random: RandomFn,
    timestamp: number,
    dependencies: QidahenPendingBattleResolvedCommandDependencies = {
        getQidahenPendingTargetActionForCore,
        getQidahenPostBattleSelectionForCore,
        applyRequestedCommittedTroops,
        createStructuredBattleRolls: createQidahenStructuredBattleRolls,
    },
): PendingActionResolvedEvent => {
    const currentPendingTargetAction = dependencies.getQidahenPendingTargetActionForCore(
        state.core,
        state.sys.interaction?.current,
    );
    const pendingTargetAction = currentPendingTargetAction
        ? dependencies.applyRequestedCommittedTroops(
            state.core,
            currentPendingTargetAction,
            command.payload.committedTroops,
        )
        : null;

    return {
        type: 'PENDING_ACTION_RESOLVED',
        payload: {
            playerId: command.playerId,
            pendingTargetAction,
            committedTroops: command.payload.committedTroops,
            retreatLossMode: command.payload.retreatLossMode,
            defenderSortieBattle: command.payload.defenderSortieBattle,
            defenderHoldCity: command.payload.defenderHoldCity,
            defenderCavalryEvasion: command.payload.defenderCavalryEvasion,
            defenderCavalryEvasionRegionId: command.payload.defenderCavalryEvasionRegionId,
            attackerCavalryPlunder: command.payload.attackerCavalryPlunder,
            attackerCavalryPlunderSource: command.payload.attackerCavalryPlunderSource,
            attackerCasualtyPriority: command.payload.attackerCasualtyPriority,
            defenderCasualtyPriority: command.payload.defenderCasualtyPriority,
            battleRolls: pendingTargetAction
                ? dependencies.createStructuredBattleRolls(state.core, pendingTargetAction, random, {
                    defenderSortieBattle: command.payload.defenderSortieBattle,
                    defenderHoldCity: command.payload.defenderHoldCity,
                    defenderCavalryEvasion: command.payload.defenderCavalryEvasion,
                    attackerCavalryPlunder: command.payload.attackerCavalryPlunder,
                })
                : null,
        },
        sourceCommandType: command.type,
        timestamp,
    };
};

const buildQidahenPostBattleDecisionResolvedEvent = (
    state: MatchState<QidahenCore>,
    command: ResolvePostBattleDecisionCommand,
    timestamp: number,
    dependencies: QidahenPendingBattleResolvedCommandDependencies = {
        getQidahenPendingTargetActionForCore,
        getQidahenPostBattleSelectionForCore,
        applyRequestedCommittedTroops,
        createStructuredBattleRolls: createQidahenStructuredBattleRolls,
    },
): PostBattleDecisionResolvedEvent => ({
    type: 'POST_BATTLE_DECISION_RESOLVED',
    payload: {
        playerId: command.playerId,
        choiceId: command.payload.choiceId,
        selection: dependencies.getQidahenPostBattleSelectionForCore(state.core, state.sys.interaction?.current),
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenScenarioCharacterChoiceResolvedEvent = (
    command: Extract<QidahenEvent, { type: 'RESOLVE_SCENARIO_CHARACTER_CHOICE' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'SCENARIO_CHARACTER_CHOICE_RESOLVED',
    payload: {
        playerId: command.playerId,
        groupId: command.payload.groupId,
        characterIds: command.payload.characterIds,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenScenarioArmamentChoiceResolvedEvent = (
    command: Extract<QidahenEvent, { type: 'RESOLVE_SCENARIO_ARMAMENT_CHOICE' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'SCENARIO_ARMAMENT_CHOICE_RESOLVED',
    payload: {
        playerId: command.playerId,
        groupId: command.payload.groupId,
        armamentIds: command.payload.armamentIds,
    },
    sourceCommandType: command.type,
    timestamp,
});

const QIDAHEN_RESOLVED_COMMAND_EVENT_BUILDERS: readonly QidahenResolvedCommandEventBuilderSpec[] = [
    {
        commandTypes: [QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE],
        buildEvents: buildSingleResolvedCommandEvents<Extract<QidahenCommand, { type: 'CAST_SCENARIO_VOTE' }>>(
            buildQidahenScenarioVoteCastEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.SELECT_FACTION],
        buildEvents: buildSingleResolvedCommandEvents<Extract<QidahenCommand, { type: 'SELECT_FACTION' }>>(
            buildQidahenFactionSelectedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD],
        buildEvents: buildSingleResolvedCommandEvents<ResolveHandLimitDiscardCommand>(
            buildQidahenHandLimitDiscardResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH],
        buildEvents: buildSingleResolvedCommandEvents<ResolveSunYuanhuaTechCommand>(
            buildQidahenSunYuanhuaTechResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH],
        buildEvents: buildSingleResolvedCommandEvents<ResolveGaoDiDispatchCommand>(
            buildQidahenGaoDiDispatchResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH],
        buildEvents: buildStatefulResolvedCommandEvents<ResolveInternalDispatchCommand>(
            buildQidahenInternalDispatchResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE],
        buildEvents: buildStatefulResolvedCommandEvents<ResolveFortificationMaintenanceCommand>(
            buildQidahenFortificationMaintenanceResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT],
        buildEvents: buildStatefulResolvedCommandEvents<ResolveDriveTigerConsentCommand>(
            buildQidahenDriveTigerConsentResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE],
        buildEvents: buildStatefulResolvedCommandEvents<ResolveRecruitChoiceCommand>(
            buildQidahenRecruitChoiceResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_GRANT_PARDON_CHOICE],
        buildEvents: buildStatefulResolvedCommandEvents<ResolveGrantPardonChoiceCommand>(
            buildQidahenGrantPardonChoiceResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE],
        buildEvents: buildStatefulResolvedCommandEvents<ResolveMaShiTradeChoiceCommand>(
            buildQidahenMaShiTradeChoiceResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE],
        buildEvents: buildStatefulResolvedCommandEvents<ResolveKhanEdictChoiceCommand>(
            buildQidahenKhanEdictChoiceResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE],
        buildEvents: buildStatefulResolvedCommandEvents<ResolveDiplomacyChoiceCommand>(
            buildQidahenDiplomacyChoiceResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_EVENT_CHARACTER_TARGET],
        buildEvents: buildStatefulResolvedCommandEvents<ResolveEventCharacterTargetCommand>(
            buildQidahenEventCharacterTargetResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE],
        buildEvents: buildStatefulResolvedCommandEvents<ResolveEventOpponentHandChoiceCommand>(
            buildQidahenEventOpponentHandChoiceResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
        buildEvents: (
            state,
            command,
            random,
            timestamp,
        ) => [buildQidahenPendingActionResolvedEvent(
            state,
            command as ResolvePendingActionCommand,
            random,
            timestamp,
        )],
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION],
        buildEvents: buildStatefulResolvedCommandEvents<ResolvePostBattleDecisionCommand>(
            buildQidahenPostBattleDecisionResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE],
        buildEvents: buildSingleResolvedCommandEvents<
            Extract<QidahenEvent, { type: 'RESOLVE_SCENARIO_CHARACTER_CHOICE' }>
        >(
            buildQidahenScenarioCharacterChoiceResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE],
        buildEvents: buildSingleResolvedCommandEvents<
            Extract<QidahenEvent, { type: 'RESOLVE_SCENARIO_ARMAMENT_CHOICE' }>
        >(
            buildQidahenScenarioArmamentChoiceResolvedEvent,
        ),
    },
];

const QIDAHEN_RESOLVED_COMMAND_EVENT_BUILDERS_BY_COMMAND_TYPE = new Map<
    QidahenCommand['type'],
    QidahenResolvedCommandEventBuilder
>(
    QIDAHEN_RESOLVED_COMMAND_EVENT_BUILDERS.flatMap(({ commandTypes, buildEvents }) => (
        commandTypes.map((commandType) => [commandType, buildEvents] as const)
    )),
);

export function buildQidahenResolvedCommandEvents(
    state: MatchState<QidahenCore>,
    command: QidahenCommand,
    random: RandomFn,
    timestamp: number,
): QidahenEvent[] | null {
    return QIDAHEN_RESOLVED_COMMAND_EVENT_BUILDERS_BY_COMMAND_TYPE.get(command.type)?.(
        state,
        command,
        random,
        timestamp,
    ) ?? null;
}
