import type { Activity, Entry } from '../types'

// How many calls an agent's feed keeps; its call count keeps growing.
const KEEP = 12

// Home folders become ~ so a line is short and carries no user name.
export function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\/(?:Users|home)\/[^/\s]+/g, '~').trim()
}

export function text(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function lines(s: string): number {
  return s ? s.split('\n').length : 0
}

// What a call does, in one line, and whether it changes a file.
export function describe(e: Record<string, unknown>): { label: string; isEdit: boolean } {
  const tool = text(e.tool)
  const file = tidy(text(e.file_path) || text(e.notebook_path))
  if (tool === 'Bash') return { label: `$ ${tidy(text(e.command))}`, isEdit: false }
  if (tool === 'Edit') {
    const add = lines(text(e.new_string))
    const del = lines(text(e.old_string))

    return { label: `✎ Edit ${file}  +${add} −${del}`, isEdit: true }
  }
  if (tool === 'Write') {
    return { label: `✎ Write ${file}  ${lines(text(e.content))} lines`, isEdit: true }
  }
  if (tool === 'MultiEdit' || tool === 'NotebookEdit') {
    return { label: `✎ ${tool} ${file}`, isEdit: true }
  }
  if (tool === 'Read') return { label: `≡ Read ${file}`, isEdit: false }
  if (tool === 'Grep' || tool === 'Glob') {
    return { label: `? ${tool} ${tidy(text(e.pattern))}`, isEdit: false }
  }
  if (tool === 'Agent') {
    return { label: `» Agent ${tidy(text(e.description))}`, isEdit: false }
  }
  const pick =
    text(e.url) || text(e.query) || text(e.description) || text(e.command) || file

  return { label: `• ${tool} ${tidy(pick)}`.trim(), isEdit: false }
}

export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`

  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export function took(ms: number): string {
  if (ms < 1000) return `${Math.max(0, ms)}ms`
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`

  return elapsed(ms)
}

export function begin(m: Record<string, Activity>, agent: string, entry: Entry) {
  const old = m[agent] ?? { feed: [], calls: 0, edits: 0 }

  return {
    ...m,
    [agent]: {
      feed: [...old.feed, entry].slice(-KEEP),
      calls: old.calls + 1,
      edits: old.edits + (entry.isEdit ? 1 : 0),
    },
  }
}

export function finish(
  m: Record<string, Activity>,
  agent: string,
  id: string,
  status: 'ok' | 'error',
  at: number,
) {
  const old = m[agent]
  if (!old) return m
  const feed = old.feed.map(x => (x.id === id ? { ...x, status, endedAt: at } : x))

  return { ...m, [agent]: { ...old, feed } }
}


export function glyph(status: Entry['status']): string {
  return status === 'running' ? '▸' : status === 'ok' ? '✓' : '✗'
}
