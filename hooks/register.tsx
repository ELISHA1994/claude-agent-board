import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, Row } from '../types'

import { begin, describe, elapsed, finish, glyph, took, text } from './format'

const PANE = 'agent-board'
// Change a tag when a field changes: it declines what an earlier version
// stored, which outlives a reload.
const agents = atom({ plugin: 'agent-board', key: 'agents' } as const, [], {
  shape: 'agents-2',
})
const activity = atom(
  { plugin: 'agent-board', key: 'activity' } as const,
  {},
  { shape: 'activity-3' },
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
    $.clock.every(1000, () => refresh($))

    return next(e)
  })

  on('command.run', { command: 'agent-board' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agents' })
    await refresh($)

    return { text: 'Agents pane opened.' }
  })

  // A call shows the moment it starts, and flips when its result is back.
  on('tool.call', async ($, e, next) => {
    const agent = (e as { agentId?: string }).agentId
    if (!agent) return next(e)

    const raw = e as unknown as Record<string, unknown>
    const at = await $.clock.now()
    const id = text(raw.tool_use_id) || `${agent}:${at}`
    const { label, isEdit } = describe(raw)
    await update($, activity, m =>
      begin(m, agent, { id, label, isEdit, status: 'running', startedAt: at }),
    )

    let ran
    try {
      ran = await next(e)
    } catch (err) {
      await update($, activity, m => finish(m, agent, id, 'error', at))
      throw err
    }
    const end = await $.clock.now()
    const failed = ran.deny !== undefined || ran.isError === true
    await update($, activity, m => finish(m, agent, id, failed ? 'error' : 'ok', end))

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const rows = await read($, agents)
    const seen = await read($, activity)
    const now = await $.clock.now()
    const room = e.props?.scroll?.bodyRows ?? e.viewport?.rows ?? 40

    const sorted = [...rows].sort(
      (a, b) =>
        Number(LIVE.includes(b.status)) - Number(LIVE.includes(a.status)) ||
        b.startedAt - a.startedAt,
    )
    const live = rows.filter(r => LIVE.includes(r.status)).length
    const failed = rows.filter(r => ['failed', 'killed'].includes(r.status)).length
    const done = rows.filter(r => r.status === 'completed').length
    // Fewer agents get a longer feed; a card is five rows plus its feed.
    const feedRows = rows.length <= 2 ? 5 : rows.length <= 4 ? 3 : 2
    const fit = Math.max(1, Math.floor((room - 3) / (5 + feedRows + 1)))
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
          const feed = (act?.feed ?? []).slice(-feedRows)
          const over = !LIVE.includes(r.status)

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
              <Text wrap="truncate-end" dimColor={over}>
                {r.description}
              </Text>
              <Text wrap="truncate-end" color="subtle">
                {act
                  ? `${act.calls} call${act.calls === 1 ? '' : 's'} · ${act.edits} edit${act.edits === 1 ? '' : 's'}`
                  : 'no tool calls seen yet'}
              </Text>
              {feed.map(x => (
                <Text
                  wrap="truncate-end"
                  color={
                    x.status === 'error'
                      ? 'error'
                      : x.status === 'running'
                        ? 'suggestion'
                        : undefined
                  }
                  bold={x.status === 'running'}
                  dimColor={x.status === 'ok'}
                >
                  {glyph(x.status)}{' '}
                  {took((x.endedAt ?? now) - x.startedAt).padEnd(6)} {x.label}
                </Text>
              ))}
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
