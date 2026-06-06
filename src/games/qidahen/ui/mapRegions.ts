export const QIDAHEN_MAP_WIDTH = 1265;
export const QIDAHEN_MAP_HEIGHT = 893;

export type QidahenMapPoint = readonly [number, number];

export interface QidahenMapRegionShape {
    id: string;
    name: string;
    polygon: readonly QidahenMapPoint[];
}

export const QIDAHEN_MAP_REGION_SHAPES: readonly QidahenMapRegionShape[] = [
    {
        id: 'jinzhou',
        name: '锦州',
        polygon: [
            [723, 371],
            [789, 338],
            [846, 370],
            [844, 452],
            [792, 498],
            [724, 472],
            [694, 422],
        ],
    },
    {
        id: 'song-jin',
        name: '皮岛',
        polygon: [
            [681, 509],
            [746, 493],
            [812, 531],
            [809, 608],
            [754, 646],
            [684, 622],
            [650, 570],
        ],
    },
    {
        id: 'shan-hai-guan',
        name: '山海关',
        polygon: [
            [626, 479],
            [681, 492],
            [688, 569],
            [647, 621],
            [596, 607],
            [574, 545],
        ],
    },
    {
        id: 'xian-xing',
        name: '咸兴',
        polygon: [
            [1038, 421],
            [1103, 392],
            [1159, 424],
            [1158, 508],
            [1108, 555],
            [1046, 543],
            [1010, 486],
        ],
    },
    {
        id: 'shou-cheng',
        name: '汉城',
        polygon: [
            [1048, 562],
            [1127, 540],
            [1204, 579],
            [1210, 665],
            [1155, 723],
            [1066, 703],
            [1016, 632],
        ],
    },
] as const;
export const QIDAHEN_MAP_REGION_SHAPES_BY_ID = new Map(
    QIDAHEN_MAP_REGION_SHAPES.map((shape) => [shape.id, shape]),
);
