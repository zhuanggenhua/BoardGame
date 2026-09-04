import {
    findExplorerByPlayerId,
    getAllExplorers,
    getExplorersInTurnOrder,
} from './explorerReadModel';
import { resolveMagicCameraOwnerPlayerId } from './hauntScenarioReadModel';
import { isImplementedBetrayalHauntCardNumber, type BetrayalTraitKey } from './scenarioConfig';
import { rotateToNextLivingPlayer } from './turnOrderReadModel';
import type {
    BetrayalCore,
    BetrayalExplorerSummary,
} from './game';

export type BetrayalHauntType = 'no-traitor' | 'one-traitor' | 'hidden-traitor' | 'free-for-all';

export type BetrayalHauntTraitorSelectionPolicy =
    | 'haunt-revealer'
    | 'hidden-traitor'
    | 'no-traitor'
    | 'free-for-all'
    | 'left-of-revealer'
    | 'oldest-character'
    | 'highest-speed'
    | 'lowest-sanity-excluding-revealer'
    | 'highest-knowledge'
    | 'lowest-sanity'
    | 'highest-knowledge-excluding-revealer'
    | 'most-omens'
    | 'highest-might'
    | 'magic-camera-owner'
    | 'event-defined';

export type BetrayalHauntTraitorTieBreak =
    | 'none'
    | 'turn-order-after-revealer'
    | 'left-of-revealer'
    | 'event-card'
    | 'source-contract-pending';

export interface BetrayalHauntTraitorResolution {
    hauntCardNumber: number | null;
    policy: BetrayalHauntTraitorSelectionPolicy;
    traitorPlayerId: string | null;
    teamModel: BetrayalHauntType;
    reasonLabel: string;
    candidatePlayerIds: string[];
    excludedPlayerIds: string[];
    tieBreak: BetrayalHauntTraitorTieBreak;
    representativeOnly: boolean;
}

export interface BetrayalTraitorVolunteerInteraction {
    active: boolean;
    designatedTraitorPlayerId: string | null;
    volunteerCandidatePlayerIds: string[];
    triggerCardHolderPlayerId: string | null;
    triggerCardId: string | null;
    requiresPositionSwap: boolean;
    requiresTriggerCardTransfer: boolean;
    reason: string | null;
}

export type BetrayalTraitorVolunteerResolutionDecision =
    | 'designated-accepts'
    | 'volunteer-replaces'
    | 'no-volunteer';

export type BetrayalTraitorVolunteerResolutionStatus =
    | 'ready'
    | 'not-applicable'
    | 'missing-volunteer'
    | 'invalid-volunteer';

export type BetrayalTraitorVolunteerResolutionContractGap =
    | 'formal-command'
    | 'reveal-ui'
    | 'traitor-boost-reconciliation'
    | 'first-player-reconciliation'
    | 'haunt-setup-reconciliation';

export interface BetrayalTraitorVolunteerResolutionInput {
    decision: BetrayalTraitorVolunteerResolutionDecision;
    volunteerPlayerId?: string | null;
}

export interface BetrayalTraitorVolunteerRoleChangePreview {
    playerId: string;
    fromSide: 'hero' | 'traitor';
    toSide: 'hero' | 'traitor';
}

export interface BetrayalTraitorVolunteerPositionSwapPreview {
    required: boolean;
    designatedTraitorPlayerId: string | null;
    volunteerPlayerId: string | null;
    fromRoomByPlayerId: Record<string, string>;
    toRoomByPlayerId: Record<string, string>;
}

export interface BetrayalTraitorVolunteerTriggerCardTransferPreview {
    required: boolean;
    cardId: string | null;
    fromPlayerId: string | null;
    toPlayerId: string | null;
    holderAlreadyCorrect: boolean;
}

export interface BetrayalTraitorVolunteerResolutionPreview {
    active: boolean;
    canResolve: boolean;
    status: BetrayalTraitorVolunteerResolutionStatus;
    decision: BetrayalTraitorVolunteerResolutionDecision;
    designatedTraitorPlayerId: string | null;
    volunteerPlayerId: string | null;
    resultingTraitorPlayerId: string | null;
    roleChanges: BetrayalTraitorVolunteerRoleChangePreview[];
    positionSwap: BetrayalTraitorVolunteerPositionSwapPreview;
    triggerCardTransfer: BetrayalTraitorVolunteerTriggerCardTransferPreview;
    requiresTraitorBoostReconciliation: boolean;
    requiresFirstPlayerReconciliation: boolean;
    requiresHauntSetupReconciliation: boolean;
    contractGaps: BetrayalTraitorVolunteerResolutionContractGap[];
    previewOnly: true;
    reason: string | null;
}

export type BetrayalHauntFirstPlayerPolicy =
    | 'left-of-traitor'
    | 'left-of-revealer'
    | 'current-player'
    | 'source-contract-pending';

export interface BetrayalHauntFirstPlayerResolution {
    hauntCardNumber: number | null;
    policy: BetrayalHauntFirstPlayerPolicy;
    anchorPlayerId: string;
    nextPlayerId: string;
    reasonLabel: string;
    representativeOnly: boolean;
}

interface BetrayalHauntTraitorPolicyModel {
    policy: BetrayalHauntTraitorSelectionPolicy;
    teamModel: BetrayalHauntType;
    reasonLabel: string;
    traitKey?: BetrayalTraitKey;
    excludeRevealer?: boolean;
}

function resolveHauntTraitorPolicyModel(
    hauntCardNumber: number | null,
    eventSelection?: 'current-explorer' | 'magic-camera-owner',
): BetrayalHauntTraitorPolicyModel {
    if (eventSelection === 'magic-camera-owner') {
        return {
            policy: 'magic-camera-owner',
            teamModel: 'one-traitor',
            reasonLabel: '魔法相机持有者；没有持有者时为作祟揭秘者',
        };
    }
    if (eventSelection === 'current-explorer') {
        return {
            policy: 'haunt-revealer',
            teamModel: 'one-traitor',
            reasonLabel: '作祟揭秘者',
        };
    }

    switch (hauntCardNumber) {
        case 2:
        case 3:
        case 6:
            return { policy: 'hidden-traitor', teamModel: 'hidden-traitor', reasonLabel: '隐藏叛徒' };
        case 4:
        case 5:
        case 7:
        case 8:
            return { policy: 'no-traitor', teamModel: 'no-traitor', reasonLabel: '无叛徒' };
        case 9:
        case 10:
        case 11:
        case 12:
            return { policy: 'free-for-all', teamModel: 'free-for-all', reasonLabel: '自由混战' };
        case 14:
        case 22:
        case 25:
        case 44:
            return { policy: 'left-of-revealer', teamModel: 'one-traitor', reasonLabel: '作祟揭秘者左侧玩家' };
        case 20:
            return { policy: 'oldest-character', teamModel: 'one-traitor', reasonLabel: '年龄最大角色' };
        case 24:
            return { policy: 'highest-speed', teamModel: 'one-traitor', reasonLabel: '速度最高', traitKey: 'speed' };
        case 30:
            return {
                policy: 'lowest-sanity-excluding-revealer',
                teamModel: 'one-traitor',
                reasonLabel: '最低神志，排除作祟揭秘者',
                traitKey: 'sanity',
                excludeRevealer: true,
            };
        case 33:
            return {
                policy: 'magic-camera-owner',
                teamModel: 'one-traitor',
                reasonLabel: '事件指定：魔法相机持有者；没有持有者时为作祟揭秘者',
            };
        case 34:
            return { policy: 'highest-knowledge', teamModel: 'one-traitor', reasonLabel: '最高知识', traitKey: 'knowledge' };
        case 36:
            return { policy: 'lowest-sanity', teamModel: 'one-traitor', reasonLabel: '最低神志', traitKey: 'sanity' };
        case 39:
            return {
                policy: 'highest-knowledge-excluding-revealer',
                teamModel: 'one-traitor',
                reasonLabel: '最高知识，排除作祟揭秘者',
                traitKey: 'knowledge',
                excludeRevealer: true,
            };
        case 43:
            return { policy: 'most-omens', teamModel: 'one-traitor', reasonLabel: '持有预兆最多' };
        case 48:
            return { policy: 'highest-might', teamModel: 'one-traitor', reasonLabel: '最高力量', traitKey: 'might' };
        default:
            return { policy: 'haunt-revealer', teamModel: 'one-traitor', reasonLabel: '作祟揭秘者' };
    }
}

function orderExplorersAfterPlayer(
    explorers: BetrayalExplorerSummary[],
    playerId: string,
): BetrayalExplorerSummary[] {
    if (explorers.length === 0) {
        return [];
    }
    const currentIndex = explorers.findIndex((explorer) => explorer.playerId === playerId);
    if (currentIndex < 0) {
        return [...explorers];
    }
    return [
        ...explorers.slice(currentIndex + 1),
        ...explorers.slice(0, currentIndex + 1),
    ];
}

function chooseExplorerByTrait(
    explorers: BetrayalExplorerSummary[],
    traitKey: BetrayalTraitKey,
    mode: 'highest' | 'lowest',
): { traitorPlayerId: string | null; candidatePlayerIds: string[] } {
    if (explorers.length === 0) {
        return { traitorPlayerId: null, candidatePlayerIds: [] };
    }
    const values = explorers.map((explorer) => explorer.traits[traitKey] ?? 0);
    const targetValue = mode === 'highest'
        ? Math.max(...values)
        : Math.min(...values);
    const candidatePlayerIds = explorers
        .filter((explorer) => (explorer.traits[traitKey] ?? 0) === targetValue)
        .map((explorer) => explorer.playerId);
    return {
        traitorPlayerId: candidatePlayerIds[0] ?? null,
        candidatePlayerIds,
    };
}

function chooseExplorerWithMostOmens(
    explorers: BetrayalExplorerSummary[],
): { traitorPlayerId: string | null; candidatePlayerIds: string[] } {
    if (explorers.length === 0) {
        return { traitorPlayerId: null, candidatePlayerIds: [] };
    }
    const omenCounts = explorers.map((explorer) => ({
        playerId: explorer.playerId,
        count: explorer.inventory.filter((card) => card.kind === 'omen').length,
    }));
    const maxCount = Math.max(...omenCounts.map((entry) => entry.count));
    const candidatePlayerIds = omenCounts
        .filter((entry) => entry.count === maxCount)
        .map((entry) => entry.playerId);
    return {
        traitorPlayerId: candidatePlayerIds[0] ?? null,
        candidatePlayerIds,
    };
}

export function resolveHauntTraitorResolutionForTrigger(
    core: BetrayalCore,
    hauntCardNumber: number | null,
    hauntRevealerPlayerId: string,
    options: {
        explicitTraitorPlayerId?: string | null;
        eventSelection?: 'current-explorer' | 'magic-camera-owner';
        revealRepresentativeOnly?: boolean;
    } = {},
): BetrayalHauntTraitorResolution {
    const policyModel = resolveHauntTraitorPolicyModel(hauntCardNumber, options.eventSelection);
    const allExplorers = getExplorersInTurnOrder(core);
    const orderedAfterRevealer = orderExplorersAfterPlayer(allExplorers, hauntRevealerPlayerId);
    const allPlayerIds = allExplorers.map((explorer) => explorer.playerId);
    const excludedPlayerIds = policyModel.excludeRevealer ? [hauntRevealerPlayerId] : [];
    const eligibleExplorers = orderedAfterRevealer.filter((explorer) => !excludedPlayerIds.includes(explorer.playerId));
    const representativeOnly = options.revealRepresentativeOnly === true
        || hauntCardNumber === null
        || !isImplementedBetrayalHauntCardNumber(hauntCardNumber);

    if (policyModel.teamModel === 'no-traitor') {
        return {
            hauntCardNumber,
            policy: policyModel.policy,
            traitorPlayerId: null,
            teamModel: policyModel.teamModel,
            reasonLabel: policyModel.reasonLabel,
            candidatePlayerIds: [],
            excludedPlayerIds,
            tieBreak: 'none',
            representativeOnly,
        };
    }

    if (policyModel.teamModel === 'hidden-traitor' || policyModel.teamModel === 'free-for-all') {
        return {
            hauntCardNumber,
            policy: policyModel.policy,
            traitorPlayerId: null,
            teamModel: policyModel.teamModel,
            reasonLabel: policyModel.reasonLabel,
            candidatePlayerIds: policyModel.teamModel === 'hidden-traitor' ? allPlayerIds : [],
            excludedPlayerIds,
            tieBreak: 'none',
            representativeOnly,
        };
    }

    if (policyModel.policy === 'magic-camera-owner') {
        const traitorPlayerId = options.explicitTraitorPlayerId
            ?? resolveMagicCameraOwnerPlayerId(core)
            ?? hauntRevealerPlayerId;
        return {
            hauntCardNumber,
            policy: policyModel.policy,
            traitorPlayerId,
            teamModel: policyModel.teamModel,
            reasonLabel: policyModel.reasonLabel,
            candidatePlayerIds: traitorPlayerId ? [traitorPlayerId] : [],
            excludedPlayerIds,
            tieBreak: 'event-card',
            representativeOnly,
        };
    }

    if (policyModel.policy === 'left-of-revealer') {
        const traitorPlayerId = options.explicitTraitorPlayerId ?? eligibleExplorers[0]?.playerId ?? null;
        return {
            hauntCardNumber,
            policy: policyModel.policy,
            traitorPlayerId,
            teamModel: policyModel.teamModel,
            reasonLabel: policyModel.reasonLabel,
            candidatePlayerIds: traitorPlayerId ? [traitorPlayerId] : [],
            excludedPlayerIds,
            tieBreak: 'left-of-revealer',
            representativeOnly,
        };
    }

    if (policyModel.policy === 'oldest-character') {
        return {
            hauntCardNumber,
            policy: policyModel.policy,
            traitorPlayerId: options.explicitTraitorPlayerId ?? null,
            teamModel: policyModel.teamModel,
            reasonLabel: `${policyModel.reasonLabel}（角色年龄数据待接入）`,
            candidatePlayerIds: allPlayerIds,
            excludedPlayerIds,
            tieBreak: 'source-contract-pending',
            representativeOnly: true,
        };
    }

    if (policyModel.policy === 'most-omens') {
        const choice = chooseExplorerWithMostOmens(eligibleExplorers);
        return {
            hauntCardNumber,
            policy: policyModel.policy,
            traitorPlayerId: options.explicitTraitorPlayerId ?? choice.traitorPlayerId,
            teamModel: policyModel.teamModel,
            reasonLabel: policyModel.reasonLabel,
            candidatePlayerIds: choice.candidatePlayerIds,
            excludedPlayerIds,
            tieBreak: 'turn-order-after-revealer',
            representativeOnly,
        };
    }

    if (policyModel.traitKey) {
        const mode = policyModel.policy.startsWith('lowest') ? 'lowest' : 'highest';
        const choice = chooseExplorerByTrait(eligibleExplorers, policyModel.traitKey, mode);
        return {
            hauntCardNumber,
            policy: policyModel.policy,
            traitorPlayerId: options.explicitTraitorPlayerId ?? choice.traitorPlayerId,
            teamModel: policyModel.teamModel,
            reasonLabel: policyModel.reasonLabel,
            candidatePlayerIds: choice.candidatePlayerIds,
            excludedPlayerIds,
            tieBreak: 'turn-order-after-revealer',
            representativeOnly,
        };
    }

    return {
        hauntCardNumber,
        policy: policyModel.policy,
        traitorPlayerId: options.explicitTraitorPlayerId ?? hauntRevealerPlayerId,
        teamModel: policyModel.teamModel,
        reasonLabel: policyModel.reasonLabel,
        candidatePlayerIds: [hauntRevealerPlayerId],
        excludedPlayerIds,
        tieBreak: 'none',
        representativeOnly,
    };
}

export function resolveBetrayalTraitorVolunteerInteraction(
    core: BetrayalCore,
): BetrayalTraitorVolunteerInteraction {
    const resolution = core.scenarioRuntime.hauntTraitorResolution;
    const designatedTraitorPlayerId = resolution?.traitorPlayerId ?? core.scenarioRuntime.traitorPlayerId ?? null;
    const triggerCardId = core.scenarioRuntime.triggeringOmenId ?? null;
    const triggerCardHolderPlayerId = triggerCardId
        ? getAllExplorers(core)
            .find((explorer) => explorer.inventory.some((card) => card.id === triggerCardId))
            ?.playerId ?? null
        : null;
    const base = {
        designatedTraitorPlayerId,
        triggerCardHolderPlayerId,
        triggerCardId,
        requiresPositionSwap: false,
        requiresTriggerCardTransfer: false,
    };

    if (core.phase !== 'haunt') {
        return {
            ...base,
            active: false,
            volunteerCandidatePlayerIds: [],
            reason: '作祟开始后才需要处理叛徒替代。',
        };
    }
    if (!resolution) {
        return {
            ...base,
            active: false,
            volunteerCandidatePlayerIds: [],
            reason: '当前还没有叛徒判定结果。',
        };
    }
    if (resolution.teamModel !== 'one-traitor') {
        return {
            ...base,
            active: false,
            volunteerCandidatePlayerIds: [],
            reason: '只有一名公开叛徒的作祟才使用自愿替代叛徒流程。',
        };
    }
    if (!designatedTraitorPlayerId) {
        return {
            ...base,
            active: false,
            volunteerCandidatePlayerIds: [],
            reason: '当前没有可替代的指定叛徒。',
        };
    }

    const volunteerCandidatePlayerIds = getAllExplorers(core)
        .filter((explorer) => explorer.playerId !== designatedTraitorPlayerId)
        .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
        .map((explorer) => explorer.playerId);
    return {
        active: volunteerCandidatePlayerIds.length > 0,
        designatedTraitorPlayerId,
        volunteerCandidatePlayerIds,
        triggerCardHolderPlayerId,
        triggerCardId,
        requiresPositionSwap: true,
        requiresTriggerCardTransfer: Boolean(triggerCardId),
        reason: volunteerCandidatePlayerIds.length > 0
            ? null
            : '没有其他存活探索者可以自愿替代叛徒。',
    };
}

export function resolveBetrayalTraitorVolunteerResolutionPreview(
    core: BetrayalCore,
    input: BetrayalTraitorVolunteerResolutionInput,
): BetrayalTraitorVolunteerResolutionPreview {
    const interaction = resolveBetrayalTraitorVolunteerInteraction(core);
    const designatedTraitorPlayerId = interaction.designatedTraitorPlayerId;
    const basePositionSwap: BetrayalTraitorVolunteerPositionSwapPreview = {
        required: false,
        designatedTraitorPlayerId,
        volunteerPlayerId: input.volunteerPlayerId ?? null,
        fromRoomByPlayerId: {},
        toRoomByPlayerId: {},
    };
    const baseTriggerCardTransfer: BetrayalTraitorVolunteerTriggerCardTransferPreview = {
        required: false,
        cardId: interaction.triggerCardId,
        fromPlayerId: interaction.triggerCardHolderPlayerId,
        toPlayerId: null,
        holderAlreadyCorrect: false,
    };
    const base = {
        decision: input.decision,
        designatedTraitorPlayerId,
        volunteerPlayerId: input.volunteerPlayerId ?? null,
        resultingTraitorPlayerId: designatedTraitorPlayerId,
        roleChanges: [],
        positionSwap: basePositionSwap,
        triggerCardTransfer: baseTriggerCardTransfer,
        requiresTraitorBoostReconciliation: false,
        requiresFirstPlayerReconciliation: false,
        requiresHauntSetupReconciliation: false,
        contractGaps: ['formal-command', 'reveal-ui'] as BetrayalTraitorVolunteerResolutionContractGap[],
        previewOnly: true as const,
    };
    const applicable = core.phase === 'haunt'
        && core.scenarioRuntime.hauntTraitorResolution?.teamModel === 'one-traitor'
        && Boolean(designatedTraitorPlayerId);

    if (!applicable) {
        return {
            ...base,
            active: false,
            canResolve: false,
            status: 'not-applicable',
            reason: interaction.reason ?? '当前作祟不使用自愿替代叛徒流程。',
        };
    }

    if (input.decision === 'designated-accepts' || input.decision === 'no-volunteer') {
        return {
            ...base,
            active: true,
            canResolve: true,
            status: 'ready',
            reason: null,
        };
    }

    if (!input.volunteerPlayerId) {
        return {
            ...base,
            active: true,
            canResolve: false,
            status: 'missing-volunteer',
            reason: '需要先选择一名自愿替代叛徒的探索者。',
        };
    }

    if (!interaction.volunteerCandidatePlayerIds.includes(input.volunteerPlayerId)) {
        return {
            ...base,
            active: true,
            canResolve: false,
            status: 'invalid-volunteer',
            reason: '该玩家不在可自愿替代叛徒列表。',
        };
    }

    const designatedTraitor = findExplorerByPlayerId(core, designatedTraitorPlayerId!);
    const volunteer = findExplorerByPlayerId(core, input.volunteerPlayerId);
    if (!designatedTraitor || !volunteer) {
        return {
            ...base,
            active: true,
            canResolve: false,
            status: 'invalid-volunteer',
            reason: '当前宅邸中找不到指定叛徒或自愿者。',
        };
    }

    const firstPlayerResolution = core.scenarioRuntime.hauntFirstPlayerResolution;
    const triggerCardTransferRequired = Boolean(
        interaction.triggerCardId
        && interaction.triggerCardHolderPlayerId !== input.volunteerPlayerId,
    );

    return {
        ...base,
        active: true,
        canResolve: true,
        status: 'ready',
        volunteerPlayerId: input.volunteerPlayerId,
        resultingTraitorPlayerId: input.volunteerPlayerId,
        roleChanges: [
            {
                playerId: designatedTraitorPlayerId!,
                fromSide: 'traitor',
                toSide: 'hero',
            },
            {
                playerId: input.volunteerPlayerId,
                fromSide: 'hero',
                toSide: 'traitor',
            },
        ],
        positionSwap: {
            required: true,
            designatedTraitorPlayerId,
            volunteerPlayerId: input.volunteerPlayerId,
            fromRoomByPlayerId: {
                [designatedTraitorPlayerId!]: designatedTraitor.roomId,
                [input.volunteerPlayerId]: volunteer.roomId,
            },
            toRoomByPlayerId: {
                [designatedTraitorPlayerId!]: volunteer.roomId,
                [input.volunteerPlayerId]: designatedTraitor.roomId,
            },
        },
        triggerCardTransfer: {
            required: triggerCardTransferRequired,
            cardId: interaction.triggerCardId,
            fromPlayerId: interaction.triggerCardHolderPlayerId,
            toPlayerId: input.volunteerPlayerId,
            holderAlreadyCorrect: interaction.triggerCardHolderPlayerId === input.volunteerPlayerId,
        },
        requiresTraitorBoostReconciliation: true,
        requiresFirstPlayerReconciliation: firstPlayerResolution?.policy === 'left-of-traitor',
        requiresHauntSetupReconciliation: true,
        contractGaps: [
            'formal-command',
            'reveal-ui',
            'traitor-boost-reconciliation',
            ...(firstPlayerResolution?.policy === 'left-of-traitor'
                ? ['first-player-reconciliation' as const]
                : []),
            'haunt-setup-reconciliation',
        ],
        reason: null,
    };
}

interface BetrayalHauntFirstPlayerPolicyModel {
    policy: BetrayalHauntFirstPlayerPolicy;
    reasonLabel: string;
}

function resolveHauntFirstPlayerPolicyModel(
    hauntCardNumber: number | null,
): BetrayalHauntFirstPlayerPolicyModel {
    switch (hauntCardNumber) {
        case 1:
        case 33:
            return { policy: 'left-of-traitor', reasonLabel: '叛徒左侧玩家先行动' };
        case 3:
        case 5:
        case 7:
        case 12:
            return { policy: 'left-of-revealer', reasonLabel: '作祟揭秘者左侧玩家先行动' };
        default:
            return { policy: 'source-contract-pending', reasonLabel: '作祟首玩家合同待接入' };
    }
}

export function resolveHauntFirstPlayerResolutionForTrigger(
    core: BetrayalCore,
    hauntCardNumber: number | null,
    hauntRevealerPlayerId: string,
    hauntTraitorResolution: BetrayalHauntTraitorResolution,
    options: { revealRepresentativeOnly?: boolean } = {},
): BetrayalHauntFirstPlayerResolution {
    const policyModel = resolveHauntFirstPlayerPolicyModel(hauntCardNumber);
    const representativeOnly = options.revealRepresentativeOnly === true
        || hauntCardNumber === null
        || !isImplementedBetrayalHauntCardNumber(hauntCardNumber);
    const anchorPlayerId = policyModel.policy === 'left-of-traitor'
        ? hauntTraitorResolution.traitorPlayerId ?? hauntRevealerPlayerId
        : hauntRevealerPlayerId;
    const nextPlayerId = policyModel.policy === 'current-player'
        ? anchorPlayerId
        : rotateToNextLivingPlayer(core, anchorPlayerId);

    return {
        hauntCardNumber,
        policy: policyModel.policy,
        anchorPlayerId,
        nextPlayerId,
        reasonLabel: policyModel.reasonLabel,
        representativeOnly,
    };
}

export function cloneHauntTraitorResolution(
    resolution: BetrayalHauntTraitorResolution | null | undefined,
): BetrayalHauntTraitorResolution | null {
    if (!resolution) {
        return null;
    }
    return {
        ...resolution,
        candidatePlayerIds: [...resolution.candidatePlayerIds],
        excludedPlayerIds: [...resolution.excludedPlayerIds],
    };
}

export function cloneHauntFirstPlayerResolution(
    resolution: BetrayalHauntFirstPlayerResolution | null | undefined,
): BetrayalHauntFirstPlayerResolution | null {
    return resolution ? { ...resolution } : null;
}
