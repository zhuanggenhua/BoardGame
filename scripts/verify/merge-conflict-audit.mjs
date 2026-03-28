#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

function printUsage() {
    console.log(`用法:
  node scripts/verify/merge-conflict-audit.mjs [merge-commit] [--fail-on-single-side]

说明:
  - 默认审计 HEAD，且 HEAD 必须是双亲 merge commit。
  - 如果 merge commit message 中带有 "#\\t<path>" 冲突记录，优先审计这些文件。
  - 否则退化为审计同时相对两个父提交都发生变化的文件。
  - --fail-on-single-side: 只要有文件结果完全等于某一侧父提交，就以非 0 退出。
`);
}

function runGit(args, { allowFailure = false } = {}) {
    try {
        return execFileSync('git', args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
    } catch (error) {
        if (allowFailure) return null;
        const stderr = error.stderr?.toString?.().trim?.() ?? String(error);
        throw new Error(`git ${args.join(' ')} 失败: ${stderr}`);
    }
}

function parseArgs(argv) {
    let commit = 'HEAD';
    let failOnSingleSide = false;

    for (const arg of argv) {
        if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        }
        if (arg === '--fail-on-single-side') {
            failOnSingleSide = true;
            continue;
        }
        if (arg.startsWith('--')) {
            throw new Error(`未知参数: ${arg}`);
        }
        commit = arg;
    }

    return { commit, failOnSingleSide };
}

function getMergeParents(commit) {
    const parents = runGit(['show', '-s', '--format=%P', commit])
        .split(/\s+/)
        .filter(Boolean);
    if (parents.length !== 2) {
        throw new Error(`${commit} 不是双亲 merge commit，无法审计冲突结果`);
    }
    return parents;
}

function getConflictFilesFromMessage(commit) {
    const body = runGit(['show', '-s', '--format=%B', commit]);
    const files = [];
    for (const line of body.split(/\r?\n/)) {
        const match = line.match(/^#\s+(.+)$/);
        if (!match) continue;
        const value = match[1].trim();
        if (!value || value.includes(':')) continue;
        files.push(value);
    }
    return [...new Set(files)];
}

function getIntersectingChangedFiles(parentA, parentB, commit) {
    const changedA = new Set(
        runGit(['diff', '--name-only', parentA, commit])
            .split(/\r?\n/)
            .map(v => v.trim())
            .filter(Boolean),
    );
    const changedB = new Set(
        runGit(['diff', '--name-only', parentB, commit])
            .split(/\r?\n/)
            .map(v => v.trim())
            .filter(Boolean),
    );
    return [...changedA].filter(file => changedB.has(file)).sort();
}

function getBlobId(ref, file) {
    return runGit(['rev-parse', `${ref}:${file}`], { allowFailure: true });
}

function classifyFile(commit, parentA, parentB, file) {
    const resultBlob = getBlobId(commit, file);
    const parentABlob = getBlobId(parentA, file);
    const parentBBlob = getBlobId(parentB, file);

    if (resultBlob === parentABlob && resultBlob === parentBBlob) {
        return 'same-as-both';
    }
    if (resultBlob === parentABlob) {
        return 'same-as-parent1';
    }
    if (resultBlob === parentBBlob) {
        return 'same-as-parent2';
    }
    return 'hybrid';
}

function toLabel(classification) {
    switch (classification) {
        case 'same-as-both':
            return '与两侧相同';
        case 'same-as-parent1':
            return '完全等于父1';
        case 'same-as-parent2':
            return '完全等于父2';
        default:
            return '混合结果';
    }
}

function main() {
    const { commit, failOnSingleSide } = parseArgs(process.argv.slice(2));
    const [parent1, parent2] = getMergeParents(commit);

    const filesFromMessage = getConflictFilesFromMessage(commit);
    const files = filesFromMessage.length > 0
        ? filesFromMessage
        : getIntersectingChangedFiles(parent1, parent2, commit);

    if (files.length === 0) {
        console.log(`未在 ${commit} 上识别到可审计的冲突文件`);
        return;
    }

    const results = files.map(file => ({
        file,
        classification: classifyFile(commit, parent1, parent2, file),
    }));

    const singleSideFiles = results.filter(
        item => item.classification === 'same-as-parent1' || item.classification === 'same-as-parent2',
    );

    console.log(`merge commit: ${commit}`);
    console.log(`父1: ${parent1}`);
    console.log(`父2: ${parent2}`);
    console.log(`审计文件数: ${results.length}`);
    console.log('');

    for (const item of results) {
        console.log(`${toLabel(item.classification)}\t${item.file}`);
    }

    console.log('');
    console.log(`完全等于父1: ${results.filter(item => item.classification === 'same-as-parent1').length}`);
    console.log(`完全等于父2: ${results.filter(item => item.classification === 'same-as-parent2').length}`);
    console.log(`混合结果: ${results.filter(item => item.classification === 'hybrid').length}`);
    console.log(`与两侧相同: ${results.filter(item => item.classification === 'same-as-both').length}`);

    if (singleSideFiles.length > 0) {
        console.log('');
        console.log('需要人工解释的文件:');
        for (const item of singleSideFiles) {
            console.log(`- ${item.file} (${toLabel(item.classification)})`);
        }
    }

    if (failOnSingleSide && singleSideFiles.length > 0) {
        process.exitCode = 1;
    }
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
