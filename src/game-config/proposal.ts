import type {
    GameConfigMaterializedPackage,
    GameConfigPatchProposal,
    GameConfigProposalStatus,
    GameConfigValidationIssue,
} from './types';
import { isJsonValue } from './validation';

const DEFAULT_STATUS: GameConfigProposalStatus = 'pending_ai_review';
const FORBIDDEN_FIELD_SEGMENTS = new Set([
    '__proto__',
    'constructor',
    'prototype',
    'code',
    'sourcecode',
    'script',
    'javascript',
    'handler',
    'executor',
    'function',
    'eval',
]);

export type GameConfigPatchProposalInput = Omit<GameConfigPatchProposal, 'status'> & {
    status?: GameConfigProposalStatus;
};

export interface ValidateGameConfigPatchProposalOptions {
    materialized?: GameConfigMaterializedPackage;
}

export interface GameConfigPatchProposalValidationResult {
    ok: boolean;
    issues: GameConfigValidationIssue[];
    proposal?: GameConfigPatchProposal;
}

function issue(
    issues: GameConfigValidationIssue[],
    path: string,
    code: string,
    message: string,
): void {
    issues.push({ path, code, message, severity: 'error' });
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function fieldPathSegments(fieldPath: string): string[] {
    return fieldPath
        .split(/[^A-Za-z0-9_]+/)
        .flatMap((segment) => segment.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/\s+/))
        .map((segment) => segment.toLowerCase())
        .filter(Boolean);
}

function hasForbiddenFieldSegment(fieldPath: string): boolean {
    return fieldPathSegments(fieldPath).some((segment) => FORBIDDEN_FIELD_SEGMENTS.has(segment));
}

export function createGameConfigPatchProposal(
    input: GameConfigPatchProposalInput,
): GameConfigPatchProposal {
    return {
        ...input,
        status: input.status ?? DEFAULT_STATUS,
    };
}

export function validateGameConfigPatchProposal(
    input: unknown,
    options: ValidateGameConfigPatchProposalOptions = {},
): GameConfigPatchProposalValidationResult {
    const issues: GameConfigValidationIssue[] = [];
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        issue(issues, '$', 'INVALID_PROPOSAL', 'config patch proposal must be an object');
        return { ok: false, issues };
    }

    const proposal = input as Partial<GameConfigPatchProposal>;
    if (!isNonEmptyString(proposal.gameId)) {
        issue(issues, '$.gameId', 'REQUIRED_STRING', 'gameId is required');
    }
    if (!isNonEmptyString(proposal.configVersion)) {
        issue(issues, '$.configVersion', 'REQUIRED_STRING', 'configVersion is required');
    }
    if (!isNonEmptyString(proposal.objectId)) {
        issue(issues, '$.objectId', 'REQUIRED_STRING', 'objectId is required');
    }
    if (!isNonEmptyString(proposal.fieldPath)) {
        issue(issues, '$.fieldPath', 'REQUIRED_STRING', 'fieldPath is required');
    } else if (hasForbiddenFieldSegment(proposal.fieldPath)) {
        issue(issues, '$.fieldPath', 'FORBIDDEN_PATCH_PATH', 'fieldPath cannot target executable code or prototype fields');
    }
    if (!isNonEmptyString(proposal.reason)) {
        issue(issues, '$.reason', 'REQUIRED_STRING', 'reason is required');
    }
    if (!isJsonValue(proposal.suggestedValue)) {
        issue(issues, '$.suggestedValue', 'INVALID_JSON_VALUE', 'suggestedValue must be a JSON value');
    }
    if (proposal.currentValue !== undefined && !isJsonValue(proposal.currentValue)) {
        issue(issues, '$.currentValue', 'INVALID_JSON_VALUE', 'currentValue must be a JSON value when present');
    }
    if (proposal.status && ![
        'pending_ai_review',
        'ai_suggest_accept',
        'ai_suggest_reject',
        'needs_more_evidence',
        'needs_human_review',
        'needs_code_support',
        'accepted',
        'rejected',
        'closed',
    ].includes(proposal.status)) {
        issue(issues, '$.status', 'INVALID_PROPOSAL_STATUS', 'status is not supported');
    }

    const materialized = options.materialized;
    if (materialized && isNonEmptyString(proposal.objectId)) {
        const object = materialized.objectsById.get(proposal.objectId);
        if (!object) {
            issue(issues, '$.objectId', 'UNKNOWN_OBJECT_ID', `unknown objectId "${proposal.objectId}"`);
        } else if (
            isNonEmptyString(proposal.fieldPath)
            && !proposal.fieldPath.startsWith(`objects[${proposal.objectId}].`)
        ) {
            issue(issues, '$.fieldPath', 'FIELD_PATH_OBJECT_MISMATCH', 'fieldPath must point at the same objectId');
        }
    }

    const ok = issues.length === 0;
    return {
        ok,
        issues,
        proposal: ok ? createGameConfigPatchProposal(proposal as GameConfigPatchProposalInput) : undefined,
    };
}
