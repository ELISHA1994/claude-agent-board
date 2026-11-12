# agent-board

A Claude Code mod that adds a pane showing what each subagent in your session is working on.

Each agent gets a bordered card, coloured by status: green running, amber waiting, red failed, muted idle or done. A card shows the agent's name, type and elapsed time, its task description, a running tally (`12 calls · 3 edits`), and a live feed of its latest tool calls:

```
▸ 4.2s   $ cd ~/app && make check          running
✓ 38ms   ✎ Edit ~/app/models.py  +3 −2      done
✗ 1.1s   $ pytest -q                        failed
```

Every call appears the moment it starts and flips to done or failed, with how long it took, when its result comes back. Commands show as `$`, edits and writes as `✎` with their line counts, reads as `≡`, and searches as `?`. Home folders in paths are shortened to `~`. Live agents sort first, and the header counts working, done and failed agents. The elapsed times refresh every second.

## Install

```
/plugin install agent-board --marketplace ELISHA1994/claude-agent-board
```

Answer `y` to add the marketplace, then pick a scope.

## Use

Run `/agent-board` to open the pane. In a terminal at least 144 columns wide it also opens by itself at session start. Then ask Claude to spawn subagents and watch them appear.

The pane shows only the agents of the session it runs in, not those of other sessions.

Elapsed times count from when the pane first saw an agent, so an agent that was already running when the plugin loaded shows a shorter time than it has really run, and calls made before the load are not in its feed.
