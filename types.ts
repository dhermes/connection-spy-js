import * as http from 'http'
import * as net from 'net'

export type OncreateCallback = (err: Error | null, socket?: net.Socket) => void

interface prototypeFields {
  createSocket: (req: http.ClientRequest, options: http.ClientRequestArgs, oncreate: OncreateCallback) => void
}

export interface AgentType {
  prototype: prototypeFields
}
