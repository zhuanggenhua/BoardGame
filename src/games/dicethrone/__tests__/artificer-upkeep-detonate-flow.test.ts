import { describe, expect, it } from 'vitest';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import {
    hasUsableOwnUpkeepPassiveAction,
    isPassiveActionUsable,
} from '../domain/passiveAbility';
import { initializeCustomActions } from '../domain/customActions';
import { createHeroMatchup, fixedRandom } from './test-utils';

initializeCustomActions();

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

type TestState = ReturnType<ReturnType<typeof createHeroMatchup>>;

describe('Artificer 纳米机器人维持阶段触发（完整 build 流程）', () => {
    it('通过 build-nanobot 命令建造后，下一回合 upkeep 引爆按钮应可用且能引爆', () => {
        // 1. 创建 artificer vs monk 对局，初始在 main1
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.turnNumber = 1;

        // 2. 给足 Synth（build 需要 2）
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 4; // build 用 2，剩 2 给 upkeep 引爆

        // 3. 通过真实命令建造纳米机器人（actionIndex 3 = build-nanobot）
        const buildEvents = execute(state, {
            type: 'USE_PASSIVE_ABILITY',
            playerId: '0',
            payload: { passiveId: 'artificer-workshop', actionIndex: 3 },
            timestamp: 100,
        }, fixedRandom);
        const afterBuild = applyEvents(state.core, buildEvents);

        // 4. 验证建造成功：artificerBotState[NANOBOT].built = true
        const botStateAfterBuild = afterBuild.players['0'].artificerBotState?.[TOKEN_IDS.NANOBOT];
        expect(botStateAfterBuild, 'build 后 artificerBotState[NANOBOT] 必须被写入').toBeDefined();
        expect(botStateAfterBuild?.built).toBe(true);
        expect(afterBuild.players['0'].tokens[TOKEN_IDS.NANOBOT]).toBe(1);
        expect(afterBuild.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(2); // 4 - 2 = 2

        // 5. 给对手施加纳米爆蛋（模拟上一回合攻击施加的）
        afterBuild.players['1'].statusEffects[STATUS_IDS.NANOBOMB] = 2;

        // 6. 推进到下一回合 upkeep（模拟回合切换 + 阶段推进）
        const upkeepCore: DiceThroneCore = {
            ...afterBuild,
            activePlayerId: '0',
            turnNumber: 2,
        };
        upkeepCore.players = {
            ...afterBuild.players,
            // 回合切换重置 activationsUsedThisTurn（模拟 handleTurnChanged）
            '0': {
                ...afterBuild.players['0'],
                artificerBotState: {
                    ...afterBuild.players['0'].artificerBotState,
                    [TOKEN_IDS.NANOBOT]: {
                        ...afterBuild.players['0'].artificerBotState![TOKEN_IDS.NANOBOT],
                        activationsUsedThisTurn: 0,
                    },
                },
            },
        };
        const upkeepState: TestState = {
            sys: { ...state.sys, phase: 'upkeep' },
            core: upkeepCore,
        };

        // 7. 关键断言：upkeep 阶段 Nano Bot 引爆应可用
        const usableBasic = isPassiveActionUsable(upkeepCore, '0', 'artificer-workshop', 0, 'upkeep');
        expect(usableBasic, '基础 Nano Bot 引爆在 upkeep 应可用（isPassiveActionUsable）').toBe(true);

        const hasUpkeepPassive = hasUsableOwnUpkeepPassiveAction(upkeepCore, '0');
        expect(hasUpkeepPassive, 'hasUsableOwnUpkeepPassiveAction 应返回 true（upkeep 不应自动跳过）').toBe(true);

        // 8. 真实执行引爆（actionIndex 0 = 基础引爆）
        const detonateEvents = execute(upkeepState, {
            type: 'USE_PASSIVE_ABILITY',
            playerId: '0',
            payload: { passiveId: 'artificer-workshop', actionIndex: 0 },
            timestamp: 200,
        }, fixedRandom);
        const afterDetonate = applyEvents(upkeepCore, detonateEvents);

        // 9. 验证引爆成功：NANOBOMB 被清零，对手扣血
        const nanobombAfter = afterDetonate.players['1'].statusEffects[STATUS_IDS.NANOBOMB] ?? 0;
        expect(nanobombAfter, '引爆后对手身上的纳米爆蛋应被清零').toBe(0);
        // 2 层 NANOBOMB 造成 3 点伤害（NANOBOMB_DAMAGE_BY_STACKS[2]=3）
        const hpBefore = afterBuild.players['1'].resources.hp ?? afterBuild.players['1'].resources.HP ?? 20;
        const hpAfter = afterDetonate.players['1'].resources.hp ?? afterDetonate.players['1'].resources.HP ?? hpBefore;
        expect(hpAfter, `引爆应造成伤害（${hpBefore} → 扣 3）`).toBeLessThan(hpBefore);
    });

    it('升级后的高级纳米机器人在 upkeep 也应可触发（actionIndex 1）', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.turnNumber = 1;

        // 先 build 基础
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 5; // build 2 + upgrade 3
        const buildEvents = execute(state, {
            type: 'USE_PASSIVE_ABILITY',
            playerId: '0',
            payload: { passiveId: 'artificer-workshop', actionIndex: 3 },
            timestamp: 100,
        }, fixedRandom);
        const afterBuild = applyEvents(state.core, buildEvents);

        // 再 upgrade（actionIndex 6 = upgrade-nanobot）
        const upState: TestState = { sys: state.sys, core: afterBuild };
        const upgradeEvents = execute(upState, {
            type: 'USE_PASSIVE_ABILITY',
            playerId: '0',
            payload: { passiveId: 'artificer-workshop', actionIndex: 6 },
            timestamp: 110,
        }, fixedRandom);
        const afterUpgrade = applyEvents(afterBuild, upgradeEvents);

        expect(afterUpgrade.players['0'].artificerBotState?.[TOKEN_IDS.NANOBOT]?.upgraded).toBe(true);
        expect(afterUpgrade.players['0'].tokenStackLimits?.[TOKEN_IDS.NANOBOT]).toBe(2);
        // 剩余 Synth: 5 - 2(build) - 3(upgrade) = 0，再补 1 给 upkeep 引爆（高级只需 1）
        afterUpgrade.players['0'].tokens[TOKEN_IDS.SYNTH] = 1;
        afterUpgrade.players['1'].statusEffects[STATUS_IDS.NANOBOMB] = 3;

        // 推进到 upkeep
        const upkeepCore: DiceThroneCore = {
            ...afterUpgrade,
            activePlayerId: '0',
            turnNumber: 2,
        };
        upkeepCore.players = {
            ...afterUpgrade.players,
            '0': {
                ...afterUpgrade.players['0'],
                artificerBotState: {
                    ...afterUpgrade.players['0'].artificerBotState,
                    [TOKEN_IDS.NANOBOT]: {
                        ...afterUpgrade.players['0'].artificerBotState![TOKEN_IDS.NANOBOT],
                        activationsUsedThisTurn: 0,
                    },
                },
            },
        };

        // 高级引爆（actionIndex 1）应可用，基础引爆（actionIndex 0）不应可用
        const usableAdvanced = isPassiveActionUsable(upkeepCore, '0', 'artificer-workshop', 1, 'upkeep');
        expect(usableAdvanced, '高级 Nano Bot 引爆在 upkeep 应可用').toBe(true);
        const usableBasic = isPassiveActionUsable(upkeepCore, '0', 'artificer-workshop', 0, 'upkeep');
        expect(usableBasic, '升级后基础 Nano Bot 引爆应不可用（避免重复）').toBe(false);
    });
});
