import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'betrayal',
    type: 'game',
    enabled: true,
    statusTag: 'under_construction',
    titleKey: 'games.betrayal.title',
    descriptionKey: 'games.betrayal.description',
    category: 'card',
    playersKey: 'games.betrayal.players',
    icon: '屋',
    thumbnailPath: 'betrayal/thumbnails/cover',
    allowLocalMode: true,
    playerOptions: [3, 4, 5, 6],
    tags: ['card_driven'],
    bestPlayers: [4, 5],
    ai: {
        capture: true,
        localAi: true,
        remoteAi: false,
        defaultLocalAiSeats: 'all-opponents',
    },
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'map-shell',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
};

export const BETRAYAL_MANIFEST: GameManifestEntry = entry;

export default entry;
