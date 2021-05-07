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
import * as net from 'net'

export type OncreateCallback = (err: Error | null, socket?: net.Socket) => void
export type ClientRequestResponseCallback = (response: http.IncomingMessage) => void
export type ClientRequestSocketCallback = (socket: net.Socket) => void
export type SocketConnectCallback = (this: net.Socket) => void
export type SocketErrorCallback = (this: net.Socket, err: Error) => void
export type SocketTimeoutCallback = (this: net.Socket) => void
export type SocketEndCallback = (this: net.Socket) => void
export type SocketCloseCallback = (this: net.Socket, hadError: boolean) => void

interface prototypeFields {
  createSocket: (req: http.ClientRequest, options: http.ClientRequestArgs, oncreate: OncreateCallback) => void
  reuseSocket: (socket: net.Socket, request: http.ClientRequest) => void
}

export interface AgentType {
  prototype: prototypeFields
}

export interface Context {
  id: string
  producer: string
  localAddress: string | null
  localPort: number | null
  remoteAddress: string | null
  remotePort: number | null
  target?: string
}
