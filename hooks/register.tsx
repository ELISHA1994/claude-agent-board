import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Row } from '../types'

const PANE = 'agent-board'
const agents = atom({ plugin: 'agent-board', key: 'agents' } as const, [], {
  shape: 'agents-1',
})
const activity = atom(
  { plugin: 'agent-board', key: 'activity' } as const,
  {},
  { shape: 'activity-1' },
)

const MARK: Record<string, string> = {
  running: '▶',
  waiting: '…',
  idle: '·',
  pending: '○',
  completed: '✓',
  failed: '✗',
  killed: '✗',
}

// One short line for what a tool call does, from whichever field it carries.
const summary = (e: Record<string, unknown>): string => {
  const pick = ['description', 'command', 'file_path', 'pattern', 'url', 'query']
    .map(k => e[k])
    .find(v => typeof v === 'string' && v.length > 0)

  return `${String(e.tool)}${pick ? ` ${String(pick).replace(/\s+/g, ' ')}` : ''}`
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

async function refresh($: EngineInterface) {
  const list = await $.agent.list()
  const rows: Row[] = list.map(a => ({
    id: a.id,
    name: a.name ?? a.teammateId ?? a.id.slice(0, 6),
    type: a.type,
    description: a.description,
    status: a.status,
    parentId: a.parentId,
  }))
  await update($, agents, () => rows)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agent-board',
      description: 'Show what each agent is working on in a pane',
    })
    void $.ui.open({ id: PANE, title: 'Agents' })
    $.clock.every(1500, () => refresh($))

    return next(e)
  })

  on('command.run', { command: 'agent-board' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agents' })
    await refresh($)

    return { text: 'Agents pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const id = (e as { agentId?: string }).agentId
    if (id) {
      const line = summary(e as unknown as Record<string, unknown>)
      await update($, activity, m => ({ ...m, [id]: line }))
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const rows = await read($, agents)
    const seen = await read($, activity)
    const width = Math.max(20, (e.props?.bodyColumns ?? 40) - 4)
    const live = rows.filter(r => ['running', 'waiting', 'pending'].includes(r.status))

    return (
      <Box flexDirection="column">
        <Text bold>
          {live.length} working · {rows.length} total
        </Text>
        {rows.length === 0 && <Text dimColor>No agents yet.</Text>}
        {rows.map(r => (
          <Box flexDirection="column">
            <Text dimColor={!live.includes(r)}>
              {MARK[r.status] ?? '?'} {r.name} ({r.type}) {r.status}
            </Text>
            <Text dimColor>  {clip(r.description, width)}</Text>
            {seen[r.id] && <Text dimColor>  ↳ {clip(seen[r.id]!, width)}</Text>}
          </Box>
        ))}
      </Box>
    )
  })
}
