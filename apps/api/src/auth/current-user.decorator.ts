import { createParamDecorator } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

/**
 * Extracts the verified Clerk userId from the current request.
 * Returns `null` when Guard is in no-op mode (CLERK_SECRET_KEY not set).
 *
 * @example
 * async myEndpoint(@User() userId: string | null) { ... }
 */
export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null =>
    ctx.switchToHttp().getRequest<Request>().clerkUserId ?? null,
)
