import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Locator, TestInfo } from '@playwright/test';

export async function saveLocatorHtmlSnapshot(
  locator: Locator,
  testInfo: TestInfo,
  snapshotPath: string,
): Promise<void> {
  await mkdir(dirname(snapshotPath), { recursive: true });
  const html = await locator.evaluate((element) => element.outerHTML);
  await writeFile(snapshotPath, html, 'utf8');
  testInfo.annotations.push({
    type: 'evidence-html-snapshot',
    description: snapshotPath,
  });
}

export async function expectNoDuplicateUiOwners(
  locator: Locator,
  testInfo: TestInfo,
  ruleset: string,
  snapshotPath: string,
): Promise<void> {
  await saveLocatorHtmlSnapshot(locator, testInfo, snapshotPath);

  try {
    execFileSync(
      process.execPath,
      ['.spec/tools/scan-ui-duplicate-owners.mjs', '--ruleset', ruleset, snapshotPath],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  } catch (error) {
    const failure = error as {
      message?: string;
      stderr?: Buffer | string;
      stdout?: Buffer | string;
    };
    const stdout = failure.stdout ? String(failure.stdout).trim() : '';
    const stderr = failure.stderr ? String(failure.stderr).trim() : '';
    throw new Error([
      `UI duplicate owner ruleset failed: ${ruleset}`,
      `snapshot: ${snapshotPath}`,
      stdout,
      stderr,
      failure.message,
    ].filter(Boolean).join('\n'));
  }
}
