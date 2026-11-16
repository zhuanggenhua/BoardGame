import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = process.cwd();
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';
const shellPath = value => process.platform === 'win32' ? value.replace(/\\/g, '/') : value;

for (const mode of ['current-web', 'nonroot-current', 'foreign-process', 'direct-nginx']) test(mode === 'current-web'
  ? '生产 Compose 使用 18081 时保留 80 端口 nginx，并允许现有 web 容器占用 18081'
  : mode === 'nonroot-current'
    ? '非 root 部署使用 sudo 识别已有 web 的端口进程'
  : mode === 'foreign-process'
    ? '目标 web 端口被其他进程占用时停止部署，不停止宿主服务'
    : 'Compose 直接映射 80 且已被 nginx 占用时，报冲突而不停止 nginx', () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'boardgame-port-preflight-'));
  const bin = path.join(fixture, 'bin');
  const log = path.join(fixture, 'commands.log');
  const shellEnv = path.join(fixture, 'bash-env.sh');
  const candidate = path.join(fixture, 'candidate.yml');
  mkdirSync(bin);
  writeFileSync(path.join(fixture, '.env'), 'INTERNAL_FEEDBACK_TOKEN=test\n');
  writeFileSync(path.join(fixture, 'docker-compose.prod.yml'), 'services:\n  web:\n    image: old\n');
  const publishedPort = mode === 'direct-nginx' ? '80' : '18081';
  writeFileSync(candidate, `services:\n  web:\n    image: example\n    ports:\n      - "${publishedPort}:80"\n    volumes:\n      - ./runtime/retained-web-assets:/app/retained-web-assets:ro\n`);
  writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
if [[ "$1 $2" == 'compose -f' ]]; then
  node -e 'const path=require("path");console.log(JSON.stringify({services:{web:{volumes:[{type:"bind",source:path.resolve(process.env.BG_PORT_FIXTURE,"runtime/retained-web-assets"),target:"/app/retained-web-assets",read_only:true}],ports:[{target:80,published:process.env.BG_PORT_PUBLISHED,protocol:"tcp"}]}}}))'
  exit 0
fi
exit 2
`, { mode: 0o755 });
  writeFileSync(shellEnv, `curl() { printf 'curl\\n' >> "$BG_PORT_LOG"; return 1; }
docker() {
  printf 'docker %s\\n' "$*" >> "$BG_PORT_LOG"
  case "$1" in
    create) printf '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\\n';;
    cp) cp "$BG_PORT_CANDIDATE" "$3";;
    rm) return 0;;
    port) printf '80/tcp -> 0.0.0.0:18081\\n80/tcp -> [::]:18081\\n';;
    *) return 2;;
  esac
}
ss() {
  printf 'ss %s\\n' "$*" >> "$BG_PORT_LOG"
  if [[ "$*" == *':18081'* ]]; then
    printf 'LISTEN 0 4096 0.0.0.0:18081 0.0.0.0:* users:(("service",pid=222,fd=4))\\n'
  elif [[ "$*" == *':80'* ]]; then
    printf 'LISTEN 0 511 0.0.0.0:80 0.0.0.0:* users:(("nginx",pid=111,fd=6))\\n'
  fi
}
ps() { if [[ "$*" == *'111'* ]]; then printf 'nginx\\n'; elif [[ "$BG_PORT_MODE" == 'current-web' || "$BG_PORT_MODE" == 'nonroot-current' ]]; then printf 'docker-proxy\\n'; else printf 'other-service\\n'; fi; }
systemctl() { printf 'systemctl %s\\n' "$*" >> "$BG_PORT_LOG"; return 1; }
sudo() { printf 'sudo %s\\n' "$*" >> "$BG_PORT_LOG"; [[ "$1" == '-n' ]] && shift; "$@"; }
id() { if [[ "$BG_PORT_MODE" == 'nonroot-current' ]]; then printf '1000\\n'; else printf '0\\n'; fi; }
export -f curl docker ss ps systemctl sudo id
`);
  try {
    const result = spawnSync(bash, [shellPath(path.join(root, 'scripts/deploy/deploy-image.sh')), 'update-local', 'latest'], {
      cwd: fixture, encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`, BASH_ENV: shellPath(shellEnv), BG_PORT_LOG: log, BG_PORT_CANDIDATE: shellPath(candidate), BG_PORT_FIXTURE: fixture, BG_PORT_MODE: mode, BG_PORT_PUBLISHED: publishedPort, BG_WEB_ASSETS_ALREADY_RETAINED: '1', SKIP_MIRROR: '1' },
    });
    const commands = readFileSync(log, 'utf8');
    assert.doesNotMatch(commands, /systemctl/);
    assert.match(commands, new RegExp(`ss .*:${publishedPort}(?:\\D|$)`));
    if (mode !== 'direct-nginx') assert.doesNotMatch(commands, /ss .*:80(?:\D|$)/);
    if (mode === 'current-web' || mode === 'nonroot-current') {
      if (mode === 'nonroot-current') assert.match(commands, /sudo -n ss .*:18081/);
      assert.match(commands, /docker port boardgame-web/);
      assert.match(commands, /docker image inspect .*boardgame-game:latest/);
    } else {
      assert.match(result.stdout + result.stderr, new RegExp(`端口 ${publishedPort}.*占用`));
      assert.doesNotMatch(commands, /docker image inspect|\bdown\b|\bstop\b/);
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
