import { ecsFormat } from '@elastic/ecs-pino-format'
import { randomUUID } from 'crypto'
import { IncomingMessage, ServerResponse } from 'http'
import type { Params } from 'nestjs-pino'
import { pino } from 'pino'
import { err as errorSerializer } from 'pino-std-serializers'

import { env } from '@/env/schema'

import { CustomException } from './types'

export const pinoHttp: Params['pinoHttp'] = {
  level: env.NODE_ENV === 'test' ? 'warn' : 'info',
  logger: pino(ecsFormat({ convertReqRes: true })),
  quietReqLogger: true,
  genReqId: () => {
    return randomUUID()
  },
  redact: {
    paths: ['req.headers.cookie', 'http.response.headers["set-cookie"]'],
    remove: true,
  },
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn'
    } else if (res.statusCode >= 500 || err) {
      return 'error'
    }
    return 'info'
  },
  customSuccessMessage: (req, res) => `${req.method ?? ''} ${req.url ?? ''} ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method ?? ''} ${req.url ?? ''} ${res.statusCode}: ${err.name} - ${err.message}`,
  customErrorObject: (req: IncomingMessage, res: ServerResponse<IncomingMessage>, error: CustomException) => {
    const loggedErrorObject = {
      res,
      error: {
        message: error.message,
        statusCode: error.status,
        stackTrace: error.stack,
        errorDetailMessage: error.options?.cause?.message,
        action: error.options?.cause?.action,
        meta: error.options?.cause?.meta,
      },
    }

    // Serialize error object
    const rawErrorObject = error.options?.cause?.meta?.error
    if (rawErrorObject) {
      loggedErrorObject.error.meta = {
        ...loggedErrorObject.error.meta,
        error: errorSerializer(rawErrorObject as Error),
      }
    }

    return loggedErrorObject
  },
}
