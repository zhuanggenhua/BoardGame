import { describe, expect, it } from 'vitest';
import {
    getQidahenScenarioCardPreview,
    getQidahenSetupArmamentPreview,
    getQidahenSetupCharacterPreview,
} from '../ui/setupCardPreviews';

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
        expect(getQidahenSetupArmamentPreview('cavalry-armor')).toMatchObject({ index: 10 });
        expect(getQidahenSetupArmamentPreview('artillery-tech')).toMatchObject({ index: 26 });
        expect(getQidahenSetupArmamentPreview('cavalry-firearm')).toMatchObject({ index: 39 });
        expect(getQidahenSetupArmamentPreview('long-barreled-musket')).toMatchObject({ index: 46 });
    });
});
