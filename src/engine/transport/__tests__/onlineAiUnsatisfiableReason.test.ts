import { describe, expect, it } from 'vitest';
import { resolveUnsatisfiableReasonFromInteraction } from '../onlineAiRecovery';

describe('resolveUnsatisfiableReasonFromInteraction（诊断口径）', () => {
    it('没有 interaction 时不应误报 empty-options', () => {
        expect(resolveUnsatisfiableReasonFromInteraction(undefined, undefined)).toBeNull();
    });
});
