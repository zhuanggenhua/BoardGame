#!/usr/bin/env node
import { DEFAULT_BOARD_PATH, syncBoardFromSummaryFile } from './lib/status-board.mjs';

function parseArgs(argv) {
    const options = {
        summaryPath: '',
        boardPath: DEFAULT_BOARD_PATH,
    };

    const positional = [];
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--board') {
            options.boardPath = argv[++index] || options.boardPath;
            continue;
        }
        positional.push(arg);
    }

    options.summaryPath = positional[0] || '';
    if (!options.summaryPath) {
        throw new Error('缺少 summary.json 路径');
    }

    return options;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const { board, boardPath } = await syncBoardFromSummaryFile(options.summaryPath, options.boardPath);
    process.stdout.write(
        `feedback-status-board: synced ${board.items.length} item(s) -> ${boardPath}\n`,
    );
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
});
