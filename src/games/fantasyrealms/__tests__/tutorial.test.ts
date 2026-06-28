import { describe, expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { CHEAT_COMMANDS } from '../../../engine/systems/CheatSystem';
import zhCNLocale from '../../../../public/locales/zh-CN/game-fantasyrealms.json';
import { engineConfig } from '../game';
import tutorial from '../tutorial';

describe('FantasyRealms 教程配置', () => {
    it('基础教程包含真实抓牌与拿中央牌两段可操作链路', () => {
        expect(tutorial.id).toBe('fantasyrealms-basic');
        expect(tutorial.steps.map((step) => step.id)).toEqual([
            'setup-draw-turn',
            'welcome',
            'deck-intro',
            'center-row-intro',
            'draw-from-deck',
            'discard-after-draw',
            'setup-take-center',
            'take-center-card',
            'discard-after-center',
            'turn-loop',
            'endgame-rule',
            'finish',
        ]);
    });

    it('需要用户操作的步骤都声明了允许命令和推进事件', () => {
        const actionSteps = tutorial.steps.filter((step) => step.requireAction);
        expect(actionSteps.length).toBeGreaterThan(0);

        for (const step of actionSteps) {
            expect(step.allowedCommands && step.allowedCommands.length > 0).toBe(true);
            expect(step.advanceOnEvents && step.advanceOnEvents.length > 0).toBe(true);
        }
    });

    it('正式可操作链只包含两条行动路线对应的四个动作位', () => {
        const actionSteps = tutorial.steps.filter((step) => step.requireAction);
        expect(actionSteps.map((step) => step.id)).toEqual([
            'draw-from-deck',
            'discard-after-draw',
            'take-center-card',
            'discard-after-center',
        ]);
        expect(actionSteps.map((step) => step.allowedCommands)).toEqual([
            ['DRAW_FROM_DECK'],
            ['DISCARD_CARD'],
            ['TAKE_FROM_DISCARD'],
            ['DISCARD_CARD'],
        ]);
    });

    it('抓牌步骤只允许从牌库摸牌，并由 CARDS_DRAWN 推进', () => {
        const step = tutorial.steps.find((item) => item.id === 'draw-from-deck');
        expect(step?.allowedCommands).toEqual(['DRAW_FROM_DECK']);
        expect(step?.advanceOnEvents).toContainEqual({
            type: 'CARDS_DRAWN',
            match: { playerId: '0' },
        });
    });

    it('拿中央牌步骤锁定到公开区目标，并由 DISCARD_CARD_TAKEN 推进', () => {
        const step = tutorial.steps.find((item) => item.id === 'take-center-card');
        expect(step?.allowedCommands).toEqual(['TAKE_FROM_DISCARD']);
        expect(step?.allowedTargets).toEqual(['land-bell-tower']);
        expect(step?.advanceOnEvents).toContainEqual({
            type: 'DISCARD_CARD_TAKEN',
            match: { playerId: '0' },
        });
    });

    it('教程规则文案会明确两种正式行动，而不是只讲抽象来源', () => {
        expect(zhCNLocale.tutorial.steps.welcome).toContain('两种行动');
        expect(zhCNLocale.tutorial.steps.welcome).toContain('摸一张牌，再弃一张牌');
        expect(zhCNLocale.tutorial.steps.welcome).toContain('从中央公开弃牌里拿一张牌，再弃一张牌');
        expect(zhCNLocale.tutorial.steps.centerRowIntro).toContain('第二种行动');
        expect(zhCNLocale.tutorial.steps.centerRowIntro).toContain('再弃一张牌');
        expect(zhCNLocale.tutorial.steps.turnLoop).toContain('摸牌并弃牌');
        expect(zhCNLocale.tutorial.steps.turnLoop).toContain('拿中央公开弃牌并弃牌');
        expect(zhCNLocale.tutorial.steps.finish).toContain('两种核心行动');
    });

    it('首个正式教学局面会同时摆出牌库与中央公开弃牌，避免第一张图只剩文字口径', () => {
        const setupStep = tutorial.steps.find((item) => item.id === 'setup-draw-turn');
        const mergeAction = setupStep?.aiActions?.[0];
        expect(mergeAction?.commandType).toBe(CHEAT_COMMANDS.MERGE_STATE);

        const discardPile = (mergeAction?.payload as { fields?: { discardPile?: Array<{ id: string }> } } | undefined)?.fields?.discardPile;
        const drawPile = (mergeAction?.payload as { fields?: { drawPile?: Array<{ id: string }> } } | undefined)?.fields?.drawPile;

        expect(discardPile?.map((card) => card.id)).toEqual(['weather-rainstorm']);
        expect(drawPile?.map((card) => card.id)).toContain('flame-candle');
    });

    it('setup-draw-turn 的教程注入会真正覆盖双人开局，并在摸牌后得到钟塔教学目标', () => {
        const setupStep = tutorial.steps.find((item) => item.id === 'setup-draw-turn');
        const mergeAction = setupStep?.aiActions?.[0];
        expect(mergeAction?.commandType).toBe(CHEAT_COMMANDS.MERGE_STATE);

        const playerIds = ['0', '1'];
        const random = createSeededRandom('fantasyrealms-tutorial-test');
        let state = {
            core: engineConfig.domain.setup(playerIds, random),
            sys: createInitialSystemState(playerIds, engineConfig.systems, 'fantasyrealms-tutorial-test'),
        };

        const mergeResult = executePipeline(
            engineConfig as Parameters<typeof executePipeline>[0],
            state,
            {
                type: mergeAction!.commandType,
                playerId: '0',
                payload: mergeAction!.payload,
                timestamp: 1,
                skipValidation: true,
            } as Parameters<typeof executePipeline>[2],
            random,
            playerIds,
        );
        expect(mergeResult.success).toBe(true);
        state = mergeResult.state;

        expect(state.core.players['0']?.hand.map((card) => card.id)).toEqual(['wizard-collector']);
        expect(state.core.discardPile.map((card) => card.id)).toEqual(['weather-rainstorm']);
        expect(state.core.drawPile.slice(0, 2).map((card) => card.id)).toEqual(['flame-candle', 'land-bell-tower']);

        const drawResult = executePipeline(
            engineConfig as Parameters<typeof executePipeline>[0],
            state,
            {
                type: 'DRAW_FROM_DECK',
                playerId: '0',
                payload: {},
                timestamp: 2,
                skipValidation: true,
            } as Parameters<typeof executePipeline>[2],
            random,
            playerIds,
        );
        expect(drawResult.success).toBe(true);
        expect(drawResult.state.core.stage).toBe('discard');
        expect(drawResult.state.core.players['0']?.hand.map((card) => card.id)).toEqual([
            'wizard-collector',
            'flame-candle',
            'land-bell-tower',
        ]);
    });
});
