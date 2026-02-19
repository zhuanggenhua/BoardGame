import { describe, it, expect } from 'vitest';
import { diceThroneCriticalImageResolver, _testExports } from '../criticalImageResolver';
import type { MatchState } from '../../../engine/types';
import type { DiceThroneCore } from '../domain/types';

const {
    CHARACTER_ASSET_TYPES,
    IMPLEMENTED_CHARACTERS,
    COMMON_CRITICAL_PATHS,
    getAllCharAssets,
} = _testExports;

// 构造最小 MatchState
function makeState(
    hostStarted: boolean,
    chars: Record<string, string> = { '0': 'unselected', '1': 'unselected' },
): unknown {
    return {
        core: {
            selectedCharacters: chars,
            hostStarted,
        } as Partial<DiceThroneCore>,
    } as MatchState<DiceThroneCore>;
}

describe('diceThroneCriticalImageResolver', () => {
    it('无状态时返回选角界面资源为 critical', () => {
        const result = diceThroneCriticalImageResolver(undefined);
        expect(result.phaseKey).toBe('no-state');
        for (const p of COMMON_CRITICAL_PATHS) {
            expect(result.critical).toContain(p);
        }
        for (const c of IMPLEMENTED_CHARACTERS) {
            expect(result.critical).toContain(`dicethrone/images/${c}/player-board`);
        }
    });

    it('选角阶段：selection 标签资源为 critical，gameplay 独有资源为 warm', () => {
        const result = diceThroneCriticalImageResolver(makeState(false));
        expect(result.phaseKey).toBe('setup');
        for (const c of IMPLEMENTED_CHARACTERS) {
            expect(result.warm).toContain(`dicethrone/images/${c}/dice`);
            expect(result.warm).toContain(`dicethrone/images/${c}/ability-cards`);
            expect(result.warm).toContain(`dicethrone/images/${c}/status-icons-atlas`);
        }
    });

    it('游戏进行中（有 playerID）：自己角色 critical，对手角色 warm', () => {
        const result = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'monk', '1': 'barbarian' }),
            undefined,
            '0', // 当前玩家是 0 号（monk）
        );
        expect(result.phaseKey).toContain('playing');

        // 自己的角色（monk）全部资源在 critical
        const myAssets = getAllCharAssets('monk');
        for (const asset of myAssets) {
            expect(result.critical, `自己的 ${asset} 应在 critical`).toContain(asset);
        }

        // 对手的角色（barbarian）全部资源在 warm
        const opponentAssets = getAllCharAssets('barbarian');
        for (const asset of opponentAssets) {
            expect(result.warm, `对手的 ${asset} 应在 warm`).toContain(asset);
            expect(result.critical, `对手的 ${asset} 不应在 critical`).not.toContain(asset);
        }
    });

    it('游戏进行中（无 playerID）：所有已选角色都在 critical（兜底）', () => {
        const result = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'monk', '1': 'barbarian' }),
        );
        // 无 playerID 时无法区分，全部进 critical
        for (const charId of ['monk', 'barbarian'] as const) {
            const allAssets = getAllCharAssets(charId);
            for (const asset of allAssets) {
                expect(result.critical, `缺少 ${asset}`).toContain(asset);
            }
        }
    });

    it('对手骰子在 warm 中（有 playerID 时）', () => {
        const result = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'pyromancer', '1': 'shadow_thief' }),
            undefined,
            '0',
        );
        // 自己的骰子在 critical
        expect(result.critical).toContain('dicethrone/images/pyromancer/dice');
        // 对手的骰子在 warm
        expect(result.warm).toContain('dicethrone/images/shadow_thief/dice');
        expect(result.critical).not.toContain('dicethrone/images/shadow_thief/dice');
    });

    it('未选角色的资源在 warm 中', () => {
        const result = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'monk', '1': 'barbarian' }),
            undefined,
            '0',
        );
        expect(result.warm).toContain('dicethrone/images/pyromancer/ability-cards');
        expect(result.warm).toContain('dicethrone/images/pyromancer/dice');
    });

    it('critical 和 warm 无重叠', () => {
        const result = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'monk', '1': 'paladin' }),
            undefined,
            '0',
        );
        const criticalSet = new Set(result.critical);
        for (const w of result.warm) {
            expect(criticalSet.has(w), `${w} 同时出现在 critical 和 warm 中`).toBe(false);
        }
    });

    it('CHARACTER_ASSET_TYPES 覆盖所有已知资源类型', () => {
        const keys = CHARACTER_ASSET_TYPES.map(a => a.key);
        expect(keys).toContain('player-board');
        expect(keys).toContain('tip');
        expect(keys).toContain('ability-cards');
        expect(keys).toContain('dice');
        expect(keys).toContain('status-icons-atlas');
    });

    it('phaseKey 随选角变化', () => {
        const r1 = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'monk', '1': 'unselected' }),
        );
        const r2 = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'monk', '1': 'barbarian' }),
        );
        expect(r1.phaseKey).not.toBe(r2.phaseKey);
    });
});
