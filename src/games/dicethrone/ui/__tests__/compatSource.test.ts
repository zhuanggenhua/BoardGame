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

    it('奖励骰右侧骰盘不应在 Board 层清空或隐藏卡牌特写队列', () => {
        const board = readUiSource('../Board.tsx');

        expect(board).toContain('cardSpotlightQueue={cardSpotlightQueue}');
        expect(board).not.toContain('suppressCardSpotlightForBonusDiceSurface');
        expect(board).not.toContain('handleCardSpotlightClose(item.id)');
    });

    it('交互提示期间应保留放大预览，并把阅读层级抬到提示之上', () => {
        const board = readUiSource('../Board.tsx');
        const boardOverlays = readUiSource('BoardOverlays.tsx');
        const interactionOverlay = readUiSource('InteractionOverlay.tsx');

        expect(board).toContain('const activeInteractionOverlayId = sysInteraction?.id ?? null');
        expect(board).toContain('magnifyZIndex={activeInteractionOverlayId ? UI_Z_INDEX.modalTooltip + 1 : undefined}');
        expect(board).toContain('allowPointerThrough: true');
        expect(board).toContain('allowBackgroundInteraction');
        expect(boardOverlays).toContain('zIndex={props.magnifyZIndex}');
        expect(interactionOverlay).toContain('allowBackgroundInteraction?: boolean');
        expect(interactionOverlay).toContain('allowBackgroundInteraction={allowBackgroundInteraction}');
    });

    it('CenterBoard tip 图应提供显式宽度，避免旧 WebView 丢失 aspect 类后横条化', () => {
        const centerBoard = readUiSource('CenterBoard.tsx');

        expect(centerBoard).toContain('width: `calc(${buildBoardShellInlineUnitValue(tipBoardHeightUnits)} * ${1311 / 2048})`');
        expect(centerBoard).not.toContain('aspect-[1311/2048]');
    });

    it('海盗双面玩家板应保留翻面动画，而不是直接硬切图片', () => {
        const centerBoard = readUiSource('CenterBoard.tsx');

        expect(centerBoard).toContain("const shouldAnimateBoardFlip = characterId === 'cursed_pirate'");
        expect(centerBoard).toContain("const true3DBoardFlipMotion = {");
        expect(centerBoard).toContain("rotateY: cursedPirateVisibleFace === 'normal' ? 0 : 180");
        expect(centerBoard).toContain("transform: 'rotateY(180deg)'");
        expect(centerBoard).toContain("perspective: '2200px'");
        expect(centerBoard).toContain("data-testid=\"player-board-face-shell\"");
    });

    it('玩家面板放大预览应提供显式宽高，避免旧 WebView 只剩横条', () => {
        const boardOverlays = readUiSource('BoardOverlays.tsx');

        expect(boardOverlays).toContain('const playerBoardPreviewWidth = `min(90vw, calc(90vh * ${playerBoardAspectRatio}))`');
        expect(boardOverlays).toContain('height: `calc(${playerBoardPreviewWidth} / ${playerBoardAspectRatio})`');
        expect(boardOverlays).toContain("? 'block w-full h-full object-contain'");
    });

    it('壳内固定操作控件应同时补偿视觉图标与命中区，避免整体 scale 后二次缩小', () => {
        const centerBoard = readUiSource('CenterBoard.tsx');
        const abilityOverlays = readUiSource('AbilityOverlays.tsx');
        const discardPile = readUiSource('DiscardPile.tsx');
        const drawDeck = readUiSource('DrawDeck.tsx');

        expect(centerBoard.match(/board-shell-fixed-icon/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(centerBoard).toContain('width: buildBoardShellScreenPixelValue(44)');
        expect(centerBoard).toContain('minWidth: buildBoardShellScreenPixelValue(44)');
        expect(abilityOverlays).toContain('className="board-shell-fixed-icon min-h-[8px] min-w-[8px] fill-current"');
        expect(abilityOverlays).toContain('width: buildBoardShellScreenPixelValue(44)');
        expect(discardPile).toContain('board-shell-fixed-icon');
        expect(discardPile).toContain('width: buildBoardShellScreenPixelValue(44)');
        expect(drawDeck).toContain('width: buildBoardShellScreenPixelValue(44)');
    });

    it('固定控件只放大 SVG，不放大圆形可视层', () => {
        const centerBoard = readUiSource('CenterBoard.tsx');
        const abilityOverlays = readUiSource('AbilityOverlays.tsx');
        const discardPile = readUiSource('DiscardPile.tsx');
        const drawDeck = readUiSource('DrawDeck.tsx');

        expect(centerBoard).toContain('data-fixed-control-visual="true"');
        expect(centerBoard).toContain('absolute top-0 right-0 flex items-center justify-center');
        expect(centerBoard).toContain('width: buildBoardShellInlineUnitValue(2.6)');
        expect(centerBoard).toContain('width: buildBoardShellInlineUnitValue(0.72)');
        expect(centerBoard).toContain('const tipBoardOverlayButtonStyle =');
        expect(centerBoard).toContain('top: buildBoardShellInlineUnitValue(0.25)');
        expect(centerBoard).toContain('right: buildBoardShellInlineUnitValue(0.25)');
        expect(abilityOverlays).toContain('data-fixed-control-visual="true"');
        expect(abilityOverlays).toContain('absolute top-0 right-0 flex items-center justify-center');
        expect(abilityOverlays).toContain('width: dtUnit(1.15)');
        expect(abilityOverlays).toContain('width: dtUnit(0.84)');
        expect(discardPile).toContain('width: dtUnit(2)');
        expect(discardPile).toContain('width: dtUnit(0.84)');
        expect(discardPile).toContain('absolute top-0 right-0 flex items-center justify-center');
        expect(drawDeck).toContain('width: buildBoardShellInlineUnitValue(2.2)');
        expect(drawDeck).toContain('data-fixed-control-visual="true"');
    });

    it('玩家面板与提示卡必须保持独立对象契约', () => {
        const centerBoard = readUiSource('CenterBoard.tsx');

        expect(centerBoard).toContain('data-testid="player-board-surface"');
        expect(centerBoard).toContain('data-testid="player-board-image"');
        expect(centerBoard).toContain('data-testid="player-board-magnify-button"');
        expect(centerBoard).toContain('data-tutorial-id="tip-board"');
        expect(centerBoard).toContain('data-testid="tip-board-surface"');
        expect(centerBoard).toContain('data-testid="tip-board-image"');
        expect(centerBoard).toContain('data-testid="tip-board-magnify-button"');
        expect(centerBoard).toContain("alt={t('imageAlt.tipBoard')}");
    });
});
