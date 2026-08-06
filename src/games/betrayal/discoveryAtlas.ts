import type { CSSProperties } from 'react';
import {
    computeSpriteImgStyle,
    type SpriteAtlasConfig,
} from '../../engine/primitives/spriteAtlas';
import type { BetrayalDeckKind, BetrayalDiscoverySummary, BetrayalInventoryCard } from './game';
import {
    buildPossessionAtlasImageStyle,
    resolvePossessionAtlasVisual,
    type BetrayalPossessionAtlasVisual,
} from './possessionAtlas';

export type BetrayalDiscoveryAtlasVisual = {
    image: string;
    config: SpriteAtlasConfig;
    frameIndex: number;
};

// @atlas-contract event-front-atlas.jpg is a 9x5 single-card grid.
// Source size is 6076x6376, so the final column/row carries the 1px remainder.
// Do not distribute that remainder into middle rows/columns: it shifts later frames.
export const EVENT_FRONT_ATLAS: SpriteAtlasConfig = {
    imageW: 6076,
    imageH: 6376,
    cols: 9,
    rows: 5,
    colStarts: [0, 675, 1350, 2025, 2700, 3375, 4050, 4725, 5400],
    colWidths: [675, 675, 675, 675, 675, 675, 675, 675, 676],
    rowStarts: [0, 1275, 2550, 3825, 5100],
    rowHeights: [1275, 1275, 1275, 1275, 1276],
};

export const EVENT_FRONT_ATLAS_IMAGE_PATHS = [
    'betrayal/cards/event-front-atlas',
];

export const EVENT_FRONT_FRAME_BY_TITLE: Record<string, number> = {
    标本剥制: 0,
    不可能的房间: 1,
    磁带播放器: 2,
    大宅饿了: 3,
    地狱蝙蝠: 4,
    电话铃声: 5,
    吊死鬼: 6,
    断手: 7,
    嘎吱的木门: 8,
    怪异的镜子: 9,
    花团锦簇: 10,
    晦暗暴风夜: 11,
    技术难点: 12,
    佳馔满桌: 13,
    禁忌知识: 14,
    可怜的尤里克: 15,
    轮到约拿了: 16,
    秘密升降机: 17,
    脑状食品: 18,
    片刻希望: 19,
    肉质苔癣: 20,
    上古旧宅: 21,
    神秘液体: 22,
    '说“茄子”！': 23,
    外星几何: 24,
    无线电广播: 25,
    小丑房间: 26,
    小机器人: 27,
    摇曳灯光: 28,
    '咬一口！': 29,
    夜幕众星: 30,
    一罐器官: 31,
    一抹鲜红: 32,
    一瓶微尘: 33,
    一声呼救: 34,
    一条秘密通道: 35,
    一种怪异的感觉: 36,
    游魂: 37,
    '在你背后！': 38,
    葬礼: 39,
    着火的人: 40,
    '蜘蛛！': 41,
    最深的壁橱: 42,
};

const buildEventVisual = (frameIndex: number): BetrayalDiscoveryAtlasVisual => ({
    image: 'betrayal/cards/event-front-atlas',
    config: EVENT_FRONT_ATLAS,
    frameIndex,
});

export function resolveDiscoveryAtlasVisual(
    discovery: BetrayalDiscoverySummary | null,
    inventoryCards: BetrayalInventoryCard[],
): BetrayalDiscoveryAtlasVisual | BetrayalPossessionAtlasVisual | null {
    if (!discovery) return null;
    if (discovery.kind === 'event') {
        const frameIndex = EVENT_FRONT_FRAME_BY_TITLE[discovery.title];
        return typeof frameIndex === 'number' ? buildEventVisual(frameIndex) : null;
    }
    if (discovery.kind === 'none') {
        return null;
    }
    const matchingCard = resolveLatestMatchingInventoryCard(discovery.kind, discovery.title, inventoryCards);
    return matchingCard ? resolvePossessionAtlasVisual(matchingCard) : null;
}

export function buildDiscoveryAtlasImageStyle(
    visual: BetrayalDiscoveryAtlasVisual | BetrayalPossessionAtlasVisual,
): CSSProperties & { aspectRatio: number } {
    if (visual.image === 'betrayal/cards/item-front-atlas' || visual.image === 'betrayal/cards/omen-front-atlas') {
        return buildPossessionAtlasImageStyle(visual as BetrayalPossessionAtlasVisual);
    }
    const spriteStyle = computeSpriteImgStyle(visual.frameIndex, visual.config);
    return {
        width: spriteStyle.imgWidth,
        height: spriteStyle.imgHeight,
        maxWidth: 'none',
        transform: `translate(${spriteStyle.translateX}, ${spriteStyle.translateY})`,
        aspectRatio: spriteStyle.aspectRatio,
    };
}

function resolveLatestMatchingInventoryCard(
    kind: Exclude<BetrayalDeckKind, 'event'>,
    title: string,
    inventoryCards: BetrayalInventoryCard[],
): BetrayalInventoryCard | null {
    for (let index = inventoryCards.length - 1; index >= 0; index -= 1) {
        const card = inventoryCards[index];
        if (card?.kind === kind && card.name === title) {
            return card;
        }
    }
    return null;
}
