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
    'betrayal/rooms/start-triple-room',
    'betrayal/rooms/start-upper-landing',
    'betrayal/rooms/start-basement-landing',
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

// @atlas-contract start-triple-room.png 来自 TTS 原始起始三联板，尺寸 2943x969；按左中右三段等宽裁为 Ground Floor Staircase / Hallway / Entrance Hall。
const START_TRIPLE_ROOM_ATLAS = generateUniformAtlasConfig(2943, 969, 1, 3);

// @atlas-contract start-upper-landing.jpg 来自 TTS 原始 Upper Landing 单图，尺寸 900x900，全图单帧。
const START_UPPER_LANDING_ATLAS = generateUniformAtlasConfig(900, 900, 1, 1);

// @atlas-contract start-basement-landing.jpg 来自 TTS 原始 Basement Landing 单图，尺寸 900x900，全图单帧。
const START_BASEMENT_LANDING_ATLAS = generateUniformAtlasConfig(900, 900, 1, 1);

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
    startGroundFloorStaircase: buildRoomTileVisual('betrayal/rooms/start-triple-room', START_TRIPLE_ROOM_ATLAS, 0),
    startHallway: buildRoomTileVisual('betrayal/rooms/start-triple-room', START_TRIPLE_ROOM_ATLAS, 1),
    startEntranceHall: buildRoomTileVisual('betrayal/rooms/start-triple-room', START_TRIPLE_ROOM_ATLAS, 2),
    startTripleRoom: buildRoomTileVisual('betrayal/rooms/start-triple-room', START_TRIPLE_ROOM_ATLAS, 0),
    startUpperLanding: buildRoomTileVisual('betrayal/rooms/start-upper-landing', START_UPPER_LANDING_ATLAS, 0),
    startBasementLanding: buildRoomTileVisual('betrayal/rooms/start-basement-landing', START_BASEMENT_LANDING_ATLAS, 0),
    trophyRoom: buildRoomTileVisual('betrayal/rooms/trophy-oubliette-atlas', TROPHY_OUBLIETTE_ATLAS, 0),
    conservatory: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 7),
    bedroom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 31),
    attic: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 23),
    study: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 25),
    gallery: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 3),
    ballroom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 4),
    chapel: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 9),
    larder: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 10),
    library: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 25),
    ritualRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 17),
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
