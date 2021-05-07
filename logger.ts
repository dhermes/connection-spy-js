import * as logform from 'logform'
import * as winston from 'winston'

function addLogTimestamp(info: logform.TransformableInfo, _opts?: any): logform.TransformableInfo | boolean {
  info._timestamp = new Date().toISOString()
  return info
}

const jsonLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(winston.format.splat(), winston.format(addLogTimestamp)(), winston.format.json()),
})

export const debug = jsonLogger.debug.bind(jsonLogger)
