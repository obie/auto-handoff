import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const MINUTE = 60_000
const HANDOFF = 'auto-handoff:handoff'

const turn = (turnId: string) => ({
  turnId,
  answer: 'done',
  durationMs: 1000,
  isAborted: false,
  reason: 'answer' as const,
})

const prompt = (kind: 'composer' | 'task-notification') => ({
  text: 'next',
  wait: false,
  origin: { kind },
})

// The engine beneath the plugin: a clock the test moves, and the commands
// the plugin ran.
const engine = (on: On) => {
  const clock = mock.clock(on)
  const ran: string[] = []
  const args: string[] = []

  on('command.run', (_$, e) => {
    ran.push(e.command)
    args.push(e.args)

    return { text: '' }
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))

  return { clock, ran, args }
}

test('runs the handoff once the session sat idle for 50 minutes', async ($, on) => {
  const { clock, ran } = engine(on)

  await $.turn.complete(turn('t1'))
  await clock.advance(49 * MINUTE)
  expect(ran).toEqual([])

  await clock.advance(MINUTE)
  expect(ran).toEqual([HANDOFF])
})

test('a new turn starts the wait over', async ($, on) => {
  const { clock, ran } = engine(on)

  await $.turn.complete(turn('t1'))
  await clock.advance(30 * MINUTE)
  await $.turn.start({ text: 'next', turnId: 't2' })
  await clock.advance(30 * MINUTE)
  expect(ran).toEqual([])

  await $.turn.complete(turn('t2'))
  await clock.advance(49 * MINUTE)
  expect(ran).toEqual([])

  await clock.advance(MINUTE)
  expect(ran).toEqual([HANDOFF])
})

test('hands off once until the person is back', async ($, on) => {
  const { clock, ran } = engine(on)

  await $.turn.complete(turn('t1'))
  await clock.advance(50 * MINUTE)
  expect(ran).toEqual([HANDOFF])

  // The handoff's own turn ends, then a background task reports in.
  await $.turn.start({ text: '', turnId: 't2' })
  await $.turn.complete(turn('t2'))
  await $.prompt.submit(prompt('task-notification'))
  await $.turn.start({ text: 'next', turnId: 't3' })
  await $.turn.complete(turn('t3'))
  await clock.advance(120 * MINUTE)
  expect(ran).toEqual([HANDOFF])

  await $.prompt.submit(prompt('composer'))
  await $.turn.start({ text: 'next', turnId: 't4' })
  await $.turn.complete(turn('t4'))
  await clock.advance(50 * MINUTE)
  expect(ran).toEqual([HANDOFF, HANDOFF])
})

test("a subagent's turn does not start the wait", async ($, on) => {
  const { clock, ran } = engine(on)

  await $.turn.complete({ ...turn('t1'), agentId: 'agent-1' })
  await clock.advance(120 * MINUTE)
  expect(ran).toEqual([])
})

test('a /clear drops the wait', async ($, on) => {
  const { clock, ran } = engine(on)

  await $.turn.complete(turn('t1'))
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  await clock.advance(120 * MINUTE)
  expect(ran).toEqual([])
})

test('skips the handoff when the machine slept through the wait', async ($, on) => {
  const { clock, ran } = engine(on)
  // The mocked clock fires a timer the moment it is due, so the sleep is told
  // the other way round: the idle clock is recorded three hours back.
  on('state.set', { plugin: 'auto-handoff', key: 'idleSince' }, (_$, e, next) =>
    next(typeof e.value === 'number' ? { ...e, value: e.value - 180 * MINUTE } : e),
  )

  await $.turn.complete(turn('t1'))
  await clock.advance(50 * MINUTE)
  expect(ran).toEqual([])

  await clock.advance(120 * MINUTE)
  expect(ran).toEqual([])
})

test(
  'takes its minutes and its command from the options',
  { options: { minutes: 5, command: '/context-save' } },
  async ($, on) => {
    const { clock, ran } = engine(on)

    await $.turn.complete(turn('t1'))
    await clock.advance(4 * MINUTE)
    expect(ran).toEqual([])

    await clock.advance(MINUTE)
    expect(ran).toEqual(['context-save'])
  },
)

test(
  'passes whatever follows the command name on as its arguments',
  { options: { minutes: 5, command: '/my-plugin:park  idle-triggered checkpoint' } },
  async ($, on) => {
    const { clock, ran, args } = engine(on)

    await $.turn.complete(turn('t1'))
    await clock.advance(5 * MINUTE)
    expect(ran).toEqual(['my-plugin:park'])
    expect(args).toEqual(['idle-triggered checkpoint'])
  },
)
