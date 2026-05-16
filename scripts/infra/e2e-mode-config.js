function isTruthyFlag(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
}

export function isDevServerE2ERequested(env = process.env) {
  return String(env.PW_USE_DEV_SERVERS ?? '').trim() === 'true';
}

export function isDevServerE2EAllowed(env = process.env) {
  return isTruthyFlag(env.PW_ALLOW_DEV_SERVER_TESTS);
}

export function resolveUseDevServers(env = process.env) {
  return isDevServerE2ERequested(env) && isDevServerE2EAllowed(env);
}

export function assertSafeE2EServerMode(env = process.env) {
  const requestedDevServers = isDevServerE2ERequested(env);
  if (!requestedDevServers) {
    return;
  }

  if (!isDevServerE2EAllowed(env)) {
    throw new Error(
      [
        '检测到 PW_USE_DEV_SERVERS=true，但缺少显式授权开关 PW_ALLOW_DEV_SERVER_TESTS=true。',
        '为避免测试误连或误清理本地开发端口，项目已禁止只靠 PW_USE_DEV_SERVERS 隐式复用开发服务器。',
        '请改用默认隔离模式，或在你明确需要复用开发服务器时同时设置：',
        '  PW_USE_DEV_SERVERS=true',
        '  PW_ALLOW_DEV_SERVER_TESTS=true',
        '  PW_START_SERVERS=false',
      ].join('\n'),
    );
  }

  if (String(env.PW_START_SERVERS ?? '').trim() === 'true') {
    throw new Error(
      [
        '禁止同时设置 PW_USE_DEV_SERVERS=true 和 PW_START_SERVERS=true。',
        '前者表示复用现有开发服务器，后者表示由测试生命周期自行起停服务；两者叠加会让开发端口落入测试清理链。',
        '如需复用开发服务器，请显式设置 PW_START_SERVERS=false。',
      ].join('\n'),
    );
  }
}
