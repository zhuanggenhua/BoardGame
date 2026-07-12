import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { qidahenCriticalImageResolver } from '../criticalImageResolver';
import { QIDAHEN_MANIFEST } from '../manifest';

const REQUIRED_CARD_BACKS = [
    'qidahen/cards/backs/ming-deck-back',
    'qidahen/cards/backs/mongol-deck-back',
    'qidahen/cards/backs/jin-deck-back',
    'qidahen/cards/backs/korea-deck-back',
    'qidahen/cards/backs/qidahen-common-card-back',
] as const;

const REQUIRED_WHEEL_MARKER = 'qidahen/markers/chronology-year-marker';

const REQUIRED_CARD_ATLASES = [
    'qidahen/cards/atlases/ming-faction-deck-atlas',
    'qidahen/cards/atlases/mongol-faction-deck-atlas',
    'qidahen/cards/atlases/jin-faction-deck-atlas',
    'qidahen/cards/atlases/korea-special-deck-atlas',
    'qidahen/cards/atlases/ordinary-hand-atlas05',
] as const;

const FORBIDDEN_CHRONOLOGY_ATLAS_ALIAS = 'qidahen/cards/atlases/chronology-deck-atlas';

const TTS_CONFIRMED_MARKERS = [
    'qidahen/markers/ming-control-diplomacy-marker-b',
    'qidahen/markers/mongol-control-diplomacy-marker-b',
    'qidahen/markers/jin-control-diplomacy-marker-b',
    'qidahen/markers/drought-marker',
    'qidahen/markers/battle-defeat-marker',
    'qidahen/markers/ruin-marker',
    'qidahen/markers/hanseong-victory-point-marker',
    'qidahen/markers/imperial-seal-victory-point-marker',
    'qidahen/markers/ming-score-marker',
    'qidahen/markers/mongol-score-marker',
    'qidahen/markers/jin-score-marker',
    'qidahen/markers/jin-homeland-marker',
    'qidahen/markers/mongol-homeland-marker',
] as const;

const TTS_CONFIRMED_UNITS = [
    'qidahen/units/ming-regular-infantry-unit',
    'qidahen/units/ming-regular-cavalry-unit',
    'qidahen/units/ming-regular-artillery-unit',
    'qidahen/units/ming-mercenary-infantry-unit',
    'qidahen/units/ming-mercenary-cavalry-unit',
    'qidahen/units/ming-mercenary-artillery-unit',
    'qidahen/units/ming-chuanbing-unit',
    'qidahen/units/mongol-regular-infantry-unit',
    'qidahen/units/mongol-regular-cavalry-unit',
    'qidahen/units/mongol-regular-artillery-unit',
    'qidahen/units/mongol-mercenary-infantry-unit',
    'qidahen/units/mongol-mercenary-cavalry-unit',
    'qidahen/units/jin-regular-infantry-unit',
    'qidahen/units/jin-regular-cavalry-unit',
    'qidahen/units/jin-regular-artillery-unit',
    'qidahen/units/jin-mercenary-infantry-unit',
    'qidahen/units/jin-mercenary-cavalry-unit',
    'qidahen/units/neutral-infantry-unit',
    'qidahen/units/neutral-cavalry-unit',
] as const;

const FORBIDDEN_MISSING_CARD_BACKS = [
    'qidahen/cards/backs/ming-card-back',
    'qidahen/cards/backs/mongol-card-back',
    'qidahen/cards/backs/jin-card-back',
    'qidahen/cards/backs/korea-card-back',
    'qidahen/cards/backs/qidahen-cover-card',
] as const;

const boardSource = readFileSync(resolve(__dirname, '..', 'Board.tsx'), 'utf8');
const qidahenAssetManifestSource = readFileSync(resolve(
    process.cwd(),
    'public/assets/i18n/zh-CN/qidahen/assets-manifest.json',
), 'utf8');
const i18nAssetManifestSource = readFileSync(resolve(
    process.cwd(),
    'public/assets/i18n/assets-manifest.json',
), 'utf8');

const getCompressedAssetFile = (assetPath: string): string => resolve(
    process.cwd(),
    'public',
    'assets',
    'i18n',
    'zh-CN',
    dirname(assetPath),
    'compressed',
    `${basename(assetPath)}.webp`,
);

const getSourceAssetFile = (assetPath: string, extension: string): string => resolve(
    process.cwd(),
    'public',
    'assets',
    'i18n',
    'zh-CN',
    `${assetPath}.${extension}`,
);

describe('七大恨牌背资源路径合同', () => {
    it('棋盘、游戏清单和关键图片预加载都引用同一组正式牌背', () => {
        const criticalImages = qidahenCriticalImageResolver(undefined).critical;

        for (const assetPath of REQUIRED_CARD_BACKS) {
            expect(boardSource).toContain(`'${assetPath}'`);
            expect([
                ...QIDAHEN_MANIFEST.criticalImages,
                ...(QIDAHEN_MANIFEST.warmImages ?? []),
            ]).toContain(assetPath);
            expect([
                ...criticalImages,
                ...qidahenCriticalImageResolver(undefined).warm,
            ]).toContain(assetPath);
        }
    });

    it('正式牌背必须存在压缩运行时文件，且旧的不存在路径不得回流', () => {
        for (const assetPath of REQUIRED_CARD_BACKS) {
            expect(existsSync(getCompressedAssetFile(assetPath))).toBe(true);
        }

        for (const missingPath of FORBIDDEN_MISSING_CARD_BACKS) {
            expect(boardSource).not.toContain(`'${missingPath}'`);
            expect(QIDAHEN_MANIFEST.criticalImages).not.toContain(missingPath);
            expect(QIDAHEN_MANIFEST.warmImages ?? []).not.toContain(missingPath);
            expect(qidahenCriticalImageResolver(undefined).critical).not.toContain(missingPath);
            expect(qidahenCriticalImageResolver(undefined).warm).not.toContain(missingPath);
        }
    });
});

describe('七大恨轮盘行动标记资源路径合同', () => {
    it('棋盘和关键图片预加载必须使用正式轮盘行动标记', () => {
        const criticalImages = qidahenCriticalImageResolver(undefined).critical;

        expect(boardSource).toContain(`'${REQUIRED_WHEEL_MARKER}'`);
        expect([
            ...QIDAHEN_MANIFEST.criticalImages,
            ...(QIDAHEN_MANIFEST.warmImages ?? []),
        ]).toContain(REQUIRED_WHEEL_MARKER);
        expect(criticalImages).toContain(REQUIRED_WHEEL_MARKER);
        expect(existsSync(getCompressedAssetFile(REQUIRED_WHEEL_MARKER))).toBe(true);
    });
});

describe('七大恨正式卡牌图集资源路径合同', () => {
    it('当前运行时会消费的卡牌图集应进入游戏清单和关键图片预加载', () => {
        const manifestImages = [
            ...QIDAHEN_MANIFEST.criticalImages,
            ...(QIDAHEN_MANIFEST.warmImages ?? []),
        ];
        const resolverImages = [
            ...qidahenCriticalImageResolver(undefined).critical,
            ...qidahenCriticalImageResolver(undefined).warm,
        ];

        for (const assetPath of REQUIRED_CARD_ATLASES) {
            expect(manifestImages).toContain(assetPath);
            expect(resolverImages).toContain(assetPath);
            expect(existsSync(getCompressedAssetFile(assetPath))).toBe(true);
        }
    });

    it('纪年卡路径不得再登记为普通手牌图集的重复别名', () => {
        const manifestImages = [
            ...QIDAHEN_MANIFEST.criticalImages,
            ...(QIDAHEN_MANIFEST.warmImages ?? []),
        ];
        const resolverImages = [
            ...qidahenCriticalImageResolver(undefined).critical,
            ...qidahenCriticalImageResolver(undefined).warm,
        ];

        expect(manifestImages).not.toContain(FORBIDDEN_CHRONOLOGY_ATLAS_ALIAS);
        expect(resolverImages).not.toContain(FORBIDDEN_CHRONOLOGY_ATLAS_ALIAS);
        expect(qidahenAssetManifestSource).not.toContain('chronology-deck-atlas');
        expect(i18nAssetManifestSource).not.toContain('chronology-deck-atlas');
        expect(existsSync(getSourceAssetFile(FORBIDDEN_CHRONOLOGY_ATLAS_ALIAS, 'jpg'))).toBe(false);
        expect(existsSync(getCompressedAssetFile(FORBIDDEN_CHRONOLOGY_ATLAS_ALIAS))).toBe(false);
    });
});

describe('七大恨 TTS 标记资源路径合同', () => {
    it('TTS 已确认的正式标记素材应进入游戏清单和预加载暖图', () => {
        const warmImages = qidahenCriticalImageResolver(undefined).warm;

        for (const assetPath of TTS_CONFIRMED_MARKERS) {
            expect(QIDAHEN_MANIFEST.warmImages ?? []).toContain(assetPath);
            expect(warmImages).toContain(assetPath);
            expect(existsSync(getCompressedAssetFile(assetPath))).toBe(true);
        }
    });
});

describe('七大恨 TTS 部队资源路径合同', () => {
    it('地图运行时可能显示的正式部队素材应进入游戏清单和预加载暖图', () => {
        const manifestImages = [
            ...QIDAHEN_MANIFEST.criticalImages,
            ...(QIDAHEN_MANIFEST.warmImages ?? []),
        ];
        const resolverImages = [
            ...qidahenCriticalImageResolver(undefined).critical,
            ...qidahenCriticalImageResolver(undefined).warm,
        ];

        for (const assetPath of TTS_CONFIRMED_UNITS) {
            expect(manifestImages).toContain(assetPath);
            expect(resolverImages).toContain(assetPath);
            expect(existsSync(getCompressedAssetFile(assetPath))).toBe(true);
        }
    });
});
