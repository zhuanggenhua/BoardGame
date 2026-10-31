/** 正式主地图顺时针十格；位置、动作与跨季节截停只读此表。历史ID仅为稳定标识，不代表兵种限制。 */
export const QIDAHEN_WHEEL_POSITIONS = [
    { id: 'wheel-new-year', kind: 'new-year', labels: ['新年'], actionKey: 'newYear', angle: -90, stop: true },
    { id: 'wheel-reclaim', kind: 'reclaim-farm', labels: ['开垦', '军屯'], actionKey: 'reclaim', angle: -54, stop: false },
    { id: 'wheel-recruit-train', kind: 'recruit-train', labels: ['征兵', '训练'], actionKey: 'recruitTrain', angle: -18, stop: false },
    { id: 'wheel-military-farm', kind: 'reclaim-farm', labels: ['开垦', '军屯'], actionKey: 'reclaim', angle: 18, stop: false },
    { id: 'wheel-diplomacy', kind: 'dispatch', labels: ['调度', '进攻'], actionKey: 'attackDispatch', angle: 54, stop: false },
    { id: 'wheel-midyear', kind: 'midyear', labels: ['年中'], actionKey: 'midyear', angle: 90, stop: true },
    { id: 'wheel-hire', kind: 'dispatch', labels: ['调度', '进攻'], actionKey: 'attackDispatch', angle: 126, stop: false },
    { id: 'wheel-attack', kind: 'diplomacy-hire', labels: ['外交', '雇佣'], actionKey: 'diplomacyHire', angle: 162, stop: false },
    { id: 'wheel-recruit-train-2', kind: 'recruit-train', labels: ['征兵', '训练'], actionKey: 'recruitTrain', angle: 198, stop: false },
    { id: 'wheel-diplomacy-hire-2', kind: 'diplomacy-hire', labels: ['外交', '雇佣'], actionKey: 'diplomacyHire', angle: 234, stop: false },
] as const;

type QidahenWheelPositionId = typeof QIDAHEN_WHEEL_POSITIONS[number]['id'];
export const getQidahenWheelPosition = (id: string) => QIDAHEN_WHEEL_POSITIONS.find(position => position.id === id);

export function getQidahenWheelDestination(id: string, steps: number) {
    let index = QIDAHEN_WHEEL_POSITIONS.findIndex(position => position.id === id);
    if (index < 0) throw new Error(`Unknown Qidahen wheel position: ${id}`);
    for (let step = 0; step < steps; step += 1) {
        index = (index + 1) % QIDAHEN_WHEEL_POSITIONS.length;
        if (QIDAHEN_WHEEL_POSITIONS[index].stop) break;
    }
    return QIDAHEN_WHEEL_POSITIONS[index];
}

export interface QidahenWheelImmediateEffectConfig {
    id: QidahenWheelPositionId;
    label: string;
    summaryTitle: string;
    troopDelta: number;
    populationDelta: number;
    drawCards: number;
    requiresFriendlyRegion: boolean;
}

const QIDAHEN_WHEEL_IMMEDIATE_EFFECT_CONFIGS: QidahenWheelImmediateEffectConfig[] = [
    {
        id: 'wheel-reclaim',
        label: '开垦',
        summaryTitle: '开垦',
        troopDelta: 0,
        populationDelta: 1,
        drawCards: 0,
        requiresFriendlyRegion: true,
    },
    {
        id: 'wheel-military-farm',
        label: '军屯',
        summaryTitle: '军屯',
        troopDelta: 1,
        populationDelta: 0,
        drawCards: 2,
        requiresFriendlyRegion: true,
    },
    {
        id: 'wheel-recruit-train',
        label: '征兵训练',
        summaryTitle: '轮盘征兵/训练',
        troopDelta: 0,
        populationDelta: 0,
        drawCards: 0,
        requiresFriendlyRegion: false,
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
