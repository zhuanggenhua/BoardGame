import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'summonerwars',
    type: 'game',
    enabled: true,
    titleKey: 'games.summonerwars.title',
    descriptionKey: 'games.summonerwars.description',
    category: 'wargame',
    playersKey: 'games.summonerwars.players',
    icon: '⚔️',
    thumbnailPath: 'summonerwars/thumbnails/cover',
    allowLocalMode: false,
    playerOptions: [2],
    tags: ['tactical', 'card_driven', 'dice_driven'],
    bestPlayers: [2],
    ai: {
        capture: true,
        localAi: true,
        remoteAi: false,
        trainingMinCompletedDurationMs: 25 * 60 * 1000,
    },
    cursorTheme: 'summonerwars-ethereal',
    fontFamily: { display: 'Bebas Neue' },
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'board-shell',
    mobileBoardShellLayout: {
        designWidth: 900,
    },
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    mobileDelivery: {
        mode: 'package-managed',
        runtimeChannel: 'stable',
        modulePackId: 'summonerwars',
        assetPackId: 'summonerwars',
    },
};

export const SUMMONER_WARS_MANIFEST: GameManifestEntry = entry;

export default entry;
