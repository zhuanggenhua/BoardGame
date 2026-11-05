import type { GameBoardProps } from '../../../engine/transport/protocol';
import type { QidahenCore, QidahenCommandMap } from '../domain';
import type { CardPreviewRef } from '../../../core/cardPreviewTypes';

export type QidahenYearCardSlot = QidahenCore['yearCards'][number];

export type Props = GameBoardProps<QidahenCore, QidahenCommandMap>;

export type QidahenPrimaryStageMode = 'faction' | 'wheel';

export type QidahenMagnifyTarget = {
    previewRef: CardPreviewRef;
    title: string;
    rawWidth: number;
    rawHeight: number;
};
