import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  PromptOrigin,
  Register,
  Timer,
} from 'claude-code'

import type { IdleSince } from '../types'

const MINUTE = 60_000
const DEFAULT_MINUTES = 50

// How late the timer may fire, as a share of the wait. A machine that slept
// through the wait wakes with the cache already cold, and a handoff then
// rereads the whole conversation at full price with nobody there to want it.
const LATE_SHARE = 0.1

// The origins that mean the person is back. A background task's notification
// or a scheduled trigger starts a turn too, and neither says anyone is here.
const PERSON: ReadonlySet<PromptOrigin['kind']> = new Set([
  'composer',
  'bridge',
  'sdk',
  'slack-ping',
  'auto-continuation',
])

const idleSince = atom(
  { plugin: 'auto-handoff', key: 'idleSince' } as const,
  null as IdleSince,
)
const isDone = atom({ plugin: 'auto-handoff', key: 'isDone' } as const, false)

type Plan = { wait: number; command: string }

let timer: Timer | undefined

function disarm() {
  timer?.cancel()
  timer = undefined
}

async function handOff($: EngineInterface, { wait, command }: Plan) {
  timer = undefined
  const since = await read($, idleSince)

  // A turn started as the timer fired: the session is not idle after all.
  if (since === null) {
    return
  }

  await update($, idleSince, () => null)
  // Set before the command runs, so its own turn does not arm the timer
  // again and hand off every `wait` for as long as the person is away.
  await update($, isDone, () => true)
  const idle = (await $.clock.now()) - since
  const minutes = Math.round(idle / MINUTE)

  if (idle - wait > wait * LATE_SHARE) {
    $.ui.toast(`idle for ${minutes} min, cache already cold: /${command} skipped`)

    return
  }

  $.ui.toast(`idle for ${minutes} min, running /${command}`)

  try {
    await $.command.run({ command })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    $.ui.toast(`/${command} did not run: ${reason}`)
  }
}

function arm($: EngineInterface, ms: number, plan: Plan) {
  disarm()
  timer = $.clock.after(ms, () => void handOff($, plan))
}

async function wake($: EngineInterface, origin: PromptOrigin) {
  if (PERSON.has(origin.kind)) {
    await update($, isDone, () => false)
  }
}

export const register: Register = (on, options) => {
  const minutes = Number(options.minutes)
  const plan: Plan = {
    wait: (minutes > 0 ? minutes : DEFAULT_MINUTES) * MINUTE,
    command: String(options.command).replace(/^\//, ''),
  }

  // A reload drops the timer and keeps the state: pick the wait up where it
  // stood, so an edit to this file half an hour in does not push it out.
  on('session.start', async ($, e, next) => {
    const since = await read($, idleSince)

    if (since !== null) {
      const now = await $.clock.now()
      arm($, Math.max(0, since + plan.wait - now), plan)
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await wake($, e.origin)

    return next(e)
  })

  on('command.run', async ($, e, next) => {
    await wake($, e.origin)

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    disarm()
    await update($, idleSince, () => null)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const isMainLoop = e.agentId === undefined

    if (isMainLoop && !(await read($, isDone))) {
      const now = await $.clock.now()
      await update($, idleSince, () => now)
      arm($, plan.wait, plan)
    }

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    disarm()
    await update($, idleSince, () => null)
    await update($, isDone, () => false)

    return next(e)
  })
}
