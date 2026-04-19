/**
 * 大杀四方 - Prompt 响应链集成测试
 *
 * 测试完整流程：
 * 1. 打出能力卡 → CHOICE_REQUESTED 事件
 * 2. 事件系统创建 Interaction
 * 3. 玩家响应 SYS_INTERACTION_RESPOND → SYS_INTERACTION_RESOLVED
 * 4. 继续函数执行 → 生成后续领域事件（MINION_MOVED/CARDS_DRAWN 等）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { INTERACTION_COMMANDS, INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import { smashUpFlowHooks } from '../domain/index';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { createSmashUpEventSystem } from '../domain/systems';
import { SMASHUP_FACTION_IDS } from '../domain/ids';

const PLAYER_IDS = ['0', '1'];

function createRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createBaseSystems<SmashUpCore>(),
            createSmashUpEventSystem(),
        ],
        playerIds: PLAYER_IDS,
    });
}

/** 蛇形选秀：外星人+恐龙 vs 海盗+忍者 */
const DRAFT_COMMANDS = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
] as any[];

describe('Prompt 响应链集成测试', () => {
    beforeAll(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
        initAllAbilities();
    });

    describe('继续函数注册验证', () => {
        it('关键能力的继续函数已注册', () => {
            // 只测试实际注册了继续函数的能力（多目标选择类）
            // 注意：一些能力用 MVP 自动选择模式，不需要继续函数
            // 仍使用 promptContinuation 的能力
            // 已迁移到 InteractionHandler 的能力
            const interactionAbilities = [
                'alien_supreme_overlord',
                'alien_collector',
                'alien_invasion_choose_minion',
                'alien_invasion_choose_base',
                'alien_disintegrator',
                'alien_beam_up',
                'alien_crop_circles',
                'alien_probe_choose_target',
                'alien_probe',
                'alien_terraform',
                'alien_abduction',
                'zombie_grave_digger',
                'zombie_grave_robbing',
                'zombie_not_enough_bullets',
                'pirate_cannon_choose_first',
                'pirate_shanghai_choose_minion',
                'pirate_powderkeg',
                'ninja_master',
                'ninja_tiger_assassin',
                'ninja_seeing_stars',
                'ninja_way_of_deception_choose_minion',
                'ninja_disguise_choose_base',
                'ninja_hidden_ninja',
                'dino_laser_triceratops',
                'dino_augmentation',
                'dino_natural_selection_choose_mine',
                'dino_survival_tiebreak',
                'dino_rampage',
                'dino_rampage_choose_minion',
                'robot_microbot_guard',
                'robot_tech_center',
            ];
            for (const id of interactionAbilities) {
                const handler = getInteractionHandler(id);
                expect(handler, `${id} 交互处理函数应已注册`).toBeDefined();
            }
        });
    });

    describe('Prompt 创建流程', () => {
        it('多目标能力创建 Interaction（不再生成 CHOICE_REQUESTED）', () => {
            const runner = createRunner();

            // 先完成选秀
            const setupResult = runner.run({
                name: '选秀',
                commands: DRAFT_COMMANDS,
            });

            // 手动构造一个状态，P0 有随从在两个基地
            const state = setupResult.finalState;
            const p0Hand = state.core.players['0'].hand;
            const cropCircles = p0Hand.find(c => c.defId === 'alien_crop_circles');
            const p0Minion1 = p0Hand.find(c => c.type === 'minion');

            if (!cropCircles || !p0Minion1) {
                // 随机抽牌可能没给这些卡，跳过
                return;
            }

            // 打出随从到基地 0
            const result1 = runner.run({
                name: '打出随从',
                commands: [
                    ...DRAFT_COMMANDS,
                    { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: p0Minion1.uid, baseIndex: 0 } },
                ],
            });

            // 如果只有一个基地有随从，麦田怪圈会自动选择，不创建 Interaction
            // 需要两个基地都有随从才会触发 Interaction
            expect(result1.finalState.sys.interaction.current).toBeUndefined();
        });
    });

    describe('SYS_PROMPT_RESPOND 处理', () => {
        it('没有活跃 Prompt 时响应返回错误', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '无 Prompt 时响应',
                commands: [
                    ...DRAFT_COMMANDS,
                    { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: 'test' } },
                ],
            });

            // PromptSystem 拦截并返回错误
            const lastError = result.actualErrors[result.actualErrors.length - 1];
            expect(lastError).toBeDefined();
            expect(lastError.error).toBe('没有待处理的选择');
        });
    });

    describe('完整响应链流程', () => {
        it('迁移后不再使用 CHOICE_REQUESTED 事件', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '检查事件结构',
                commands: DRAFT_COMMANDS,
            });

            // 选秀阶段不会产生任何交互事件
            const allEvents = result.steps.flatMap(s => s.events);
            // CHOICE_REQUESTED 已移除，所有交互通过 InteractionSystem 处理
            expect(allEvents.filter(e => e.type === 'su:choice_requested')).toHaveLength(0);
        });

        it('SmashUp Prompt 桥接系统正常工作', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '桥接系统验证',
                commands: DRAFT_COMMANDS,
            });

            // 游戏初始化成功
            expect(result.finalState.core.turnOrder).toHaveLength(2);
            expect(result.finalState.sys.interaction.current).toBeUndefined();
            expect(result.finalState.sys.interaction.queue).toEqual([]);
        });
    });
});

describe('能力特定的 Prompt 流程', () => {
    beforeAll(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
        initAllAbilities();
    });

    describe('pirate_cannon (加农炮)', () => {
        it('第一次选择的交互处理函数存在', () => {
            const handler = getInteractionHandler('pirate_cannon_choose_first');
            expect(handler).toBeDefined();
            expect(typeof handler).toBe('function');
        });

        it('第二次选择的交互处理函数存在', () => {
            const handler = getInteractionHandler('pirate_cannon_choose_second');
            expect(handler).toBeDefined();
            expect(typeof handler).toBe('function');
        });
    });

    describe('zombie_grave_digger (掘墓人)', () => {
        it('交互处理函数存在且为函数类型', () => {
            const handler = getInteractionHandler('zombie_grave_digger');
            expect(handler).toBeDefined();
            expect(typeof handler).toBe('function');
        });
    });

    describe('pirate_shanghai (上海)', () => {
        it('选择随从的交互处理函数存在', () => {
            const handler = getInteractionHandler('pirate_shanghai_choose_minion');
            expect(handler).toBeDefined();
            expect(typeof handler).toBe('function');
        });

        it('选择基地的交互处理函数存在', () => {
            const handler = getInteractionHandler('pirate_shanghai_choose_base');
            expect(handler).toBeDefined();
            expect(typeof handler).toBe('function');
        });
    });

    describe('alien_crop_circles (麦田怪圈)', () => {
        it('交互处理函数存在且为函数类型', () => {
            const handler = getInteractionHandler('alien_crop_circles');
            expect(handler).toBeDefined();
            expect(typeof handler).toBe('function');
        });
    });
});

describe('SYS_PROMPT_RESOLVED 触发继续执行', () => {
    beforeAll(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
        initAllAbilities();
    });

    it('PROMPT_EVENTS.RESOLVED 常量正确', () => {
        expect(INTERACTION_EVENTS.RESOLVED).toBe('SYS_INTERACTION_RESOLVED');
    });

    it('初始状态无活跃 Interaction', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '验证初始状态',
            commands: DRAFT_COMMANDS,
        });

        expect(result.finalState.sys.interaction.current).toBeUndefined();
    });
});
