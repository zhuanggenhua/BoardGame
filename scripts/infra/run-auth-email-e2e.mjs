import { SMTPServer } from 'smtp-server';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runE2ECommand } from './run-e2e-command.mjs';

// 独立 SMTP 收件箱承接真实 API 发信；不调用真实邮箱，也不 mock 浏览器认证接口。
const run = `auth-mail-${Date.now()}`;
const dir = path.resolve('.tmp', run);
mkdirSync(dir, { recursive: true });
const cert = path.join(dir, 'smtp-cert.pem');
const key = path.join(dir, 'smtp-key.pem');
const inbox = path.join(dir, 'inbox.json');
const mode = path.join(dir, 'mode.json');
writeFileSync(inbox, '[]');
writeFileSync(mode, JSON.stringify({ reject: false }));
const gitOpenSsl = 'C:/Program Files/Git/usr/bin/openssl.exe';
execFileSync(process.env.OPENSSL_BINARY || (existsSync(gitOpenSsl) ? gitOpenSsl : 'openssl'), [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
    '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
], { stdio: 'ignore' });
const messages = [];
const smtp = new SMTPServer({
    key: readFileSync(key), cert: readFileSync(cert), minVersion: 'TLSv1.2',
    logger: false, disabledCommands: ['XCLIENT', 'XFORWARD'],
    onAuth(auth, session, callback) {
        if (!session.secure || auth.username !== 'auth-e2e@example.invalid' || auth.password !== run) {
            return callback(new Error('Invalid test SMTP credentials'));
        }
        callback(null, { user: 'auth-e2e' });
    },
    onData(stream, session, callback) {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
            if (JSON.parse(readFileSync(mode, 'utf8')).reject) {
                const error = new Error('Test SMTP delivery rejected');
                error.responseCode = 554;
                return callback(error);
            }
            messages.push({ to: session.envelope.rcptTo.map(recipient => recipient.address), secure: session.secure, raw: Buffer.concat(chunks).toString('utf8') });
            writeFileSync(inbox, JSON.stringify(messages, null, 2));
            callback();
        });
        stream.on('error', callback);
    },
});
smtp.on('error', error => { console.error('[auth-email-e2e] SMTP fixture failed:', error.message); process.exitCode = 1; });
await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
const port = smtp.server.address().port;
console.log(`[auth-email-e2e] run=${run}; local STARTTLS SMTP=${port}; inbox=${inbox}`);
try {
    await runE2ECommand({
        mode: 'default', entrypoint: 'run-auth-email-e2e',
        extraArgs: ['e2e/auth-email-delivery.e2e.ts', '--retries=0'],
        envOverrides: {
            PLATFORM_E2E_ISOLATION_ID: run, PLATFORM_E2E_RUN_ID: run,
            MONGO_URI: `mongodb://127.0.0.1:37022/boardgame_home_acceptance_${run}`,
            UGC_STORAGE_MODE: 'local', UGC_LOCAL_PATH: path.join(tmpdir(), `boardgame-${run}`, 'ugc'),
            PW_E2E_SERVICE_REUSE: 'isolated', PW_DISABLE_JPEG_REPORTER: 'true',
            SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_USER: 'auth-e2e@example.invalid', SMTP_PASS: run,
            NODE_EXTRA_CA_CERTS: cert, AUTH_E2E_INBOX: inbox, AUTH_E2E_SMTP_MODE: mode,
        },
    });
} finally {
    await new Promise(resolve => smtp.close(resolve));
}
