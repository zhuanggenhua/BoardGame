import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiceBoxPhysicsSourceProps } from '../../../lib/dice-physics/DiceBoxPhysicsSource';
import type { QidahenBattleRolls } from '../domain/types';
import { QidahenBattleRollSequence } from '../ui/QidahenBattleRollSequence';

const { inputs } = vi.hoisted(() => ({ inputs: [] as DiceBoxPhysicsSourceProps[] }));
vi.mock('../../../lib/dice-physics/DiceBoxPhysicsSource', () => ({
    DiceBoxPhysicsSource: (props: DiceBoxPhysicsSourceProps) => { inputs.push(props); return <div data-testid={props.testId} />; },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); inputs.length = 0; });
const participants = { attacker: { name: '大明' }, defender: { name: '蒙古' } };

describe('战斗权威骰果的物理显示投影', () => {
    it('同侧混合骰种仍归同侧，双方所有骰子停稳前不揭示结果', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect() {}, beginPath() {}, arc() {}, fill() {},
        } as unknown as CanvasRenderingContext2D);
        const rolls = { stages: [{
            phase: 'melee', attackerRolls: [{ dieSides: 6, raw: 3, value: 3 }, { dieSides: 10, raw: 5, value: 5 }],
            defenderRolls: [{ dieSides: 8, raw: 4, value: 4 }], attackerTotal: 8, defenderTotal: 4, attackerDamage: 2, defenderDamage: 1,
        }] } as unknown as QidahenBattleRolls;
        const view = render(<QidahenBattleRollSequence {...participants} rolls={rolls} sourceName="辽北" targetName="叶赫部" onComplete={() => {}} />);
        expect(view.getByTestId('qidahen-battle-roll-context')).toBeVisible();
        expect(view.getByTestId('qidahen-battle-roll-context').textContent).toBe('辽北 → 叶赫部');
        const attacker = view.getByTestId('qidahen-battle-side-attacker');
        expect(attacker.contains(view.getByTestId('qidahen-battle-dice-physics-0-attacker-6'))).toBe(true);
        expect(attacker.contains(view.getByTestId('qidahen-battle-dice-physics-0-attacker-10'))).toBe(true);
        expect(view.getByTestId('qidahen-battle-side-defender').contains(view.getByTestId('qidahen-battle-dice-physics-0-defender-8'))).toBe(true);
        const physicalGroups = [...inputs];
        await act(async () => { physicalGroups[0].onSettledChange!(true); physicalGroups[1].onSettledChange!(true); });
        expect(view.queryByTestId('qidahen-battle-stage-damage')).toBeNull();
        await act(async () => { physicalGroups[2].onSettledChange!(true); });
        expect(view.getByTestId('qidahen-battle-stage-damage')).toBeTruthy();
        expect(view.getByTestId('qidahen-battle-roll-context')).toBeVisible();
        expect(view.getByTestId('qidahen-battle-dice-calculation-0-attacker-6').textContent).toBe('');
        expect(view.getByTestId('qidahen-battle-dice-calculation-0-attacker-10').textContent).toBe('');
    });
    it('原生十面骰的零面明确对应十点，不把印刷零当伤害零', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect() {}, beginPath() {}, arc() {}, fill() {},
        } as unknown as CanvasRenderingContext2D);
        const rolls = { stages: [{
            phase: 'infantry', attackerRolls: [{ dieSides: 10, raw: 10, value: 10 }],
            defenderRolls: [], attackerTotal: 10, defenderTotal: 0, attackerDamage: 0, defenderDamage: 1,
        }] } as unknown as QidahenBattleRolls;
        const view = render(<QidahenBattleRollSequence {...participants} rolls={rolls} sourceName="辽北" targetName="叶赫部" onComplete={() => {}} />);
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
        render(<QidahenBattleRollSequence {...participants} rolls={rolls} sourceName="辽北" targetName="叶赫部" onComplete={() => {}} />);
        const initial = inputs.at(-1)!;
        expect(initial.dice.map(die => die.value)).toEqual([1, 6]);
        expect(initial.dieSkins!.map(skin => skin!.readableFaceValue)).toEqual([1, 6]);
        expect(initial.styleProfile!.optimizeSettledFaceReadability).toBe(true);
        await act(async () => { initial.onSettledChange!(true); });
        expect(inputs.at(-1)!.dice).toBe(initial.dice);
        expect(inputs.at(-1)!.dieSkins).toBe(initial.dieSkins);
    });
});
