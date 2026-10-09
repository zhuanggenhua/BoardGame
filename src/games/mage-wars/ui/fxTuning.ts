import type { BoardBurstPresetName } from '../../../components/common/animations/BoardFxPresets';
import type { ImpactEffects } from '../../../components/common/animations/ImpactContainer';
import type { SummonColorTheme } from '../../../components/common/animations/SummonEffect';

type MageWarsTravelFxKind = 'attack' | 'push' | 'move';
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
    rangedAttackTravelMs: 1_350,
    projectileRangedCompleteMs: 2_650,
    projectileSameCellCompleteMs: 1_450,
    // 近战来源冲刺、命中和结果层必须在真实录屏中保持可读，不能只留下单帧闪光。
    meleeLungeOutMs: 280,
    meleeLungePauseMs: 140,
    meleeLungeReturnMs: 280,
    meleeStrikeMs: 260,
    meleeCompleteMs: 900,
    diceResultRollMs: 900,
    // Attack d6 follows DiceThrone / Summoner Wars: linear tumble, then ease onto the result face.
    diceResultTumbleMs: 500,
    diceResultSettleMs: 800,
    meleeResultVisibleMs: 3_000,
    teleportArrivalImpactMs: 420,
    teleportCompleteMs: 1_250,
    // 实体滑移必须长到过程帧能看见真实棋子；线性位移，落点再停一拍给截图和 registry 超时对齐。
    pushTravelImpactMs: 1_400,
    pushSameCellImpactMs: 80,
    pushTravelCompleteMs: 3_200,
    pushSameCellCompleteMs: 180,
    moveTravelImpactMs: 560,
    moveSameCellImpactMs: 80,
    moveTravelCompleteMs: 620,
    moveSameCellCompleteMs: 180,
    directDamageCompleteMs: 850,
} as const;

export const MAGE_WARS_SUMMON_FX_TUNING = {
    // 宿主贴卡；沿用现有 summon 光柱，按卡宽比拉成等宽，不再叠 CSS 光圈。
    scale: 1,
    originY: 0.9,
    durationScale: 2.4,
    visualScale: 1,
    dimStrength: 0,
    pillarWidthRatio: 1,
} as const;

/** E2E 审计上限：宿主与卡同框，只留亚像素/描边余量。 */
export const MAGE_WARS_SUMMON_FX_MAX_OBJECT_RATIO = 1.2;

export const MAGE_WARS_SUMMON_HOST_STYLE = {
    overflow: 'visible' as const,
};

export const MAGE_WARS_ATTACK_FX_TUNING = {
    pathPaddingCells: 1.35,
    pathMinSizeCells: 2.25,
    projectileMotionEasing: 'linear',
    damageNumberFontScale: 2.55,
    damageNumberColorClass: 'text-red-100',
    damageNumberDurationSeconds: 1.6,
    pulseColor: 'rgba(220, 38, 38, 0.28)',
    showImpactBurst: true,
    showRedPulse: false,
    impactBurstPreset: 'explosionStrong' as BoardBurstPresetName,
    impactBurstOverflow: 2.2,
    shakeDuration: 620,
    impactEffects: { shake: true, hitStop: true } satisfies ImpactEffects,
    damageFlashCompleteMs: 1_550,
    meleeSlashDurationMs: 860,
    meleeSlashActiveMs: 460,
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
    move: {
        pathPaddingCells: 0.8,
        pathMinSizeCells: 1.25,
        sourceWakeSizeClassName: 'relative h-12 w-12',
        sourceWakeOverflow: 1.2,
        midBurstOverflow: 1.35,
        sourceWakePreset: 'sparks',
        midBurstPreset: 'sparks',
    },
} as const;

export const MAGE_WARS_TELEPORT_FX_TUNING = {
    sourcePreset: 'magicDust' as BoardBurstPresetName,
    arrivalPreset: 'summonGlow' as BoardBurstPresetName,
    arrivalStrongPreset: 'summonGlowStrong' as BoardBurstPresetName,
    sourceOverflow: 2.2,
    arrivalOverflow: 2.2,
    sourceSizeClassName: 'relative h-20 w-20',
    arrivalSizeClassName: 'relative h-28 w-28',
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
    if (kind === 'move') return ['#ecfeff', '#a5f3fc', '#22d3ee', '#0e7490'];
    if (kind === 'push') return ['#e0f2fe', '#bae6fd', '#38bdf8', '#0369a1'];
    return strong
        ? ['#fff7ed', '#fde68a', '#f59e0b', '#7c2d12']
        : ['#f0f9ff', '#bae6fd', '#38bdf8', '#1d4ed8'];
}
