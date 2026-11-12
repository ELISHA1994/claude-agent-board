import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-board',
  component: 'Pane',
  requestId: 'agent-board',
  props: {
    title: 'Agents',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const LIST = [
  { id: 'a1', name: 'scout', type: 'Explore', description: 'map the repo', status: 'running' },
]

function engine(on: any, clock: { t: number }) {
  on('command.register', () => ({ value: { command: 'agent-board' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: (clock.t += 100) }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('agent.list', () => ({ value: LIST }))
}

test('a finished call is marked done with the time it took', async ($, on) => {
  const clock = { t: 0 }
  engine(on, clock)
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'agent-board' })
  await $.tool.call({
    tool: 'Bash',
    command: 'cd /Users/someone/app && make check',
    agentId: 'a1',
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const row = (await ui.find({ type: 'Text', text: /make check/ }))?.text ?? ''
  expect(row).toMatch(/^✓ \d+ms/)
  expect(row).toMatch(/\$ cd ~\/app && make check/)
  expect(row).not.toMatch(/someone/)
  expect((await ui.find({ type: 'Text', text: /scout/ }))?.text).toMatch(/▶ scout/)
  expect(await ui.find({ type: 'Text', text: /1 call · 0 edits/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /1 working/ }))?.text).toMatch(/1 working/)
  await ui.unmount()
})

test('an edit shows its line counts and a failed call turns red', async ($, on) => {
  const clock = { t: 0 }
  engine(on, clock)
  on('tool.call', (_, e) => (e.tool === 'Bash' ? { result: {}, isError: true } : { result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'agent-board' })
  await $.tool.call({
    tool: 'Edit',
    file_path: '/Users/someone/app/a.py',
    old_string: 'x\ny',
    new_string: 'x\ny\nz',
    agentId: 'a1',
  })
  await $.tool.call({ tool: 'Bash', command: 'pytest -q', agentId: 'a1' })
  await $.tool.call({ tool: 'Read', file_path: '/Users/someone/app/a.py' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const edit = (await ui.find({ type: 'Text', text: /Edit/ }))?.text ?? ''
    expect(edit).toMatch(/✎ Edit ~\/app\/a\.py  \+3 −2/)
    expect(edit).toMatch(/^✓ /)
    expect((await ui.find({ type: 'Text', text: /pytest/ }))?.text).toMatch(/^✗ /)
    // The main loop's own Read carries no agentId and stays off the board.
    expect(await ui.find({ type: 'Text', text: /Read/ })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /2 calls · 1 edit$/ }))?.text).toBeDefined()
    await ui.unmount()
  }
})

test('an empty roster says so', async ($, on) => {
  on('clock.now', () => ({ value: 0 }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /No agents yet/ }))?.text).toBe('No agents yet.')
  await ui.unmount()
})
