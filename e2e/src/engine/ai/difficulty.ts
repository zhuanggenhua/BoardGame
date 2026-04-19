import type { AiDifficultyLevel, AiDifficultyProfile } from './types';

export const DEFAULT_LOCAL_AI_DIFFICULTY: AiDifficultyLevel = 'normal';

const AI_DIFFICULTY_PROFILES: Record<AiDifficultyLevel, AiDifficultyProfile> = {
    easy: {
        level: 'easy',
        searchDepth: 0,
        shortlistSize: 2,
        simulationBudgetMs: 0,
        randomness: 16,
        beliefSampleCount: 1,
        evaluatorProfile: 'basic',
    },
    normal: {
        level: 'normal',
        searchDepth: 1,
        shortlistSize: 3,
        simulationBudgetMs: 18,
        randomness: 6,
        beliefSampleCount: 1,
        evaluatorProfile: 'balanced',
    },
    hard: {
        level: 'hard',
        searchDepth: 1,
        shortlistSize: 5,
        simulationBudgetMs: 40,
        randomness: 2,
        beliefSampleCount: 2,
        evaluatorProfile: 'strong',
    },
    expert: {
        level: 'expert',
        searchDepth: 1,
        shortlistSize: 8,
        simulationBudgetMs: 80,
        randomness: 0,
        beliefSampleCount: 3,
        evaluatorProfile: 'expert',
    },
};

export function isAiDifficultyLevel(value: string | undefined): value is AiDifficultyLevel {
    return value === 'easy' || value === 'normal' || value === 'hard' || value === 'expert';
}

export function normalizeAiDifficultyLevel(value: string | undefined): AiDifficultyLevel | undefined {
    if (!value) return undefined;
    const trimmed = value.trim().toLowerCase();
    return isAiDifficultyLevel(trimmed) ? trimmed : undefined;
}

export function resolveAiDifficultyProfile(
    level: AiDifficultyLevel | undefined,
): AiDifficultyProfile {
    const resolvedLevel = level ?? DEFAULT_LOCAL_AI_DIFFICULTY;
    return AI_DIFFICULTY_PROFILES[resolvedLevel];
}

