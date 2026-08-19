import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readUiSource = (relativePath: string) =>
    readFileSync(resolve(TEST_DIR, '..', relativePath), 'utf8');

describe('SummonerWars compatibility source guards', () => {
    it('CardSprite 应提供 padding 比例盒兜底，避免旧 WebView 因 aspect-ratio 失效塌高', () => {
        const cardSprite = readUiSource('CardSprite.tsx');

        expect(cardSprite).toContain('const ratioPaddingTop = `${100 / spriteStyle.aspectRatio}%`;');
        expect(cardSprite).toContain('height: 0,');
        expect(cardSprite).toContain('paddingTop: ratioPaddingTop,');
    });

    it('主要放大预览入口应改为宽驱动显式尺寸，而不是只给高度', () => {
        const board = readUiSource('../Board.tsx');
        const factionSelection = readUiSource('FactionSelectionAdapter.tsx');
        const cardPoolPanel = readUiSource('deckbuilder/CardPoolPanel.tsx');
        const myDeckPanel = readUiSource('deckbuilder/MyDeckPanel.tsx');

        expect(board).toContain("width: `min(90vw, max(40vw, calc(75vh * ${SUMMONER_WARS_CARD_ASPECT_RATIO})))`");
        expect(factionSelection).toContain("width: `min(90vw, max(${magnifySpriteMinWidthPx}px, calc(80vh * ${SUMMONER_WARS_CARD_ASPECT_RATIO})))`");
        expect(cardPoolPanel).toContain("width: `min(90vw, calc(75vh * ${SUMMONER_WARS_CARD_ASPECT_RATIO}))`");
        expect(myDeckPanel).toContain("width: `min(90vw, calc(75vh * ${SUMMONER_WARS_CARD_ASPECT_RATIO}))`");
    });

    it('局内摧毁与受击效果层也应保留比例盒兜底', () => {
        const destroyEffect = readUiSource('DestroyEffect.tsx');
        const fxSetup = readUiSource('fxSetup.ts');

        expect(destroyEffect).toContain('paddingTop: CARD_PADDING_TOP,');
        expect(fxSetup).toContain('paddingTop: CARD_PADDING_TOP,');
    });

    it('召唤光柱应保留 Summoner Wars 旧 cell 空间直连，不走共享召唤 preset', () => {
        const fxSetup = readUiSource('fxSetup.ts');

        expect(fxSetup).toContain("import { SummonEffect } from '../../../components/common/animations/SummonEffect';");
        expect(fxSetup).not.toContain('BoardSummonEffectPreset');
        expect(fxSetup).not.toContain('SummonHybridEffect');
        expect(fxSetup).toContain('const scale = 7.5;');
        expect(fxSetup).toContain('const box = createFxScaledCellBox(pos, scale);');
        expect(fxSetup).toContain('React.createElement(SummonEffect, {');
        expect(fxSetup).toContain('originY: 0.5,');
        expect(fxSetup).not.toContain('anchorSnapshot');
    });

    it('BoardGrid 充能圆点应使用正方形 padding 兜底，而不是只依赖 aspect-ratio 或 aspect-square', () => {
        const boardGrid = readUiSource('BoardGrid.tsx');

        expect(boardGrid).toContain('const UNIT_CHARGE_MARKER_DOT_STYLE: React.CSSProperties = {');
        expect(boardGrid).toContain('height: 0,');
        expect(boardGrid).toContain("paddingTop: '16%',");
        expect(boardGrid).not.toContain("aspectRatio: '1 / 1'");
        expect(boardGrid).not.toContain('w-[15%] aspect-square');
    });

    it('选派系全屏容器应使用 runtime viewport 变量，而不是直接依赖 h-screen', () => {
        const factionSelection = readUiSource('FactionSelectionAdapter.tsx');

        expect(factionSelection).toContain("height: 'var(--runtime-viewport-height, 100vh)'");
        expect(factionSelection).not.toContain('w-screen h-screen');
    });
});
