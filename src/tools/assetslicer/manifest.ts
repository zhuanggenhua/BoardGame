import type { GameManifestEntry } from '../../games/manifest.types';

const entry: GameManifestEntry = {
    id: 'assetslicer',
    type: 'tool',
    enabled: true,
    titleKey: 'games.assetslicer.title',
    descriptionKey: 'games.assetslicer.description',
    category: 'tools',
    playersKey: 'games.assetslicer.players',
    icon: 'SL',
    mobileProfile: 'none',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    ai: {
        capture: false,
        localAi: false,
        remoteAi: false,
    },
};

export const ASSET_SLICER_MANIFEST: GameManifestEntry = entry;

export default entry;
