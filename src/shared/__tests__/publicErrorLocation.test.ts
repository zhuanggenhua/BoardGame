import { describe, expect, it } from 'vitest';
import { findPublicErrorSource, parsePublicErrorSource } from '../publicErrorLocation';

describe('正式构建异常位置', () => {
    it('识别 Safari 和 Chromium 栈里的正式直连及域名构建位置', () => {
        const direct = 'http://8.148.71.102/assets/index-AbCd1234.js:12:345';
        const domain = 'https://easyboardgame.top/assets/main-XyZ98765.js:6:78';
        expect(findPublicErrorSource(`render@${direct}\nother@file.js:1:1`)).toBe(direct);
        expect(findPublicErrorSource(`Error\n    at render (${domain})`)).toBe(domain);
        expect(parsePublicErrorSource(direct)).toEqual({ bundle: 'AbCd1234', line: 12, column: 345 });
    });

    it('拒绝相似主机、外站嵌套地址、查询参数和非构建脚本', () => {
        for (const source of [
            'http://8.148.71.102.evil.example/assets/index-AbCd1234.js:12:345',
            'https://evil.example/http://8.148.71.102/assets/index-AbCd1234.js:12:345',
            'http://8.148.71.102/assets/index-AbCd1234.js:12:345?token=private',
            'http://8.148.71.102/private-AbCd1234.js:12:345',
        ]) {
            expect(findPublicErrorSource(`render@${source}`)).toBeUndefined();
            expect(parsePublicErrorSource(source)).toBeUndefined();
        }
    });
});
