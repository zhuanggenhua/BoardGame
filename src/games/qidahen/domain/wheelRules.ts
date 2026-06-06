export type QidahenWheelPositionId =
    | 'wheel-reclaim'
    | 'wheel-military-farm'
    | 'wheel-recruit-train'
    | 'wheel-diplomacy'
    | 'wheel-hire'
    | 'wheel-attack'
    | 'wheel-midyear'
    | 'wheel-new-year';

export interface QidahenWheelImmediateEffectConfig {
    id: QidahenWheelPositionId;
    label: string;
    summaryTitle: string;
    troopDelta: number;
    populationDelta: number;
    drawCards: number;
    requiresFriendlyRegion: boolean;
}

export const QIDAHEN_WHEEL_IMMEDIATE_EFFECT_CONFIGS: QidahenWheelImmediateEffectConfig[] = [
    {
        id: 'wheel-reclaim',
        label: '开垦',
        summaryTitle: '轮盘开垦',
        troopDelta: 0,
        populationDelta: 1,
        drawCards: 0,
        requiresFriendlyRegion: true,
    },
    {
        id: 'wheel-military-farm',
        label: '军屯',
        summaryTitle: '轮盘军屯',
        troopDelta: 1,
        populationDelta: 0,
        drawCards: 2,
        requiresFriendlyRegion: true,
    },
    {
        id: 'wheel-recruit-train',
        label: '征兵训练',
        summaryTitle: '轮盘征兵/训练',
        troopDelta: 2,
        populationDelta: 0,
        drawCards: 0,
        requiresFriendlyRegion: true,
    },
];

const QIDAHEN_WHEEL_IMMEDIATE_EFFECT_CONFIG_BY_ID = new Map(
    QIDAHEN_WHEEL_IMMEDIATE_EFFECT_CONFIGS.map((config) => [config.id, config]),
);

export const getQidahenWheelImmediateEffectConfig = (
    positionId: string,
): QidahenWheelImmediateEffectConfig | null => (
    QIDAHEN_WHEEL_IMMEDIATE_EFFECT_CONFIG_BY_ID.get(positionId as QidahenWheelPositionId) ?? null
);
