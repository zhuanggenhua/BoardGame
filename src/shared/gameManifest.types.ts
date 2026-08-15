export type GameManifestType = 'game' | 'tool';

export type GameCategory = 'card' | 'dice' | 'abstract' | 'wargame' | 'casual' | 'tools';

export type GameMobileProfile = 'none' | 'landscape-adapted' | 'portrait-adapted' | 'tablet-only';

export type GameOrientationPreference = 'landscape' | 'portrait';

export type GameMobileLayoutPreset = 'board-shell' | 'portrait-simple' | 'map-shell';

export type GameMobileBattlefieldZoom = 'none' | 'shell-pinch-pan' | 'game-owned';

export type GameShellTarget = 'pwa' | 'app-webview' | 'mini-program-webview';

export type GameMobileDeliveryMode = 'builtin' | 'package-managed';

export interface GameMobileBoardShellLayout {
    designWidth?: number;
    designHeight?: number;
    minLogicalHeight?: number;
    minReadableScale?: number;
}

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
    /** 选择该选项后允许的游戏人数；用于通用开局壳层从 manifest 推导人数约束。 */
    playerOptions?: number[];
}

export interface GameSetupSelectField {
    type: 'select';
    labelKey: string;
    options?: GameSetupSelectOption[];
    optionsByPlayerCount?: Partial<Record<number, GameSetupSelectOption[]>>;
    default?: string;
    /** 创建房间入口的默认值；用于重开弹窗时重置非持久化偏好。 */
    createRoomDefault?: string;
    presentation?: 'select' | 'segmented';
}

export interface GameSetupMultiSelectField {
    type: 'multi-select';
    labelKey: string;
    options: GameSetupSelectOption[];
    default?: string[];
}

export type GameSetupField = GameSetupSelectField | GameSetupMultiSelectField;

export interface GameManifestCreateRoomSetup {
    /**
     * 创建房间入口不展示也不保留的 setup selection key。
     *
     * 用于游戏把“正式对局建房”和“本地/教程/预设 setup”分开，而不让通用大厅组件识别具体游戏。
     */
    hiddenSelectionKeys?: string[];
    /** 创建房间入口必须写入的 setup selection。 */
    forcedSelections?: Record<string, string | string[]>;
    /** 是否展示通用 setupOptions 字段；未配置时默认展示。 */
    showSetupOptions?: boolean;
}

export interface GameManifestTranslationLabel {
    labelKey: string;
    namespace?: string;
    defaultValue?: string;
}

export interface GameManifestPublicRoomSetupSummary {
    enabledExpansions?: Record<string, GameManifestTranslationLabel>;
    scenario?: {
        options?: Record<string, GameManifestTranslationLabel>;
        pendingLabel?: GameManifestTranslationLabel;
    };
}

export interface GamePreloadAssets {
    images?: string[];
    audio?: string[];
}

export interface GameManifestPageShell {
    /**
     * 本地/测试壳层跟随当前玩家视角时，是否保持同一个 Board 实例。
     *
     * 适用于 Board 自己维护跨视角 UI 上下文、相机或场景缓存的游戏；
     * 页面壳层只读取这个通用运行时合同，不按具体游戏 ID 分支。
     */
    keepBoardMountedOnPlayerViewChange?: boolean;
    tutorialCatalogTheme?: {
        className?: string;
        chapterAccents?: string[];
    };
}

export interface GameManifestAiSupport {
    capture: boolean;
    capturePolicy?: 'human-only' | 'all-seats';
    /** 正式训练数据允许提交的最低完整对局时长；未配置时使用服务端全局门槛。 */
    trainingMinCompletedDurationMs?: number;
    localAi: boolean;
    remoteAi: boolean;
    defaultLocalAiSeats?: 'first-opponent' | 'all-opponents';
}

export type GameStatusTag = 'under_construction';
export type GameAiSupportProfile = GameManifestAiSupport;

export interface GameManifestEntry {
    id: string;
    type: GameManifestType;
    enabled: boolean;
    listed?: boolean;
    statusTag?: GameStatusTag;
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
    createRoomSetup?: GameManifestCreateRoomSetup;
    publicRoomSetupSummary?: GameManifestPublicRoomSetupSummary;
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
    mobileBoardShellLayout?: GameMobileBoardShellLayout;
    pageShell?: GameManifestPageShell;
    ai?: GameManifestAiSupport;
}
