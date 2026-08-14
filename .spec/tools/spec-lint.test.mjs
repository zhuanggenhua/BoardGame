// spec-lint 自测:在临时目录搭 fixture 仓库,断言各类违规被抓、合法仓库全绿。
// 运行:node --test tools/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const LINT = join(dirname(fileURLToPath(import.meta.url)), 'spec-lint.mjs')

/** 生成一个最小合法仓库,返回根路径;overrides 可改写/追加文件(值为 null 表示删除该默认文件)。 */
function fixture(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'spec-lint-fixture-'))
  const files = {
    'CLAUDE.md': '# CLAUDE.md\n\n@.spec/AGENTS.md\n\n@.spec/knowledge/README.md\n\n@.spec/rules/system.md\n',
    '.spec/AGENTS.md': '# 中心文档\n\n| 名称 | 职责 |\n|------|------|\n| `coder` | 写代码 |\n',
    '.spec/rules/system.md': '# 规则\n',
    '.spec/knowledge/README.md': [
      '---', 'name: knowledge', 'description: 导航', 'metadata:', '  type: index', '---', '',
      '# 导航', '', '| 文档 | 一句话 |', '|------|--------|',
      '| [`standards/workflow.md`](standards/workflow.md) | 工作流 |',
      '| [`features/_TEMPLATE.md`](features/_TEMPLATE.md) | 模板 |', '',
    ].join('\n'),
    '.spec/knowledge/standards/workflow.md':
      '---\nname: workflow\ndescription: 工作流\nmetadata:\n  type: doc\n  status: 已交付\n---\n\n# 工作流\n',
    '.spec/knowledge/features/_TEMPLATE.md':
      '---\nname: template\ndescription: 模板\nmetadata:\n  type: doc\n  status: 设计中\n---\n\n# 模板\n',
    '.spec/agents/coder.agent.md': '---\nname: coder\ndescription: 写代码\n---\n\n# Coder\n',
    '.spec/skills/demo/SKILL.md': '---\nname: demo\ndescription: 演示\n---\n\n# Demo\n',
    ...overrides,
  }
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue
    const p = join(root, rel)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, content)
  }
  mkdirSync(join(root, '.claude'), { recursive: true })
  mkdirSync(join(root, '.agents'), { recursive: true })
  symlinkSync('../.spec/agents', join(root, '.claude/agents'), process.platform === 'win32' ? 'junction' : 'dir')
  symlinkSync('../.spec/skills', join(root, '.claude/skills'), process.platform === 'win32' ? 'junction' : 'dir')
  symlinkSync('../.spec/skills', join(root, '.agents/skills'), process.platform === 'win32' ? 'junction' : 'dir')
  return root
}

/** 跑 lint,返回 { code, output }。 */
function lint(root) {
  try {
    const out = execFileSync(process.execPath, [LINT, root], { encoding: 'utf8' })
    return { code: 0, output: out }
  } catch (e) {
    return { code: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('最小合法仓库全绿', () => {
  const { code, output } = lint(fixture())
  assert.equal(code, 0, output)
  assert.match(output, /spec-lint: OK/)
})

test('knowledge 文档未登记导航被抓', () => {
  const { code, output } = lint(fixture({
    '.spec/knowledge/standards/hidden.md':
      '---\nname: hidden\ndescription: 隐身\nmetadata:\n  type: doc\n  status: 设计中\n---\n\n# 隐身\n',
  }))
  assert.equal(code, 1)
  assert.match(output, /未登记进 knowledge\/README\.md 导航/)
})

test('悬空链接被抓', () => {
  const { code, output } = lint(fixture({
    '.spec/AGENTS.md': '# 中心文档\n\n| 名称 | 职责 |\n|------|------|\n| `coder` | 写代码 |\n\n[不存在](nowhere.md)\n',
  }))
  assert.equal(code, 1)
  assert.match(output, /悬空链接:nowhere\.md/)
})

test('rules 文件缺 @import 行被抓', () => {
  const { code, output } = lint(fixture({
    '.spec/rules/extra.md': '# 另一份规则\n',
  }))
  assert.equal(code, 1)
  assert.match(output, /缺 @import 行:@\.spec\/rules\/extra\.md/)
})

test('status 非枚举被抓', () => {
  const { code, output } = lint(fixture({
    '.spec/knowledge/standards/workflow.md':
      '---\nname: workflow\ndescription: 工作流\nmetadata:\n  type: doc\n  status: 草稿\n---\n\n# 工作流\n',
  }))
  assert.equal(code, 1)
  assert.match(output, /status「草稿」不在枚举/)
})

test('description 多行标量被抓(不再绕过长度校验)', () => {
  const { code, output } = lint(fixture({
    '.spec/knowledge/standards/workflow.md':
      '---\nname: workflow\ndescription: >-\n  很长很长的描述\nmetadata:\n  type: doc\n  status: 已交付\n---\n\n# 工作流\n',
  }))
  assert.equal(code, 1)
  assert.match(output, /description 必须单行明文/)
})

test('名册幽灵行被抓(名册有、文件无)', () => {
  const { code, output } = lint(fixture({
    '.spec/AGENTS.md': '# 中心文档\n\n| 名称 | 职责 |\n|------|------|\n| `coder` | 写代码 |\n| `ghost` | 不存在 |\n',
  }))
  assert.equal(code, 1)
  assert.match(output, /名册幽灵行:「ghost」/)
})

test('缺 CLAUDE.md 给可读报错而非崩栈', () => {
  const { code, output } = lint(fixture({ 'CLAUDE.md': null }))
  assert.equal(code, 1)
  assert.match(output, /缺核心文件:CLAUDE\.md/)
  assert.doesNotMatch(output, /at .*spec-lint\.mjs:\d/) // 无堆栈
})

test('任务卡 status 非枚举被抓', () => {
  const { code, output } = lint(fixture({
    '.spec/tasks/demo-card.md': '---\nstatus: done\n---\n\n# 演示卡\n',
  }))
  assert.equal(code, 1)
  assert.match(output, /status「done」不在枚举/)
})

test('任务卡缺 frontmatter 被抓', () => {
  const { code, output } = lint(fixture({
    '.spec/tasks/demo-card.md': '# 裸卡\n',
  }))
  assert.equal(code, 1)
  assert.match(output, /任务卡缺少 frontmatter/)
})

test('任务卡多余 frontmatter 字段被抓', () => {
  const { code, output } = lint(fixture({
    '.spec/tasks/demo-card.md': '---\nstatus: pending\nowner: me\n---\n\n# 卡\n',
  }))
  assert.equal(code, 1)
  assert.match(output, /只允许 status/)
})

test('合法任务卡通过,子目录与 README 不校验', () => {
  const { code, output } = lint(fixture({
    '.spec/tasks/demo-card.md': '---\nstatus: in_progress\n---\n\n# 卡\n',
    '.spec/tasks/README.md': '# 任务卡目录\n',
    '.spec/tasks/sub-dir/stray-card.md': '---\nstatus: whatever\n---\n\n# 子目录卡\n',
  }))
  assert.equal(code, 0, output)
})

test('软链接缺失被抓', () => {
  const root = fixture()
  rmSync(join(root, '.claude/agents'), { recursive: true, force: true })
  const { code, output } = lint(root)
  assert.equal(code, 1)
  assert.match(output, /软链接缺失/)
})
