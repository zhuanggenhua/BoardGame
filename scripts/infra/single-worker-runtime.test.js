import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const runtimeModule = new URL('./single-worker-runtime.js', import.meta.url).href;

function runNode(source) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    timeout: 5000,
  });
}

test('ignores child stdout/stderr tails after close, preserves open writes, and closes idempotently', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'single-worker-runtime-writer-'));
  const logFile = path.join(directory, 'runtime.log');
  try {
    const child = runNode(`
      import { EventEmitter } from 'node:events';
      import { createRuntimeLogWriter } from ${JSON.stringify(runtimeModule)};
      const writer = createRuntimeLogWriter(${JSON.stringify(logFile)}, console);
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      writer.writeLine('open-line');
      writer.pipeChildOutput({ stdout, stderr });
      stdout.emit('data', Buffer.from('stdout-open'));
      stderr.emit('data', Buffer.from('stderr-open'));
      writer.close();
      writer.close();
      stdout.emit('data', Buffer.from('stdout-tail'));
      stderr.emit('data', Buffer.from('stderr-tail'));
      await new Promise(resolve => setTimeout(resolve, 50));
    `);
    assert.equal(child.status, 0, `child must close cleanly; stderr:\n${child.stderr}`);
    assert.doesNotMatch(child.stderr, /ERR_STREAM_WRITE_AFTER_END/);
    assert.equal(fs.readFileSync(logFile, 'utf8'), 'open-line\nstdout-openstderr-open');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('does not hide a genuine log-file open error', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'single-worker-runtime-writer-error-'));
  try {
    const child = runNode(`
      import { createRuntimeLogWriter } from ${JSON.stringify(runtimeModule)};
      const writer = createRuntimeLogWriter(${JSON.stringify(directory)}, console);
      writer.writeLine('trigger file error');
      await new Promise(resolve => setTimeout(resolve, 100));
    `);
    assert.notEqual(child.status, 0, 'a real filesystem error must remain observable');
    assert.match(child.stderr, /EISDIR/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
