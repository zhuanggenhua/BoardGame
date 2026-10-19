import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AndroidForceUpdateGate } from '../system/AndroidForceUpdateGate';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe('AndroidForceUpdateGate', () => {
    it('displays the release notes carried by the OTA manifest', () => {
        render(
            <AndroidForceUpdateGate
                state={{
                    phase: 'downloading',
                    blocking: true,
                    version: '6.0.0-ota-test',
                    releaseNotes: '- 修正更新记录来源\n- 显示 Android OTA 更新说明',
                }}
                onRetry={() => {}}
                onDismiss={() => {}}
            />,
        );

        expect(screen.getByTestId('ota-release-notes')).toHaveTextContent('ota.forceUpdate.releaseNotesTitle');
        expect(screen.getByTestId('ota-release-notes')).toHaveTextContent(/- 修正更新记录来源\s+- 显示 Android OTA 更新说明/);
    });
});
