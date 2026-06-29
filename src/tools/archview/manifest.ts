import type { GameManifestEntry } from '../../games/manifest.types';

const entry: GameManifestEntry = {
    id: 'archview',
    type: 'tool',
    enabled: true,
    titleKey: 'games.archview.title',
    descriptionKey: 'games.archview.description',
    category: 'tools',
    playersKey: 'games.archview.players',
    icon: 'AR',
    mobileProfile: 'none',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    ai: {
        capture: false,
        localAi: false,
        remoteAi: false,
    },
};

export const ARCH_VIEW_MANIFEST: GameManifestEntry = entry;

export default entry;
