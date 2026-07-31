import type {
    GameConfigAssetRef,
    GameConfigDeck,
    GameConfigFaction,
    GameConfigMaterializedPackage,
    GameConfigObject,
    GameConfigPackage,
    GameConfigPackageSource,
    GameConfigReviewCell,
    GameConfigReviewColumn,
    GameConfigReviewRow,
    GameConfigReviewTable,
    GameConfigValidationIssue,
    GameConfigValidationOptions,
    JsonValue,
} from './types';
import { isJsonValue, validateGameConfigPackage } from './validation';

export class GameConfigPackageError extends Error {
    readonly issues: GameConfigValidationIssue[];

    constructor(message: string, issues: GameConfigValidationIssue[]) {
        super(message);
        this.name = 'GameConfigPackageError';
        this.issues = issues;
    }
}

export interface MaterializeGameConfigPackageOptions extends GameConfigValidationOptions {
    source?: GameConfigPackageSource;
    skipValidation?: boolean;
}

function mapById<TItem extends { id: string }>(items: readonly TItem[] | undefined): ReadonlyMap<string, TItem> {
    return new Map((items ?? []).map((item) => [item.id, item]));
}

function readHiddenSource(pkg: GameConfigPackage): GameConfigPackageSource | undefined {
    const withSource = pkg as unknown as { __source?: GameConfigPackageSource };
    return withSource.__source;
}

export function materializeGameConfigPackage(
    pkg: GameConfigPackage,
    options: MaterializeGameConfigPackageOptions = {},
): GameConfigMaterializedPackage {
    if (!options.skipValidation) {
        const result = validateGameConfigPackage(pkg, options);
        if (!result.ok) {
            throw new GameConfigPackageError('game config package validation failed', result.issues);
        }
    }

    return {
        package: pkg,
        source: options.source ?? readHiddenSource(pkg),
        factionsById: mapById<GameConfigFaction>(pkg.factions),
        assetsById: mapById<GameConfigAssetRef>(pkg.assets),
        objectsById: mapById<GameConfigObject>(pkg.objects),
        decksById: mapById<GameConfigDeck>(pkg.decks),
    };
}

const REVIEW_COLUMNS: GameConfigReviewColumn[] = [
    { key: 'objectType', label: '类型' },
    { key: 'id', label: '对象 ID' },
    { key: 'name', label: '名称' },
    { key: 'factionId', label: '派系' },
    { key: 'quantity', label: '数量' },
    { key: 'cost', label: '费用' },
    { key: 'stats', label: '属性' },
    { key: 'tags', label: '标签' },
    { key: 'text', label: '规则文本' },
    { key: 'abilities', label: '能力绑定' },
    { key: 'assetRefs', label: '素材引用' },
    { key: 'data', label: '扩展数据' },
];

function displayValue(value: JsonValue | undefined): string {
    if (value === undefined) {
        return '';
    }
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return JSON.stringify(value);
}

function cell(
    objectId: string,
    key: string,
    label: string,
    value: unknown,
    editable = true,
): GameConfigReviewCell {
    const jsonValue = value === undefined
        ? undefined
        : isJsonValue(value) ? value : String(value);
    return {
        key,
        label,
        fieldPath: `objects[${objectId}].${key}`,
        value: jsonValue,
        displayValue: displayValue(jsonValue),
        editable,
    };
}

function objectToReviewRow(object: GameConfigObject): GameConfigReviewRow {
    return {
        rowId: `${object.objectType}:${object.id}`,
        objectId: object.id,
        objectType: object.objectType,
        displayName: object.name,
        groupId: object.factionId,
        cells: [
            cell(object.id, 'objectType', '类型', object.objectType, false),
            cell(object.id, 'id', '对象 ID', object.id, false),
            cell(object.id, 'name', '名称', object.name),
            cell(object.id, 'factionId', '派系', object.factionId),
            cell(object.id, 'quantity', '数量', object.quantity),
            cell(object.id, 'cost', '费用', object.cost),
            cell(object.id, 'stats', '属性', object.stats),
            cell(object.id, 'tags', '标签', object.tags),
            cell(object.id, 'text', '规则文本', object.text),
            cell(object.id, 'abilities', '能力绑定', object.abilities),
            cell(object.id, 'assetRefs', '素材引用', object.assetRefs),
            cell(object.id, 'data', '扩展数据', object.data),
        ],
    };
}

export function buildGameConfigReviewTable(
    materialized: GameConfigMaterializedPackage,
): GameConfigReviewTable {
    return {
        tableId: `${materialized.package.gameId}@${materialized.package.packageVersion}:objects`,
        gameId: materialized.package.gameId,
        packageVersion: materialized.package.packageVersion,
        source: materialized.source,
        columns: REVIEW_COLUMNS,
        rows: materialized.package.objects.map(objectToReviewRow),
    };
}
