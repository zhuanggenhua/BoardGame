import { describe, expect, it } from 'vitest';
import zhCNLocale from '../../../../public/locales/zh-CN/game-fantasyrealms.json';
import tutorial from '../tutorial';

describe('FantasyRealms 教程配置', () => {
    it('基础教程改成短句示范局结构，只保留常规对局的真实流程', () => {
        expect(tutorial.id).toBe('fantasyrealms-basic');
        expect(tutorial.steps.map((step) => step.id)).toEqual([
            'setup-state',
            'setup-overview',
            'draw-overview',
            'draw-from-deck',
            'discard-after-draw',
            'setup-take-center',
            'take-center-card',
            'discard-after-center',
            'setup-score-showcase',
            'score-intro',
            'score-card-details',
            'score-total-review',
            'endgame-review',
            'finish',
        ]);
    });

    it('需要用户操作的步骤仍然只允许真实游玩里的那条命令链', () => {
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

    it('开场会先隐藏铺好真实牌桌，再把第一句正式开场文案展示给玩家', () => {
        const setupState = tutorial.steps.find((step) => step.id === 'setup-state');
        const setupOverview = tutorial.steps.find((step) => step.id === 'setup-overview');
        const setupMerge = setupState?.aiActions?.[0];

        expect(setupState?.showMask).toBe(true);
        expect(setupState?.infoStep).not.toBe(true);
        expect(setupMerge?.commandType).toBe('SYS_CHEAT_MERGE_STATE');
        expect(setupOverview?.content).toBe('game-fantasyrealms:tutorial.steps.setupOverview');
        expect(setupOverview?.infoStep).toBe(true);
    });

    it('教程文案会先讲目标和基础回合，再直接点名当前牌和动作', () => {
        expect(zhCNLocale.tutorial.steps.setupOverview).toBe('先看当前手牌。');
        expect(zhCNLocale.tutorial.steps.drawOverview).toContain('终局总分最高');
        expect(zhCNLocale.tutorial.steps.drawOverview).toContain('始终维持 7 张手牌');
        expect(zhCNLocale.tutorial.steps.drawOverview).toContain('从牌库摸 1 张牌');
        expect(zhCNLocale.tutorial.steps.drawOverview).toContain('从弃牌堆拿 1 张牌');
        expect(zhCNLocale.tutorial.steps.drawFromDeck).toBe('现在点击摸牌按钮。');
        expect(zhCNLocale.tutorial.steps.discardAfterDraw).toContain('王后');
        expect(zhCNLocale.tutorial.steps.takeCenterCard).toContain('钟塔');
        expect(zhCNLocale.tutorial.steps.takeCenterCard).toContain('蜡烛');
        expect(zhCNLocale.tutorial.steps.takeCenterCard).toContain('选中钟塔');
        expect(zhCNLocale.tutorial.steps.discardAfterCenter).toContain('选中暴风雨');
        expect(zhCNLocale.tutorial.steps.scoreIntro).toContain('198 分');
        expect(zhCNLocale.tutorial.steps.scoreIntro).toContain('蜡烛');
        expect(zhCNLocale.tutorial.steps.scoreIntro).toContain('钟塔');
        expect(zhCNLocale.tutorial.steps.scoreCardDetails).toContain('点击或悬浮卡牌');
        expect(zhCNLocale.tutorial.steps.scoreTotalReview).toBe('右上角会显示这手牌的总分。');
        expect(zhCNLocale.tutorial.steps.endgameReview).toContain('中央弃牌堆达到 10 张');
        expect(zhCNLocale.tutorial.steps.endgameReview).toContain('分数最高的人获胜');
        expect(zhCNLocale.tutorial.steps.finish).toBe('现在开始一局真正的幻想国度吧。');
    });

    it('计分步骤会把分数带与终局区都纳入教学锚点', () => {
        const scoreIntro = tutorial.steps.find((step) => step.id === 'score-intro');
        const scoreCardDetails = tutorial.steps.find((step) => step.id === 'score-card-details');
        const scoreTotalReview = tutorial.steps.find((step) => step.id === 'score-total-review');
        const endgameReview = tutorial.steps.find((step) => step.id === 'endgame-review');

        expect(scoreIntro?.highlightTarget).toBe('fantasyrealms-live-score-band');
        expect(scoreCardDetails?.highlightTarget).toBe('fantasyrealms-card-hand-flame-candle');
        expect(scoreTotalReview?.highlightTarget).toBe('fantasyrealms-live-score-band');
        expect(endgameReview?.highlightTarget).toBe('fantasyrealms-card-hand-flame-candle');
    });

    it('拿中央牌案例会强制拿钟塔并弃掉暴风雨，保证玩家看到真实组合收益', () => {
        const takeCenterCard = tutorial.steps.find((step) => step.id === 'take-center-card');
        const discardAfterCenter = tutorial.steps.find((step) => step.id === 'discard-after-center');
        const discardAfterDraw = tutorial.steps.find((step) => step.id === 'discard-after-draw');

        expect(takeCenterCard?.allowedTargets).toEqual(['land-bell-tower']);
        expect(discardAfterDraw?.allowedTargets).toEqual(['leader-queen']);
        expect(discardAfterCenter?.allowedTargets).toEqual(['weather-rainstorm']);
        expect(takeCenterCard?.highlightTarget).toBe('fantasyrealms-card-discard-land-bell-tower');
        expect(discardAfterDraw?.highlightTarget).toBe('fantasyrealms-card-hand-leader-queen');
        expect(discardAfterCenter?.highlightTarget).toBe('fantasyrealms-card-hand-weather-rainstorm');
    });

    it('终局案例步骤会直接切到标准局终局评分态，而不是只留一段口头说明', () => {
        const setupScoreShowcase = tutorial.steps.find((step) => step.id === 'setup-score-showcase');
        const mergeAction = setupScoreShowcase?.aiActions?.[0];
        const focusAction = setupScoreShowcase?.aiActions?.[1];
        const payload = mergeAction?.payload as {
            fields?: {
                playerIds?: string[];
                setupConfig?: { variant?: string };
                players?: Record<string, { score?: number; hand?: Array<{ id: string }> }>;
                discardPile?: Array<{ id: string }>;
                focusCardId?: string;
            };
        } | undefined;

        expect(mergeAction?.commandType).toBe('SYS_CHEAT_MERGE_STATE');
        expect(payload?.fields?.setupConfig?.variant).toBe('standard');
        expect(payload?.fields?.playerIds).toEqual(['0', '1', '2']);
        expect(payload?.fields?.players?.['0']?.score).toBe(198);
        expect(payload?.fields?.players?.['1']?.score).toBe(154);
        expect(payload?.fields?.players?.['2']?.score).toBe(0);
        expect(payload?.fields?.discardPile).toHaveLength(10);
        expect(payload?.fields?.focusCardId).toBe('flame-candle');
        expect(payload?.fields?.players?.['0']?.hand?.map((card) => card.id)).toEqual([
            'artifact-book-of-changes',
            'flame-candle',
            'weapon-magic-wand',
            'wild-mirage',
            'weather-smoke',
            'wizard-collector',
            'land-bell-tower',
        ]);
        expect(focusAction).toMatchObject({
            commandType: 'SET_FOCUS_CARD',
            playerId: '0',
            payload: {
                cardId: 'flame-candle',
            },
        });
    });
});
