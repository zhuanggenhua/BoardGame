import { describe, it, expect } from 'vitest';

// 从 Feedback.tsx 中提取的纯逻辑，保持同步
const EMBEDDED_IMG_RE = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;

function extractText(content: string): string {
    return content.replace(EMBEDDED_IMG_RE, '').trim() || '（仅图片）';
}

function hasEmbeddedImage(content: string): boolean {
    EMBEDDED_IMG_RE.lastIndex = 0;
    return EMBEDDED_IMG_RE.test(content);
}

function parseImages(content: string): { text: string; images: string[] } {
    EMBEDDED_IMG_RE.lastIndex = 0;
    const images: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = EMBEDDED_IMG_RE.exec(content)) !== null) {
        images.push(match[2]);
    }
    return { text: extractText(content), images };
}

describe('反馈内容解析', () => {
    it('纯文本内容 — 无图片', () => {
        const content = '这是一个 bug 报告';
        expect(extractText(content)).toBe('这是一个 bug 报告');
        expect(hasEmbeddedImage(content)).toBe(false);
    });

    it('仅图片 — 无文本', () => {
        const content = '![Screenshot](data:image/jpeg;base64,/9j/4AAQ...)';
        expect(extractText(content)).toBe('（仅图片）');
        expect(hasEmbeddedImage(content)).toBe(true);
    });

    it('文本 + 图片混合', () => {
        const content = '页面白屏了\n\n![Screenshot](data:image/png;base64,iVBOR...)';
        const result = parseImages(content);
        expect(result.text).toBe('页面白屏了');
        expect(result.images).toHaveLength(1);
        expect(result.images[0]).toContain('data:image/png;base64,');
    });

    it('多张图片', () => {
        const content = '步骤1\n![s1](data:image/jpeg;base64,AAA)\n步骤2\n![s2](data:image/jpeg;base64,BBB)';
        const result = parseImages(content);
        expect(result.images).toHaveLength(2);
        expect(result.text).toContain('步骤1');
        expect(result.text).toContain('步骤2');
    });

    it('普通 Markdown 链接不被误匹配', () => {
        const content = '参考 [这个链接](https://example.com)';
        expect(hasEmbeddedImage(content)).toBe(false);
        expect(extractText(content)).toBe(content);
    });

    it('连续调用 hasEmbeddedImage 不受全局正则 lastIndex 影响', () => {
        const content = '![img](data:image/jpeg;base64,test)';
        expect(hasEmbeddedImage(content)).toBe(true);
        expect(hasEmbeddedImage(content)).toBe(true);
        expect(hasEmbeddedImage(content)).toBe(true);
    });
});
