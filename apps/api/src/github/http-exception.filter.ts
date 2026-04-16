import 'reflect-metadata'
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'

/** Shape of GitHub API error responses (e.g. 404, 401, 403). */
interface GitHubApiError {
  status?: number
  message?: string
}

function isGitHubApiError(err: unknown): err is GitHubApiError {
  return typeof err === 'object' && err !== null && 'status' in err
}

function mapGitHubStatus(status: number, message: string | undefined): [number, string] {
  if (status === 401) return [HttpStatus.UNAUTHORIZED, 'GitHub authentication failed']
  if (status === 404) return [HttpStatus.NOT_FOUND, 'GitHub resource not found']
  if (status === 403 || status === 429 || message?.includes('rate limit') === true) {
    return [HttpStatus.TOO_MANY_REQUESTS, 'GitHub rate limit exceeded']
  }
  return [HttpStatus.BAD_GATEWAY, `Upstream GitHub error: ${message ?? 'unknown'}`]
}

/**
 * Global exception filter that maps GitHub API errors and NestJS
 * `HttpException` instances to well-formed JSON error responses.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      res.status(status).json({ statusCode: status, message: exception.message })
      return
    }

    if (isGitHubApiError(exception) && exception.status !== undefined) {
      const [status, message] = mapGitHubStatus(exception.status, exception.message)
      this.logger.warn(`GitHub API error ${exception.status}: ${exception.message ?? ''}`)
      res.status(status).json({ statusCode: status, message })
      return
    }

    this.logger.error('Unhandled exception', exception)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    })
  }
}
