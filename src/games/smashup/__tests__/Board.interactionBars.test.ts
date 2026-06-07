import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { buildDiscardStripCards } from '../ui/discardStripCards';

function readBoardSource(): string {
    return readFileSync(resolve(__dirname, '..', 'Board.tsx'), 'utf-8');
}

describe('SmashUp 交互浮动操作栏源码约束', () => {
    it('浮动操作栏外层容器应保持 pointer-events-auto，避免真机触摸命中丢失', () => {
        const source = readBoardSource();
        expect(source).toContain("absolute inset-x-0 flex justify-center pointer-events-auto");
        expect(source).toContain("fixed inset-x-0 flex justify-center pointer-events-auto");
    });

    it('普通 hand prompt 仍由手牌直选承接，普通 reaction_choose button prompt 不应被整体排除出 PromptOverlay', () => {
        const source = readBoardSource();
        expect(source).toContain('isDirectHandSelectPrompt && handSelectExtraOptions.length > 0');
        expect(source).toContain('const shouldRender = !isDirectHandSelectPrompt');
        expect(source).not.toContain('const shouldRender = !isReactionChoicePrompt');
        expect(source).toContain('isDiscardMode={needDiscard}');
        expect(source).not.toContain('isHandDrivenPrompt');
        expect(source).not.toContain('isReactionDirectHandPrompt');
    });

    it('弃牌横条应把 discardActionPlayProvider 结果映射成点随从模式', () => {
        const stripCards = buildDiscardStripCards({
            isDiscardMinionPrompt: false,
            discardPlayOptions: [],
            discardActionPlayOptions: [{
                card: { uid: 'action-1', defId: 'cyborg_apes_shielding', owner: '0', type: 'action' },
                allowedBaseIndices: [0],
                allowedMinionUids: ['host-1'],
                sourceId: 'cyborg_apes_cyberback',
                defId: 'cyborg_apes_shielding',
                name: '护盾',
            }],
            discardSpecialOptions: [],
        });

        expect(stripCards).toEqual([{
            uid: 'action-1',
            defId: 'cyborg_apes_shielding',
            label: '护盾',
            mode: 'play_action_minion',
        }]);
    });

    it('弃牌堆 special 应按 allowedMinionUids 映射到点基地或点随从模式', () => {
        const stripCards = buildDiscardStripCards({
            isDiscardMinionPrompt: false,
            discardPlayOptions: [],
            discardActionPlayOptions: [],
            discardSpecialOptions: [
                {
                    card: { uid: 'special-base', defId: 'skeletons_revenant', owner: '0', type: 'minion' },
                    allowedBaseIndices: 'all',
                    sourceId: 'skeletons_revenant',
                    defId: 'skeletons_revenant',
                    name: '归来者',
                },
                {
                    card: { uid: 'special-minion', defId: 'world_champs_eh', owner: '0', type: 'action' },
                    allowedBaseIndices: [0],
                    allowedMinionUids: ['ally-1'],
                    sourceId: 'world_champs_eh',
                    defId: 'world_champs_eh',
                    name: 'Eh',
                },
            ],
        });

        expect(stripCards).toEqual([
            {
                uid: 'special-base',
                defId: 'skeletons_revenant',
                label: '归来者',
                mode: 'activate_special_base',
            },
            {
                uid: 'special-minion',
                defId: 'world_champs_eh',
                label: 'Eh',
                mode: 'activate_special_minion',
            },
        ]);
    });
});
