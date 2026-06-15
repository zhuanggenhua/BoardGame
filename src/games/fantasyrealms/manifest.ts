import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'fantasyrealms',
    type: 'game',
    enabled: true,
    titleKey: 'games.fantasyrealms.title',
    descriptionKey: 'games.fantasyrealms.description',
    category: 'card',
    playersKey: 'games.fantasyrealms.players',
    icon: '🏰',
    thumbnailPath: 'fantasyrealms/thumbnails/cover',
    allowLocalMode: true,
    playerOptions: [2, 3, 4, 5, 6],
    bestPlayers: [3, 4],
    tags: ['card_driven', 'set_collection', 'fantasy'],
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

export const FANTASY_REALMS_MANIFEST: GameManifestEntry = entry;
export default entry;
