import { describe, expect, it } from 'vitest';
import {
    QIDAHEN_DISCARD_HAND_PROMPT,
    resolveQidahenOperationPrompt,
} from '../ui/operationPrompt';

const idleInput = {
    handInteractionTrayVisible: false,
    gaoDiDiscardPending: false,
};

describe('七大恨操作提示', () => {
    it('test_operation_prompt_tray_visible_hides_banner', () => {
        expect(resolveQidahenOperationPrompt({
            handInteractionTrayVisible: true,
            gaoDiDiscardPending: false,
        })).toBeNull();
        expect(resolveQidahenOperationPrompt({
            handInteractionTrayVisible: true,
            gaoDiDiscardPending: true,
        })).toBeNull();
    });

    it('test_operation_prompt_gao_di_discard_without_tray_shows_select_discard_hand', () => {
        expect(resolveQidahenOperationPrompt({
            handInteractionTrayVisible: false,
            gaoDiDiscardPending: true,
        })).toEqual({
            kind: 'discard-hand',
            title: QIDAHEN_DISCARD_HAND_PROMPT,
        });
    });

    it('test_operation_prompt_idle_hides_banner', () => {
        expect(resolveQidahenOperationPrompt(idleInput)).toBeNull();
    });
});
