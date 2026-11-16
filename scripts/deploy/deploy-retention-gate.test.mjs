import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = process.cwd();
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';
const shellPath = value => process.platform === 'win32' ? value.replace(/\\/g, '/') : value;

test('下载 Compose 失败且旧配置缺少历史资源挂载时，在停止旧容器前终止部署', () => {
  if (process.platform === 'win32' && !existsSync(bash)) return;
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'boardgame-retention-gate-'));
  const bin = path.join(fixture, 'bin');
  const log = path.join(fixture, 'docker.log');
  const shellEnv = path.join(fixture, 'bash-env.sh');
  mkdirSync(bin);
  writeFileSync(path.join(fixture, '.env'), 'INTERNAL_FEEDBACK_TOKEN=test\n');
  writeFileSync(path.join(fixture, 'docker-compose.prod.yml'), 'services:\n  web:\n    image: old\n');
  writeFileSync(path.join(bin, 'curl'), '#!/usr/bin/env bash\nprintf "curl\\n" >> "$BG_GATE_DOCKER_LOG"\nexit 1\n', { mode: 0o755 });
  writeFileSync(path.join(bin, 'id'), '#!/usr/bin/env bash\nprintf "0\\n"\n', { mode: 0o755 });
  writeFileSync(path.join(bin, 'sudo'), '#!/usr/bin/env bash\nexit 2\n', { mode: 0o755 });
  writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$BG_GATE_DOCKER_LOG"
if [[ "$1 $2" == 'compose -f' ]]; then
  printf '%s\\n' '{"services":{"web":{"volumes":[]}}}'
  exit 0
fi
exit 2
`, { mode: 0o755 });
  // Git Bash 可能优先找到系统自带的 curl.exe；通过 bash 函数确保不访问网络。
  writeFileSync(shellEnv, `curl() { printf 'curl\\n' >> "$BG_GATE_DOCKER_LOG"; return 1; }
docker() { printf '%s\\n' "$*" >> "$BG_GATE_DOCKER_LOG"; return 2; }
id() { printf '0\\n'; }
export -f curl docker id
`);

  try {
    const result = spawnSync(bash, [shellPath(path.join(root, 'scripts/deploy/deploy-image.sh')), 'update-local', 'latest'], {
      cwd: fixture,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`, BASH_ENV: shellPath(shellEnv), BG_GATE_DOCKER_LOG: log, BG_WEB_ASSETS_ALREADY_RETAINED: '1' },
    });
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stdout + result.stderr, /部署配置缺少正确的 web 历史资源挂载/);
    const commands = existsSync(log) ? readFileSync(log, 'utf8') : '';
    assert.match(commands, /curl/);
    assert.doesNotMatch(commands, /\bdown\b|\bstop\b|\brestart\b/);
    assert.doesNotMatch(result.stdout, /停止旧服务|清理旧镜像和构建缓存/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

for (const mode of ['valid', 'invalid', 'missing', 'copy_error']) test(mode === 'valid'
  ? '网络不可用时使用目标镜像内同版本 Compose，再继续执行本地部署检查'
  : mode === 'invalid'
    ? '镜像内 Compose 缺少挂载时保留旧配置且不启动部署'
    : mode === 'missing'
      ? '旧镜像未包含 Compose 时清理临时容器并执行原有安全检查'
      : '镜像 Compose 复制故障时停止部署且不下载替代配置', () => {
  const valid = mode === 'valid';
  if (process.platform === 'win32' && !existsSync(bash)) return;
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'boardgame-image-compose-'));
  const bin = path.join(fixture, 'bin');
  const log = path.join(fixture, 'commands.log');
  const shellEnv = path.join(fixture, 'bash-env.sh');
  const candidate = path.join(fixture, 'candidate.yml');
  mkdirSync(bin);
  writeFileSync(path.join(fixture, '.env'), 'INTERNAL_FEEDBACK_TOKEN=test\n');
  writeFileSync(path.join(fixture, 'docker-compose.prod.yml'), 'services:\n  web:\n    image: old\n');
  writeFileSync(candidate, valid
    ? 'services:\n  web:\n    image: example\n    volumes:\n      - ./runtime/retained-web-assets:/app/retained-web-assets:ro\n'
    : 'services:\n  web:\n    image: invalid\n');
  // Linux 中 Node 找到该 Docker 替身；Windows 中 Docker Compose 只读解析测试文件。
  writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
if [[ "$1 $2" == 'compose -f' ]]; then
  node -e 'const path=require("path");const volumes=process.env.BG_GATE_INVALID?[]:[{type:"bind",source:path.resolve(process.env.BG_GATE_FIXTURE,"runtime/retained-web-assets"),target:"/app/retained-web-assets",read_only:true}];console.log(JSON.stringify({services:{web:{volumes}}}))'
  exit 0
fi
exit 2
`, { mode: 0o755 });
  writeFileSync(shellEnv, `curl() { printf 'curl\\n' >> "$BG_GATE_DOCKER_LOG"; return 1; }
docker() {
  printf '%s\\n' "$*" >> "$BG_GATE_DOCKER_LOG"
  case "$1" in
    create) printf '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\\n';;
    cp) if [[ "$BG_GATE_MISSING" == 1 ]]; then printf 'Could not find the file /app/deploy/docker-compose.prod.yml in container test\\n' >&2; return 1; fi; if [[ "$BG_GATE_COPY_ERROR" == 1 ]]; then printf 'I/O error\\n' >&2; return 1; fi; cp "$BG_GATE_CANDIDATE" "$3";;
    rm) return 0;;
    *) return 2;;
  esac
}
id() { printf '0\\n'; }
ss() { return 1; }
export -f curl docker id ss
`);
  try {
    const result = spawnSync(bash, [shellPath(path.join(root, 'scripts/deploy/deploy-image.sh')), 'update-local', 'latest'], {
      cwd: fixture,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`, BASH_ENV: shellPath(shellEnv), BG_GATE_DOCKER_LOG: log, BG_GATE_CANDIDATE: shellPath(candidate), BG_GATE_FIXTURE: fixture, BG_GATE_INVALID: valid ? '' : '1', BG_GATE_MISSING: mode === 'missing' ? '1' : '', BG_GATE_COPY_ERROR: mode === 'copy_error' ? '1' : '', BG_WEB_ASSETS_ALREADY_RETAINED: '1', SKIP_MIRROR: '1' },
    });
    const output = result.stdout + result.stderr;
    const actualCompose = readFileSync(path.join(fixture, 'docker-compose.prod.yml'), 'utf8');
    const commands = readFileSync(log, 'utf8');
    assert.match(commands, /create .*boardgame-web:latest/);
    assert.match(commands, /cp 0123456789abcdef[0-9a-f]+:/);
    assert.match(commands, /rm 0123456789abcdef[0-9a-f]+/);
    if (valid) {
      assert.doesNotMatch(commands, /curl/);
      assert.match(output, /使用目标镜像内的 Compose/);
      assert.match(output, /历史资源挂载检查通过/);
      assert.match(actualCompose, /retained-web-assets/);
      assert.match(commands, /image inspect .*boardgame-game:latest/);
    } else if (mode === 'invalid') {
      assert.doesNotMatch(commands, /curl/);
      assert.notEqual(result.status, 0);
      assert.match(output, /目标镜像内的 Compose 缺少正确历史资源挂载/);
      assert.equal(actualCompose, 'services:\n  web:\n    image: old\n');
      assert.doesNotMatch(commands, /\bdown\b|\bstop\b|\brestart\b/);
    } else if (mode === 'missing') {
      assert.notEqual(result.status, 0);
      assert.match(commands, /curl/);
      assert.match(output, /部署配置缺少正确的 web 历史资源挂载/);
      assert.equal(actualCompose, 'services:\n  web:\n    image: old\n');
      assert.doesNotMatch(commands, /\bdown\b|\bstop\b|\brestart\b/);
    } else {
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(commands, /curl|\bdown\b|\bstop\b|\brestart\b/);
      assert.match(output, /无法从目标镜像复制 Compose，部署已停止: I\/O error/);
      assert.equal(actualCompose, 'services:\n  web:\n    image: old\n');
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
