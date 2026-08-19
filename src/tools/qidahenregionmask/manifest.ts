import type { GameManifestEntry } from '../../games/manifest.types';

const entry: GameManifestEntry = {
    id: 'qidahenregionmask',
    type: 'tool',
    enabled: true,
    titleKey: 'games.qidahenregionmask.title',
    descriptionKey: 'games.qidahenregionmask.description',
    category: 'tools',
    playersKey: 'games.qidahenregionmask.players',
    icon: '七',
    mobileProfile: 'none',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    ai: {
        capture: false,
        localAi: false,
        remoteAi: false,
    },
};

export const QIDAHEN_REGION_MASK_TOOL_MANIFEST: GameManifestEntry = entry;

export default entry;
