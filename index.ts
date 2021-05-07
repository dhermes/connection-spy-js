import * as http from 'http'
import * as https from 'https'
import * as net from 'net'
import * as uuid from 'uuid'

import * as logger from './logger'
import * as types from './types'

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

  monkeyPatchAgentCreateSocket((SpyAgent as unknown) as types.AgentType)
  monkeyPatchAgentReuseSocket((SpyAgent as unknown) as types.AgentType)
  // @ts-ignore
  https.Agent = SpyAgent
}

function monkeyPatchAgentCreateSocket(derivedAgent: types.AgentType): void {
  const originalCreateSocket = derivedAgent.prototype.createSocket
  derivedAgent.prototype.createSocket = function createSocket(
    req: http.ClientRequest,
    options: http.ClientRequestArgs,
    cb: types.OncreateCallback,
  ): void {
    originalCreateSocket.apply(this, [req, options, cb])
  }
}

function monkeyPatchAgentReuseSocket(derivedAgent: types.AgentType): void {
  const originalReuseSocket = derivedAgent.prototype.reuseSocket
  derivedAgent.prototype.reuseSocket = function reuseSocket(socket: net.Socket, request: http.ClientRequest): void {
    const id = uuid.v4()
    logger.debug('Reuse Socket', { id })
    const reuseSocketResult = originalReuseSocket.apply(this, [socket, request])
    return reuseSocketResult
  }
}
