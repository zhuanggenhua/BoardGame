import type { GameManifestEntry } from '../manifest.types';
import {
    CARDIA_IMAGE_PATHS,
    getCardiaDeckCardPath,
    getCardiaLocationPaths,
} from './imagePaths';
import { DECK_VARIANT_IDS } from './domain/ids';

const entry: GameManifestEntry = {
    id: 'cardia',
    type: 'game',
    enabled: true,
    titleKey: 'games.cardia.title',
    descriptionKey: 'games.cardia.description',
    category: 'card',
    playersKey: 'games.cardia.players',
    icon: '🏰',
    thumbnailPath: CARDIA_IMAGE_PATHS.THUMBNAIL_TITLE,
    allowLocalMode: false,
    playerOptions: [2],
    tags: ['card_driven', 'tactical'],
    bestPlayers: [2],
    ai: {
        capture: true,
        localAi: true,
        remoteAi: false,
    },
    cursorTheme: 'cardia',
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
            CARDIA_IMAGE_PATHS.THUMBNAIL_TITLE,
            CARDIA_IMAGE_PATHS.HELPER_1,
            CARDIA_IMAGE_PATHS.HELPER_2,
            // Deck I 卡牌（1-16）
            ...Array.from({ length: 16 }, (_, i) => getCardiaDeckCardPath(DECK_VARIANT_IDS.I, i + 1)),
            // Deck II 卡牌（1-16）
            ...Array.from({ length: 16 }, (_, i) => getCardiaDeckCardPath(DECK_VARIANT_IDS.II, i + 1)),
            // 地点卡牌
            ...getCardiaLocationPaths(),
        ],
    },
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'board-shell',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    mobileDelivery: {
        mode: 'package-managed',
        runtimeChannel: 'stable',
        modulePackId: 'cardia',
        assetPackId: 'cardia',
    },
};

export const CARDIA_MANIFEST: GameManifestEntry = entry;
export default entry;
