import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AndroidForceUpdateGate } from '../system/AndroidForceUpdateGate';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe('AndroidForceUpdateGate', () => {
    it('displays the release notes carried by the OTA manifest', () => {
        const releaseNotes = '王权骰铸 0.6.48：伤害响应提示修复\n\n本次更新修复伤害响应提示。\n\n## 修复\n- 修复不可防御伤害错误打开防御窗口';
        render(
            <AndroidForceUpdateGate
                state={{
                    phase: 'downloading',
                    blocking: true,
                    version: '6.0.0-ota-test',
                    releaseNotes,
                }}
                onRetry={() => {}}
                onDismiss={() => {}}
            />,
        );

        expect(screen.getByTestId('ota-release-notes')).toHaveTextContent('ota.forceUpdate.releaseNotesTitle');
        expect(screen.getByTestId('ota-release-notes')).toHaveTextContent(/王权骰铸 0\.6\.48：伤害响应提示修复/);
        expect(screen.getByTestId('ota-release-notes')).toHaveTextContent(/修复不可防御伤害错误打开防御窗口/);
    });
});
