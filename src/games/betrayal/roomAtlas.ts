import type { CSSProperties } from 'react';
import {
    computeSpriteAspectRatio,
    computeSpriteImgStyle,
    generateUniformAtlasConfig,
    type SpriteAtlasConfig,
} from '../../engine/primitives/spriteAtlas';

export type BetrayalRoomTileVisual = {
    image: string;
    config: SpriteAtlasConfig;
    frameIndex: number;
};

export const BETRAYAL_ROOM_ATLAS_IMAGE_PATHS = [
    'betrayal/rooms/room-front-atlas',
    'betrayal/rooms/room-back-atlas',
    'betrayal/rooms/trophy-oubliette-atlas',
];

// @atlas-contract room-front-atlas.jpg 来自原始 6300x5400 房间正面图集，7 列 x 6 行，每格 900x900；坐标经总览分格人工核对。
const ROOM_FRONT_ATLAS = generateUniformAtlasConfig(6300, 5400, 6, 7);

// @atlas-contract room-back-atlas.jpg 来自原始 6300x5400 房间背面图集，7 列 x 6 行，每格 900x900；坐标经总览分格人工核对。
const ROOM_BACK_ATLAS = generateUniformAtlasConfig(6300, 5400, 6, 7);

// @atlas-contract trophy-oubliette-atlas.png 来自原始 1425x1426 双房间源，奖杯室位于左上 713x713 裁切框。
const TROPHY_OUBLIETTE_ATLAS: SpriteAtlasConfig = {
    imageW: 1425,
    imageH: 1426,
    frames: [
        {
            x: 0,
            y: 0,
            width: 713,
            height: 713,
        },
    ],
};

const buildRoomTileVisual = (
    image: string,
    config: SpriteAtlasConfig,
    frameIndex: number,
): BetrayalRoomTileVisual => ({
    image,
    config,
    frameIndex,
});

export const BETRAYAL_ROOM_TILE_VISUALS = {
    trophyRoom: buildRoomTileVisual('betrayal/rooms/trophy-oubliette-atlas', TROPHY_OUBLIETTE_ATLAS, 0),
    conservatory: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 7),
    bedroom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 31),
    attic: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 23),
    study: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 25),
    upperLanding: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 40),
    entranceHall: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 3),
    diningRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 11),
    foyer: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 4),
    backUpper: buildRoomTileVisual('betrayal/rooms/room-back-atlas', ROOM_BACK_ATLAS, 0),
    backGround: buildRoomTileVisual('betrayal/rooms/room-back-atlas', ROOM_BACK_ATLAS, 4),
    backBasement: buildRoomTileVisual('betrayal/rooms/room-back-atlas', ROOM_BACK_ATLAS, 13),
};

export function buildRoomAtlasImageStyle(visual: BetrayalRoomTileVisual): CSSProperties {
    const spriteStyle = computeSpriteImgStyle(visual.frameIndex, visual.config);
    return {
        width: spriteStyle.imgWidth,
        height: spriteStyle.imgHeight,
        maxWidth: 'none',
        transform: `translate(${spriteStyle.translateX}, ${spriteStyle.translateY})`,
        aspectRatio: computeSpriteAspectRatio(visual.frameIndex, visual.config),
    };
}
