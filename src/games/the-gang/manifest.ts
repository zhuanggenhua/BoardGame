import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'the-gang',
    type: 'game',
    enabled: true,
    titleKey: 'games.the-gang.title',
    descriptionKey: 'games.the-gang.description',
    category: 'card',
    playersKey: 'games.the-gang.players',
    icon: '🃏',
    thumbnailPath: 'the-gang/thumbnails/the-gang-vault-heist-thumbnail',
    cursorTheme: 'the-gang-vault',
    allowLocalMode: true,
    playerOptions: [3, 4, 5, 6, 7, 8, 9, 10],
    bestPlayers: [4, 5, 6],
    tags: ['card_driven', 'cooperative', 'poker'],
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'board-shell',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    ai: {
        capture: true,
        localAi: true,
        remoteAi: false,
        defaultLocalAiSeats: 'all-opponents',
    },
};

export const THE_GANG_MANIFEST: GameManifestEntry = entry;
export default entry;
