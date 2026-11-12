export type Row = {
  id: string
  name: string
  type: string
  description: string
  status: string
  parentId?: string
  startedAt: number
  endedAt?: number
}

// One tool call an agent made: running until its result comes back.
export type Entry = {
  id: string
  label: string
  isEdit: boolean
  status: 'running' | 'ok' | 'error'
  startedAt: number
  endedAt?: number
}

export type Activity = { feed: Entry[]; calls: number; edits: number }

declare module 'claude-code' {
  interface PluginState {
    'agent-board': {
      agents: Shaped<Row[]>
      activity: Shaped<Record<string, Activity>>
    }
  }
}
