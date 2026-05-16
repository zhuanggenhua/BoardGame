export type GameManifestType = 'game' | 'tool';

export type GameCategory = 'card' | 'dice' | 'abstract' | 'wargame' | 'casual' | 'tools';

export type GameMobileProfile = 'none' | 'landscape-adapted' | 'portrait-adapted' | 'tablet-only';

export type GameOrientationPreference = 'landscape' | 'portrait';

export type GameMobileLayoutPreset = 'board-shell' | 'portrait-simple' | 'map-shell';

export type GameMobileBattlefieldZoom = 'none' | 'shell-pinch-pan' | 'game-owned';

export type GameShellTarget = 'pwa' | 'app-webview' | 'mini-program-webview';

export type GameMobileDeliveryMode = 'builtin' | 'package-managed';

export interface GameManifestMobileDelivery {
    mode: GameMobileDeliveryMode;
    runtimeChannel?: string;
    modulePackId?: string;
    assetPackId?: string;
    modulePackBytes?: number;
    assetPackBytes?: number;
    requiresAppUpdate?: boolean;
    requiredAppVersion?: string;
}

export interface GameSetupSelectOption {
    value: string;
    labelKey: string;
}

export interface GameSetupSelectField {
    type: 'select';
    labelKey: string;
    options?: GameSetupSelectOption[];
    optionsByPlayerCount?: Partial<Record<number, GameSetupSelectOption[]>>;
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
    capturePolicy?: 'human-only' | 'all-seats';
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
    mobileBattlefieldZoom?: GameMobileBattlefieldZoom;
    shellTargets?: GameShellTarget[];
    mobileDelivery?: GameManifestMobileDelivery;
    ai?: GameManifestAiSupport;
}
