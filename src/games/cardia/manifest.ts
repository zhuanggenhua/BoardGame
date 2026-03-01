import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'cardia',
    type: 'game',
    enabled: true,
    titleKey: 'games.cardia.title',
    descriptionKey: 'games.cardia.description',
    category: 'card',
    playersKey: 'games.cardia.players',
    icon: '🏰',
    thumbnailPath: 'cardia/cards/title',  // 使用主题图作为缩略图
    allowLocalMode: false,
    playerOptions: [2],
    tags: ['card_driven', 'tactical'],
    bestPlayers: [2],
    setupOptions: {
        deckVariant: {
            type: 'select',
            labelKey: 'games.cardia.setup.deckVariant.label',
            options: [
                { value: 'I', labelKey: 'games.cardia.setup.deckVariant.deck1' },
                { value: 'II', labelKey: 'games.cardia.setup.deckVariant.deck2' },
            ],
            default: 'I',
        },
    },
    preloadAssets: {
        images: [
            // 标题和辅助图片
            'cardia/cards/title',
            'cardia/cards/helper1',
            'cardia/cards/helper2',
            // Deck I 卡牌（1-16）
            ...Array.from({ length: 16 }, (_, i) => `cardia/cards/deck1/${i + 1}`),
            // Deck II 卡牌（1-16）
            ...Array.from({ length: 16 }, (_, i) => `cardia/cards/deck2/${i + 1}`),
            // 地点卡牌
            'cardia/cards/locations/1',
            'cardia/cards/locations/2',
            'cardia/cards/locations/3',
            'cardia/cards/locations/4',
            'cardia/cards/locations/5',
            'cardia/cards/locations/6',
            'cardia/cards/locations/7',
            'cardia/cards/locations/8',
        ],
    },
};

export const CARDIA_MANIFEST: GameManifestEntry = entry;
export default entry;
