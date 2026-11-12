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

test('the pane draws a card with task, latest tool, calls and timer', async ($, on) => {
  on('command.register', () => ({ value: { command: 'agent-board' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 125_000 }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({
    value: [{ id: 'a1', name: 'scout', type: 'Explore', description: 'map the repo', status: 'running' }],
  }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'agent-board' })
  await $.tool.call({ tool: 'Grep', pattern: 'TODO', agentId: 'a1' })
  await $.tool.call({ tool: 'Bash', command: 'cd /Users/someone/app && ls', agentId: 'a1' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /scout/ }))?.text).toMatch(/▶ scout/)
    expect((await ui.find({ type: 'Text', text: /Explore/ }))?.text).toMatch(/0s/)
    expect((await ui.find({ type: 'Text', text: /map the repo/ }))?.text).toBe('map the repo')
    const tool = (await ui.find({ type: 'Text', text: /↳/ }))?.text ?? ''
    expect(tool).toMatch(/Bash cd ~\/app/)
    expect(tool).toMatch(/2 calls/)
    expect(tool).not.toMatch(/someone/)
    expect((await ui.find({ type: 'Text', text: /1 working/ }))?.text).toMatch(/1 working/)
    await ui.unmount()
  }
})

test('an empty roster says so', async ($, on) => {
  on('clock.now', () => ({ value: 0 }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /No agents yet/ }))?.text).toBe('No agents yet.')
  await ui.unmount()
})
