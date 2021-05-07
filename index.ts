import * as https from 'https'

/**
 * monkeyPatch should be invoked before **any** code that does `https` operations.
 * For example, code that prepopulates a connection pool at application start.
 */
export function monkeyPatch(): void {
  const originalHttpsAgent = https.Agent

  class SpyAgent extends originalHttpsAgent {
    constructor(options?: https.AgentOptions) {
      // NOTE: This derived class isn't strictly necessary, but we put it here
      //       in case future customizations are desired. For example, registering
      //       a default keylogger for cases where an `Agent` is spawned multiple library
      //       calls deep and the application code doesn't have access to it:
      //       >> this.on('keylog', keylogCallback)
      super(options)
    }
  }

  // @ts-ignore
  https.Agent = SpyAgent
}
