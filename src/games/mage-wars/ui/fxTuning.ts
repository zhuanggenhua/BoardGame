import type { BoardBurstPresetName } from '../../../components/common/animations/BoardFxPresets';
import type { ImpactEffects } from '../../../components/common/animations/ImpactContainer';
import type { SummonColorTheme } from '../../../components/common/animations/SummonEffect';

type MageWarsTravelFxKind = 'attack' | 'push' | 'teleport';
type MageWarsTravelFxTuning = {
    pathPaddingCells: number;
    pathMinSizeCells: number;
    sourceWakeSizeClassName: string;
    sourceWakeOverflow: number;
    midBurstOverflow: number;
    sourceWakePreset: BoardBurstPresetName;
    midBurstPreset: BoardBurstPresetName;
    midBurstStrongPreset?: BoardBurstPresetName;
    targetBurstPreset?: BoardBurstPresetName;
    targetBurstStrongPreset?: BoardBurstPresetName;
    targetBurstOverflow?: number;
    targetBurstSizeClassName?: string;
};

export const MAGE_WARS_FX_TIMING = {
    projectileTravelMs: 2_600,
    projectileRangedCompleteMs: 4_200,
    projectileSameCellCompleteMs: 1_450,
    teleportTravelImpactMs: 2_600,
    teleportSameCellImpactMs: 180,
    teleportTravelCompleteMs: 3_600,
    teleportSameCellCompleteMs: 950,
    pushTravelImpactMs: 2_600,
    pushSameCellImpactMs: 80,
    pushTravelCompleteMs: 3_300,
    pushSameCellCompleteMs: 780,
    directDamageCompleteMs: 850,
} as const;

export const MAGE_WARS_SUMMON_FX_TUNING = {
    scale: 1.08,
    originY: 0.66,
    durationScale: 2.4,
    visualScale: 1.55,
    dimStrength: 0,
} as const;

export const MAGE_WARS_ATTACK_FX_TUNING = {
    pathPaddingCells: 1.35,
    pathMinSizeCells: 2.25,
    projectileMotionEasing: 'linear',
    damageNumberFontScale: 1.75,
    damageNumberColorClass: 'text-amber-50',
    damageNumberDurationSeconds: 1.35,
    showImpactBurst: true,
    impactBurstPreset: 'explosionStrong' as BoardBurstPresetName,
    impactBurstOverflow: 2.2,
    shakeDuration: 620,
    impactEffects: { shake: true, hitStop: true } satisfies ImpactEffects,
    damageFlashCompleteMs: 1_550,
} as const;

export const MAGE_WARS_TRAVEL_FX_TUNING: Record<MageWarsTravelFxKind, MageWarsTravelFxTuning> = {
    attack: {
        pathPaddingCells: 1.35,
        pathMinSizeCells: 2.25,
        sourceWakeSizeClassName: 'relative h-20 w-20',
        sourceWakeOverflow: 2.2,
        midBurstOverflow: 2.4,
        sourceWakePreset: 'sparks',
        midBurstPreset: 'sparks',
    },
    push: {
        pathPaddingCells: 1.45,
        pathMinSizeCells: 2.45,
        sourceWakeSizeClassName: 'relative h-24 w-24',
        sourceWakeOverflow: 2.4,
        midBurstOverflow: 2.5,
        sourceWakePreset: 'summonGlow',
        midBurstPreset: 'summonGlowStrong',
        targetBurstPreset: 'summonGlowStrong',
        targetBurstOverflow: 2.35,
        targetBurstSizeClassName: 'relative h-28 w-28',
    },
    teleport: {
        pathPaddingCells: 1.45,
        pathMinSizeCells: 2.45,
        sourceWakeSizeClassName: 'relative h-20 w-20',
        sourceWakeOverflow: 2.2,
        midBurstOverflow: 2.45,
        sourceWakePreset: 'magicDust',
        midBurstPreset: 'summonGlow',
        midBurstStrongPreset: 'summonGlowStrong',
        targetBurstPreset: 'summonGlow',
        targetBurstStrongPreset: 'summonGlowStrong',
        targetBurstOverflow: 2.2,
        targetBurstSizeClassName: 'relative h-28 w-28',
    },
} as const;

export const MAGE_WARS_DIRECT_DAMAGE_FX_TUNING = {
    numberFontScale: 1.25,
    numberColorClass: 'text-amber-50',
    numberDurationSeconds: 1,
    showImpactBurst: false,
    shakeDuration: 420,
    impactEffects: { shake: true, hitStop: false } satisfies ImpactEffects,
    damageFlashCompleteMs: 780,
    sizeStyle: {
        width: '5rem',
        height: '5rem',
        paddingTop: 0,
        aspectRatio: '1 / 1',
    },
} as const;

export function resolveMageWarsSummonColor(objectKind: unknown): SummonColorTheme {
    return objectKind === 'conjuration' ? 'gold' : 'blue';
}

export function mageWarsFxColors(kind: MageWarsTravelFxKind, strong = false): string[] {
    if (kind === 'attack') return ['#fff7ed', '#fca5a5', '#ef4444', '#7f1d1d'];
    if (kind === 'push') return ['#e0f2fe', '#bae6fd', '#38bdf8', '#0369a1'];
    return strong
        ? ['#fff7ed', '#fde68a', '#f59e0b', '#7c2d12']
        : ['#f0f9ff', '#bae6fd', '#38bdf8', '#1d4ed8'];
}
