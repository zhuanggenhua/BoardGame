import { describe, expect, it } from 'vitest';
import type { QidahenArmamentId } from '../domain/types';
import {
    getQidahenArmamentInspectView,
    getQidahenScenarioCardPreview,
    getQidahenSetupArmamentPreview,
    getQidahenSetupCharacterPreview,
    listQidahenDevelopedArmaments,
} from '../ui/setupCardPreviews';

const ALL_ARMAMENT_IDS: readonly QidahenArmamentId[] = [
    'infantry-armor',
    'han-banners',
    'manzhou-banners',
    'mongol-banners',
    'cavalry-armor',
    'horse-breeding',
    'artillery-tech',
    'cavalry-firearm',
    'western-bastion',
    'long-barreled-musket',
];

describe('七大恨局内前置真实卡图映射', () => {
    it('三个剧本都映射到蒙古牌组中的正式剧本卡', () => {
        expect(getQidahenScenarioCardPreview('dingmao-rebellion-1627')).toMatchObject({ index: 0 });
        expect(getQidahenScenarioCardPreview('post-sarhu-1619')).toMatchObject({ index: 1 });
        expect(getQidahenScenarioCardPreview('shanhaiguan-1622')).toMatchObject({ index: 2 });
    });

    it('人物前置使用对应阵营的正式人物牌', () => {
        expect(getQidahenSetupCharacterPreview('ming', 'ming-xiong-tingbi')).toMatchObject({ index: 0 });
        expect(getQidahenSetupCharacterPreview('ming', 'ming-wang-huazhen')).toMatchObject({ index: 8 });
        expect(getQidahenSetupCharacterPreview('jin', 'jin-eidu')).toMatchObject({ index: 4 });
        expect(getQidahenSetupCharacterPreview('jin', 'jin-fan-wencheng')).toMatchObject({ index: 1 });
    });

    it('军备前置使用普通手牌 atlas 中的同名军备牌', () => {
        expect(getQidahenSetupArmamentPreview('infantry-armor')).toMatchObject({ index: 3 });
        expect(getQidahenSetupArmamentPreview('han-banners')).toMatchObject({ index: 5 });
        expect(getQidahenSetupArmamentPreview('manzhou-banners')).toMatchObject({ index: 6 });
        expect(getQidahenSetupArmamentPreview('mongol-banners')).toMatchObject({ index: 7 });
        expect(getQidahenSetupArmamentPreview('cavalry-armor')).toMatchObject({ index: 10 });
        expect(getQidahenSetupArmamentPreview('horse-breeding')).toMatchObject({ index: 17 });
        expect(getQidahenSetupArmamentPreview('artillery-tech')).toMatchObject({ index: 26 });
        expect(getQidahenSetupArmamentPreview('cavalry-firearm')).toMatchObject({ index: 39 });
        expect(getQidahenSetupArmamentPreview('western-bastion')).toMatchObject({ index: 42 });
        expect(getQidahenSetupArmamentPreview('long-barreled-musket')).toMatchObject({ index: 46 });
    });

    it('检视军备只展示已开发项，并且每项都有正式卡面和规则摘要', () => {
        expect(listQidahenDevelopedArmaments([
            { id: 'artillery-tech', name: '火炮技术', level: 1 },
            { id: 'infantry-armor', name: '步兵铁甲', level: 0 },
        ]).map((armament) => armament.id)).toEqual(['artillery-tech']);

        for (const armamentId of ALL_ARMAMENT_IDS) {
            const view = getQidahenArmamentInspectView(armamentId);
            expect(view?.previewRef).toMatchObject({ type: 'atlas' });
            expect(view?.rulesSummary.length).toBeGreaterThan(0);
        }
        expect(getQidahenArmamentInspectView('artillery-tech')?.rulesSummary).toContain('炮兵');
        expect(getQidahenArmamentInspectView('cavalry-firearm')?.previewRef).toMatchObject({ index: 39 });
    });
});
