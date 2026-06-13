import type { GameManifestEntry } from '../manifest.types';
import {
    DEFAULT_QIDAHEN_SCENARIO_ID,
    QIDAHEN_PLAYER_OPTIONS,
    QIDAHEN_SCENARIO_SETUP_OPTIONS,
} from './roomSetup';

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
    playerOptions: [...QIDAHEN_PLAYER_OPTIONS],
    tags: ['card_driven', 'tactical'],
    bestPlayers: [3],
    setupOptions: {
        scenario: {
            type: 'select',
            labelKey: 'games.qidahen.setup.scenario.label',
            options: [...QIDAHEN_SCENARIO_SETUP_OPTIONS],
            default: DEFAULT_QIDAHEN_SCENARIO_ID,
        },
    },
    ai: {
        capture: true,
        localAi: true,
        remoteAi: false,
    },
    criticalImages: [
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
    warmImages: [
        'qidahen/cards/backs/mongol-card-back',
        'qidahen/cards/backs/jin-card-back',
        'qidahen/cards/atlases/jin-faction-deck-atlas',
        'qidahen/cards/atlases/chronology-deck-atlas',
        'qidahen/markers/mongol-control-diplomacy-marker-a',
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
