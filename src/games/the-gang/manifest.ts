import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'the-gang',
    type: 'game',
    enabled: true,
    statusTag: 'under_construction',
    titleKey: 'games.the-gang.title',
    descriptionKey: 'games.the-gang.description',
    category: 'card',
    playersKey: 'games.the-gang.players',
    icon: '🃏',
    thumbnailPath: 'the-gang/thumbnails/cover',
    allowLocalMode: true,
    playerOptions: [3, 4, 5, 6],
    bestPlayers: [4, 5],
    tags: ['card_driven', 'cooperative', 'poker'],
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'board-shell',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    ai: {
        capture: true,
        localAi: true,
        remoteAi: false,
    },
};

export const THE_GANG_MANIFEST: GameManifestEntry = entry;
export default entry;
