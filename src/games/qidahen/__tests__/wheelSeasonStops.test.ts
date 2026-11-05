import { describe, it, expect } from 'vitest';
import { QIDAHEN_WHEEL_POSITIONS, getQidahenWheelDestination } from '../domain/wheelRules';

describe('正式十格轮盘与必停格', () => {
    it('从新年出发的前三格按正式地图行动，第三格不是进攻', () => {
        expect(QIDAHEN_WHEEL_POSITIONS).toHaveLength(10);
        expect(getQidahenWheelDestination('wheel-new-year',1).kind).toBe('reclaim-farm');
        expect(getQidahenWheelDestination('wheel-new-year',2).kind).toBe('recruit-train');
        expect(getQidahenWheelDestination('wheel-new-year',3).kind).toBe('reclaim-farm');
    });
    it('经过年中必须截停，不能把余步继续走到外交或新年', () => {
        expect(getQidahenWheelDestination('wheel-diplomacy',3).id).toBe('wheel-midyear');
        expect(getQidahenWheelDestination('wheel-midyear',1).kind).toBe('dispatch');
    });
    it('经过新年也截停，下一回合才能进入首格', () => {
        expect(getQidahenWheelDestination('wheel-recruit-train-2',3).id).toBe('wheel-new-year');
        expect(getQidahenWheelDestination('wheel-new-year',1).id).toBe('wheel-reclaim');
    });
});
