import type { Page } from '@playwright/test';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../../src/games/qidahen/annualTutorial';

export const qidahenTutorialProgressIdentity = { gameId: 'qidahen', seed: `tutorial-progress:v1:qidahen:${QIDAHEN_ANNUAL_TUTORIAL.id}:r${QIDAHEN_ANNUAL_TUTORIAL.revision}`, numPlayers: 3 };

export const readQidahenStoredTutorialStep = (page: Page) => page.evaluate(async identity => {
    const path = '/src/engine/transport/localSession.ts';
    const { readLocalMatchSnapshot } = await import(path);
    return readLocalMatchSnapshot(identity)?.state.sys.tutorial.step?.id;
}, qidahenTutorialProgressIdentity);

/** 在浏览器内比较大历史，只返回摘要，避免把几十MB存档带回测试/主上下文。 */
export const readQidahenTutorialProgressStatus = (page: Page) => page.evaluate(async identity => {
    const path = '/src/engine/transport/localSession.ts';
    const { readLocalMatchSnapshot, buildLocalMatchSnapshotKey } = await import(path);
    const saved = readLocalMatchSnapshot(identity);
    const live = (window as any).__BG_TEST_HARNESS__.state.get();
    const digest = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return {
        storedStep: saved?.state.sys.tutorial.step?.id,
        encodedChars: localStorage.getItem(buildLocalMatchSnapshotKey(identity.gameId, identity.seed))?.length ?? 0,
        sourceBytes: saved ? new TextEncoder().encode(JSON.stringify(saved)).length : 0,
        savedCoreHash: saved ? await digest(saved.state.core) : '', liveCoreHash: await digest(live.core),
        savedHistoryHash: saved ? await digest(saved.state.sys.tutorial.checkpoints) : '', liveHistoryHash: await digest(live.sys.tutorial.checkpoints),
        checkpoints: live.sys.tutorial.checkpoints?.length ?? 0,
        randomCursor: saved?.randomCursor,
        randomPolicy: JSON.stringify(live.sys.tutorial.randomPolicy),
    };
}, qidahenTutorialProgressIdentity);
