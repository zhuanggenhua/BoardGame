import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { DiceThroneCore } from '../domain/types';
import { diceThroneCriticalImageResolver, _testExports } from '../criticalImageResolver';
import {
    getPlayerBoardDimensions,
    getPlayerBoardLayoutVersion,
    getPlayerBoardUiTuning,
} from '../ui/abilitySlotLayout';

const {
    CHARACTER_ASSET_TYPES,
    COMMON_CRITICAL_PATHS,
    HAND_ATLAS_CHARACTER_IDS,
    IMPLEMENTED_CHARACTERS,
    getCharAssetsByTag,
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
            for (const asset of getCharAssetsByTag(charId, 'selection')) {
                expect(result.critical).toContain(asset);
            }
            for (const asset of getCharAssetsByTag(charId, 'gameplay')) {
                expect(result.warm).toContain(asset);
            }
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

    it('咒缚海盗 gameplay 预加载同时包含咒缚面与人类面玩家板，选角预览仍只展示默认玩家板', () => {
        const gameplayAssets = getCharAssetsByTag('cursed_pirate', 'gameplay');
        const selectionAssets = getCharAssetsByTag('cursed_pirate', 'selection');

        expect(gameplayAssets).toContain('dicethrone/images/cursed/human-player-board');
        expect(gameplayAssets).toContain('dicethrone/images/cursed/player-board');
        expect(selectionAssets).toContain('dicethrone/images/cursed/player-board');
        expect(selectionAssets).not.toContain('dicethrone/images/cursed/human-player-board');
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
        for (const characterId of ['monk', 'gunslinger', 'samurai', 'tianshi', 'vampire_lord'] as const) {
            const tuning = getPlayerBoardUiTuning(characterId);

            expect(tuning.playerBoardBaseHeightVw, `${characterId} 缺少 playerBoardBaseHeightVw`).toBeGreaterThan(0);
            expect(tuning.tipBoardHeightVw, `${characterId} 缺少 tipBoardHeightVw`).toBeGreaterThan(0);
            expect(tuning.centerBoardGapVw, `${characterId} 缺少 centerBoardGapVw`).toBeGreaterThanOrEqual(0);
        }
    });

    it('新版玩家面板角色使用 v2 布局与对应面板尺寸', () => {
        const expectedDimensions = {
            barbarian: { width: 2048, height: 1260 },
            monk: { width: 2048, height: 1260 },
            moon_elf: { width: 2048, height: 1260 },
            paladin: { width: 2048, height: 1250 },
            pyromancer: { width: 2048, height: 1260 },
            shadow_thief: { width: 2048, height: 1260 },
            tianshi: { width: 3643, height: 2234 },
            lieren: { width: 3632, height: 2234 },
            vampire_lord: { width: 3627, height: 2234 },
        } as const;

        for (const [characterId, dimensions] of Object.entries(expectedDimensions)) {
            expect(getPlayerBoardLayoutVersion(characterId), `${characterId} 应使用 v2 面板布局`).toBe('v2');
            expect(getPlayerBoardDimensions(characterId)).toEqual(dimensions);
        }
    });
});
