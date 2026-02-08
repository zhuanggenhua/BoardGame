import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api/src/app.module';
import { AdminInitService } from '../apps/api/src/modules/auth/admin-init.service';

const readArg = (name: string): string | null => {
    const prefix = `--${name}=`;
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg.startsWith(prefix)) {
            return arg.slice(prefix.length);
        }
        if (arg === `--${name}` && argv[i + 1]) {
            return argv[i + 1];
        }
    }
    return null;
};

const requireValue = (value: string | null, label: string): string => {
    if (!value) {
        throw new Error(`缺少参数: ${label}`);
    }
    return value;
};

const run = async () => {
    const email = readArg('email') || process.env.ADMIN_EMAIL || null;
    const password = readArg('password') || process.env.ADMIN_PASSWORD || null;
    const username = readArg('username') || process.env.ADMIN_USERNAME || null;
    const actor = readArg('actor') || process.env.ADMIN_ACTOR || 'cli';
    const actorIp = readArg('actor-ip') || process.env.ADMIN_ACTOR_IP || null;

    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    try {
        const adminInitService = app.get(AdminInitService);
        const result = await adminInitService.initAdminOnce({
            email: requireValue(email, 'email'),
            password: requireValue(password, 'password'),
            username: requireValue(username, 'username'),
            actor,
            actorIp,
        });

        console.log(`[InitAdmin] status=${result.status} email=${result.email} userId=${result.userId}`);
    } finally {
        await app.close();
    }
};

run().catch((error) => {
    const message = error instanceof Error ? error.message : '初始化管理员失败';
    console.error(`[InitAdmin] error=${message}`);
    process.exitCode = 1;
});
