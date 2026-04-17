import type { PaginateInterface } from '@octokit/plugin-paginate-rest';
import { Octokit } from '@octokit/rest';
/**
 * The fully-composed Octokit client type — includes REST helpers (via
 * `@octokit/rest`), automatic pagination, exponential-backoff retry, and
 * rate-limit throttling.
 *
 * Consumers of `@revi/octokit` should only reference this type; they must
 * never import from any `@octokit/*` package directly.
 */
export type OctokitClient = Octokit & {
    paginate: PaginateInterface;
};
/**
 * Assembles a configured Octokit instance with all required plugins applied:
 * - `@octokit/plugin-paginate-rest` — automatic pagination via `client.paginate()`
 * - `@octokit/plugin-retry` — exponential backoff on 5xx responses
 * - `@octokit/plugin-throttling` — gracefully handles primary and secondary
 *   GitHub rate limits by logging a warning and retrying (never throws)
 *
 * @param token - Optional GitHub personal access token or OAuth token.
 *   When omitted the client operates as an anonymous user — public resources
 *   are still accessible, subject to the unauthenticated rate limit (60 req/h).
 * @returns A fully configured `OctokitClient`.
 */
export declare function createOctokitClient(token?: string): OctokitClient;
//# sourceMappingURL=client.d.ts.map