import 'reflect-metadata'
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { verifyToken } from '@clerk/backend'
import type { Request } from 'express'
import { IS_PUBLIC_KEY } from './public.decorator.js'
import type { Env } from '../config.js'

declare module 'express' {
  interface Request {
    clerkUserId: string | null
  }
}

@Injectable()
export class ClerkGuard implements CanActivate {
  private readonly secretKey: string | undefined
  private readonly logger = new Logger(ClerkGuard.name)

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    private readonly reflector: Reflector,
  ) {
    this.secretKey = config.get('CLERK_SECRET_KEY', { infer: true })
    if (!this.secretKey) {
      this.logger.warn('CLERK_SECRET_KEY not set — ClerkGuard is running in no-op mode (all requests allowed)')
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Routes decorated with @Public() always pass through
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<Request>()

    // No-op mode: key not configured — allow all, set userId null
    if (!this.secretKey) {
      req.clerkUserId = null
      return true
    }

    const authorization = req.headers['authorization']
    if (!authorization) {
      throw new UnauthorizedException('Missing Authorization header')
    }

    const [scheme, token] = authorization.split(' ')
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header format')
    }

    try {
      const payload = await verifyToken(token, { secretKey: this.secretKey })
      req.clerkUserId = payload.sub
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}
