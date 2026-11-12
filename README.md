# agent-board

A Claude Code mod that adds a pane showing what each subagent in your session is working on.

Each row shows the agent's status mark (`▶` running, `…` waiting, `·` idle, `○` pending, `✓` done, `✗` failed or killed), its name, type and status, its task description, and its latest tool call (for example `↳ Grep TODO`). The header counts how many agents are working out of the total. The pane refreshes every 1.5 seconds and whenever an agent makes a tool call.

## Install

```
/plugin install agent-board --marketplace ELISHA1994/claude-agent-board
```

Answer `y` to add the marketplace, then pick a scope.

## Use

Run `/agent-board` to open the pane. In a terminal at least 144 columns wide it also opens by itself at session start. Then ask Claude to spawn subagents and watch them appear.

The pane shows only the agents of the session it runs in, not those of other sessions.
