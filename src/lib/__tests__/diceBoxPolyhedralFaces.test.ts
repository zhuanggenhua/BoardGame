import { describe, it, expect, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Mesh, Object3D, Vector3 } from 'three';
import { DiceBoxThreeEngine } from '../dice-box-threejs/engine';

// 来自原装DiceBox.swapDiceFace：d10面从材质1起，其余当前骰型从材质2起。
const nativeFaces = [['d6', 6, 2], ['d8', 8, 2], ['d10', 10, 1], ['d12', 12, 2]] as const;
function engineFor(type: string, value: number, materialIndex: number) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('normal', new Float32BufferAttribute([
        1, 0, 0, 1, 0, 0, 1, 0, 0,
        0, 1, 0, 0, 1, 0, 0, 1, 0,
    ], 3));
    geometry.addGroup(0, 3, materialIndex);
    geometry.addGroup(3, 3, 3); // 六面自定义覆盖用的第二面。
    const die = Object.assign(new Mesh(geometry), { getLastValue: () => ({ value }) });
    const camera = new Object3D(); camera.position.set(0, 0, 100); camera.updateMatrixWorld(true);
    const engine = Object.create(DiceBoxThreeEngine.prototype) as any;
    engine.dieType = type; engine.dieSkins = []; engine.styleProfile = { optimizeSettledFaceReadability: true };
    engine.box = { diceList: [die], camera };
    engine.getProjectedLayout = vi.fn(() => ({ width: 40, height: 40, visualWidth: 40, visualHeight: 40, outlineRotateZ: 0 }));
    return { engine, die };
}
describe('原生多面骰面索引与停稳可读方向', () => {
    it.each(nativeFaces)('%s最高合法面对应原装材质，越界面不生成索引', (type, sides, offset) => {
        const { engine } = engineFor(type, sides, sides - 1 + offset);
        expect(engine.getMaterialIndexForFaceValue(sides)).toBe(sides - 1 + offset);
        expect(engine.getFaceValueForMaterialIndex(sides - 1 + offset)).toBe(sides);
        expect(engine.getFaceValueForMaterialIndex(offset - 1)).toBeNull();
        expect(engine.getMaterialIndexForFaceValue(sides + 1)).toBeNull();
    });
    it.each(nativeFaces)('%s无皮肤时按已存权威骰果把结果面朝向相机，不改骰值', (type, sides, offset) => {
        const { engine, die } = engineFor(type, sides, sides - 1 + offset);
        engine.optimizeSettledDieOrientations();
        const normal = new Vector3(1, 0, 0).transformDirection(die.matrixWorld);
        expect(normal.dot(new Vector3(0, 0, 1))).toBeGreaterThan(0.999);
        expect(engine.getValues()).toEqual([sides]);
    });
    it('自定义皮肤显式面继续优先，保留Betrayal的规则面映射', () => {
        const { engine, die } = engineFor('d6', 6, 7);
        engine.dieSkins = [{ readableFaceValue: 2 }];
        engine.optimizeSettledDieOrientations();
        const customFace = new Vector3(0, 1, 0).transformDirection(die.matrixWorld);
        expect(customFace.dot(new Vector3(0, 0, 1))).toBeGreaterThan(0.999);
        expect(engine.getValues()).toEqual([6]);
    });
    it('未开启优化的共享默认保持原姿态与骰果', () => {
        const { engine, die } = engineFor('d6', 6, 7);
        engine.styleProfile = {};
        const before = die.quaternion.clone();
        engine.optimizeSettledDieOrientations();
        expect(die.quaternion.equals(before)).toBe(true);
        expect(engine.getValues()).toEqual([6]);
    });
});
