import type {
    GameConfigAbilityDefinition,
    GameConfigAbilityParamSpec,
    GameConfigPackage,
    GameConfigValidationIssue,
    GameConfigValidationOptions,
    GameConfigValidationResult,
    JsonPrimitive,
    JsonValue,
} from './types';

const ID_PATTERN = /^[a-z0-9][a-z0-9:_-]*$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJsonValue(value: unknown): value is JsonValue {
    if (
        value === null
        || typeof value === 'string'
        || typeof value === 'boolean'
    ) {
        return true;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value);
    }
    if (Array.isArray(value)) {
        return value.every(isJsonValue);
    }
    if (isRecord(value)) {
        return Object.values(value).every(isJsonValue);
    }
    return false;
}

function issue(
    issues: GameConfigValidationIssue[],
    path: string,
    code: string,
    message: string,
    severity: GameConfigValidationIssue['severity'] = 'error',
): void {
    issues.push({ path, code, message, severity });
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function validateId(
    value: unknown,
    path: string,
    issues: GameConfigValidationIssue[],
): value is string {
    if (!isNonEmptyString(value)) {
        issue(issues, path, 'REQUIRED_STRING', 'must be a non-empty string');
        return false;
    }
    if (!ID_PATTERN.test(value)) {
        issue(issues, path, 'INVALID_ID', 'must start with lowercase letter or digit and use lowercase id characters');
        return false;
    }
    return true;
}

function validateOptionalPositiveInteger(
    value: unknown,
    path: string,
    issues: GameConfigValidationIssue[],
): void {
    if (value === undefined) {
        return;
    }
    if (!Number.isInteger(value) || Number(value) <= 0) {
        issue(issues, path, 'INVALID_POSITIVE_INTEGER', 'must be a positive integer');
    }
}

function validateOptionalStringArray(
    value: unknown,
    path: string,
    issues: GameConfigValidationIssue[],
): void {
    if (value === undefined) {
        return;
    }
    if (!Array.isArray(value)) {
        issue(issues, path, 'INVALID_STRING_ARRAY', 'must be an array of strings');
        return;
    }
    value.forEach((item, index) => {
        if (!isNonEmptyString(item)) {
            issue(issues, `${path}[${index}]`, 'INVALID_STRING_ARRAY_ITEM', 'must be a non-empty string');
        }
    });
}

function validateOptionalJsonObject(
    value: unknown,
    path: string,
    issues: GameConfigValidationIssue[],
): void {
    if (value === undefined) {
        return;
    }
    if (!isRecord(value) || !isJsonValue(value)) {
        issue(issues, path, 'INVALID_JSON_OBJECT', 'must be a JSON object');
    }
}

function addId(
    ids: Set<string>,
    id: string,
    path: string,
    issues: GameConfigValidationIssue[],
): void {
    if (ids.has(id)) {
        issue(issues, path, 'DUPLICATE_ID', `duplicate id "${id}"`);
        return;
    }
    ids.add(id);
}

function buildAbilityCatalog(options: GameConfigValidationOptions): Record<string, GameConfigAbilityDefinition> | undefined {
    const explicitCatalog = options.abilityCatalog;
    const knownIds = options.knownAbilityIds ? Array.from(options.knownAbilityIds) : [];
    if (!explicitCatalog && knownIds.length === 0) {
        return undefined;
    }

    const catalog: Record<string, GameConfigAbilityDefinition> = {};
    for (const [abilityId, def] of Object.entries(explicitCatalog ?? {})) {
        catalog[abilityId] = def;
    }
    for (const abilityId of knownIds) {
        if (!catalog[abilityId]) {
            catalog[abilityId] = {
                abilityId,
                implementationStatus: 'implemented',
            };
        }
    }
    return catalog;
}

function validateParamValue(
    value: unknown,
    path: string,
    spec: GameConfigAbilityParamSpec,
    issues: GameConfigValidationIssue[],
): void {
    if (value === undefined) {
        if (spec.required) {
            issue(issues, path, 'MISSING_ABILITY_PARAM', 'required ability param is missing');
        }
        return;
    }

    switch (spec.type) {
        case 'string':
            if (typeof value !== 'string') {
                issue(issues, path, 'INVALID_ABILITY_PARAM_TYPE', 'must be a string');
            }
            return;
        case 'number':
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                issue(issues, path, 'INVALID_ABILITY_PARAM_TYPE', 'must be a finite number');
                return;
            }
            if (spec.min !== undefined && value < spec.min) {
                issue(issues, path, 'ABILITY_PARAM_BELOW_MIN', `must be >= ${spec.min}`);
            }
            if (spec.max !== undefined && value > spec.max) {
                issue(issues, path, 'ABILITY_PARAM_ABOVE_MAX', `must be <= ${spec.max}`);
            }
            return;
        case 'integer':
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                issue(issues, path, 'INVALID_ABILITY_PARAM_TYPE', 'must be an integer');
                return;
            }
            if (spec.min !== undefined && value < spec.min) {
                issue(issues, path, 'ABILITY_PARAM_BELOW_MIN', `must be >= ${spec.min}`);
            }
            if (spec.max !== undefined && value > spec.max) {
                issue(issues, path, 'ABILITY_PARAM_ABOVE_MAX', `must be <= ${spec.max}`);
            }
            return;
        case 'boolean':
            if (typeof value !== 'boolean') {
                issue(issues, path, 'INVALID_ABILITY_PARAM_TYPE', 'must be a boolean');
            }
            return;
        case 'enum':
            if (!spec.values || spec.values.length === 0) {
                issue(issues, path, 'INVALID_ABILITY_PARAM_SCHEMA', 'enum params require values');
                return;
            }
            if (!spec.values.some((item: JsonPrimitive) => item === value)) {
                issue(issues, path, 'INVALID_ABILITY_PARAM_ENUM', `must be one of ${spec.values.join(', ')}`);
            }
            return;
        case 'array':
            if (!Array.isArray(value)) {
                issue(issues, path, 'INVALID_ABILITY_PARAM_TYPE', 'must be an array');
                return;
            }
            if (spec.items) {
                value.forEach((item, index) => validateParamValue(item, `${path}[${index}]`, spec.items!, issues));
            }
            return;
        case 'object':
            if (!isRecord(value)) {
                issue(issues, path, 'INVALID_ABILITY_PARAM_TYPE', 'must be an object');
                return;
            }
            if (!isJsonValue(value)) {
                issue(issues, path, 'INVALID_ABILITY_PARAM_JSON', 'must contain JSON values only');
            }
            return;
        case 'json':
            if (!isJsonValue(value)) {
                issue(issues, path, 'INVALID_ABILITY_PARAM_JSON', 'must be a JSON value');
            }
            return;
        default:
            issue(issues, path, 'UNKNOWN_ABILITY_PARAM_TYPE', `unknown param type "${String(spec.type)}"`);
    }
}

function validateAbilityParams(
    params: unknown,
    path: string,
    ability: GameConfigAbilityDefinition,
    issues: GameConfigValidationIssue[],
): void {
    if (params !== undefined && (!isRecord(params) || !isJsonValue(params))) {
        issue(issues, path, 'INVALID_ABILITY_PARAMS', 'ability params must be a JSON object');
        return;
    }

    const paramRecord = isRecord(params) ? params : {};
    const paramSpecs = ability.params ?? {};
    for (const [paramName, spec] of Object.entries(paramSpecs)) {
        validateParamValue(paramRecord[paramName], `${path}.${paramName}`, spec, issues);
    }
    if (!ability.allowExtraParams) {
        for (const paramName of Object.keys(paramRecord)) {
            if (!paramSpecs[paramName]) {
                issue(issues, `${path}.${paramName}`, 'UNKNOWN_ABILITY_PARAM', `unknown ability param "${paramName}"`);
            }
        }
    }
}

export function validateGameConfigPackage(
    value: unknown,
    options: GameConfigValidationOptions = {},
): GameConfigValidationResult {
    const issues: GameConfigValidationIssue[] = [];
    const abilityCatalog = buildAbilityCatalog(options);

    if (!isRecord(value)) {
        issue(issues, '$', 'INVALID_ROOT', 'game config package must be an object');
        return { ok: false, issues };
    }

    if (value.schemaVersion !== 1) {
        issue(issues, '$.schemaVersion', 'INVALID_SCHEMA_VERSION', 'schemaVersion must be 1');
    }
    if (!validateId(value.gameId, '$.gameId', issues)) {
        // Continue collecting other issues.
    }
    if (!isNonEmptyString(value.packageVersion)) {
        issue(issues, '$.packageVersion', 'REQUIRED_STRING', 'packageVersion is required');
    }
    if (!isRecord(value.metadata)) {
        issue(issues, '$.metadata', 'REQUIRED_OBJECT', 'metadata is required');
    } else {
        if (!isNonEmptyString(value.metadata.title)) {
            issue(issues, '$.metadata.title', 'REQUIRED_STRING', 'metadata.title is required');
        }
        validateOptionalPositiveInteger(value.metadata.minPlayers, '$.metadata.minPlayers', issues);
        validateOptionalPositiveInteger(value.metadata.maxPlayers, '$.metadata.maxPlayers', issues);
        validateOptionalStringArray(value.metadata.tags, '$.metadata.tags', issues);
    }
    validateOptionalJsonObject(value.data, '$.data', issues);

    const factionIds = new Set<string>();
    if (value.factions !== undefined) {
        if (!Array.isArray(value.factions)) {
            issue(issues, '$.factions', 'INVALID_ARRAY', 'factions must be an array');
        } else {
            value.factions.forEach((faction, index) => {
                const path = `$.factions[${index}]`;
                if (!isRecord(faction)) {
                    issue(issues, path, 'INVALID_OBJECT', 'faction must be an object');
                    return;
                }
                if (validateId(faction.id, `${path}.id`, issues)) {
                    addId(factionIds, faction.id, `${path}.id`, issues);
                }
                if (!isNonEmptyString(faction.name)) {
                    issue(issues, `${path}.name`, 'REQUIRED_STRING', 'faction.name is required');
                }
                validateOptionalStringArray(faction.assetRefs, `${path}.assetRefs`, issues);
                validateOptionalJsonObject(faction.data, `${path}.data`, issues);
            });
        }
    }

    const assetIds = new Set<string>();
    if (value.assets !== undefined) {
        if (!Array.isArray(value.assets)) {
            issue(issues, '$.assets', 'INVALID_ARRAY', 'assets must be an array');
        } else {
            value.assets.forEach((asset, index) => {
                const path = `$.assets[${index}]`;
                if (!isRecord(asset)) {
                    issue(issues, path, 'INVALID_OBJECT', 'asset must be an object');
                    return;
                }
                if (validateId(asset.id, `${path}.id`, issues)) {
                    addId(assetIds, asset.id, `${path}.id`, issues);
                }
                if (!isNonEmptyString(asset.path)) {
                    issue(issues, `${path}.path`, 'REQUIRED_STRING', 'asset.path is required');
                }
            });
        }
    }

    const objectIds = new Set<string>();
    if (!Array.isArray(value.objects)) {
        issue(issues, '$.objects', 'REQUIRED_ARRAY', 'objects must be an array');
    } else {
        value.objects.forEach((object, index) => {
            const path = `$.objects[${index}]`;
            if (!isRecord(object)) {
                issue(issues, path, 'INVALID_OBJECT', 'config object must be an object');
                return;
            }
            if (validateId(object.id, `${path}.id`, issues)) {
                addId(objectIds, object.id, `${path}.id`, issues);
            }
            if (!isNonEmptyString(object.objectType)) {
                issue(issues, `${path}.objectType`, 'REQUIRED_STRING', 'objectType is required');
            }
            if (!isNonEmptyString(object.name)) {
                issue(issues, `${path}.name`, 'REQUIRED_STRING', 'name is required');
            }
            if (object.factionId !== undefined) {
                if (validateId(object.factionId, `${path}.factionId`, issues) && value.factions !== undefined && !factionIds.has(object.factionId)) {
                    issue(issues, `${path}.factionId`, 'UNKNOWN_FACTION_ID', `unknown factionId "${object.factionId}"`);
                }
            }
            validateOptionalPositiveInteger(object.quantity, `${path}.quantity`, issues);
            validateOptionalJsonObject(object.cost, `${path}.cost`, issues);
            validateOptionalJsonObject(object.stats, `${path}.stats`, issues);
            validateOptionalStringArray(object.tags, `${path}.tags`, issues);
            validateOptionalStringArray(object.assetRefs, `${path}.assetRefs`, issues);
            validateOptionalJsonObject(object.data, `${path}.data`, issues);

            if (Array.isArray(object.assetRefs)) {
                object.assetRefs.forEach((assetId, assetIndex) => {
                    if (typeof assetId !== 'string') {
                        return;
                    }
                    if (value.assets !== undefined && !assetIds.has(assetId)) {
                        issue(issues, `${path}.assetRefs[${assetIndex}]`, 'UNKNOWN_ASSET_REF', `unknown assetRef "${assetId}"`);
                    }
                    if (value.assets === undefined && options.requireAssetDefinitions) {
                        issue(issues, `${path}.assetRefs[${assetIndex}]`, 'MISSING_ASSET_DEFINITIONS', `assetRef "${assetId}" has no package assets list`);
                    }
                });
            }

            if (object.abilities !== undefined) {
                if (!Array.isArray(object.abilities)) {
                    issue(issues, `${path}.abilities`, 'INVALID_ARRAY', 'abilities must be an array');
                } else {
                    object.abilities.forEach((binding, abilityIndex) => {
                        const abilityPath = `${path}.abilities[${abilityIndex}]`;
                        if (!isRecord(binding)) {
                            issue(issues, abilityPath, 'INVALID_OBJECT', 'ability binding must be an object');
                            return;
                        }
                        if (!isNonEmptyString(binding.abilityId)) {
                            issue(issues, `${abilityPath}.abilityId`, 'REQUIRED_STRING', 'abilityId is required');
                            return;
                        }
                        if (!abilityCatalog) {
                            validateOptionalJsonObject(binding.params, `${abilityPath}.params`, issues);
                            return;
                        }
                        const ability = abilityCatalog[binding.abilityId];
                        if (!ability) {
                            issue(issues, `${abilityPath}.abilityId`, 'UNKNOWN_ABILITY_ID', `unknown abilityId "${binding.abilityId}"`);
                            return;
                        }
                        if (
                            !options.allowUnimplementedAbilities
                            && ability.implementationStatus !== 'implemented'
                        ) {
                            issue(
                                issues,
                                `${abilityPath}.abilityId`,
                                'ABILITY_NEEDS_CODE',
                                `ability "${binding.abilityId}" is ${ability.implementationStatus}`,
                            );
                        }
                        validateAbilityParams(binding.params, `${abilityPath}.params`, ability, issues);
                    });
                }
            }
        });
    }

    const deckIds = new Set<string>();
    if (value.decks !== undefined) {
        if (!Array.isArray(value.decks)) {
            issue(issues, '$.decks', 'INVALID_ARRAY', 'decks must be an array');
        } else {
            value.decks.forEach((deck, index) => {
                const path = `$.decks[${index}]`;
                if (!isRecord(deck)) {
                    issue(issues, path, 'INVALID_OBJECT', 'deck must be an object');
                    return;
                }
                if (validateId(deck.id, `${path}.id`, issues)) {
                    addId(deckIds, deck.id, `${path}.id`, issues);
                }
                if (!isNonEmptyString(deck.name)) {
                    issue(issues, `${path}.name`, 'REQUIRED_STRING', 'deck.name is required');
                }
                if (deck.factionId !== undefined && validateId(deck.factionId, `${path}.factionId`, issues) && value.factions !== undefined && !factionIds.has(deck.factionId)) {
                    issue(issues, `${path}.factionId`, 'UNKNOWN_FACTION_ID', `unknown factionId "${deck.factionId}"`);
                }
                if (!Array.isArray(deck.entries)) {
                    issue(issues, `${path}.entries`, 'REQUIRED_ARRAY', 'deck.entries must be an array');
                    return;
                }
                deck.entries.forEach((entry, entryIndex) => {
                    const entryPath = `${path}.entries[${entryIndex}]`;
                    if (!isRecord(entry)) {
                        issue(issues, entryPath, 'INVALID_OBJECT', 'deck entry must be an object');
                        return;
                    }
                    if (validateId(entry.objectId, `${entryPath}.objectId`, issues) && !objectIds.has(entry.objectId)) {
                        issue(issues, `${entryPath}.objectId`, 'UNKNOWN_OBJECT_ID', `unknown objectId "${entry.objectId}"`);
                    }
                    validateOptionalPositiveInteger(entry.count, `${entryPath}.count`, issues);
                });
                validateOptionalJsonObject(deck.data, `${path}.data`, issues);
            });
        }
    }

    if (value.setup !== undefined) {
        if (!isRecord(value.setup)) {
            issue(issues, '$.setup', 'INVALID_OBJECT', 'setup must be an object');
        } else {
            validateOptionalStringArray(value.setup.startingDecks, '$.setup.startingDecks', issues);
            if (Array.isArray(value.setup.startingDecks)) {
                value.setup.startingDecks.forEach((deckId, index) => {
                    if (typeof deckId === 'string' && value.decks !== undefined && !deckIds.has(deckId)) {
                        issue(issues, `$.setup.startingDecks[${index}]`, 'UNKNOWN_DECK_ID', `unknown deck id "${deckId}"`);
                    }
                });
            }
            if (value.setup.startingDeployment !== undefined) {
                if (!Array.isArray(value.setup.startingDeployment)) {
                    issue(issues, '$.setup.startingDeployment', 'INVALID_ARRAY', 'startingDeployment must be an array');
                } else {
                    value.setup.startingDeployment.forEach((deployment, index) => {
                        const path = `$.setup.startingDeployment[${index}]`;
                        if (!isRecord(deployment)) {
                            issue(issues, path, 'INVALID_OBJECT', 'startingDeployment item must be an object');
                            return;
                        }
                        if (validateId(deployment.objectId, `${path}.objectId`, issues) && !objectIds.has(deployment.objectId)) {
                            issue(issues, `${path}.objectId`, 'UNKNOWN_OBJECT_ID', `unknown objectId "${deployment.objectId}"`);
                        }
                        if (!isNonEmptyString(deployment.location)) {
                            issue(issues, `${path}.location`, 'REQUIRED_STRING', 'location is required');
                        }
                        validateOptionalPositiveInteger(deployment.count, `${path}.count`, issues);
                        validateOptionalJsonObject(deployment.data, `${path}.data`, issues);
                    });
                }
            }
            validateOptionalJsonObject(value.setup.data, '$.setup.data', issues);
        }
    }

    const ok = !issues.some((item) => item.severity === 'error');
    return {
        ok,
        issues,
        package: ok ? value as unknown as GameConfigPackage : undefined,
    };
}
