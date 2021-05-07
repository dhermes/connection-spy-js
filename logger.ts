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

import * as logform from 'logform'
import * as winston from 'winston'

function addLogTimestamp(info: logform.TransformableInfo, _opts?: any): logform.TransformableInfo | boolean {
  info._timestamp = new Date().toISOString()
  return info
}

const jsonLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(winston.format.splat(), winston.format(addLogTimestamp)(), winston.format.json()),
  exitOnError: false,
  transports: [new winston.transports.Console()],
})

export const debug = jsonLogger.debug.bind(jsonLogger)
