import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'dicethrone',
    type: 'game',
    enabled: true,
    titleKey: 'games.dicethrone.title',
    descriptionKey: 'games.dicethrone.description',
    category: 'dice',
    playersKey: 'games.dicethrone.players',
    icon: '🎲',
    thumbnailPath: 'dicethrone/thumbnails/fengm',
    allowLocalMode: false,
    playerOptions: [2, 4],
    tags: ['dice_driven', 'combat'],
    bestPlayers: [2, 4],
    cursorTheme: 'dicethrone-critical',
    fontFamily: { display: 'Cinzel' },
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'board-shell',
    mobileBattlefieldZoom: 'game-owned',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    mobileDelivery: {
        mode: 'package-managed',
        runtimeChannel: 'stable',
        modulePackId: 'dicethrone',
        assetPackId: 'dicethrone',
    },
    ai: {
        capture: true,
        localAi: true,
        remoteAi: true,
        trainingMinCompletedDurationMs: 10 * 60 * 1000,
    },
};

export const DICETHRONE_MANIFEST: GameManifestEntry = entry;

export default entry;
