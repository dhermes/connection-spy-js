import * as http from 'http'
import * as https from 'https'
import * as net from 'net'
import * as uuid from 'uuid'
import * as winston from 'winston'

import * as logger from './logger'
import * as types from './types'

const PORT_SENTINEL = '${PORT_8750beb7c50c}'
const SPY_PRODUCER = 'connection-spy'

/**
 * monkeyPatch should be invoked before **any** code that does `https` operations.
 * For example, code that prepopulates a connection pool at application start.
 */
export function monkeyPatch(debug: winston.LeveledLogMethod = logger.debug): void {
  monkeyPatchHTTPS(debug)
}

function monkeyPatchHTTPS(debug: winston.LeveledLogMethod): void {
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

  monkeyPatchAgentCreateSocket((SpyAgent as unknown) as types.AgentType, debug)
  monkeyPatchAgentReuseSocket((SpyAgent as unknown) as types.AgentType, debug)
  // @ts-ignore
  https.Agent = SpyAgent
}

export function spyNewSocket(
  id: string,
  targetTemplate: string,
  socket: net.Socket,
  debug: winston.LeveledLogMethod = logger.debug,
): void {
  socket.on('connect', makeSocketConnectCallback(id, targetTemplate, debug))
  socket.on('error', makeSocketErrorCallback(id, debug))
  socket.on('timeout', makeSocketTimeoutCallback(id, debug))
  socket.on('end', makeSocketEndCallback(id, debug))
  socket.on('close', makeSocketCloseCallback(id, debug))
}

function monkeyPatchAgentCreateSocket(derivedAgent: types.AgentType, debug: winston.LeveledLogMethod): void {
  const originalCreateSocket = derivedAgent.prototype.createSocket
  derivedAgent.prototype.createSocket = function createSocket(
    req: http.ClientRequest,
    options: http.ClientRequestArgs,
    cb: types.OncreateCallback,
  ): void {
    const id = uuid.v4()
    const targetTemplate = requestTargetTemplate(req)
    req.on('socket', makeClientRequestSocketCallback(id, targetTemplate, debug))
    req.on('response', makeClientRequestResponseCallback(id, targetTemplate, debug))

    originalCreateSocket.apply(this, [req, options, cb])
  }
}

function monkeyPatchAgentReuseSocket(derivedAgent: types.AgentType, debug: winston.LeveledLogMethod): void {
  const originalReuseSocket = derivedAgent.prototype.reuseSocket
  derivedAgent.prototype.reuseSocket = function reuseSocket(socket: net.Socket, req: http.ClientRequest): void {
    const id = uuid.v4()
    const targetTemplate = requestTargetTemplate(req)
    const ctx = getContext(id, targetTemplate, socket)
    debug('Reuse Socket', ctx)

    req.on('response', makeClientRequestResponseCallback(id, targetTemplate, debug))
    const reuseSocketResult = originalReuseSocket.apply(this, [socket, req])
    return reuseSocketResult
  }
}

function requestTargetTemplate(req: http.ClientRequest): string {
  return `${req.method} ${req.protocol}//${req.host}:${PORT_SENTINEL}${req.path}`
}

function getContext(id: string, targetTemplate: string, socket: net.Socket): types.Context {
  const port = socket.remotePort || null
  const fullTarget = targetTemplate.replace(PORT_SENTINEL, `${port}`)
  return {
    id,
    producer: SPY_PRODUCER,
    localAddress: socket.localAddress,
    localPort: socket.localPort,
    remoteAddress: socket.remoteAddress || null,
    remotePort: port,
    target: fullTarget,
  }
}

function makeClientRequestResponseCallback(
  id: string,
  targetTemplate: string,
  debug: winston.LeveledLogMethod,
): types.ClientRequestResponseCallback {
  return function clientRequestResponse(response: http.IncomingMessage): void {
    const ctx = getContext(id, targetTemplate, response.socket)
    debug('HTTP(S) Response', ctx)
  }
}

function makeClientRequestSocketCallback(
  id: string,
  targetTemplate: string,
  debug: winston.LeveledLogMethod,
): types.ClientRequestSocketCallback {
  return function clientRequestSocket(socket: net.Socket): void {
    spyNewSocket(id, targetTemplate, socket, debug)
  }
}

function makeSocketConnectCallback(
  id: string,
  targetTemplate: string,
  debug: winston.LeveledLogMethod,
): types.SocketConnectCallback {
  return function socketConnect(this: net.Socket): void {
    const ctx = getContext(id, targetTemplate, this)
    debug('Socket Connect', ctx)
  }
}

function makeSocketErrorCallback(id: string, debug: winston.LeveledLogMethod): types.SocketErrorCallback {
  return function socketError(this: net.Socket, err: Error): void {
    const ctx = getContext(id, '', this)
    delete ctx.target
    debug('Socket Error', { ...ctx, err })
  }
}

function makeSocketTimeoutCallback(id: string, debug: winston.LeveledLogMethod): types.SocketTimeoutCallback {
  return function socketTimeout(this: net.Socket): void {
    const ctx = getContext(id, '', this)
    delete ctx.target
    debug('Socket Timeout', ctx)
  }
}

function makeSocketEndCallback(id: string, debug: winston.LeveledLogMethod): types.SocketEndCallback {
  return function socketEnd(this: net.Socket): void {
    const ctx = getContext(id, '', this)
    delete ctx.target
    debug('Socket End', ctx)
  }
}

function makeSocketCloseCallback(id: string, debug: winston.LeveledLogMethod): types.SocketCloseCallback {
  return function socketClose(this: net.Socket, hadError: boolean): void {
    const ctx = getContext(id, '', this)
    delete ctx.target
    debug('Socket Close', { ...ctx, hadError })
  }
}
