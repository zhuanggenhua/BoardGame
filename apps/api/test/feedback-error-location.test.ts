import { describe, expect, it } from 'vitest';
import { projectSafeErrorLocation } from '../src/modules/feedback/errorLocation';

describe('客户端错误位置安全投影', () => {
    it('只提取正式站点构建产物指纹和行列，并可在读取投影时保留', () => {
        const location = projectSafeErrorLocation('https://easyboardgame.top/assets/index-AbCd1234.js:12:345', undefined);
        expect(location).toEqual({ bundle: 'AbCd1234', line: 12, column: 345 });
        expect(projectSafeErrorLocation(undefined, location)).toEqual(location);
    });

    it('拒绝外站、页面、查询参数、原始堆栈和不合法的持久化位置', () => {
        for (const source of [
            'https://other.example/assets/index-AbCd1234.js:12:345',
            'https://easyboardgame.top/play/private-player:12:345',
            'https://easyboardgame.top/assets/index-AbCd1234.js?token=private:12:345',
            'at function (https://easyboardgame.top/assets/index-AbCd1234.js:12:345)',
        ]) expect(projectSafeErrorLocation(source, undefined)).toBeUndefined();
        expect(projectSafeErrorLocation(undefined, { bundle: '../private', line: 1, column: 2 })).toBeUndefined();
    });
});
