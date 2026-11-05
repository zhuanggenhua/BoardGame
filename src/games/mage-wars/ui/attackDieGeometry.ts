import type { CSSProperties } from 'react';
import { computeSpriteStyle, type SpriteAtlasConfig } from '../../../engine/primitives/spriteAtlas';

/** Cube-net faces from `attack-die-texture.png` (1280x1280 latin-cross unfold). */
export const ATTACK_DIE_TEXTURE = 'mage-wars/dice/attack-die-texture';
export const ATTACK_DIE_TEXTURE_SIZE = 1280;

export type AttackDieFaceKind = 'burst' | 'hit2' | 'hit1' | 'blank';

export type AttackDieFace = {
    id: string;
    kind: AttackDieFaceKind;
    result: number;
    uvMin: readonly [number, number];
    uvSize: readonly [number, number];
    cubeRotate: string;
    glyphRotateDeg: number;
};

const FACE_W = 314;
const FACE_H = 313;

function uv(x: number, y: number): Pick<AttackDieFace, 'uvMin' | 'uvSize'> {
    return {
        uvMin: [x / ATTACK_DIE_TEXTURE_SIZE, y / ATTACK_DIE_TEXTURE_SIZE],
        uvSize: [FACE_W / ATTACK_DIE_TEXTURE_SIZE, FACE_H / ATTACK_DIE_TEXTURE_SIZE],
    };
}

/**
 * Net layout:
 * ```
 *           [top blank]
 * [burst] [front hit2] [right blank]
 *           [plain 2]
 *           [back 1]
 * ```
 * Cube placement follows Summoner Wars Dice3D: result paints on the camera-front
 * face; the cube rests identity so the settled face is a square tile facing the
 * camera, matching the SW overlay stills.
 */
export const ATTACK_DIE_FACES: readonly AttackDieFace[] = [
    { id: 'front-hit2', kind: 'hit2', result: 2, ...uv(483, 320), cubeRotate: '', glyphRotateDeg: 0 },
    { id: 'back-hit1', kind: 'hit1', result: 1, ...uv(483, 946), cubeRotate: 'rotateY(180deg)', glyphRotateDeg: 90 },
    { id: 'right-blank', kind: 'blank', result: 0, ...uv(797, 320), cubeRotate: 'rotateY(90deg)', glyphRotateDeg: 0 },
    { id: 'left-burst', kind: 'burst', result: 3, ...uv(169, 320), cubeRotate: 'rotateY(-90deg)', glyphRotateDeg: 90 },
    { id: 'top-blank', kind: 'blank', result: 0, ...uv(483, 7), cubeRotate: 'rotateX(90deg)', glyphRotateDeg: 0 },
    { id: 'bottom-two', kind: 'hit2', result: 2, ...uv(483, 633), cubeRotate: 'rotateX(-90deg)', glyphRotateDeg: 0 },
];

export const ATTACK_DIE_ATLAS: SpriteAtlasConfig = {
    imageW: ATTACK_DIE_TEXTURE_SIZE,
    imageH: ATTACK_DIE_TEXTURE_SIZE,
    frames: ATTACK_DIE_FACES.map((face) => ({
        x: face.uvMin[0] * ATTACK_DIE_TEXTURE_SIZE,
        y: face.uvMin[1] * ATTACK_DIE_TEXTURE_SIZE,
        width: face.uvSize[0] * ATTACK_DIE_TEXTURE_SIZE,
        height: face.uvSize[1] * ATTACK_DIE_TEXTURE_SIZE,
    })),
};

const SETTLED_FACE_ID: Record<AttackDieFaceKind, string> = {
    hit2: 'front-hit2',
    hit1: 'back-hit1',
    burst: 'left-burst',
    blank: 'right-blank',
};

/**
 * Summoner Wars Dice3D paints the result on i === 0 and settles
 * rotateX(0deg) rotateY(0deg). Mage Wars keeps the official numbered/burst net
 * on that same camera-front rest so the still matches a flat red tile, not an
 * isometric cube.
 */
export const ATTACK_DIE_SETTLED_TRANSFORM = 'rotateX(0deg) rotateY(0deg)';
export const ATTACK_DIE_SETTLED_POSE = 'none';
export const ATTACK_DIE_SETTLED_TILT = 'camera-front';
export const ATTACK_DIE_REVEAL_MS = 600;
export const ATTACK_DIE_REVEAL_STAGGER_MS = 100;
export const ATTACK_DIE_FACE_BACKGROUND = '#8b2020';

export function getAttackDieFaceArtStyle(face: AttackDieFace): CSSProperties {
    const index = ATTACK_DIE_FACES.findIndex((entry) => entry.id === face.id);
    return computeSpriteStyle(Math.max(0, index), ATTACK_DIE_ATLAS);
}

export function getAttackDieFaceKind(result: number): AttackDieFaceKind {
    if (result >= 3) return 'burst';
    if (result === 2) return 'hit2';
    if (result === 1) return 'hit1';
    return 'blank';
}

export function getAttackDieSettledFaceId(result: number): string {
    return SETTLED_FACE_ID[getAttackDieFaceKind(result)];
}

export function getAttackDieSettledTransform(_result?: number): string {
    return ATTACK_DIE_SETTLED_TRANSFORM;
}

export function getAttackDieResultFace(result: number): AttackDieFace {
    const settledFaceId = getAttackDieSettledFaceId(result);
    return ATTACK_DIE_FACES.find((face) => face.id === settledFaceId) ?? ATTACK_DIE_FACES[0];
}

/**
 * Camera-front result face shows the official net crop upright.
 * The net paints hit1 on its side; decorative cube faces keep `glyphRotateDeg`.
 */
export function getAttackDieTileUprightRotateDeg(kind: AttackDieFaceKind): number {
    if (kind === 'hit1') return 270;
    return 0;
}
