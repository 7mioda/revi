import { createParamDecorator } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

/**
 * Extracts the verified Clerk userId from the current request.
 * Returns `null` when ClerkGuard is in no-op mode (CLERK_SECRET_KEY not set).
 *
 * @example
 * async myEndpoint(@CurrentUser() userId: string | null) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null =>
    ctx.switchToHttp().getRequest<Request>().clerkUserId ?? null,
)
