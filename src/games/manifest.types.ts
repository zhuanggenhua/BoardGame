export type GameManifestType = 'game' | 'tool';

export type GameCategory = 'card' | 'dice' | 'abstract' | 'wargame' | 'casual' | 'tools';

export type GameMobileProfile = 'none' | 'landscape-adapted' | 'portrait-adapted' | 'tablet-only';

export type GameOrientationPreference = 'landscape' | 'portrait';

export type GameMobileLayoutPreset = 'board-shell' | 'portrait-simple' | 'map-shell';

export type GameShellTarget = 'pwa' | 'app-webview' | 'mini-program-webview';

export interface GameSetupSelectOption {
    value: string;
    labelKey: string;
}

export interface GameSetupSelectField {
    type: 'select';
    labelKey: string;
    options: GameSetupSelectOption[];
    default?: string;
}

export interface GameSetupMultiSelectField {
    type: 'multi-select';
    labelKey: string;
    options: GameSetupSelectOption[];
    default?: string[];
}

export type GameSetupField = GameSetupSelectField | GameSetupMultiSelectField;

export interface GamePreloadAssets {
    images?: string[];
    audio?: string[];
}

export interface GameManifestAiSupport {
    capture: boolean;
    localAi: boolean;
    remoteAi: boolean;
}

export interface GameManifestEntry {
    id: string;
    type: GameManifestType;
    enabled: boolean;
    titleKey: string;
    descriptionKey: string;
    authorName?: string;
    category: GameCategory;
    playersKey: string;
    icon: string;
    thumbnailPath?: string;
    allowLocalMode?: boolean;
    playerOptions?: number[];
    tags?: string[];
    bestPlayers?: number[];
    criticalImages?: string[];
    warmImages?: string[];
    cursorTheme?: string;
    fontFamily?: {
        display: string;
        body?: string;
    };
    setupOptions?: Record<string, GameSetupField>;
    preloadAssets?: GamePreloadAssets;
    theme?: {
        background?: string;
    };
    mobileProfile?: GameMobileProfile;
    preferredOrientation?: GameOrientationPreference;
    mobileLayoutPreset?: GameMobileLayoutPreset;
    shellTargets?: GameShellTarget[];
    ai?: GameManifestAiSupport;
}
