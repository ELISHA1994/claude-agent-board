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

export type Activity = { line: string; calls: number }

declare module 'claude-code' {
  interface PluginState {
    'agent-board': {
      agents: Shaped<Row[]>
      activity: Shaped<Record<string, Activity>>
    }
  }
}
