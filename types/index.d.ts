/**
 * When the main loop last went idle, in `$.clock.now()`'s milliseconds; null
 * while a turn runs, once the handoff has run, and after a /clear.
 */
export type IdleSince = number | null

declare module 'claude-code' {
  interface PluginState {
    'auto-handoff': { idleSince: IdleSince; isDone: boolean }
  }
}
