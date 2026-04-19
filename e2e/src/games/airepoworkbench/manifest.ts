import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'airepoworkbench',
    type: 'tool',
    enabled: false,
    titleKey: 'games.airepoworkbench.title',
    descriptionKey: 'games.airepoworkbench.description',
    category: 'tools',
    playersKey: 'games.airepoworkbench.players',
    ai: {
        capture: false,
        localAi: false,
        remoteAi: false,
    },
    icon: '🧠',
    mobileProfile: 'none',
    shellTargets: ['pwa'],
};

export default entry;
