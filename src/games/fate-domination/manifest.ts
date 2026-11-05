import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'fate-domination',
    type: 'game',
    enabled: true,
    statusTag: 'under_construction',
    titleKey: 'games.fate-domination.title',
    descriptionKey: 'games.fate-domination.description',
    category: 'card',
    playersKey: 'games.fate-domination.players',
    icon: 'FD',
    thumbnailPath: 'fate-domination/thumbnails/cover',
    cursorTheme: 'fate-domination-table',
    allowLocalMode: true,
    playerOptions: [3, 4, 5, 6, 7],
    bestPlayers: [3, 4],
    tags: ['card_driven', 'tabletop', 'prototype'],
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'map-shell',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    ai: {
        capture: true,
        localAi: true,
        remoteAi: false,
        manualSetupSelection: true,
        defaultLocalAiSeats: 'all-opponents',
    },
};

export const FATE_DOMINATION_MANIFEST: GameManifestEntry = entry;
export default entry;
