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
 * Cube placement follows DiceThrone Dice2D / Summoner Wars Dice3D.
 */
export const ATTACK_DIE_FACES: readonly AttackDieFace[] = [
    { id: 'front-hit2', kind: 'hit2', result: 2, ...uv(483, 320), cubeRotate: '', glyphRotateDeg: 0 },
    { id: 'back-hit1', kind: 'hit1', result: 1, ...uv(483, 946), cubeRotate: 'rotateY(180deg)', glyphRotateDeg: 90 },
    { id: 'right-blank', kind: 'blank', result: 0, ...uv(797, 320), cubeRotate: 'rotateY(90deg)', glyphRotateDeg: 0 },
    { id: 'left-burst', kind: 'burst', result: 3, ...uv(169, 320), cubeRotate: 'rotateY(-90deg)', glyphRotateDeg: 90 },
    { id: 'top-blank', kind: 'blank', result: 0, ...uv(483, 7), cubeRotate: 'rotateX(90deg)', glyphRotateDeg: 0 },
    { id: 'bottom-two', kind: 'hit2', result: 2, ...uv(483, 633), cubeRotate: 'rotateX(-90deg)', glyphRotateDeg: 0 },
];

const SETTLED_FACE_ID: Record<AttackDieFaceKind, string> = {
    hit2: 'front-hit2',
    hit1: 'back-hit1',
    burst: 'left-burst',
    blank: 'right-blank',
};

const SETTLED_FACE_ALIGN: Record<AttackDieFaceKind, string> = {
    hit2: 'rotateX(0deg) rotateY(0deg)',
    hit1: 'rotateX(0deg) rotateY(180deg)',
    burst: 'rotateX(0deg) rotateY(90deg)',
    blank: 'rotateX(0deg) rotateY(-90deg)',
};

/** Cube FACE_ALIGN puts the result on +Z; this pose shows thin adjacent-face slivers. */
export const ATTACK_DIE_SETTLED_POSE = 'rotateX(-16deg) rotateY(18deg)';
export const ATTACK_DIE_SETTLED_TILT = 'camera-pose';

export function getAttackDieFaceKind(result: number): AttackDieFaceKind {
    if (result >= 3) return 'burst';
    if (result === 2) return 'hit2';
    if (result === 1) return 'hit1';
    return 'blank';
}

export function getAttackDieSettledFaceId(result: number): string {
    return SETTLED_FACE_ID[getAttackDieFaceKind(result)];
}

export function getAttackDieSettledTransform(result: number): string {
    return SETTLED_FACE_ALIGN[getAttackDieFaceKind(result)];
}
