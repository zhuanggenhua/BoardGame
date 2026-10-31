import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiceBoxPhysicsSourceProps } from '../../../lib/dice-physics/DiceBoxPhysicsSource';
import type { QidahenBattleRolls } from '../domain/types';
import { QidahenBattleRollSequence } from '../ui/QidahenBattleRollSequence';

const { inputs } = vi.hoisted(() => ({ inputs: [] as DiceBoxPhysicsSourceProps[] }));
vi.mock('../../../lib/dice-physics/DiceBoxPhysicsSource', () => ({
    DiceBoxPhysicsSource: (props: DiceBoxPhysicsSourceProps) => { inputs.push(props); return <div />; },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); inputs.length = 0; });

describe('战斗权威骰果的物理显示投影', () => {
    it('原生十面骰的零面明确对应十点，不把印刷零当伤害零', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect() {}, beginPath() {}, arc() {}, fill() {},
        } as unknown as CanvasRenderingContext2D);
        const rolls = { stages: [{
            phase: 'infantry', attackerRolls: [{ dieSides: 10, raw: 10, value: 10 }],
            defenderRolls: [], attackerTotal: 10, defenderTotal: 0, attackerDamage: 0, defenderDamage: 1,
        }] } as unknown as QidahenBattleRolls;
        const view = render(<QidahenBattleRollSequence rolls={rolls} sourceName="辽北" targetName="叶赫部" onComplete={() => {}} />);
        expect(inputs.at(-1)!.dice[0].value).toBe(10);
        await act(async () => { inputs.at(-1)!.onSettledChange!(true); });
        expect(view.getByText('0（10）')).toBeTruthy();
    });
    it('白骰朝向原始骰果而非加成值，停稳回调不替换同阶段骰子或皮肤', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect() {}, beginPath() {}, arc() {}, fill() {},
        } as unknown as CanvasRenderingContext2D);
        const rolls = { stages: [{
            phase: 'artillery', attackerRolls: [{ dieSides: 6, raw: 1, value: 3 }, { dieSides: 6, raw: 6, value: 8 }],
            defenderRolls: [], attackerTotal: 11, defenderTotal: 0, attackerDamage: 0, defenderDamage: 1,
        }] } as unknown as QidahenBattleRolls;
        render(<QidahenBattleRollSequence rolls={rolls} sourceName="辽北" targetName="叶赫部" onComplete={() => {}} />);
        const initial = inputs.at(-1)!;
        expect(initial.dice.map(die => die.value)).toEqual([1, 6]);
        expect(initial.dieSkins!.map(skin => skin!.readableFaceValue)).toEqual([1, 6]);
        expect(initial.styleProfile!.optimizeSettledFaceReadability).toBe(true);
        await act(async () => { initial.onSettledChange!(true); });
        expect(inputs.at(-1)!.dice).toBe(initial.dice);
        expect(inputs.at(-1)!.dieSkins).toBe(initial.dieSkins);
    });
});
