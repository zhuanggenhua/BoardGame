import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { DiceThroneCore } from '../domain/types';
import { diceThroneCriticalImageResolver, _testExports } from '../criticalImageResolver';
import { getPlayerBoardUiTuning } from '../ui/abilitySlotLayout';

const {
    CHARACTER_ASSET_TYPES,
    COMMON_CRITICAL_PATHS,
    HAND_ATLAS_CHARACTER_IDS,
    IMPLEMENTED_CHARACTERS,
    getAllCharAssets,
    getHandAtlasAssets,
} = _testExports;

function makeState(
    hostStarted: boolean,
    chars: Record<string, string> = { '0': 'unselected', '1': 'unselected' },
): MatchState<DiceThroneCore> {
    return {
        core: {
            selectedCharacters: chars,
            hostStarted,
        } as Partial<DiceThroneCore> as DiceThroneCore,
    } as MatchState<DiceThroneCore>;
}

describe('diceThroneCriticalImageResolver', () => {
    it('无状态时返回选角关键图和 gameplay 暖加载', () => {
        const result = diceThroneCriticalImageResolver(undefined, undefined, '0');

        expect(result.phaseKey).toBe('no-state:0');
        for (const path of COMMON_CRITICAL_PATHS) {
            expect(result.critical).toContain(path);
        }
        for (const charId of IMPLEMENTED_CHARACTERS) {
            expect(result.critical).toContain(`dicethrone/images/${charId}/player-board`);
            expect(result.warm).toContain(`dicethrone/images/${charId}/dice`);
        }
    });

    it('setup 阶段按自己 -> 对手 -> 未选择角色排列 warm 队列', () => {
        const result = diceThroneCriticalImageResolver(
            makeState(false, { '0': 'monk', '1': 'barbarian' }),
            undefined,
            '0',
        );

        expect(result.phaseKey).toBe('setup:0:0:monk|1:barbarian');
        const myIndex = result.warm.indexOf('dicethrone/images/monk/ability-cards');
        const opponentIndex = result.warm.indexOf('dicethrone/images/barbarian/ability-cards');
        const unrelatedIndex = result.warm.indexOf('dicethrone/images/pyromancer/ability-cards');

        expect(myIndex).toBeGreaterThanOrEqual(0);
        expect(opponentIndex).toBeGreaterThan(myIndex);
        expect(unrelatedIndex).toBeGreaterThan(opponentIndex);
    });

    it('setup/playing 阶段仅为枪手和武士加入 hand atlas', () => {
        const setupResult = diceThroneCriticalImageResolver(
            makeState(false, { '0': 'samurai', '1': 'gunslinger' }),
            undefined,
            '0',
        );
        const playingResult = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'samurai', '1': 'gunslinger' }),
            undefined,
            '0',
        );

        for (const charId of HAND_ATLAS_CHARACTER_IDS) {
            const [path] = getHandAtlasAssets(charId);
            expect(setupResult.warm).toContain(path);
        }

        expect(playingResult.critical).toContain('dicethrone/images/samurai/hand-cards-atlas');
        expect(playingResult.warm).toContain('dicethrone/images/gunslinger/hand-cards-atlas');

        expect(setupResult.warm).not.toContain('dicethrone/images/monk/hand-cards-atlas');
        expect(playingResult.critical).not.toContain('dicethrone/images/monk/hand-cards-atlas');
    });

    it('playing 阶段有 playerID 时：自己进 critical，对手进 warm', () => {
        const result = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'monk', '1': 'barbarian' }),
            undefined,
            '0',
        );

        expect(result.phaseKey).toBe('playing:0:0:monk|1:barbarian');

        for (const asset of getAllCharAssets('monk')) {
            expect(result.critical).toContain(asset);
        }
        for (const asset of getAllCharAssets('barbarian')) {
            expect(result.warm).toContain(asset);
            expect(result.critical).not.toContain(asset);
        }
    });

    it('playing 阶段无 playerID 时：所有已选角色都进 critical', () => {
        const result = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'monk', '1': 'barbarian' }),
        );

        for (const charId of ['monk', 'barbarian'] as const) {
            for (const asset of getAllCharAssets(charId)) {
                expect(result.critical).toContain(asset);
            }
        }
        expect(result.warm).toEqual([]);
    });

    it('playing 阶段不再预加载未选择角色', () => {
        const result = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'monk', '1': 'barbarian' }),
            undefined,
            '0',
        );

        expect(result.warm).not.toContain('dicethrone/images/pyromancer/ability-cards');
        expect(result.warm).not.toContain('dicethrone/images/pyromancer/dice');
    });

    it('critical 和 warm 不重叠', () => {
        const result = diceThroneCriticalImageResolver(
            makeState(true, { '0': 'monk', '1': 'paladin' }),
            undefined,
            '0',
        );

        const criticalSet = new Set(result.critical);
        for (const path of result.warm) {
            expect(criticalSet.has(path)).toBe(false);
        }
    });

    it('资源类型声明覆盖所有已知角色素材', () => {
        const keys = CHARACTER_ASSET_TYPES.map((asset) => asset.key);
        expect(keys).toEqual([
            'player-board',
            'tip',
            'ability-cards',
            'dice',
            'status-icons-atlas',
        ]);
    });

    it('玩家面板布局调参必须包含 CenterBoard 所需的尺寸字段', () => {
        for (const characterId of ['monk', 'gunslinger', 'samurai'] as const) {
            const tuning = getPlayerBoardUiTuning(characterId);

            expect(tuning.playerBoardBaseHeightVw, `${characterId} 缺少 playerBoardBaseHeightVw`).toBeGreaterThan(0);
            expect(tuning.tipBoardHeightVw, `${characterId} 缺少 tipBoardHeightVw`).toBeGreaterThan(0);
            expect(tuning.centerBoardGapVw, `${characterId} 缺少 centerBoardGapVw`).toBeGreaterThanOrEqual(0);
        }
    });
});
