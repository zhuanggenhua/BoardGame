import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { captureEvidenceSourceIdentity } from '../framework/sourceIdentity';

const contractPath = path.resolve('e2e/fate-domination/fgo-capture-contract.json');
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

export async function fgoEvidenceSnapshot(page: Page) {
  const visible = {
    actionEnabled: await page.getByTestId('fate-domination-primary-action').isEnabled(),
    battleVisible: await page.getByTestId('fate-fgo-battle').isVisible(),
    nobleVisible: await page.getByTestId('fate-fgo-noble').isVisible(),
  };
  const authoritative = await page.evaluate(() => {
    const core = (window as any).__BG_TEST_HARNESS__.state.get().core;
    return { phase: core.phase, resolvedLocations: core.resolvedLocations, currentPlayerId: core.currentPlayerId };
  });
  return { visible, authoritative };
}

export async function writeFgoEvidence(page: Page, info: TestInfo, data: {
  chainId: string; action: string; outcome: string;
  before: Awaited<ReturnType<typeof fgoEvidenceSnapshot>>;
  after: Awaited<ReturnType<typeof fgoEvidenceSnapshot>>;
  assertions: Array<{ name: string; actual: unknown; expected: unknown }>;
  screenshots: Array<{ file: string; id: string; change: 'animation-phase' | 'interaction-mode' }>;
}) {
  for (const assertion of data.assertions) {
    if (!isDeepStrictEqual(assertion.actual, assertion.expected)) throw new Error(`证据断言失败：${assertion.name}`);
  }
  const contract = await readFile(contractPath);
  const identity = await captureEvidenceSourceIdentity(page, 'fate-domination');
  const sourceRun = process.env.PW_E2E_SESSION_ID;
  if (!sourceRun) throw new Error('缺少本次端到端运行身份');
  const uiStates = await Promise.all(data.screenshots.map(async item => ({
    id: item.id, stepId: 'execute', change: item.change, viewport: 'desktop',
    sha256: sha256(await readFile(info.outputPath(item.file))),
  })));
  await writeFile(info.outputPath('capture-contract.json'), contract);
  await writeFile(info.outputPath('source-identity.json'), JSON.stringify(identity, null, 2));
  await writeFile(info.outputPath('behavior-trace.json'), JSON.stringify({
    gameId: 'fate-domination', evidenceCategory: 'independent', sourceRun,
    sourceRevision: identity.sourceRevision, chainId: data.chainId, status: 'PASS', outcome: data.outcome,
    fixtureBoundary: '正式牌桌代表态，玩家通过页面执行当前动作；不是新局自然全流程。',
    captureContract: { sha256: sha256(contract) },
    steps: [{ id: 'execute', action: data.action, before: data.before, after: data.after, assertions: data.assertions }],
    uiStates,
  }, null, 2));
}
