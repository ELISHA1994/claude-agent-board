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

test('the pane lists an agent with its task and latest tool', async ($, on) => {
  on('command.register', () => ({ value: { command: 'agent-board' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({
    value: [{ id: 'a1', name: 'scout', type: 'Explore', description: 'map the repo', status: 'running' }],
  }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'agent-board' })
  await $.tool.call({ tool: 'Grep', pattern: 'TODO', agentId: 'a1' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /scout/ }))?.text).toMatch(/running/)
  expect((await ui.find({ type: 'Text', text: /map the repo/ }))?.text).toMatch(/map the repo/)
  expect((await ui.find({ type: 'Text', text: /Grep TODO/ }))?.text).toMatch(/Grep TODO/)
  await ui.unmount()
})

test('an empty roster says so', async ($) => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /No agents yet/ }))?.text).toBe('No agents yet.')
  await ui.unmount()
})
