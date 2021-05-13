/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as http from 'http'
import * as https from 'https'
import * as net from 'net'
import * as uuid from 'uuid'

import * as logger from './logger'
import * as types from './types'

const SPY_PRODUCER = 'connection-spy'

/**
 * monkeyPatch should be invoked before **any** code that does `http` or `https` operations.
 * For example, code that prepopulates a connection pool at application start.
 */
export function monkeyPatch(debug: types.DebugLog = logger.debug): void {
  monkeyPatchHTTP(debug)
  monkeyPatchHTTPS(debug)
}

function monkeyPatchHTTP(debug: types.DebugLog): void {
  const originalHttpAgent = http.Agent

  class SpyAgent extends originalHttpAgent {
    constructor(options?: http.AgentOptions) {
      // NOTE: This derived class isn't strictly necessary, but we put it here
      //       in case future customizations are desired.
      super(options)
    }
  }

  monkeyPatchAgentCreateSocket((SpyAgent as unknown) as types.AgentType, debug)
  monkeyPatchAgentReuseSocket((SpyAgent as unknown) as types.AgentType, debug)
  // @ts-ignore
  http.Agent = SpyAgent
}

function monkeyPatchHTTPS(debug: types.DebugLog): void {
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
  target: types.Target,
  socket: net.Socket,
  debug: types.DebugLog = logger.debug,
): void {
  stashID(socket, id)
  socket.on('connect', makeSocketConnectCallback(id, target, debug))
  socket.on('error', makeSocketErrorCallback(id, debug))
  socket.on('timeout', makeSocketTimeoutCallback(id, debug))
  socket.on('end', makeSocketEndCallback(id, debug))
  socket.on('close', makeSocketCloseCallback(id, debug))
}

/**
 * Stash the ID on the socket (in case the socket is reused).
 * @param socket
 * @param id
 */
function stashID(socket: net.Socket, id: string): void {
  // @ts-ignore
  socket._connection_spy_id = id
}

/**
 * Check if there is an ID stashed on the socket.
 * @param socket
 */
function getStashedID(socket: net.Socket): string | undefined {
  // @ts-ignore
  return socket._connection_spy_id
}

function monkeyPatchAgentCreateSocket(derivedAgent: types.AgentType, debug: types.DebugLog): void {
  const originalCreateSocket = derivedAgent.prototype.createSocket
  derivedAgent.prototype.createSocket = function createSocket(
    req: http.ClientRequest,
    options: http.ClientRequestArgs,
    cb: types.OncreateCallback,
  ): void {
    const id = uuid.v4()
    const target = requestTarget(req)
    req.on('socket', makeClientRequestSocketCallback(id, target, debug))
    req.on('response', makeClientRequestResponseCallback(id, target, debug))

    originalCreateSocket.apply(this, [req, options, cb])
  }
}

function monkeyPatchAgentReuseSocket(derivedAgent: types.AgentType, debug: types.DebugLog): void {
  const originalReuseSocket = derivedAgent.prototype.reuseSocket
  derivedAgent.prototype.reuseSocket = function reuseSocket(socket: net.Socket, req: http.ClientRequest): void {
    const id = getStashedID(socket) || uuid.v4()
    const target = requestTarget(req)
    const ctx = getContext(id, target, socket)
    debug('Reuse Socket', ctx)

    req.on('response', makeClientRequestResponseCallback(id, target, debug))
    const reuseSocketResult = originalReuseSocket.apply(this, [socket, req])
    return reuseSocketResult
  }
}

function requestTarget(req: http.ClientRequest): types.Target {
  return {
    method: req.method,
    protocol: req.protocol,
    host: req.host,
    path: req.path,
  }
}

function formatTarget(target: types.Target | undefined): string | undefined {
  if (target === undefined) {
    return undefined
  }
  return `${target.method} ${target.protocol}//${target.host}:${target.port}${target.path}`
}

function maybeSetPort(socket: net.Socket, target: types.Target): void {
  if (target.port !== undefined) {
    return
  }

  if (socket.remotePort) {
    target.port = socket.remotePort
  }
}

function maybeSetProtocol(socket: net.Socket, target: types.Target): void {
  if (target.protocol !== undefined) {
    return
  }

  if (socket.constructor.name == 'TLSSocket') {
    target.protocol = 'https:'
    return
  }
  // NOTE: This **assumes** that the only connections in use will be HTTP / HTTPS.
  if (socket.constructor.name == 'Socket') {
    target.protocol = 'http:'
    return
  }
}

function maybeSetHost(socket: net.Socket, target: types.Target): void {
  if (target.host !== undefined) {
    return
  }

  const host: string | undefined = (socket as any)._host
  if (typeof host === 'string') {
    target.host = host
  }
}

function maybeUpdateFromSocket(socket: net.Socket, target: types.Target | undefined): void {
  if (target === undefined) {
    return
  }
  maybeSetPort(socket, target)
  maybeSetProtocol(socket, target)
  maybeSetHost(socket, target)
}

function getContext(id: string, target: types.Target | undefined, socket: net.Socket): types.Context {
  maybeUpdateFromSocket(socket, target)
  return {
    id,
    producer: SPY_PRODUCER,
    localAddress: socket.localAddress || null,
    localPort: socket.localPort || null,
    remoteAddress: socket.remoteAddress || null,
    remotePort: socket.remotePort || null,
    target: formatTarget(target),
  }
}

function makeClientRequestResponseCallback(
  id: string,
  target: types.Target,
  debug: types.DebugLog,
): types.ClientRequestResponseCallback {
  return function clientRequestResponse(response: http.IncomingMessage): void {
    const ctx = getContext(id, target, response.socket)
    debug('HTTP(S) Response', ctx)
  }
}

function makeClientRequestSocketCallback(
  id: string,
  target: types.Target,
  debug: types.DebugLog,
): types.ClientRequestSocketCallback {
  return function clientRequestSocket(socket: net.Socket): void {
    spyNewSocket(id, target, socket, debug)
  }
}

function makeSocketConnectCallback(
  id: string,
  target: types.Target,
  debug: types.DebugLog,
): types.SocketConnectCallback {
  return function socketConnect(this: net.Socket): void {
    const ctx = getContext(id, target, this)
    debug('Socket Connect', ctx)
  }
}

function makeSocketErrorCallback(id: string, debug: types.DebugLog): types.SocketErrorCallback {
  return function socketError(this: net.Socket, err: Error): void {
    const ctx = getContext(id, undefined, this)
    debug('Socket Error', { ...ctx, err })
  }
}

function makeSocketTimeoutCallback(id: string, debug: types.DebugLog): types.SocketTimeoutCallback {
  return function socketTimeout(this: net.Socket): void {
    const ctx = getContext(id, undefined, this)
    debug('Socket Timeout', ctx)
  }
}

function makeSocketEndCallback(id: string, debug: types.DebugLog): types.SocketEndCallback {
  return function socketEnd(this: net.Socket): void {
    const ctx = getContext(id, undefined, this)
    debug('Socket End', ctx)
  }
}

function makeSocketCloseCallback(id: string, debug: types.DebugLog): types.SocketCloseCallback {
  return function socketClose(this: net.Socket, hadError: boolean): void {
    const ctx = getContext(id, undefined, this)
    debug('Socket Close', { ...ctx, hadError })
  }
}
