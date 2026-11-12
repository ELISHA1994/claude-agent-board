# agent-board

A Claude Code mod that adds a pane showing what each subagent in your session is working on.

Each agent gets a bordered card, coloured by status: green running, amber waiting, red failed, muted idle or done. A card shows the agent's name, type and elapsed time (frozen once it finishes), its task description, and its latest tool call with a running count of calls (for example `↳ Grep TODO · 4 calls`). Home folders in paths are shortened to `~`. Live agents sort first, and the header counts working, done and failed agents. The pane refreshes every 1.5 seconds and whenever an agent makes a tool call.

## Install

```
/plugin install agent-board --marketplace ELISHA1994/claude-agent-board
```

Answer `y` to add the marketplace, then pick a scope.

## Use

Run `/agent-board` to open the pane. In a terminal at least 144 columns wide it also opens by itself at session start. Then ask Claude to spawn subagents and watch them appear.

The pane shows only the agents of the session it runs in, not those of other sessions.
