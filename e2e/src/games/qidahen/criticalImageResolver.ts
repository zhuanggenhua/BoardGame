import type { CriticalImageResolver } from '../../core/types';

export const qidahenCriticalImageResolver: CriticalImageResolver = () => ({
    critical: ['i18n/zh-CN/qidahen/board/main-board'],
    warm: [
        'i18n/zh-CN/qidahen/cards/backs/ming-card-back',
        'i18n/zh-CN/qidahen/cards/backs/mongol-card-back',
        'i18n/zh-CN/qidahen/cards/backs/jin-card-back',
        'i18n/zh-CN/qidahen/aids/player-aid-ming',
        'i18n/zh-CN/qidahen/aids/player-aid-mongol',
        'i18n/zh-CN/qidahen/aids/player-aid-jin',
    ],
});

export default qidahenCriticalImageResolver;
