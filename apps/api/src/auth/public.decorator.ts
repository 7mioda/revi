import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/**
 * Marks a route as public — the ClerkGuard will allow it through without
 * requiring an Authorization header, even when CLERK_SECRET_KEY is set.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
