import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'qidahen',
    type: 'game',
    enabled: true,
    statusTag: 'under_construction',
    titleKey: 'games.qidahen.title',
    descriptionKey: 'games.qidahen.description',
    category: 'wargame',
    playersKey: 'games.qidahen.players',
    icon: '恨',
    thumbnailPath: 'qidahen/thumbnails/cover',
    allowLocalMode: false,
    playerOptions: [3],
    tags: ['card_driven', 'tactical'],
    bestPlayers: [3],
    ai: {
        capture: true,
        localAi: false,
        remoteAi: false,
    },
    criticalImages: [
        'i18n/zh-CN/qidahen/board/qidahen-main-map',
    ],
    warmImages: [
        'i18n/zh-CN/qidahen/cards/backs/ming-deck-back',
        'i18n/zh-CN/qidahen/cards/backs/mongol-deck-back',
        'i18n/zh-CN/qidahen/cards/backs/jin-deck-back',
    ],
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'map-shell',
    mobileBattlefieldZoom: 'game-owned',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    mobileDelivery: {
        mode: 'package-managed',
        runtimeChannel: 'stable',
        modulePackId: 'qidahen',
        assetPackId: 'qidahen',
    },
};

export const QIDAHEN_MANIFEST: GameManifestEntry = entry;

export default entry;
