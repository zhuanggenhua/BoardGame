import type { QidahenFactionId, QidahenWheelMoveChoice } from './types';

const QIDAHEN_WHEEL_MOVE_CHOICES: QidahenWheelMoveChoice[] = [
    { id: 'move-1-free', label: '免费走 1', steps: 1, drawText: '对手不抽牌' },
    { id: 'move-2-one-opponent', label: '一名对手抽 2，走 2', steps: 2, drawText: '指定的对手抽 2' },
    { id: 'move-3-all-opponents', label: '所有对手抽 2，走 3', steps: 3, drawText: '每名对手各抽 2' },
];

export const getQidahenWheelMoveChoices = (): QidahenWheelMoveChoice[] => (
    QIDAHEN_WHEEL_MOVE_CHOICES.map((choice) => ({ ...choice }))
);

export const getQidahenWheelMoveById = (
    moveId: string,
): QidahenWheelMoveChoice | undefined => (
    QIDAHEN_WHEEL_MOVE_CHOICES.find((choice) => choice.id === moveId)
);

export const buildQidahenWheelMoveSummary = (
    moveId: string,
    opponentFactionId?: QidahenFactionId,
    opponentFactionName?: string,
): string => {
    const move = getQidahenWheelMoveById(moveId) ?? QIDAHEN_WHEEL_MOVE_CHOICES[0];
    const drawText = move.id === 'move-2-one-opponent' && opponentFactionId
        ? `${opponentFactionName ?? opponentFactionId} 抽 2`
        : move.drawText;
    return `${move.label}：${drawText}`;
};
