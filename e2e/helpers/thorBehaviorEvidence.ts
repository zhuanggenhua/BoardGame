import type { Page, TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '../framework';
import { getEvidenceScreenshotDir } from '../framework/evidenceScreenshots';
import { finalizeThorEvidenceSourceIdentity, shot } from './dicethroneThorEvidence';

type Snapshot = { visible: Record<string, unknown>; authoritative: Record<string, unknown> };
type Assertion = { name: string; actual: unknown; expected: unknown };

/** 记录实际玩家操作；截图视觉裁决仍须另行逐图执行。 */
export async function createThorBehaviorEvidence(
 page: Page,
 info: TestInfo,
 chainId: string,
 authoritative: () => Promise<Record<string, unknown>>,
 contractFile = 'e2e/dicethrone/thor-required-ui-states.json',
 fixtureBoundary = '合法代表态：手牌与起始资源预置；动作和结果来自同次页面运行。',
) {
 const contractPath = join(process.cwd(), contractFile);
 const contractBytes = await readFile(contractPath);
 const contract = JSON.parse(contractBytes.toString('utf8')) as { requiredStates: Array<{ chainId: string; uiStateId: string }> };
 const required = contract.requiredStates.filter(state => state.chainId === chainId).map(state => state.uiStateId);
 if (!required.length) throw new Error(`没有预先声明的截图合同：${chainId}`);
 const steps: Array<{ id: string; action: string; before: Snapshot; after: Snapshot; assertions: Assertion[] }> = [];
 const media: Array<{ id: string; stepId: string; change: string; viewport: string; sha256: string; path: string }> = [];
 const snapshot = async (): Promise<Snapshot> => ({
  visible: await page.evaluate(() => ({
   url: location.href, text: document.body.innerText, viewport: { width: innerWidth, height: innerHeight },
   health: Object.fromEntries(Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial-id="opponent-health"]'))
    .map(node => [node.dataset.feedbackPlayerId ?? '', node.innerText.trim()])),
   ownHealth: document.querySelector<HTMLElement>('[data-dicethrone-resource="health"]')?.innerText.trim() ?? '',
   dice: Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="die-button-"]'))
    .map(node => node.getAttribute('data-display-value')),
  })),
  authoritative: await authoritative(),
 });
 return {
  async step(id: string, action: string, run: () => Promise<void>, check: (after: Snapshot) => Assertion[]) {
   const before = await snapshot();
   await run();
   const after = await snapshot();
   const assertions = check(after);
   if (!assertions.length) throw new Error(`行为步骤缺少断言：${id}`);
   for (const assertion of assertions) expect(assertion.actual, assertion.name).toEqual(assertion.expected);
   steps.push({ id, action, before, after, assertions });
  },
  async capture(id: string, stepId: string, name: string, change: string) {
   if (!required.includes(id) || !steps.some(step => step.id === stepId)) throw new Error(`截图不属于本次合同或没有对应动作：${id}`);
   await shot(page, info, name);
   const path = join(getEvidenceScreenshotDir(info), `${name}.png`);
   media.push({ id, stepId, change, viewport: 'desktop', sha256: createHash('sha256').update(await readFile(path)).digest('hex'), path });
  },
  async finish(outcome: string) {
   expect(await readFile(contractPath)).toEqual(contractBytes);
   expect(media.map(item => item.id)).toEqual(required);
   const sourceRevision = await finalizeThorEvidenceSourceIdentity(page);
   if (!sourceRevision) throw new Error('行为链缺少源码身份');
   const trace = { gameId: 'dicethrone', evidenceCategory: 'independent', chainId,
    sourceRun: process.env.PW_E2E_SESSION_ID, sourceRevision, status: 'PASS', outcome,
    fixtureBoundary,
    captureContract: { sha256: createHash('sha256').update(contractBytes).digest('hex') }, steps, uiStates: media };
   await writeFile(join(getEvidenceScreenshotDir(info), `${chainId}.trace.json`), JSON.stringify(trace, null, 2));
  },
 };
}
