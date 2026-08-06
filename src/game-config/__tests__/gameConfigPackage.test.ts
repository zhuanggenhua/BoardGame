import { describe, expect, it } from 'vitest';
import {
    buildGameConfigReviewTable,
    createGameConfigPatchProposal,
    loadGameConfigPackageFromText,
    materializeGameConfigPackage,
    parseGameConfigPackageText,
    validateGameConfigPackage,
    validateGameConfigPatchProposal,
    type GameConfigAbilityDefinition,
    type GameConfigPackage,
} from '..';

const abilityCatalog: Record<string, GameConfigAbilityDefinition> = {
    ranged_attack: {
        abilityId: 'ranged_attack',
        implementationStatus: 'implemented',
        params: {
            range: { type: 'integer', required: true, min: 1 },
        },
    },
    needs_custom_code: {
        abilityId: 'needs_custom_code',
        implementationStatus: 'needs-code',
    },
};

function validPackage(overrides: Partial<GameConfigPackage> = {}): GameConfigPackage {
    return {
        schemaVersion: 1,
        gameId: 'samplegame',
        packageVersion: '2026.07.30',
        metadata: {
            title: '样例游戏',
            minPlayers: 2,
            maxPlayers: 2,
        },
        factions: [
            { id: 'vanguard', name: '先锋军' },
        ],
        assets: [
            { id: 'archer-card', path: 'samplegame/cards/archer' },
        ],
        objects: [
            {
                id: 'archer',
                objectType: 'unit',
                name: '弓箭手',
                factionId: 'vanguard',
                quantity: 3,
                stats: { attack: 2, hp: 1 },
                tags: ['ranged'],
                abilities: [
                    { abilityId: 'ranged_attack', params: { range: 3 } },
                ],
                assetRefs: ['archer-card'],
            },
        ],
        decks: [
            {
                id: 'vanguard-deck',
                name: '先锋军牌组',
                factionId: 'vanguard',
                entries: [
                    { objectId: 'archer', count: 3 },
                ],
            },
        ],
        setup: {
            startingDecks: ['vanguard-deck'],
            startingDeployment: [
                { objectId: 'archer', location: 'home-row', count: 1 },
            ],
        },
        ...overrides,
    };
}

describe('game-config package validation', () => {
    it('loads strict JSON, validates ability params, and materializes review rows from one source', () => {
        const json = JSON.stringify(validPackage());

        const materialized = loadGameConfigPackageFromText(json, {
            sourceId: 'samplegame.config.json',
            abilityCatalog,
        });
        const table = buildGameConfigReviewTable(materialized);

        expect(materialized.objectsById.get('archer')?.name).toBe('弓箭手');
        expect(table.rows).toHaveLength(1);
        expect(table.rows[0].cells.find((cell) => cell.key === 'stats')?.fieldPath).toBe('objects[archer].stats');
        expect(table.source?.sourceId).toBe('samplegame.config.json');
    });

    it('rejects commented JSON-like text because the official source is strict JSON', () => {
        const jsonWithComments = `{
            // Comments and trailing commas belong in import tools, not the official source.
            "schemaVersion": 1,
            "gameId": "samplegame",
            "packageVersion": "2026.07.30",
            "metadata": { "title": "样例游戏" },
            "objects": [],
        }`;

        const result = parseGameConfigPackageText(jsonWithComments, {
            sourceId: 'samplegame.config.json',
            abilityCatalog,
        });

        expect(result.ok).toBe(false);
        expect(result.issues[0].code).toBe('CONFIG_PARSE_ERROR');
    });

    it('rejects duplicate ids, broken references, and invalid ability params with field paths', () => {
        const pkg = validPackage({
            assets: [],
            objects: [
                {
                    id: 'archer',
                    objectType: 'unit',
                    name: '弓箭手',
                    factionId: 'missing-faction',
                    abilities: [{ abilityId: 'ranged_attack', params: { range: 0, extra: true } }],
                    assetRefs: ['missing-asset'],
                },
                {
                    id: 'archer',
                    objectType: 'unit',
                    name: '重名弓箭手',
                },
            ],
            decks: [{
                id: 'bad-deck',
                name: '坏牌组',
                entries: [{ objectId: 'missing-card', count: 1 }],
            }],
        });

        const result = validateGameConfigPackage(pkg, { abilityCatalog });
        const codes = result.issues.map((issue) => issue.code);

        expect(result.ok).toBe(false);
        expect(codes).toContain('DUPLICATE_ID');
        expect(codes).toContain('UNKNOWN_FACTION_ID');
        expect(codes).toContain('UNKNOWN_ASSET_REF');
        expect(codes).toContain('ABILITY_PARAM_BELOW_MIN');
        expect(codes).toContain('UNKNOWN_ABILITY_PARAM');
        expect(codes).toContain('UNKNOWN_OBJECT_ID');
        expect(result.issues.some((issue) => issue.path.includes('objects[0].abilities[0].params.range'))).toBe(true);
    });

    it('reports abilities that need code support instead of treating data as executable behavior', () => {
        const pkg = validPackage({
            objects: [{
                id: 'specialist',
                objectType: 'unit',
                name: '特技兵',
                abilities: [{ abilityId: 'needs_custom_code' }],
            }],
        });

        const result = validateGameConfigPackage(pkg, { abilityCatalog });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'ABILITY_NEEDS_CODE' }),
        ]));
    });
});

describe('game-config patch proposals', () => {
    it('creates field-level proposals with a pending AI review status', () => {
        const materialized = materializeGameConfigPackage(validPackage(), { abilityCatalog });
        const proposal = createGameConfigPatchProposal({
            gameId: 'samplegame',
            configVersion: '2026.07.30',
            objectId: 'archer',
            objectType: 'unit',
            fieldPath: 'objects[archer].stats',
            currentValue: { attack: 2, hp: 1 },
            suggestedValue: { attack: 2, hp: 2 },
            reason: '规则卡牌显示生命值为 2。',
            evidence: '规则书第 4 页',
            sourceContext: {
                tableId: 'samplegame@2026.07.30:objects',
                rowId: 'unit:archer',
                cellKey: 'stats',
                language: 'zh-CN',
            },
        });
        const result = validateGameConfigPatchProposal(proposal, { materialized });

        expect(proposal.status).toBe('pending_ai_review');
        expect(result.ok).toBe(true);
        expect(result.proposal?.fieldPath).toBe('objects[archer].stats');
    });

    it('rejects proposals that target executable code fields or the wrong object row', () => {
        const materialized = materializeGameConfigPackage(validPackage(), { abilityCatalog });
        const result = validateGameConfigPatchProposal({
            gameId: 'samplegame',
            configVersion: '2026.07.30',
            objectId: 'archer',
            fieldPath: 'objects[other].abilities[0].executorCode',
            currentValue: null,
            suggestedValue: 'return hacked;',
            reason: '尝试提交代码',
        }, { materialized });

        expect(result.ok).toBe(false);
        expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
            'FORBIDDEN_PATCH_PATH',
            'FIELD_PATH_OBJECT_MISMATCH',
        ]));
    });
});
