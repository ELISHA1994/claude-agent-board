import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, Row } from '../types'

const PANE = 'agent-board'
// Change a tag when a field changes: it declines what an earlier version
// stored, which outlives a reload.
const agents = atom({ plugin: 'agent-board', key: 'agents' } as const, [], {
  shape: 'agents-2',
})
const activity = atom(
  { plugin: 'agent-board', key: 'activity' } as const,
  {},
  { shape: 'activity-2' },
)

const LIVE = ['running', 'waiting', 'pending']
const MARK: Record<string, string> = {
  running: '▶',
  waiting: '◔',
  idle: '●',
  pending: '○',
  completed: '✓',
  failed: '✗',
  killed: '✗',
}
const TONE: Record<string, string> = {
  running: 'success',
  waiting: 'warning',
  pending: 'warning',
  idle: 'subtle',
  completed: 'inactive',
  failed: 'error',
  killed: 'error',
}

// One short line for what a tool call does, from whichever field it carries.
function summary(e: Record<string, unknown>): string {
  const pick = ['description', 'command', 'file_path', 'pattern', 'url', 'query']
    .map(k => e[k])
    .find(v => typeof v === 'string' && v.length > 0)
  const text = pick ? ` ${String(pick).replace(/\s+/g, ' ')}` : ''

  // Home folders become ~ so a line is short and carries no user name.
  return `${String(e.tool)}${text}`.replace(/\/(?:Users|home)\/[^/\s]+/g, '~')
}

function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`

  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

async function refresh($: EngineInterface) {
  const list = await $.agent.list()
  const now = await $.clock.now()
  await update($, agents, before => {
    const known = new Map(before.map(r => [r.id, r]))

    return list.map(a => {
      const old = known.get(a.id)
      const isLive = LIVE.includes(a.status) || a.status === 'idle'

      return {
        id: a.id,
        name: a.name ?? a.teammateId ?? a.id.slice(0, 6),
        type: a.type,
        description: a.description,
        status: a.status,
        parentId: a.parentId,
        startedAt: old?.startedAt ?? now,
        // Frozen at the first look after it ended, so a finished timer stops.
        endedAt: isLive ? undefined : (old?.endedAt ?? now),
      }
    })
  })
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
      await update($, activity, m => ({
        ...m,
        [id]: { line, calls: (m[id]?.calls ?? 0) + 1 },
      }))
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const rows = await read($, agents)
    const seen = await read($, activity)
    const now = await $.clock.now()
    const width = Math.max(16, (e.props?.bodyColumns ?? 40) - 6)
    const rowsLeft = e.viewport?.rows ?? 24

    const sorted = [...rows].sort(
      (a, b) =>
        Number(LIVE.includes(b.status)) - Number(LIVE.includes(a.status)) ||
        b.startedAt - a.startedAt,
    )
    const live = rows.filter(r => LIVE.includes(r.status)).length
    const failed = rows.filter(r => ['failed', 'killed'].includes(r.status)).length
    const done = rows.filter(r => r.status === 'completed').length
    // A card is five rows: two of border, three of text.
    const fit = Math.max(1, Math.floor((rowsLeft - 4) / 5))
    const shown = sorted.slice(0, fit)

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row">
          <Text bold>Agents</Text>
          <Text dimColor>{'  '}</Text>
          <Text color={live ? 'success' : 'inactive'} bold={live > 0}>
            {'● '}
            {live} working
          </Text>
          <Text dimColor>
            {'  ✓ '}
            {done}
          </Text>
          {failed > 0 && (
            <Text color="error">
              {'  ✗ '}
              {failed}
            </Text>
          )}
        </Box>
        {rows.length === 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>No agents yet.</Text>
            <Text dimColor>Ask Claude to spawn one and it shows up here.</Text>
          </Box>
        )}
        {shown.map(r => {
          const tone = TONE[r.status] ?? 'text'
          const act = seen[r.id]
          const idle = !LIVE.includes(r.status)

          return (
            <Box
              flexDirection="column"
              borderStyle="round"
              borderColor={tone}
              paddingX={1}
              marginTop={1}
            >
              <Box flexDirection="row">
                <Text bold color={tone}>
                  {MARK[r.status] ?? '?'} {r.name}
                </Text>
                <Text dimColor>
                  {' · '}
                  {r.type}
                  {' · '}
                  {elapsed((r.endedAt ?? now) - r.startedAt)}
                </Text>
              </Box>
              <Text wrap="truncate-end" dimColor={idle}>
                {clip(r.description, width)}
              </Text>
              <Text wrap="truncate-end" color="subtle">
                {act ? `↳ ${clip(act.line, width - 12)}` : '↳ waiting for a tool call'}
                {act ? `  ·  ${act.calls} call${act.calls === 1 ? '' : 's'}` : ''}
              </Text>
            </Box>
          )
        })}
        {sorted.length > shown.length && (
          <Text dimColor>+{sorted.length - shown.length} more</Text>
        )}
      </Box>
    )
  })
}
