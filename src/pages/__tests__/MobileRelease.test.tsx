/* @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MobileReleasePage from '../admin/MobileRelease';
import { getDeployProgressSnapshot } from '../admin/mobileReleaseProgress';

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

const baseStatus = {
    packageVersion: '0.6.1',
    androidVersionCode: 564,
    channel: 'stable',
    manifestUrl: 'https://example.com/ota/latest.json',
    latest: null,
    ota: {
        manifestUrl: 'https://example.com/ota/latest.json',
        latest: null,
    },
    native: {
        manifestUrl: 'https://example.com/native/latest.json',
        latest: null,
    },
    releaseReady: {
        script: true,
        nativeScript: true,
        packageScript: true,
        deployScript: true,
        deployRunner: true,
        otaWorkflow: false,
        dist: true,
        releaseApk: true,
        serverAssetsReady: true,
    },
    deploy: {
        statusCommand: 'bash scripts/deploy/deploy-image.sh status',
        updateCommand: 'bash scripts/deploy/deploy-image.sh update',
        updateExecutionEnabled: true,
        rollbackLastCommand: 'bash scripts/deploy/deploy-image.sh rollback-last',
        rollbackExecutionEnabled: true,
        rollbackLastTarget: {
            action: 'rollback-last',
            tag: 'latest',
            description: '上一版镜像',
        },
    },
    running: false,
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        token: 'token-1',
    }),
}));

vi.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({
        success: mockToastSuccess,
        error: mockToastError,
    }),
}));

vi.mock('../../config/server', () => ({
    ADMIN_API_URL: '/admin-api',
}));

const jsonResponse = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
});

describe('MobileReleasePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
        cleanup();
        vi.unstubAllGlobals();
    });

    it('部署执行按钮不再要求先输入确认文字', async () => {
        let executeBody: Record<string, unknown> | null = null;
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : input.toString();
            const method = init?.method ?? 'GET';
            if (method === 'GET' && url.includes('/mobile-release/android/status')) {
                return jsonResponse(baseStatus);
            }
            if (method === 'POST' && url.endsWith('/mobile-release/deploy/update/execute')) {
                executeBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
                return jsonResponse({
                    ok: true,
                    mode: 'execute',
                    command: 'bash scripts/deploy/deploy-image.sh update',
                    output: 'done',
                });
            }
            throw new Error(`Unexpected request: ${method} ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<MobileReleasePage />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'admin.mobileReleasePage.actions.execute_deploy_update' })).toBeEnabled();
        });

        const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
        expect(sectionHeadings.map((heading) => heading.textContent).slice(0, 2)).toEqual([
            'admin.mobileReleasePage.deployUpdate.title',
            'admin.mobileReleasePage.ota.title',
        ]);
        expect(screen.queryByText('admin.mobileReleasePage.deployUpdate.confirm_label')).toBeNull();

        fireEvent.change(screen.getAllByLabelText('admin.mobileReleasePage.form.ota_bundle_version')[0], {
            target: { value: '6.0.0-ota-2026-07-04T01-00-00-000Z' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'admin.mobileReleasePage.actions.execute_deploy_update' }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                '/admin-api/mobile-release/deploy/update/execute',
                expect.objectContaining({ method: 'POST' }),
            );
        });
        expect(executeBody).toMatchObject({
            version: '6.0.0-ota-2026-07-04T01-00-00-000Z',
            confirmText: '确认部署',
        });
        expect(await screen.findByText('admin.mobileReleasePage.result.server_log')).toBeTruthy();
        expect(screen.getByText('done')).toBeTruthy();
    });

    it('Docker 拉取日志会驱动部署进度而不是固定 55%', () => {
        const progress = getDeployProgressSnapshot({
            ok: true,
            mode: 'execute',
            jobId: 'job-1',
            status: 'running',
            exitCode: null,
            command: 'bash scripts/deploy/deploy-image.sh update',
            output: [
                'Pulling 11/16',
                'web Pulling',
                'cd0647388d7f Downloading [=================>                                 ]  1.522MB/4.369MB',
            ].join('\n'),
        });

        expect(progress).toEqual({
            percent: 63,
            labelKey: 'result.progress_pulling',
            detail: '11/16',
        });
        expect(progress.percent).not.toBe(55);
    });

    it('回滚执行按钮不再要求先输入确认文字', async () => {
        let executeBody: Record<string, unknown> | null = null;
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : input.toString();
            const method = init?.method ?? 'GET';
            if (method === 'GET' && url.includes('/mobile-release/android/status')) {
                return jsonResponse(baseStatus);
            }
            if (method === 'POST' && url.endsWith('/mobile-release/deploy/rollback/execute')) {
                executeBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
                return jsonResponse({
                    ok: true,
                    mode: 'execute',
                    command: 'bash scripts/deploy/deploy-image.sh rollback-last',
                    output: 'done',
                });
            }
            throw new Error(`Unexpected request: ${method} ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<MobileReleasePage />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'admin.mobileReleasePage.actions.execute_rollback' })).toBeEnabled();
        });

        expect(screen.queryByText('admin.mobileReleasePage.rollback.confirm_label')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'admin.mobileReleasePage.actions.execute_rollback' }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                '/admin-api/mobile-release/deploy/rollback/execute',
                expect.objectContaining({ method: 'POST' }),
            );
        });
        expect(executeBody).toMatchObject({
            action: 'rollback-last',
            confirmText: '确认回滚',
        });
    });

    it('OTA 发布可在 GitHub Actions 入口就绪时绕过本机发布产物要求', async () => {
        const status = {
            ...baseStatus,
            releaseReady: {
                ...baseStatus.releaseReady,
                script: false,
                otaWorkflow: true,
                dist: false,
                serverAssetsReady: false,
            },
        };
        let publishBody: Record<string, unknown> | null = null;
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : input.toString();
            const method = init?.method ?? 'GET';
            if (method === 'GET' && url.includes('/mobile-release/android/status')) {
                return jsonResponse(status);
            }
            if (method === 'POST' && url.endsWith('/mobile-release/android/ota/publish')) {
                publishBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
                return jsonResponse({
                    ok: true,
                    kind: 'ota',
                    mode: 'publish',
                    command: 'GitHub Actions workflow_dispatch zhuanggenhua/BoardGame/android-ota-publish.yml',
                    output: 'Android OTA 发布任务已提交到 GitHub Actions。',
                });
            }
            throw new Error(`Unexpected request: ${method} ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<MobileReleasePage />);

        const publishButton = await screen.findByRole('button', { name: 'admin.mobileReleasePage.actions.publish' });
        expect(publishButton).toBeEnabled();

        fireEvent.click(publishButton);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                '/admin-api/mobile-release/android/ota/publish',
                expect.objectContaining({ method: 'POST' }),
            );
        });
        expect(publishBody).toMatchObject({
            channel: 'stable',
            dryRun: false,
            forceUpdate: true,
        });
    });
});
