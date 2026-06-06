import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'qidahen',
    type: 'game',
    enabled: true,
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
        'qidahen/cards/backs/ming-card-back',
        'qidahen/cards/backs/korea-card-back',
        'qidahen/cards/backs/qidahen-cover-card',
        'qidahen/cards/atlases/ming-faction-deck-atlas',
        'qidahen/cards/atlases/mongol-faction-deck-atlas',
        'qidahen/cards/atlases/korea-special-deck-atlas',
    ],
    warmImages: [
        'qidahen/cards/backs/mongol-card-back',
        'qidahen/cards/backs/jin-card-back',
        'qidahen/cards/atlases/jin-faction-deck-atlas',
        'qidahen/cards/atlases/chronology-deck-atlas',
        'qidahen/markers/ming-control-diplomacy-marker-a',
        'qidahen/markers/mongol-control-diplomacy-marker-a',
        'qidahen/markers/jin-control-diplomacy-marker-a',
        'qidahen/units/ming-regular-infantry-unit',
        'qidahen/units/ming-regular-cavalry-unit',
    ],
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'board-shell',
    mobileBattlefieldZoom: 'none',
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
