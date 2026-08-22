import type { ChoiceRequest, ChoiceRequestCandidate } from '../../../engine/ChoiceRequest';
import type { AiCommandSpec } from '../../../engine/ai/types';

export interface DiceThroneTokenResponseChoiceOption {
    candidateId: string;
    tokenId: string;
    amount: number;
    command: AiCommandSpec;
}

export interface DiceThroneTokenResponseChoiceProjection {
    requestId: string;
    playerId: string;
    pendingDamageId?: string;
    tokenOptions: DiceThroneTokenResponseChoiceOption[];
    skipAvailable: boolean;
    skipCommand?: AiCommandSpec;
}

export interface DiceThroneTokenResponseCommandLike {
    type?: unknown;
    playerId?: unknown;
    payload?: unknown;
}

export interface DiceThroneTokenResponseChoiceCommandSource {
    requestId: string;
    candidateId: string;
    opportunityId?: string;
    resolutionFrameId?: string;
}

type InteractionLike = {
    id?: unknown;
    kind?: unknown;
    data?: unknown;
    resolutionFrameId?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null
);

function isEnabledCandidate(candidate: ChoiceRequestCandidate): boolean {
    return candidate.disabled !== true && candidate.stale !== true;
}

function readUseTokenOption(candidate: ChoiceRequestCandidate): DiceThroneTokenResponseChoiceOption | null {
    if (!isEnabledCandidate(candidate)) return null;

    const command = candidate.commands?.find((item) => item.type === 'USE_TOKEN');
    const payload = asRecord(command?.payload);
    const tokenId = typeof payload?.tokenId === 'string' ? payload.tokenId : null;
    const amount = typeof payload?.amount === 'number' && Number.isFinite(payload.amount)
        ? payload.amount
        : null;

    if (!tokenId || !amount || amount <= 0) return null;
    return {
        candidateId: candidate.id,
        tokenId,
        amount,
        command,
    };
}

function readSkipCommand(candidate: ChoiceRequestCandidate): AiCommandSpec | null {
    if (!isEnabledCandidate(candidate)) return null;
    return candidate.commands?.find((item) => item.type === 'SKIP_TOKEN_RESPONSE') ?? null;
}

function payloadMatches(expected: unknown, actual: unknown): boolean {
    const expectedRecord = asRecord(expected);
    const actualRecord = asRecord(actual);
    if (!expectedRecord && !actualRecord) return true;
    if (!expectedRecord || !actualRecord) return false;

    const expectedKeys = Object.keys(expectedRecord)
        .sort();
    const actualKeys = Object.keys(actualRecord).sort();
    if (expectedKeys.length !== actualKeys.length) return false;
    return expectedKeys.every((key, index) => (
        actualKeys[index] === key
        && actualRecord[key] === expectedRecord[key]
    ));
}

function candidateAllowsCommand(
    candidate: ChoiceRequestCandidate,
    command: DiceThroneTokenResponseCommandLike,
): boolean {
    if (!isEnabledCandidate(candidate) || typeof command.type !== 'string') return false;
    return candidate.commands?.some((candidateCommand) => (
        candidateCommand.type === command.type
        && payloadMatches(candidateCommand.payload, command.payload)
    )) === true;
}

function resolveMatchingCandidate(
    contract: ChoiceRequest,
    command: DiceThroneTokenResponseCommandLike,
): ChoiceRequestCandidate | null {
    return contract.candidates.find((candidate) => candidateAllowsCommand(candidate, command)) ?? null;
}

export function readDiceThroneTokenResponseChoiceContract(
    interaction: InteractionLike | null | undefined,
): ChoiceRequest | null {
    if (interaction?.kind !== 'dt:token-response') return null;

    const data = asRecord(interaction.data);
    const contract = asRecord(data?.choiceRequestContract);
    if (!contract) return null;

    if (
        typeof contract.requestId !== 'string'
        || typeof contract.playerId !== 'string'
        || typeof contract.kind !== 'string'
        || !Array.isArray(contract.candidates)
        || !asRecord(contract.selection)
        || !asRecord(contract.resolution)
    ) {
        return null;
    }

    return contract as unknown as ChoiceRequest;
}

export function resolveDiceThroneTokenResponseInteractionPendingDamageId(
    interaction: InteractionLike | null | undefined,
): string | undefined {
    if (interaction?.kind !== 'dt:token-response') return undefined;

    const contract = readDiceThroneTokenResponseChoiceContract(interaction);
    const contractPendingDamageId = contract?.metadata?.pendingDamageId;
    if (typeof contractPendingDamageId === 'string' && contractPendingDamageId.length > 0) {
        return contractPendingDamageId;
    }

    const data = asRecord(interaction.data);
    const diagnostic = asRecord(data?.choiceRequest);
    const diagnosticMetadata = asRecord(diagnostic?.metadata);
    const diagnosticPendingDamageId = diagnosticMetadata?.pendingDamageId;
    if (typeof diagnosticPendingDamageId === 'string' && diagnosticPendingDamageId.length > 0) {
        return diagnosticPendingDamageId;
    }

    const prefix = 'dt-token-response-';
    return typeof interaction.id === 'string' && interaction.id.startsWith(prefix)
        ? interaction.id.slice(prefix.length)
        : undefined;
}

export function isDiceThroneTokenResponseCommandAllowedByContract(
    interaction: InteractionLike | null | undefined,
    command: DiceThroneTokenResponseCommandLike,
): boolean | null {
    const contract = readDiceThroneTokenResponseChoiceContract(interaction);
    if (!contract) return null;
    if (command.playerId !== contract.playerId) return false;

    return resolveMatchingCandidate(contract, command) !== null;
}

export function resolveDiceThroneTokenResponseChoiceCommandSource(
    interaction: InteractionLike | null | undefined,
    command: DiceThroneTokenResponseCommandLike,
): DiceThroneTokenResponseChoiceCommandSource | null {
    const contract = readDiceThroneTokenResponseChoiceContract(interaction);
    if (!contract || command.playerId !== contract.playerId) return null;

    const candidate = resolveMatchingCandidate(contract, command);
    if (!candidate) return null;
    const opportunityId = typeof contract.metadata?.opportunityId === 'string'
        ? contract.metadata.opportunityId
        : undefined;
    const resolutionFrameId = typeof contract.metadata?.resolutionFrameId === 'string'
        ? contract.metadata.resolutionFrameId
        : typeof interaction?.resolutionFrameId === 'string'
            ? interaction.resolutionFrameId
            : undefined;
    return {
        requestId: contract.requestId,
        candidateId: candidate.id,
        ...(opportunityId ? { opportunityId } : {}),
        ...(resolutionFrameId ? { resolutionFrameId } : {}),
    };
}

export function projectDiceThroneTokenResponseChoiceContract(
    contract: ChoiceRequest | null,
): DiceThroneTokenResponseChoiceProjection | null {
    if (!contract) return null;
    const skipCommand = contract.candidates
        .map(readSkipCommand)
        .find((command): command is AiCommandSpec => command !== null);
    const pendingDamageId = typeof contract.metadata?.pendingDamageId === 'string'
        ? contract.metadata.pendingDamageId
        : undefined;

    return {
        requestId: contract.requestId,
        playerId: contract.playerId,
        ...(pendingDamageId ? { pendingDamageId } : {}),
        tokenOptions: contract.candidates
            .map(readUseTokenOption)
            .filter((option): option is DiceThroneTokenResponseChoiceOption => option !== null),
        skipAvailable: skipCommand !== undefined,
        ...(skipCommand ? { skipCommand } : {}),
    };
}

export function resolveDiceThroneTokenResponseSkipCommand(
    interaction: InteractionLike | null | undefined,
): AiCommandSpec | null {
    const contract = readDiceThroneTokenResponseChoiceContract(interaction);
    if (!contract) return null;
    return contract.candidates
        .map(readSkipCommand)
        .find((command): command is AiCommandSpec => command !== null)
        ?? null;
}

export function buildDiceThroneTokenResponseChoiceContractSignature(
    interaction: InteractionLike | null | undefined,
): string | null {
    const projection = projectDiceThroneTokenResponseChoiceContract(
        readDiceThroneTokenResponseChoiceContract(interaction),
    );
    if (!projection) return null;

    return JSON.stringify({
        requestId: projection.requestId,
        playerId: projection.playerId,
        pendingDamageId: projection.pendingDamageId ?? null,
        tokenOptions: projection.tokenOptions.map((option) => ({
            tokenId: option.tokenId,
            amount: option.amount,
            commandType: option.command.type,
            commandPayload: option.command.payload,
        })),
        skipAvailable: projection.skipAvailable,
        skipCommand: projection.skipCommand
            ? {
                type: projection.skipCommand.type,
                payload: projection.skipCommand.payload,
            }
            : null,
    });
}
