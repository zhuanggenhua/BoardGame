import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

const envFiles = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
];

if (process.env.NODE_ENV !== 'production') {
    envFiles.push(path.resolve(process.cwd(), '.env.example'));
}

const fallbackValues = new Map();

for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) {
        continue;
    }

    const parsed = parse(fs.readFileSync(envFile));
    for (const [key, value] of Object.entries(parsed)) {
        if (process.env.NODE_ENV === 'test' && envFile.endsWith('.env.example') && key === 'MONGO_URI') {
            continue;
        }
        if (!fallbackValues.has(key)) {
            fallbackValues.set(key, value);
        }
    }
}

for (const [key, value] of fallbackValues) {
    if ((process.env[key] ?? '').trim() === '' && value.trim() !== '') {
        process.env[key] = value;
    }
}
