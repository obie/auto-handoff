# auto-handoff

A Claude Code plugin that writes a handoff document when you walk away from a session.

Claude Code keeps a session's context in a prompt cache that expires an hour after the last request. A turn sent inside that hour reads the conversation back at a fraction of the usual input price. Once the hour is up, the next turn pays full price to read everything again, and on a long session that is slow and expensive.

auto-handoff watches the gap. When a session has sat idle for 50 minutes it runs a handoff command while the cache is still warm, so the state of your work lands in a file that a fresh session can resume from.

## Install

```
/plugin marketplace add obie/auto-handoff
/plugin install auto-handoff@auto-handoff
```

The plugin loads at the next session start.

It is built on the function hooks plugin API, which is early access and may change between Claude Code releases. Development and testing happened on Claude Code 2.1.289.

## How it behaves

- The idle clock starts when a turn of the main conversation ends. Any new turn restarts it, whoever started that turn. A subagent finishing leaves it alone.
- After `minutes` of idle time the plugin runs `command` as if you had typed it, and a toast says so.
- You get one handoff per absence. The plugin then stays quiet until you send a prompt or run a command yourself. A background task reporting in, or a scheduled trigger firing, keeps it quiet.
- `/clear` cancels a pending handoff.
- A laptop that slept through the wait wakes with a cold cache. The plugin sees that its timer fired late and skips the handoff, since running it then would cost the full price it exists to avoid.

## The bundled skill

The default command is `/auto-handoff:handoff`, a skill that ships with the plugin. You can run it by hand too.

It writes `docs/handoffs/<timestamp>-<slug>.md`, covering the goal, status, decisions, dead ends, files, verification commands, next steps and open questions. To do that it runs `date` and `git status`, then writes that one file. Nothing gets committed.

Nobody is there to answer a permission prompt when it runs, so the skill pre-approves those tools for itself through `allowed-tools`. It completes in the default permission mode.

## Configuration

| Option | Default | Meaning |
| --- | --- | --- |
| `minutes` | `50` | Idle time before the command runs |
| `command` | `auto-handoff:handoff` | Slash command to run, as you would type it, with any arguments after its name |

Set them with `/plugin configure auto-handoff` inside Claude Code, or from a shell:

```
echo '{"command": "my-plugin:my-handoff"}' | claude plugin configure auto-handoff@auto-handoff --values-stdin
```

Arguments go after the command's name, as they would at the prompt. A command that behaves differently when nobody is there can be told so: `my-plugin:park idle-triggered`.

A command of your own has to get through an unattended run. Give it `allowed-tools` for whatever it calls, or run your sessions in a permission mode that lets it write.

## Limits

- The default of 50 assumes the one-hour cache. A session that has dropped to the five-minute cache, as happens in usage overage, needs a much smaller `minutes`. The plugin cannot tell which cache a session has.
- The handoff is a turn like any other. Each model request in it costs one cached read of the conversation, and the turn keeps the cache warm for another hour.
- The timer lives in the Claude Code process, so it stops when you quit Claude Code.
- A model that reaches for a tool the command has not pre-approved leaves the turn waiting at a permission prompt until you return.

## Development

```
git clone https://github.com/obie/auto-handoff ~/projects/auto-handoff
ln -s ~/projects/auto-handoff ~/.claude/skills/auto-handoff
```

Claude Code loads the linked folder as `auto-handoff@skills-dir` at the next session start and reloads the hooks module when you save a file.

```
claude plugin validate .
claude plugin test .
```

The pieces:

- `hooks/register.ts` is the hooks module: an idle timer armed at `turn.complete` and cancelled at `turn.start`.
- `types/index.d.ts` declares the two values the module keeps in `$.state`.
- `skills/handoff/SKILL.md` is the bundled handoff skill.
- `tests/` runs under `claude plugin test` against a mocked clock.

## License

MIT
