import type { CriticalImageResolver } from '../../core/types';

export const qidahenCriticalImageResolver: CriticalImageResolver = () => ({
    critical: ['i18n/zh-CN/qidahen/board/qidahen-main-map'],
    warm: [
        'i18n/zh-CN/qidahen/cards/backs/ming-deck-back',
        'i18n/zh-CN/qidahen/cards/backs/mongol-deck-back',
        'i18n/zh-CN/qidahen/cards/backs/jin-deck-back',
        'i18n/zh-CN/qidahen/aids/ming-player-aid',
        'i18n/zh-CN/qidahen/aids/mongol-player-aid',
        'i18n/zh-CN/qidahen/aids/jin-player-aid',
    ],
});

export default qidahenCriticalImageResolver;
