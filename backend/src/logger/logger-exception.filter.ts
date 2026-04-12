import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common'
import type { HttpAdapterHost } from '@nestjs/core'
import { Response } from 'express'

@Catch()
export class LoggerExceptionFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost
    const response: Response = host.switchToHttp().getResponse()
    response.err = error

    const httpException = error instanceof HttpException ? error : new InternalServerErrorException()

    httpAdapter.reply(response, httpException.getResponse(), httpException.getStatus())
  }
}
