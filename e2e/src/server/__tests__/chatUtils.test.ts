import { describe, it, expect } from 'vitest';
import { MAX_CHAT_LENGTH, sanitizeChatText } from '../chatUtils';

describe('chatUtils', () => {
    it('sanitizeChatText: 空白返回 null', () => {
        expect(sanitizeChatText('')).toBeNull();
        expect(sanitizeChatText('   ')).toBeNull();
    });

    it('sanitizeChatText: 去除首尾空白并保留内容', () => {
        expect(sanitizeChatText('  hello  ')).toBe('hello');
    });

    it('sanitizeChatText: 超过长度限制返回 null', () => {
        const tooLong = 'a'.repeat(MAX_CHAT_LENGTH + 1);
        expect(sanitizeChatText(tooLong)).toBeNull();
    });

    it('sanitizeChatText: 等于长度上限可通过', () => {
        const ok = 'b'.repeat(MAX_CHAT_LENGTH);
        expect(sanitizeChatText(ok)).toBe(ok);
    });
});
