export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type GameConfigPackageFormat = 'json';

export type GameConfigObjectType =
    | 'card'
    | 'unit'
    | 'event'
    | 'building'
    | 'token'
    | 'board'
    | 'resource'
    | 'other'
    | string;

export type GameConfigAbilityImplementationStatus =
    | 'implemented'
    | 'needs-code'
    | 'not-implemented';

export type GameConfigProposalStatus =
    | 'pending_ai_review'
    | 'ai_suggest_accept'
    | 'ai_suggest_reject'
    | 'needs_more_evidence'
    | 'needs_human_review'
    | 'needs_code_support'
    | 'accepted'
    | 'rejected'
    | 'closed';

export type GameConfigAiReviewOutcome =
    | 'suggest_accept'
    | 'suggest_reject'
    | 'needs_more_evidence'
    | 'needs_human_review'
    | 'needs_code_support';

export interface GameConfigMetadata {
    title: string;
    description?: string;
    locale?: string;
    minPlayers?: number;
    maxPlayers?: number;
    tags?: string[];
}

export interface GameConfigFaction {
    id: string;
    name: string;
    description?: string;
    assetRefs?: string[];
    data?: JsonObject;
}

export interface GameConfigAssetRef {
    id: string;
    path: string;
    kind?: string;
    locale?: string;
    description?: string;
}

export interface GameConfigAbilityBinding {
    abilityId: string;
    label?: string;
    description?: string;
    params?: JsonObject;
}

export interface GameConfigObject {
    id: string;
    objectType: GameConfigObjectType;
    name: string;
    factionId?: string;
    quantity?: number;
    cost?: JsonObject;
    stats?: JsonObject;
    tags?: string[];
    text?: string;
    abilities?: GameConfigAbilityBinding[];
    assetRefs?: string[];
    data?: JsonObject;
}

export interface GameConfigDeckEntry {
    objectId: string;
    count: number;
}

export interface GameConfigDeck {
    id: string;
    name: string;
    factionId?: string;
    entries: GameConfigDeckEntry[];
    data?: JsonObject;
}

export interface GameConfigStartingDeployment {
    objectId: string;
    owner?: string;
    location: string;
    count?: number;
    data?: JsonObject;
}

export interface GameConfigSetup {
    startingDecks?: string[];
    startingDeployment?: GameConfigStartingDeployment[];
    data?: JsonObject;
}

export interface GameConfigPackageSource {
    format?: GameConfigPackageFormat;
    sourceId?: string;
    loadedAt?: string;
}

export interface GameConfigPackage {
    schemaVersion: 1;
    gameId: string;
    packageVersion: string;
    metadata: GameConfigMetadata;
    factions?: GameConfigFaction[];
    assets?: GameConfigAssetRef[];
    objects: GameConfigObject[];
    decks?: GameConfigDeck[];
    setup?: GameConfigSetup;
    data?: JsonObject;
}

export type GameConfigValidationSeverity = 'error' | 'warning';

export interface GameConfigValidationIssue {
    path: string;
    code: string;
    message: string;
    severity: GameConfigValidationSeverity;
}

export interface GameConfigValidationResult {
    ok: boolean;
    issues: GameConfigValidationIssue[];
    package?: GameConfigPackage;
}

export type GameConfigParamType =
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'enum'
    | 'array'
    | 'object'
    | 'json';

export interface GameConfigAbilityParamSpec {
    type: GameConfigParamType;
    required?: boolean;
    values?: JsonPrimitive[];
    min?: number;
    max?: number;
    items?: GameConfigAbilityParamSpec;
}

export interface GameConfigAbilityDefinition {
    abilityId: string;
    implementationStatus: GameConfigAbilityImplementationStatus;
    params?: Record<string, GameConfigAbilityParamSpec>;
    allowExtraParams?: boolean;
}

export interface GameConfigValidationOptions {
    abilityCatalog?: Record<string, GameConfigAbilityDefinition>;
    knownAbilityIds?: Iterable<string>;
    allowUnimplementedAbilities?: boolean;
    requireAssetDefinitions?: boolean;
}

export interface GameConfigMaterializedPackage {
    package: GameConfigPackage;
    source?: GameConfigPackageSource;
    factionsById: ReadonlyMap<string, GameConfigFaction>;
    assetsById: ReadonlyMap<string, GameConfigAssetRef>;
    objectsById: ReadonlyMap<string, GameConfigObject>;
    decksById: ReadonlyMap<string, GameConfigDeck>;
}

export interface GameConfigReviewColumn {
    key: string;
    label: string;
}

export interface GameConfigReviewCell {
    key: string;
    label: string;
    fieldPath: string;
    value: JsonValue | undefined;
    displayValue: string;
    editable: boolean;
}

export interface GameConfigReviewRow {
    rowId: string;
    objectId: string;
    objectType: GameConfigObjectType;
    displayName: string;
    groupId?: string;
    cells: GameConfigReviewCell[];
}

export interface GameConfigReviewTable {
    tableId: string;
    gameId: string;
    packageVersion: string;
    source?: GameConfigPackageSource;
    columns: GameConfigReviewColumn[];
    rows: GameConfigReviewRow[];
}

export interface GameConfigProposalSourceContext {
    route?: string;
    tableId?: string;
    rowId?: string;
    cellKey?: string;
    language?: string;
    objectContext?: JsonObject;
}

export interface GameConfigAiReview {
    outcome: GameConfigAiReviewOutcome;
    summary: string;
    evidenceRefs?: string[];
    reviewedAt?: string;
}

export interface GameConfigPatchProposal {
    gameId: string;
    configVersion: string;
    objectId: string;
    objectType?: GameConfigObjectType;
    fieldPath: string;
    currentValue: JsonValue | undefined;
    suggestedValue: JsonValue;
    reason: string;
    evidence?: string;
    sourceContext?: GameConfigProposalSourceContext;
    status: GameConfigProposalStatus;
    aiReview?: GameConfigAiReview;
}
