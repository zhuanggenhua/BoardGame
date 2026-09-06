import type { CSSProperties } from 'react';
import type { BetrayalRoomNode } from './game';
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
    observatory: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 0),
    tower: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 1),
    statuaryCorridor: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 2),
    conservatory: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 7),
    bedroom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 31),
    study: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 25),
    gallery: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 3),
    ballroom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 4),
    kitchen: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 5),
    chapel: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 9),
    larder: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 10),
    laboratory: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 6),
    laundryChute: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 12),
    vault: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 13),
    chasm: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 14),
    graveyard: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 8),
    panicRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 15),
    undergroundCavern: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 16),
    library: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 25),
    ritualRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 17),
    undergroundLake: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 18),
    catacombs: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 19),
    secretStaircase: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 20),
    furnaceRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 21),
    winterBedroom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 22),
    guestQuarters: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 23),
    bloodyRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 24),
    collapsedRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 26),
    junkRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 27),
    specimenRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 28),
    charredRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 29),
    salon: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 30),
    primaryBedroom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 31),
    organRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 32),
    soundproofedRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 33),
    nursery: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 34),
    operatingTheatre: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 35),
    crawlspace: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 36),
    gameRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 37),
    gymnasium: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 38),
    armory: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 39),
    crampedPassageway: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 40),
    mysticElevator: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 41),
    upperLanding: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 40),
    entranceHall: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 3),
    diningRoom: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 11),
    foyer: buildRoomTileVisual('betrayal/rooms/room-front-atlas', ROOM_FRONT_ATLAS, 4),
    backUpper: buildRoomTileVisual('betrayal/rooms/room-back-atlas', ROOM_BACK_ATLAS, 0),
    backGround: buildRoomTileVisual('betrayal/rooms/room-back-atlas', ROOM_BACK_ATLAS, 4),
    backBasement: buildRoomTileVisual('betrayal/rooms/room-back-atlas', ROOM_BACK_ATLAS, 13),
};

const BETRAYAL_ROOM_VISUAL_ALIASES: Partial<Record<string, keyof typeof BETRAYAL_ROOM_TILE_VISUALS>> = {
    startTriple: 'startTripleRoom',
    upperLanding: 'startUpperLanding',
    basementLanding: 'startBasementLanding',
    entranceHall: 'startEntranceHall',
    foyer: 'startGroundFloorStaircase',
};

export function resolveBetrayalRoomTileVisual(visualId: string): BetrayalRoomTileVisual | undefined {
    const alias = BETRAYAL_ROOM_VISUAL_ALIASES[visualId];
    if (alias) return BETRAYAL_ROOM_TILE_VISUALS[alias];
    return BETRAYAL_ROOM_TILE_VISUALS[visualId as keyof typeof BETRAYAL_ROOM_TILE_VISUALS];
}

export function resolveBetrayalRoomNodeTileVisual(
    room: BetrayalRoomNode,
    isDiscovered: boolean,
): BetrayalRoomTileVisual {
    const visualId = isDiscovered ? room.visualId : room.backVisualId;
    return resolveBetrayalRoomTileVisual(visualId) ?? BETRAYAL_ROOM_TILE_VISUALS.conservatory;
}

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
