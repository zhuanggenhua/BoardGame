import type { GameSetupSelectField } from '../manifest.types';
import type { PublicSetupSummary } from '../../shared/lobby';
import {
    BETRAYAL_SCENARIO_CONFIGS,
    DEFAULT_BETRAYAL_SCENARIO_ID,
    type BetrayalScenarioId,
} from './scenarioConfig';

export const BETRAYAL_SCENARIO_SETUP_FIELD = 'scenario' as const;

export const BETRAYAL_SCENARIO_SETUP_OPTIONS = [
    {
        value: 'first-scenario',
        labelKey: 'setup.scenario.firstScenario',
    },
] as const satisfies NonNullable<GameSetupSelectField['options']>;

const BETRAYAL_SCENARIO_ID_SET = new Set<BetrayalScenarioId>(
    BETRAYAL_SCENARIO_SETUP_OPTIONS.map((option) => option.value as BetrayalScenarioId),
);

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    return value as Record<string, unknown>;
}

function normalizeScenarioId(value: unknown): BetrayalScenarioId | undefined {
    if (typeof value !== 'string' || !BETRAYAL_SCENARIO_ID_SET.has(value as BetrayalScenarioId)) {
        return undefined;
    }
    return value as BetrayalScenarioId;
}

export function readBetrayalScenarioId(setupData?: unknown): BetrayalScenarioId {
    return readExplicitBetrayalScenarioId(setupData) ?? DEFAULT_BETRAYAL_SCENARIO_ID;
}

export function readExplicitBetrayalScenarioId(setupData?: unknown): BetrayalScenarioId | undefined {
    const setupRecord = asRecord(setupData);
    const topLevelScenario = normalizeScenarioId(setupRecord?.[BETRAYAL_SCENARIO_SETUP_FIELD]);
    if (topLevelScenario) {
        return topLevelScenario;
    }

    const legacyScenarioId = normalizeScenarioId(setupRecord?.scenarioId);
    if (legacyScenarioId) {
        return legacyScenarioId;
    }

    const setupSelections = asRecord(setupRecord?.setupSelections);
    const selectedScenario = normalizeScenarioId(setupSelections?.[BETRAYAL_SCENARIO_SETUP_FIELD]);
    if (selectedScenario) {
        return selectedScenario;
    }

    return undefined;
}

function readRuntimeBetrayalScenarioId(runtimeState?: unknown): BetrayalScenarioId | undefined {
    const stateRecord = asRecord(runtimeState);
    const coreRecord = asRecord(stateRecord?.core) ?? stateRecord;
    if (coreRecord?.phase === 'characterSelect') {
        return undefined;
    }
    if (typeof coreRecord?.phase !== 'string') {
        return undefined;
    }
    return normalizeScenarioId(coreRecord.scenarioId);
}

export function buildBetrayalPublicRoomSummary(
    setupData?: Record<string, unknown>,
    runtimeState?: unknown,
): PublicSetupSummary {
    const scenarioId = readExplicitBetrayalScenarioId(setupData) ?? readRuntimeBetrayalScenarioId(runtimeState);
    if (!scenarioId || !BETRAYAL_SCENARIO_CONFIGS[scenarioId]) {
        return {};
    }
    return {
        scenarioId,
    };
}
