import { MongoMemoryServer } from 'mongodb-memory-server';
import { randomBytes } from 'node:crypto';
import { runE2ECommand } from './run-e2e-command.mjs';

const mongo = await MongoMemoryServer.create({ instance: { dbName: 'feedback_capture_e2e' } });
try {
    const uri = mongo.getUri('feedback_capture_e2e');
    await runE2ECommand({ mode: 'isolated', entrypoint: 'run-feedback-capture-e2e',
        extraArgs: ['e2e/dicethrone/feedback-authoritative-capture.e2e.ts', '--workers=1', '--retries=0'],
        envOverrides: { MONGO_URI: uri, FEEDBACK_CAPTURE_E2E_MONGO_URI: uri,
            INTERNAL_FEEDBACK_TOKEN: randomBytes(32).toString('hex'), PW_E2E_SERVICE_REUSE: 'isolated' },
    });
} finally {
    await mongo.stop();
}
