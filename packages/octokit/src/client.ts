import type { PaginateInterface } from '@octokit/plugin-paginate-rest'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { retry } from '@octokit/plugin-retry'
import { throttling } from '@octokit/plugin-throttling'
import { Octokit } from '@octokit/rest'

/**
 * The fully-composed Octokit client type — includes REST helpers (via
 * `@octokit/rest`), automatic pagination, exponential-backoff retry, and
 * rate-limit throttling.
 *
 * Consumers of `@revi/octokit` should only reference this type; they must
 * never import from any `@octokit/*` package directly.
 */
export type OctokitClient = Octokit & { paginate: PaginateInterface }

/**
 * Assembles a configured Octokit instance with all required plugins applied:
 * - `@octokit/plugin-paginate-rest` — automatic pagination via `client.paginate()`
 * - `@octokit/plugin-retry` — exponential backoff on 5xx responses
 * - `@octokit/plugin-throttling` — gracefully handles primary and secondary
 *   GitHub rate limits by logging a warning and retrying (never throws)
 *
 * @param token - A GitHub personal access token or OAuth token.
 * @returns A fully configured `OctokitClient`.
 */
export function createOctokitClient(token: string): OctokitClient {
  const OctokitWithPlugins = Octokit.plugin(paginateRest, retry, throttling)
  // The composed instance is a superset of OctokitClient; the cast is safe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new OctokitWithPlugins({
    auth: token,
    throttle: {
      // Structural type for `octokit` — we only need `log.warn`, which avoids
      // a circular reference back to the full OctokitClient type.
      onRateLimit: (retryAfter: number, _options: unknown, octokit: { log: { warn: (msg: string) => void } }) => {
        octokit.log.warn(`Primary rate limit hit — retrying after ${retryAfter}s`)
        return true // instruct throttling plugin to retry
      },
      onSecondaryRateLimit: (retryAfter: number, _options: unknown, octokit: { log: { warn: (msg: string) => void } }) => {
        octokit.log.warn(`Secondary rate limit hit — retrying after ${retryAfter}s`)
        return true // instruct throttling plugin to retry
      },
    },
  }) as OctokitClient
}
