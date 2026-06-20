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
        capture: false,
        localAi: false,
        remoteAi: false,
    },
    mobileProfile: 'portrait-adapted',
    preferredOrientation: 'portrait',
    mobileLayoutPreset: 'portrait-simple',
    shellTargets: ['pwa'],
};

export const BETRAYAL_MANIFEST: GameManifestEntry = entry;

export default entry;
