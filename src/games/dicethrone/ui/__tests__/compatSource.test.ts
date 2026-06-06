import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readUiSource = (relativePath: string) =>
    readFileSync(resolve(TEST_DIR, '..', relativePath), 'utf8');

describe('DiceThrone compatibility source guards', () => {
    it('角色选择卡应保留 3:4 padding/height 兜底，避免旧 WebView 塌高', () => {
        const heroSelection = readUiSource('HeroSelectionOverlay.tsx');
        const advancedSelection = readUiSource('DiceThroneHeroSelection.tsx');

        expect(heroSelection).toContain("paddingTop: `${100 / 0.75}%`");
        expect(heroSelection).toContain("aspectRatio: '3 / 4'");
        expect(advancedSelection).toContain("paddingTop: `${100 / 0.75}%`");
        expect(advancedSelection).toContain("aspectRatio: '3 / 4'");
    });

    it('局内卡牌放大与特写应保留显式高度计算', () => {
        const boardOverlays = readUiSource('BoardOverlays.tsx');
        const spotlightOverlay = readUiSource('CardSpotlightOverlay.tsx');
        const attackShowcase = readUiSource('AttackShowcaseOverlay.tsx');

        expect(boardOverlays).toContain("height: `calc(${magnifiedCardWidth} / 0.61)`");
        expect(boardOverlays).toContain("height: `calc(${magnifiedMultiCardWidth} / 0.61)`");
        expect(spotlightOverlay).toContain("height: `calc(${SPOTLIGHT_CARD_WIDTH} / ${SPOTLIGHT_CARD_ASPECT_RATIO})`");
        expect(attackShowcase).toContain('function buildCardFrameStyle');
    });

    it('CenterBoard tip 图应提供显式宽度，避免旧 WebView 丢失 aspect 类后横条化', () => {
        const centerBoard = readUiSource('CenterBoard.tsx');

        expect(centerBoard).toContain('width: `calc(${tipBoardHeightVw}vw * ${1311 / 2048})`');
        expect(centerBoard).not.toContain('aspect-[1311/2048]');
    });

    it('海盗双面玩家板应保留翻面动画，而不是直接硬切图片', () => {
        const centerBoard = readUiSource('CenterBoard.tsx');

        expect(centerBoard).toContain("const shouldAnimateBoardFlip = characterId === 'cursed_pirate'");
        expect(centerBoard).toContain('<AnimatePresence initial={false} mode="wait">');
        expect(centerBoard).toContain('rotateY: -92');
        expect(centerBoard).toContain("data-testid=\"player-board-face-shell\"");
    });

    it('玩家面板放大预览应提供显式宽高，避免旧 WebView 只剩横条', () => {
        const boardOverlays = readUiSource('BoardOverlays.tsx');

        expect(boardOverlays).toContain('const playerBoardPreviewWidth = `min(90vw, calc(90vh * ${playerBoardAspectRatio}))`');
        expect(boardOverlays).toContain('height: `calc(${playerBoardPreviewWidth} / ${playerBoardAspectRatio})`');
        expect(boardOverlays).toContain("? 'block w-full h-full object-contain'");
    });
});
