import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
    QIDAHEN_FACTION_SELECT_COPY,
    QIDAHEN_FACTION_SELECT_IDS,
    QIDAHEN_SCENARIO_SHORT_NAME,
} from '../ui/factionSelectionCopy';

const ruleSource = readFileSync(resolve(__dirname, '..', 'rule', '七大恨规则.md'), 'utf-8');

describe('七大恨派系选择文案', () => {
    it('三个势力都使用规则《游戏简介》原文，不发明口号', () => {
        expect(QIDAHEN_FACTION_SELECT_IDS).toEqual(['ming', 'mongol', 'jin']);
        expect(QIDAHEN_FACTION_SELECT_COPY.ming.intro).toContain('屹立百年的火药帝国');
        expect(QIDAHEN_FACTION_SELECT_COPY.mongol.intro).toContain('林丹汗');
        expect(QIDAHEN_FACTION_SELECT_COPY.jin.intro).toContain('努尔哈赤');
        expect(JSON.stringify(QIDAHEN_FACTION_SELECT_COPY)).not.toContain('资源紧张');
        expect(JSON.stringify(QIDAHEN_FACTION_SELECT_COPY)).not.toContain('机动灵活');
        expect(JSON.stringify(QIDAHEN_FACTION_SELECT_COPY)).not.toContain('手牌充足');
        expect(JSON.stringify(QIDAHEN_FACTION_SELECT_COPY)).not.toContain('待锁定');
    });

    it('势力行动效果来自规则正文', () => {
        const compactRule = ruleSource.replace(/\s+/g, '');
        for (const factionId of QIDAHEN_FACTION_SELECT_IDS) {
            for (const action of QIDAHEN_FACTION_SELECT_COPY[factionId].actions) {
                expect(ruleSource).toContain(action.name);
                expect(compactRule).toContain(action.effect.replace(/\s+/g, ''));
            }
        }
        expect(QIDAHEN_FACTION_SELECT_COPY.ming.facts).toContain('手牌上限 15');
        expect(QIDAHEN_FACTION_SELECT_COPY.mongol.facts).toContain('牌库 20');
        expect(QIDAHEN_FACTION_SELECT_COPY.jin.facts).toContain('牌库 18');
    });

    it('剧本短名只使用规则对象名称', () => {
        expect(QIDAHEN_SCENARIO_SHORT_NAME['post-sarhu-1619']).toBe('萨尔浒战后');
        expect(QIDAHEN_SCENARIO_SHORT_NAME['shanhaiguan-1622']).toBe('山海关之议');
        expect(QIDAHEN_SCENARIO_SHORT_NAME['dingmao-rebellion-1627']).toBe('丁卯胡乱');
    });
});
