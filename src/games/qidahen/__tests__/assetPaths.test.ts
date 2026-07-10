import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { qidahenCriticalImageResolver } from '../criticalImageResolver';
import { QIDAHEN_MANIFEST } from '../manifest';

const REQUIRED_CARD_BACKS = [
    'qidahen/cards/backs/ming-deck-back',
    'qidahen/cards/backs/korea-deck-back',
    'qidahen/cards/backs/qidahen-common-card-back',
] as const;

const REQUIRED_WHEEL_MARKER = 'qidahen/markers/chronology-year-marker';

const FORBIDDEN_MISSING_CARD_BACKS = [
    'qidahen/cards/backs/ming-card-back',
    'qidahen/cards/backs/korea-card-back',
    'qidahen/cards/backs/qidahen-cover-card',
] as const;

const boardSource = readFileSync(resolve(__dirname, '..', 'Board.tsx'), 'utf8');

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

describe('七大恨牌背资源路径合同', () => {
    it('棋盘、游戏清单和关键图片预加载都引用同一组正式牌背', () => {
        const criticalImages = qidahenCriticalImageResolver(undefined).critical;

        for (const assetPath of REQUIRED_CARD_BACKS) {
            expect(boardSource).toContain(`'${assetPath}'`);
            expect(QIDAHEN_MANIFEST.criticalImages).toContain(assetPath);
            expect(criticalImages).toContain(assetPath);
        }
    });

    it('正式牌背必须存在压缩运行时文件，且旧的不存在路径不得回流', () => {
        for (const assetPath of REQUIRED_CARD_BACKS) {
            expect(existsSync(getCompressedAssetFile(assetPath))).toBe(true);
        }

        for (const missingPath of FORBIDDEN_MISSING_CARD_BACKS) {
            expect(boardSource).not.toContain(`'${missingPath}'`);
            expect(QIDAHEN_MANIFEST.criticalImages).not.toContain(missingPath);
            expect(qidahenCriticalImageResolver(undefined).critical).not.toContain(missingPath);
        }
    });
});

describe('七大恨轮盘行动标记资源路径合同', () => {
    it('棋盘和关键图片预加载必须使用正式轮盘行动标记', () => {
        const criticalImages = qidahenCriticalImageResolver(undefined).critical;

        expect(boardSource).toContain(`'${REQUIRED_WHEEL_MARKER}'`);
        expect(criticalImages).toContain(REQUIRED_WHEEL_MARKER);
        expect(existsSync(getCompressedAssetFile(REQUIRED_WHEEL_MARKER))).toBe(true);
    });
});
