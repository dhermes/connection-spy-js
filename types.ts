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
  localAddress: string
  localPort: number
  remoteAddress: string | null
  remotePort: number | null
  target?: string
}
