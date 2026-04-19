import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'archview',
    type: 'tool',
    enabled: true,
    titleKey: 'games.archview.title',
    descriptionKey: 'games.archview.description',
    category: 'tools',
    playersKey: 'games.archview.players',
    ai: {
        capture: false,
        localAi: false,
        remoteAi: false,
    },
    icon: '🏗️',
    mobileProfile: 'none',
    shellTargets: ['pwa'],
};

export default entry;
