import { expect, test } from 'claude-code/testing'

import { begin, describe, elapsed, finish, glyph, took } from './format'

test('a call begins running and is counted, then flips when its result is back', () => {
  const entry = {
    id: 't1',
    label: '$ make check',
    isEdit: false,
    status: 'running' as const,
    startedAt: 1000,
  }
  const running = begin({}, 'a1', entry)
  expect(running.a1?.calls).toBe(1)
  expect(running.a1?.feed[0]?.status).toBe('running')
  expect(glyph('running')).toBe('▸')

  const done = finish(running, 'a1', 't1', 'ok', 3500)
  expect(done.a1?.feed[0]).toMatchObject({ status: 'ok', endedAt: 3500 })
  expect(glyph('ok')).toBe('✓')

  const failed = finish(running, 'a1', 't1', 'error', 3500)
  expect(failed.a1?.feed[0]?.status).toBe('error')
  expect(glyph('error')).toBe('✗')
})

test('finishing a call of an agent never seen leaves the board as it was', () => {
  const board = begin({}, 'a1', { id: 't1', label: 'x', isEdit: false, status: 'running', startedAt: 0 })
  expect(finish(board, 'zz', 't1', 'ok', 5)).toBe(board)
})

test('the feed keeps only the newest calls but the count keeps growing', () => {
  let board = {}
  for (let i = 0; i < 30; i++) {
    board = begin(board, 'a1', { id: `t${i}`, label: `c${i}`, isEdit: false, status: 'ok', startedAt: i })
  }
  const act = (board as Record<string, { feed: unknown[]; calls: number }>).a1
  expect(act?.calls).toBe(30)
  expect(act?.feed.length).toBe(12)
})

test('commands and edits read as one tidy line, home folders as ~', () => {
  expect(describe({ tool: 'Bash', command: 'cd /Users/someone/app\n && make check' })).toEqual({
    label: '$ cd ~/app && make check',
    isEdit: false,
  })
  expect(
    describe({ tool: 'Edit', file_path: '/Users/someone/a.py', old_string: 'x\ny', new_string: 'x\ny\nz' }),
  ).toEqual({ label: '✎ Edit ~/a.py  +3 −2', isEdit: true })
  expect(describe({ tool: 'Write', file_path: '/home/me/b.md', content: 'a\nb\nc' })).toEqual({
    label: '✎ Write ~/b.md  3 lines',
    isEdit: true,
  })
  expect(describe({ tool: 'Grep', pattern: 'TODO' }).label).toBe('? Grep TODO')
  expect(describe({ tool: 'Read', file_path: '/Users/someone/c.ts' }).label).toBe('≡ Read ~/c.ts')
})

test('times read as ms, seconds, minutes and hours', () => {
  expect(took(240)).toBe('240ms')
  expect(took(2100)).toBe('2.1s')
  expect(took(65_000)).toBe('1m 05s')
  expect(elapsed(7_380_000)).toBe('2h 03m')
})
