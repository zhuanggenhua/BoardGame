import type { CriticalImageResolver } from '../../core/types';

export const qidahenCriticalImageResolver: CriticalImageResolver = () => ({
    critical: [
        'qidahen/board/qidahen-main-map',
        'qidahen/cards/backs/ming-card-back',
        'qidahen/cards/backs/korea-card-back',
        'qidahen/cards/backs/qidahen-cover-card',
        'qidahen/cards/atlases/ming-faction-deck-atlas',
        'qidahen/cards/atlases/mongol-faction-deck-atlas',
        'qidahen/cards/atlases/korea-special-deck-atlas',
        'qidahen/markers/ming-control-diplomacy-marker-a',
        'qidahen/markers/jin-control-diplomacy-marker-a',
        'qidahen/units/ming-regular-infantry-unit',
        'qidahen/units/ming-regular-cavalry-unit',
    ],
    warm: [
        'qidahen/cards/backs/mongol-card-back',
        'qidahen/cards/backs/jin-card-back',
        'qidahen/cards/atlases/jin-faction-deck-atlas',
        'qidahen/cards/atlases/chronology-deck-atlas',
        'qidahen/markers/mongol-control-diplomacy-marker-a',
    ],
});

export default qidahenCriticalImageResolver;
