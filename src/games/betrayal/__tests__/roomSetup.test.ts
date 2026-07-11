import { describe, expect, it } from 'vitest';
import { buildGamePublicRoomSummary } from '../../roomSetupRegistry';
import { DEFAULT_BETRAYAL_SCENARIO_ID } from '../scenarioConfig';
import {
    BETRAYAL_SCENARIO_SETUP_FIELD,
    buildBetrayalPublicRoomSummary,
    readBetrayalScenarioId,
    readExplicitBetrayalScenarioId,
} from '../roomSetup';

describe('山屋惊魂房间 setup 解析', () => {
    it('运行时没有显式选择时仍回退首剧本', () => {
        expect(readBetrayalScenarioId()).toBe(DEFAULT_BETRAYAL_SCENARIO_ID);
        expect(readBetrayalScenarioId({
            setupSelections: {
                [BETRAYAL_SCENARIO_SETUP_FIELD]: 'unknown-scenario',
            },
        })).toBe(DEFAULT_BETRAYAL_SCENARIO_ID);
    });

    it('会读取 setupSelections 和旧字段里的显式剧本选择', () => {
        expect(readExplicitBetrayalScenarioId({
            setupSelections: {
                [BETRAYAL_SCENARIO_SETUP_FIELD]: 'first-scenario',
            },
        })).toBe('first-scenario');
        expect(readExplicitBetrayalScenarioId({
            scenarioId: 'first-scenario',
        })).toBe('first-scenario');
    });

    it('公开房间摘要只在房间已带剧本选择时显示当前剧本', () => {
        expect(buildBetrayalPublicRoomSummary()).toEqual({});
        expect(buildGamePublicRoomSummary('betrayal', {})).toEqual({});
        expect(buildBetrayalPublicRoomSummary({
            roomName: '不应泄露',
            password: '1234',
            setupSelections: {
                [BETRAYAL_SCENARIO_SETUP_FIELD]: 'first-scenario',
            },
        })).toEqual({
            scenarioId: 'first-scenario',
        });
    });
});
