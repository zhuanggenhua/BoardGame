export interface DicePhysicsProjectedLayout {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
}

export interface DicePhysicsMotionSnapshot {
    x: number;
    y: number;
    z: number;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
}

export interface DicePhysicsState {
    id: number;
    layout: DicePhysicsProjectedLayout;
    motion: DicePhysicsMotionSnapshot;
    settled: boolean;
}

export type DicePhysicsRendererMode = 'debug-visible' | 'physics-only';

export interface DiceRendererContract<TDie> {
    dice: TDie[];
    physicsStates?: DicePhysicsState[];
}
