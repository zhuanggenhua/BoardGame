import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import { findRuntimeById, listRuntimes } from '../../scripts/infra/e2e-runtime-registry.js';
import { hashSourceIdentity, selectFrontendEvidenceIdentity, selectRuntimeSourceIdentity, sourceIdentityMatches } from '../../scripts/infra/e2e-source-identity.mjs';

const releases = new WeakMap<BrowserContext, () => Promise<void>>();

export async function startSourceSession(context: BrowserContext, frontend: string) {
    if (releases.has(context)) return releases.get(context)!;
    const session = randomUUID();
    await context.addCookies([{ name: 'bg_e2e_source_session', value: session, url: frontend }]);
    const release = async () => {
        await context.request.delete(`${frontend}/__e2e/source-identity`, { headers: { 'x-e2e-source-session': session } });
        releases.delete(context);
    };
    releases.set(context, release);
    return release;
}

export async function releaseSourceSession(context: BrowserContext) { await releases.get(context)?.(); }

/** 核对实际响应快照及权威构建输入；变更消息只列本链真正消费的依赖。 */
export async function captureEvidenceSourceIdentity(page: Page, gameId: string) {
    const runtime = process.env.PW_MANAGED_RUNTIME_ID
        ? findRuntimeById(process.env.PW_MANAGED_RUNTIME_ID)
        : listRuntimes().find(item => item.scope === process.env.PW_RUNTIME_SCOPE);
    if (!runtime) throw new Error('缺少当前托管测试服务身份');
    const frontend = await page.evaluate(async () => {
        const response = await fetch('/__e2e/source-identity');
        if (!response.ok) throw new Error(`源依赖采集失败：${response.status}`);
        return response.json();
    });
    const targetFrontend = selectFrontendEvidenceIdentity(frontend, gameId);
    if (!targetFrontend.files?.length) throw new Error('当前浏览器未登记当前游戏的实际响应依赖');
    if (targetFrontend.conflicts?.length) throw new Error(`本链加载过不同版本：${targetFrontend.conflicts.join(', ')}`);
    const backend = selectRuntimeSourceIdentity(runtime.sourceIdentity, gameId);
    if (!backend?.files?.length) throw new Error('服务缺少可验证的构建依赖图，需要更新测试服务');
    const identity = { files: [...targetFrontend.files, ...backend.files] };
    if (!sourceIdentityMatches(identity)) {
        const changed = identity.files.filter(file => !sourceIdentityMatches({ files: [file] })).map(file => file.path);
        throw new Error(`本链实际依赖已改变：${[...new Set(changed)].join(', ')}`);
    }
    return {
        sourceRevision: hashSourceIdentity(identity),
        sourceIdentity: identity,
        frontendSourceIdentity: targetFrontend,
        backendSourceIdentity: backend,
        runtimeId: runtime.runtimeId,
    };
}
