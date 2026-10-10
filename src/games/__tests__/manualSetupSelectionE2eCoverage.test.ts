import { describe, expect, it } from 'vitest';
import { GAME_MANIFEST } from '../manifest';

// 这份清单是“真实浏览器截图 E2E 已覆盖”的测试合同。
// manifest 新增 manualSetupSelection=true 时，必须先补对应 E2E 再更新这里。
const MANUAL_SETUP_E2E_GAME_IDS = [
    'dicethrone',
    'qidahen',
    'smashup',
    'summonerwars',
] as const;

describe('手动代 AI 开局选择的 E2E 覆盖', () => {
    it('所有声明手动开局选择的游戏都必须有真实浏览器截图 E2E', () => {
        const declaredGameIds = GAME_MANIFEST
            .filter((manifest) => manifest.type === 'game' && manifest.ai?.manualSetupSelection === true)
            .map((manifest) => manifest.id)
            .sort();

        expect(declaredGameIds).toEqual([...MANUAL_SETUP_E2E_GAME_IDS].sort());
    });
});
